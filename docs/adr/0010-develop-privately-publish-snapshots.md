---
status: Accepted
date: 2026-11-19
decision-makers: Jan-Ru Muller (sole maintainer)
---
# ADR-010: Develop in a private repository and publish snapshots to the public one

- **Accepted:** 2026-11-19, in #10.
- **Component:** `.public-exclude`, `scripts/publish-public.ts`, `.github/workflows/docs.yml`, the Vercel Git integration, [docs/workflows.md](../workflows.md)

## Context

The code was developed in the public repository, so everything in it was public: the coding-agent configuration, the
Figma design exports, the release procedure. The maintainer wants to keep those private and to keep working with
pull requests that get a Vercel preview, while the code itself stays public.

## Decision

Development moves to a private working repository; the public repository `jan-ru/my-svelte-app` receives snapshots.

- **Snapshots, not mirrored history.** `npm run publish:public` copies the tree of the private `main`, minus the paths
  in `.public-exclude`, as one new commit on the public `main`, through a pull request that the public `test` check
  gates. Private commits, messages and excluded files never leave.
- **Checked before pushing.** The script installs and runs CI's checks on the snapshot itself first. A test that reads
  an excluded file is excluded with it.
- **Deployments run from the private repository.** Vercel builds a preview for each private PR and production from
  every merge to the private `main`. The API reference is built by `docs.yml` there and published to Cloudflare Pages
  at a release tag or by hand, the way finance-tools publishes its docs.
- **Dependabot runs in the private repository.**

## Alternatives ruled out

- **Mirroring the full history** (a push of `main` to both remotes). Every private commit and every excluded file in
  the history would be public.
- **Filtering history on each sync** (`git filter-repo` into the public repository). Rewrites commit ids on every run
  and is easy to get subtly wrong; the public history has no value that a snapshot loses.
- **Vercel from the public repository.** The live app would be exactly what was published, but private PRs would get
  no preview.
- **GitHub Pages for the API reference.** Only one of the two repositories could serve it, and finance-tools already
  publishes to Cloudflare Pages.

## Consequences

- The public history is one commit per snapshot; the private repository is the record of how the code changed.
- Files excluded from 2026-11-19 on are gone from the public tree but stay in the public history before that date.
- Public files that link to an excluded one (`AGENTS.md`, `RELEASING.md`, `design/horizon/`) have broken links there,
  and `npm run build:tokens` cannot run in the public copy; the build does not need it.
- GitHub Actions minutes of the private repository count against the account's allowance; on the public repository
  they were free.
- The live app can be ahead of the public code until the next snapshot is published.
- A public release is tagged on the public repository separately, as step 6 of the release procedure (`RELEASING.md`,
  private) describes.
