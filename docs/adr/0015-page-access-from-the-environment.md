---
status: Proposed
date: 2026-11-27
decision-makers: Jan-Ru Muller (sole maintainer)
---
# ADR-015: Per-page access from two environment variables, edited on an admin-only settings page

- **Proposed:** 2026-11-27. Extends ADR-014: the list of who may sign in stays as it is, and this decides which pages
  each signed-in person may use.
- **Component:** `src/lib/server/page-access.ts`, `src/hooks.server.ts`, `src/routes/settings/`

## Context

Every address on `ALLOWED_EMAILS` gets every page. The maintainer wants to grant pages per person, from a settings page
only administrators see, with users as rows and pages as columns. The site must keep running on Vercel, Cloudflare and
a Docker container on a VPS (#175), and the solution should be low-tech and safe.

## Decision

1. **Two more environment variables.** `ADMIN_EMAILS` names the admins, and `PAGE_ACCESS` says which pages everyone
   else may use (`a@x.test=*; b@y.test=/financials,/countries`). Like `ALLOWED_EMAILS`, they never enter the repository.
2. **Admins get every page and `/settings`.** An admin must also be on `ALLOWED_EMAILS`: one list decides who can sign
   in, and `ADMIN_EMAILS` only widens what an admin may use.
3. **The settings page writes nothing.** It shows the grid of the rules in force, and *Create value* turns the ticked
   boxes into a new `PAGE_ACCESS` value that the admin pastes into the host's environment and deploys. For anyone but
   an admin, `/settings` is a 404. It is never cached.
4. **Checked in hooks on every request.** `locals.authed` now means "signed in and may use this page", so every
   existing check (`interactive`, the Financials loaders, the template download) follows the rules unchanged. A path
   below a page belongs to it (`/financials/valuation/template`), and SvelteKit's data requests carry the page's path.
5. **Fails closed.** Unset, an unreadable entry, an unknown page or an address without an entry grants nothing.
6. **What a page permission unlocks.** On the public pages (Multiples, Explore) it unlocks the interactive view; without
   it a signed-in person gets the anonymous view, which is the same as the cached copy, so ADR-003's cache is unchanged.
   On Financials and Valuation it unlocks the whole page; without it the page says the account has no access. About
   and the login pages are open to everyone.

## Alternatives ruled out

- **A store the page writes to** (Upstash Redis, Edge Config, a database). Changes would apply at once, but it adds a
  service and a key, a write path an attacker with an admin session could use to grant access, and, for Edge Config, a
  Vercel-wide API token. ADR-014 ruled out a store for the sign-in list for the same reasons. If instant changes become
  necessary, only the function that reads the rules has to change.
- **Admins as a column on the settings page.** A stolen admin session could make more admins.
- **Hiding pages entirely from anonymous visitors.** Would end the public site and its cache (ADR-003).

## Consequences

- A change of access takes a paste and a redeploy, as adding a person to `ALLOWED_EMAILS` already does.
- On deploy, people without a `PAGE_ACCESS` entry lose every page: set `ADMIN_EMAILS` and `PAGE_ACCESS` first.
- The header shows "Log in" on a page the person may not use, because that page is the anonymous view.
- The settings page shows addresses, so it is admin-only, `noindex` and `private, no-store`.
