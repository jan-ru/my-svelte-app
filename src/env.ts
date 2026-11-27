import { defineEnvVars } from '@sveltejs/kit/env';

// All optional: a missing value must not crash the app. The /financials code fails closed
// (locked page, "not configured" messages) when the login's variables (GOOGLE_CLIENT_ID,
// GOOGLE_CLIENT_SECRET, ALLOWED_EMAILS, SESSION_SECRET) or, for a source, its API key (FMP_API_KEY, EULERPOOL_API_KEY) is unset.
const optional = (value: string | undefined) => value || undefined;

export const variables = defineEnvVars({
	SESSION_SECRET: {
		schema: optional,
		description: 'HMAC secret that signs the site-wide session cookie, the sign-in state cookie and the log hash'
	},
	GOOGLE_CLIENT_ID: { schema: optional, description: 'OAuth client id for Sign in with Google' },
	GOOGLE_CLIENT_SECRET: { schema: optional, description: 'OAuth client secret for Sign in with Google' },
	ALLOWED_EMAILS: {
		schema: optional,
		description: 'Comma-separated Google addresses that may log in; unset lets nobody in'
	},
	ADMIN_EMAILS: {
		schema: optional,
		description:
			'Comma-separated addresses, each also on ALLOWED_EMAILS, that get every page and /settings; unset means no admin'
	},
	PAGE_ACCESS: {
		schema: optional,
		description:
			'Which pages each signed-in address may use, e.g. "a@x.test=*; b@y.test=/financials,/countries" (ADR-015); unset grants none'
	},
	FMP_API_KEY: { schema: optional, description: 'Financial Modeling Prep API key' },
	EULERPOOL_API_KEY: { schema: optional, description: 'Eulerpool API key' },
	ISR_BYPASS_TOKEN: {
		schema: optional,
		description:
			'Random string (32+ characters) that lets a logged-in browser skip the ISR cache; unset turns the cache off'
	}
});
