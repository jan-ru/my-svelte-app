# Configuration and deployment

Environment variables, the login, caching, security headers and deployment. The rules that bind code changes are in `AGENTS.md`; how `/financials` is built is in [financials.md](financials.md); what runs in CI is in [workflows.md](workflows.md).

## Environment variables

The app reads four environment variables, plus one optional one:

- `FMP_API_KEY`: your FMP key.
- `EULERPOOL_API_KEY` (optional): your Eulerpool key; without it the Eulerpool source says it is not configured.
- `SITE_PASSWORD`: the shared password you give to the people who may use the page.
- `SESSION_SECRET`: signs the login cookie. Generate one with `openssl rand -base64 32`.
- `ISR_BYPASS_TOKEN`: random string of at least 32 characters (`openssl rand -hex 32`). It makes the public pages (Multiples, Countries, Industries, Companies, Find industry, About) a cached static copy (Vercel ISR, one day) for anonymous visitors; logging in sets a cookie that skips the cache. Unset or shorter than 32 characters turns the cache off: the site still works, but it is simply uncached (the pages are sent `private, no-store`, so the CDN does not cache them either, and logging in changes nothing about caching). Set it for Production and Preview. The token is read at build time (the ISR config) and at runtime (the cookie check), so build and runtime must see the same value; redeploy after changing it. The token is also Vercel's revalidation secret, and logout does not invalidate an existing cookie value: to revoke every bypass cookie, rotate `ISR_BYPASS_TOKEN` and redeploy, ideally together with a `SITE_PASSWORD` change. Vercel drops every query parameter that is not listed in the ISR `allowQuery`, even for logged-in requests that skip the cache, so `allowQuery` (`ISR_ALLOW_QUERY` in `src/lib/server/access.ts`) lists every parameter the pages read plus SvelteKit's two data-request parameters. Each value of a listed parameter is cached separately (anonymous pages ignore them, so each entry is the same default view); a bot that varies those values can create extra cache entries and function runs, but the anonymous pages no longer link to any query variant. When a page starts reading a new query parameter, add it to `ISR_ALLOW_QUERY`; a test checks that `SIZE_PARAMS` in `size-nav.ts` is covered.

On Vercel, add them as shared (team-level) variables and link them to the project for Production and Preview. Locally, put them in a `.env` file (see `.env.example`; `.env` is gitignored). They are declared in `src/env.ts` and read on the server only through `$app/env/private`, so a new variable must be added to `src/env.ts` first. If `SITE_PASSWORD` or `SESSION_SECRET` is unset, nobody can log in.

## Login and sessions

Login sets a signed, HTTP-only cookie that lasts 7 days and applies to the whole site (path `/`); when `ISR_BYPASS_TOKEN` is usable, a second cookie, `__prerender_bypass`, is set with it. Logging out only clears the cookie in that browser; a copied cookie stays valid until it expires. To log everyone out, change `SESSION_SECRET`; to stop new logins with the old password, change `SITE_PASSWORD`. Failed logins are rate limited per IP, best effort only, because the counter lives in each serverless instance. When testing the login with `curl`, send `Accept: text/html`, or SvelteKit answers form actions with JSON.

## Caching

NYU publishes the data as legacy `.xls` workbooks, one per multiple family and region (32 files, updated about once a year). The server downloads only the files a view needs, parses them with [SheetJS](https://sheetjs.com), and keeps them in memory for 24 hours. The public pages are cached by Vercel ISR for one day (when `ISR_BYPASS_TOKEN` is set). If NYU is unreachable, a previously cached copy is served. A January update can take up to about two days to show on the public pages (24 h in-memory + 24 h ISR); logged-in visitors only wait for the in-memory copy.

## Security headers

Pages are served with a Content-Security-Policy (script hashes, no framing, same-origin forms) and the headers `X-Content-Type-Options`, `Referrer-Policy` and `Permissions-Policy`, set in `vite.config.ts` (CSP) and `src/hooks.server.ts`. The NYU download is limited to 5 MB per workbook and has a 10 s timeout, URL parameters are checked against allow-lists, and the CI workflow runs with read-only permissions.

## Deployment

The app builds with `adapter-vercel`, configured in `vite.config.ts` (SvelteKit 3 no longer reads `svelte.config.js`). Vercel uses the Node version from `engines` in `package.json` and the settings in `vercel.json`. Every merge to `main` deploys to production and every pull request gets a preview; [workflows.md](workflows.md) covers CI and the other automation. Dependabot keeps dependencies up to date.
