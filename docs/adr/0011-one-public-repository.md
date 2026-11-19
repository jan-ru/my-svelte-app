---
status: Accepted
date: 2026-11-19
decision-makers: Jan-Ru Muller (sole maintainer)
---
# ADR-011: One public repository again: the private copy's history merged back

- **Accepted:** 2026-11-19.
- **Supersedes:** [ADR-010](0010-develop-privately-publish-snapshots.md).
- **Component:** the repository `jan-ru/my-svelte-app`, the Vercel Git integration, `.github/workflows/docs.yml`

## Context

ADR-010 moved development to a private copy, `jan-ru/my-svelte-app-dev`, and published snapshots to this
repository. Within the day it was clear that the cost outweighed what it kept private: two repositories, a sync
script, broken links in the public copy, releases tagged twice, Actions minutes billed, and the live app running
ahead of the published code. None of the excluded files (agent configuration, the Figma token exports, the release
procedure) needs to be private, and all of them were already in this repository's history.

GitHub keeps pull requests, issues and releases per repository, not in git. This repository holds the project's PRs
and issues since 2024-11-15; the private copy had only the commits.

## Decision

`jan-ru/my-svelte-app` is again the only repository, and the private copy's commits come back with their history.

- The private `main` merged this repository's `main` (the one snapshot commit, #146) keeping its own tree, and that
  merge arrived here through a pull request with a merge commit, so no history was rewritten or force-pushed.
- The snapshot machinery (`scripts/publish-public.ts`, `.public-exclude`, `npm run publish:public`) is removed, and
  the excluded files are back.
- Vercel, Dependabot and the API reference (`docs.yml`, still to Cloudflare Pages) run from this repository.
- The private copy is archived, so its pull requests stay readable.

## Alternatives ruled out

- **Make the private copy public and delete this repository.** The commits would survive, but the 135 pull requests,
  the issues and the first release live only here.
- **Keep the split and lock this repository down** (no admin bypass, only `snapshot/**` branches, publishing from
  CI). The standard shape of a private-source, public-mirror setup, but more machinery than a one-person project needs
  when nothing has to stay private.

## Consequences

- The commits of the private copy's PRs end in `(#7)`, `(#9)`, `(#10)` and `(#11)`. Those numbers refer to the
  private copy's PRs (`https://github.com/jan-ru/my-svelte-app-dev/pull/N`), not to this repository's PRs of the
  same number.
- The private copy's open Dependabot PRs are not moved; Dependabot opens them again here.
