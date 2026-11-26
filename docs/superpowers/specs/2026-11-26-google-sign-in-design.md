# Sign in with Google, limited to a list of permitted addresses

- **Date:** 2026-11-26
- **Status:** design, approved in conversation; to be implemented in one pull request
- **Issue:** #133 (closed by the implementation)
- **Decision record:** ADR-014, written in the same pull request

## Goal

Replace the shared password (`SITE_PASSWORD`) with Google sign-in, so that each person logs in with their own account
and access can be withdrawn from one person. Only Google accounts whose address is on a permitted list get in. The same
code works on Vercel, on Cloudflare Workers and on a Node server (VPS) with `adapter-node`.

## Decisions

| Question | Decision |
|---|---|
| Login methods | Google only. The shared password is removed in the same pull request. |
| Who gets in | A Google account with a verified e-mail address that is on the permitted list. |
| List entries | Exact e-mail addresses only, no domains. Compared lower-cased. |
| Where the list lives | The environment variable `ALLOWED_EMAILS`, comma-separated. Never committed: the repository is public and the addresses are personal data. Changing it takes a redeploy. |
| Previews | No login. Google needs every callback URL registered in advance, and each preview has a new address. Logged-in work is tested locally (`http://localhost:5173`) and on production. |
| OpenID Connect client | `oauth4webapi` (MIT, no dependencies, Web standards only, OpenID-certified), pinned exactly. `arctic` was considered and is deprecated on npm. Auth.js and host-level protection (Cloudflare Access, Vercel protection) were ruled out: the first replaces our sessions and sits badly with the ISR bypass cookie and the CSP, the second is tied to one host. |
| Crypto | Web Crypto (`crypto.subtle`) instead of `node:crypto` in the session code and `access.ts`, so nothing in the login depends on Node. |
| Logs | No addresses. A login event logs a short keyed hash of the address. |
| Own domain | Not needed first: production has the stable `my-svelte-app-alpha.vercel.app`. Recommended before a move of host, so the callback URL, cookies and bookmarks survive it (issue #175). |

## Flow

1. **`/login`** shows one link, "Sign in with Google", to `/login/google?from=<path>`. Where `GOOGLE_CLIENT_ID`,
   `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET` or `ALLOWED_EMAILS` is not set (every preview), it shows "Logging in is only
   available on the production site." instead. It stays one page, private and `no-store`. A logged-in visitor is sent
   on to `from`, and gets the bypass cookie back when it is missing, as today.
2. **`GET /login/google`** (a `+server.ts`, private, `no-store`):
   - creates a random `state`, a `nonce` and a PKCE code verifier (`oauth4webapi`);
   - stores them, with the checked `from` (`returnPath`), in one signed, HTTP-only cookie `fin_oauth` on path
     `/login/google`, `sameSite=lax`, `secure` outside localhost, for 10 minutes;
   - redirects (303) to Google's authorization endpoint with `response_type=code`, scopes `openid email`, the
     `state`, the `nonce`, the S256 code challenge and the `redirect_uri`.
   - When sign-in is not configured, it redirects to `/login` instead.
3. **`GET /login/google/callback`**:
   - reads and verifies `fin_oauth`, then deletes it: it is single-use;
   - checks the returned `state` against it;
   - exchanges the code for tokens with `oauth4webapi`, which checks the ID token's issuer, audience, expiry and
     nonce, and the PKCE verifier;
   - requires `email_verified === true` and reads `email`;
   - **on the list:** sets the session cookie and, when the cache is on, the bypass cookie (`sessionCookieOptions()`),
     deletes the legacy `/financials` session cookie, logs `login allowed user=<hash>`, and redirects (303) to `from`
     or `/`;
   - **not on the list:** sets no session, logs `login refused user=<hash>`, and redirects to `/login?error=denied`,
     where the page says "This Google account has no access." without the address;
   - **any other failure** (missing or wrong cookie, wrong `state`, an error from Google, a failed exchange): sets no
     session, logs `login failed reason=<fixed word>` with no Google text, and redirects to `/login?error=failed`,
     where the page says "Signing in did not work. Try again."
   - Google's access and ID tokens are discarded after reading the address. Nothing from Google is logged or sent to
     the page.
4. **Every request:** `hooks.server.ts` verifies the session's signature and expiry, and that its address is still on
   `ALLOWED_EMAILS`. Taking an address off the list and redeploying ends that person's session at once.
5. **Logout:** as today, the `logout` action of `/login` deletes the session, legacy and bypass cookies.

The callback URL is `<origin>/login/google/callback`, built from the request's own origin. Google accepts only the
registered ones: `https://my-svelte-app-alpha.vercel.app/login/google/callback` and
`http://localhost:5173/login/google/callback`. Another host registers its own.

## Session

- Cookie `fin_session` = `<expiresMs>.<email, base64url>.<signature>`. The signature is HMAC-SHA256 under
  `SESSION_SECRET` over `session:<expiresMs>.<email>`. Seven days, as today; options as today (`path=/`, `httpOnly`,
  `sameSite=lax`, `maxAge`).
- `verifySession(value, secret, allowed, now)` returns the address, or `null` when the format, signature or expiry is
  wrong or the address is not on the list. `locals.authed` stays a boolean (`address !== null`); the address itself is
  not put in `locals`, since nothing needs it.
- A cookie in today's format (`<expiresMs>.<signature>`) has two parts and fails verification, so everyone logs in once
  more after the deploy.
- The `fin_oauth` cookie is signed the same way, with the label `oauth:`, so neither cookie can be passed off as the
  other.

## Permitted list

- `parseAllowed(raw: string | undefined): ReadonlySet<string>`: split on commas, trim, lower-case, drop empty entries.
  An entry without exactly one `@` is dropped. An unset or empty variable is an empty set, and then nobody can log in
  (fails closed).
- `isAllowed(email, allowed)`: the lower-cased address is in the set.
- No domains, no wildcards, no patterns.

## Log hash

- `userHash(email, secret)`: the first 8 hex characters of HMAC-SHA256 under `SESSION_SECRET` over
  `log:<lower-cased email>`. The maintainer can match a hash to a person by computing it; without the secret nobody
  else can.

## Environment

`src/env.ts`, all optional, failing closed:

| Variable | Change |
|---|---|
| `SITE_PASSWORD` | Removed |
| `GOOGLE_CLIENT_ID` | New: the OAuth client's id |
| `GOOGLE_CLIENT_SECRET` | New: the OAuth client's secret |
| `ALLOWED_EMAILS` | New: the permitted addresses, comma-separated |
| `SESSION_SECRET`, `ISR_BYPASS_TOKEN`, `FMP_API_KEY`, `EULERPOOL_API_KEY` | Unchanged |

On Vercel the three new variables are set for Production only. Reads of `$app/env/private` stay in `hooks.server.ts`,
`src/routes/login/` (which now includes `login/google/`) and `src/routes/financials/`.

## Files

- `src/lib/server/session.ts` (new, replaces `auth.ts`, which is deleted with `passwordMatches`): the session format
  above and the `fin_oauth` cookie, on Web Crypto; `parseAllowed`, `isAllowed`, `userHash`, `signInConfig`.
- `src/lib/server/access.ts`: `isInteractive` compares with a Web Crypto digest instead of `node:crypto`. Behaviour
  unchanged.
- `src/lib/server/google.ts` (new): the `oauth4webapi` calls (authorization URL, code exchange, ID token claims), with
  an injectable `fetch` for tests. Pure apart from the network call.
- `src/routes/login/+page.server.ts`, `+page.svelte`: the button or the "only on production" note, the two error
  messages, logout. The `login` action and its password form are removed.
- `src/routes/login/google/+server.ts`, `src/routes/login/google/callback/+server.ts` (new).
- `src/lib/components/LoginForm.svelte`: replaced by the sign-in link. It keeps an accessible name, and
  `svelte-autofixer` reports nothing.
- `src/lib/server/ratelimit.ts` and its test: removed, since only the password login used them.
- `src/hooks.server.ts`: the async `verifySession` with the list.
- `src/env.ts`: as above.
- `package.json`: `oauth4webapi`, pinned exactly.

## What does not change

- ADR-003's split between public and logged-in views: `isInteractive`, the bypass cookie, `isRevalidation`,
  `pageParams`, `bypassToRestore`.
- `/financials` and `/financials/valuation` stay `private, no-store` and locked without a session.
- `loginHref(from)`, `logoutAction(from)` and the `RETURN_PATHS` allow-list.
- The CSP: the sign-in is a top-level navigation to Google, not a script or a frame, so no source is added.

## Tests (no network)

- `session.test.ts`: create and verify a session; a wrong signature, a changed address, an expired session, the old
  two-part format and an address taken off the list all fail. `parseAllowed`: case, spaces, empty entries, entries
  without `@`, unset. `userHash`: stable, 8 hex characters, different under another secret, case-insensitive.
- `google.test.ts`: the authorization URL's parameters; the exchange against a fake token endpoint, through the
  injectable `fetch`.
- `login/google` route tests:
  - the start route sets `fin_oauth` and redirects to Google, and redirects to `/login` when not configured;
  - the callback, against a fake Google: a missing cookie, a wrong `state`, an error from Google, an unverified address
    and an address not on the list all end without a session and with the right `error`; an address on the list sets
    the session and bypass cookies and redirects to `from`; a `from` outside `RETURN_PATHS` goes to `/`;
  - nothing logged or returned contains the address, a token or Google's error text.
- `page.server.test.ts`: rewritten for the new `/login` (configured, not configured, logged in, the two errors,
  logout).
- `login-views.test.ts`: the component's two states (the sign-in link; the "only on production" note) and the two error
  messages.
- `access.test.ts` and `hooks.server.test.ts` keep their assertions.
- E2E: the Playwright server gets test-only Google values, so `/login` offers the sign-in and `/login/google` redirects
  to Google (not followed). The tests log in by setting a signed session cookie for a test address, as the callback
  would. The "only on production" note is covered by the component test. No serious axe violations.

## Documents

- **ADR-014**, "Sign in with Google, limited to a list of permitted addresses": the decisions above. It supersedes
  ADR-003's sign-in method (the shared password) but not its split between public and logged-in views. ADR-003 gets a
  dated clarification pointing to ADR-014. ADR-014 is written as Proposed; it goes in `ADR_THEMES` (theme `Access`)
  when it is accepted, since that table names only accepted ADRs.
- `AGENTS.md` (and so `CLAUDE.md`): the Secrets, Login and `ISR_BYPASS_TOKEN` lines (no more "rotate with a password
  change"; rotate `SESSION_SECRET` to end every session).
- `docs/financials.md`: the login section.
- The pull request closes #133.

## The maintainer's setup, before merging

1. In Google Cloud Console, create an OAuth client of type "Web application", with consent screen user type
   "External", in testing or published.
2. Register the callback URLs `https://my-svelte-app-alpha.vercel.app/login/google/callback` and
   `http://localhost:5173/login/google/callback`.
3. In Vercel, set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `ALLOWED_EMAILS` for Production only, and delete
   `SITE_PASSWORD`.
4. For local work, put the same three in `.env`, which is git-ignored, with your own address in `ALLOWED_EMAILS`.

## Rollout

Production changes only at the next release tag. After the release, the maintainer logs in once on production. If it
fails, the fallback is to revert the release, as `SITE_PASSWORD` is gone.

## Out of scope

- A login on previews or a staging address. It can be added later with one more registered callback and environment.
- Domains or groups in the list; other providers (HvA, SURFconext, Microsoft).
- A store for the list shared between hosts.
- Moving to another host, and an own domain (issue #175).
