// src/lib/server/google.ts
// Sign in with Google (OpenID Connect, authorization code with PKCE), through oauth4webapi: Web standards only, so
// it runs on Node, Cloudflare Workers and a VPS alike (ADR-014). No Google token or error text leaves this module.
import * as oauth from 'oauth4webapi';
import type { Pending } from './session';

export const CALLBACK_PATH = '/login/google/callback';
const TIMEOUT_MS = 10_000;

/** Google's endpoints, fixed, so no discovery request is needed. */
const GOOGLE: oauth.AuthorizationServer = {
	issuer: 'https://accounts.google.com',
	authorization_endpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
	token_endpoint: 'https://oauth2.googleapis.com/token',
	jwks_uri: 'https://www.googleapis.com/oauth2/v3/certs',
	id_token_signing_alg_values_supported: ['RS256']
};

export interface GoogleClient {
	readonly id: string;
	readonly secret: string;
}

const redirectUri = (origin: string): string => `${origin}${CALLBACK_PATH}`;

/** A new state, nonce and PKCE verifier for one sign-in. */
export function newPending(from: string | null): Pending {
	return {
		state: oauth.generateRandomState(),
		nonce: oauth.generateRandomNonce(),
		verifier: oauth.generateRandomCodeVerifier(),
		from
	};
}

/** Where to send the browser: Google's sign-in, asking only for the address. */
export async function authorizationUrl(client: GoogleClient, origin: string, pending: Pending): Promise<URL> {
	const url = new URL(GOOGLE.authorization_endpoint ?? '');
	url.searchParams.set('client_id', client.id);
	url.searchParams.set('redirect_uri', redirectUri(origin));
	url.searchParams.set('response_type', 'code');
	url.searchParams.set('scope', 'openid email');
	url.searchParams.set('state', pending.state);
	url.searchParams.set('nonce', pending.nonce);
	url.searchParams.set('code_challenge', await oauth.calculatePKCECodeChallenge(pending.verifier));
	url.searchParams.set('code_challenge_method', 'S256');
	return url;
}

export type SignInResult =
	| { readonly ok: true; readonly email: string }
	| { readonly ok: false; readonly reason: 'state' | 'google' | 'exchange' | 'unverified' };

/** The callback's parameters, checked against the state; or why not. */
function callbackParams(client: oauth.Client, callbackUrl: URL, state: string): URLSearchParams | 'state' | 'google' {
	try {
		return oauth.validateAuthResponse(GOOGLE, client, callbackUrl, state);
	} catch (error) {
		return error instanceof oauth.AuthorizationResponseError ? 'google' : 'state';
	}
}

/**
 * Exchanges the code and returns Google's verified address. oauth4webapi checks the ID token's issuer, audience,
 * expiry and nonce, and PKCE. The token comes straight from Google's token endpoint over TLS, so its signature need
 * not be checked (OpenID Connect Core 3.1.3.7).
 */
export async function finishSignIn(
	client: GoogleClient,
	callbackUrl: URL,
	pending: Pending,
	fetchFn: typeof fetch = fetch
): Promise<SignInResult> {
	const asClient: oauth.Client = { client_id: client.id };
	const params = callbackParams(asClient, callbackUrl, pending.state);
	if (typeof params === 'string') return { ok: false, reason: params };
	let claims: oauth.IDToken | undefined;
	try {
		const response = await oauth.authorizationCodeGrantRequest(
			GOOGLE,
			asClient,
			oauth.ClientSecretPost(client.secret),
			params,
			redirectUri(callbackUrl.origin),
			pending.verifier,
			{ [oauth.customFetch]: fetchFn, signal: AbortSignal.timeout(TIMEOUT_MS) }
		);
		const result = await oauth.processAuthorizationCodeResponse(GOOGLE, asClient, response, {
			expectedNonce: pending.nonce,
			requireIdToken: true
		});
		claims = oauth.getValidatedIdTokenClaims(result);
	} catch {
		return { ok: false, reason: 'exchange' };
	}
	const email = claims?.email;
	if (typeof email !== 'string' || claims?.email_verified !== true) return { ok: false, reason: 'unverified' };
	return { ok: true, email: email.toLowerCase() };
}
