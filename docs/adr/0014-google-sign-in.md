---
status: Accepted
date: 2026-11-26
decision-makers: Jan-Ru Muller (sole maintainer)
---
# ADR-014: Sign in with Google, limited to a list of permitted addresses

- **Accepted:** 2026-11-26, after the first working sign-in. Supersedes ADR-003's sign-in method (the shared
  password), not its split between public and logged-in views.
- **Spec:** `docs/superpowers/specs/2026-11-26-google-sign-in-design.md`, for #133.
- **Component:** `src/lib/server/session.ts`, `src/lib/server/google.ts`, `src/routes/login/`, `src/hooks.server.ts`

## Context

One shared password (`SITE_PASSWORD`) opened `/financials` and made the public pages interactive. Everyone who knew it
was the same user, a leaver could only be locked out by changing it for everyone, and the log could not say who
looked. The site may also move from Vercel to Cloudflare or a VPS (#175), so the login must not depend on one host.

## Decision

1. **Google is the only sign-in.** OpenID Connect, authorization code with PKCE, scopes `openid email`, through
   `oauth4webapi`, pinned exactly. It uses Web standards only, so it runs on Node, Cloudflare Workers and a VPS.
   `SITE_PASSWORD` and its rate limit are removed.
2. **Only addresses on `ALLOWED_EMAILS` get in.** Exact addresses, compared lower-cased, in an environment variable,
   never in the repository, which is public. Google must have verified the address. The list is checked at sign-in
   and on every request, so removing an address and redeploying ends that session.
3. **The session cookie carries the address,** signed with `SESSION_SECRET` (HMAC-SHA256, Web Crypto), for seven
   days. The state, nonce and verifier travel in a second signed cookie, valid for ten minutes and used once.
4. **No login on previews.** Google needs every callback URL registered in advance, and each preview has a new
   address. Logged-in work is tested locally and on production.
5. **Logs hold no addresses.** A login logs `login allowed`, `login refused` or `login failed` (an address Google has not verified is `login failed reason=unverified`), with an 8-character
   keyed hash of the address or a fixed reason.
6. **ADR-003's split stands.** The ISR bypass cookie, `isInteractive`, `isRevalidation` and `pageParams` are unchanged.

## Alternatives ruled out

- **Keep the password beside Google, or as a fallback.** A shared secret with all its rotation duties, kept for a
  case a revert of the release covers.
- **`arctic`.** Deprecated on npm.
- **Auth.js.** Replaces the session, cookies and pages, and sits badly with the ISR bypass cookie and the CSP.
- **Host-level protection** (Cloudflare Access, Vercel deployment protection). Tied to one host, and blind to ADR-003's
  split.
- **Domains in the list** (`@hva.nl`). A much wider door than named people.
- **A shared store for the list** (a database, a key-value service). One more service and key, and code that differs
  by host, for a short list that rarely changes.

## Consequences

- Each person logs in as themselves, and access is withdrawn from one person by editing the list and redeploying.
- Everyone logs in once more after the deploy: older session cookies have no address.
- The maintainer registers each host's callback URL with Google (production and localhost now). An own domain makes a
  move of host keep the same callback.
- Previews cannot show `/financials`. A fixed staging address can be added later with one more registered callback.
- A removed person keeps the shared `__prerender_bypass` cookie value, which only skips the cache and always gets the
  anonymous view; rotate `ISR_BYPASS_TOKEN` (and redeploy) when that matters.
- The list matches addresses, not Google account ids, so whoever controls a listed address's domain at Google (a
  Workspace admin) could create an account with that verified address.
- Rotating `SESSION_SECRET` ends every session and changes every log hash.
