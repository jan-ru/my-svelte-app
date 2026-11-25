# Security policy

my-svelte-app is a public SvelteKit app with one maintainer ([@jan-ru](https://github.com/jan-ru)). Its public pages are open to anyone; `/financials` and the valuation page sit behind a password ([docs/configuration.md](docs/configuration.md)).

## Supported versions

Only the **latest release** is supported. A release is what runs in production: the app and the API reference are deployed from a release tag and never from a push to `main` ([RELEASING.md](RELEASING.md)). A fix goes out in a new release, and older releases are not patched.

## Reporting a vulnerability

Report it **privately**, through the repository's **Security → Report a vulnerability** (a GitHub private security advisory). Do not open a public issue or pull request for a security problem.

Please include:

- the page, route or file affected;
- what an attacker can do, and what they need first (a login, a crafted link);
- steps to reproduce, or a proof of concept.

You will get an acknowledgement within a few days. If the report is accepted, a fix is prepared and released before anything is disclosed, and you are credited in the advisory unless you would rather not be. If it is declined, you will get the reason.

## Scope

In scope: the app as deployed from the latest release, the API reference at <https://my-svelte-app-docs.pages.dev/>, and this repository's workflows.

Out of scope:

- the services it reads from or runs on (Financial Modeling Prep, Yahoo Finance, Eulerpool, the NYU data files, Vercel, Cloudflare): report those to their owners;
- denial of service by volume, and missing best-practice headers with no attack behind them;
- anything that needs the maintainer's Vercel, Cloudflare or GitHub account first.

## What is in place

- **Secrets** live only in Vercel's environment variables and are never committed. GitHub's secret scanning and push protection are on, and gitleaks scans the commits of every pull request in the required `test` check ([jan-ru/system-health ADR-0011](https://github.com/jan-ru/system-health/blob/main/docs/adr/0011-secret-scanning.md)).
- **Dependencies:** Dependabot opens weekly updates for npm and GitHub Actions, and `npm audit` of the runtime dependencies is part of `test`. Actions are pinned by commit.
- **The pages** carry a Content-Security-Policy and further security headers ([docs/configuration.md](docs/configuration.md#security-headers)), and the end-to-end tests fail on a CSP block.
- **Each release** records its OpenSSF Scorecard result, its advisories and the secrets count in `metrics.json` ([docs/workflows.md](docs/workflows.md)).
