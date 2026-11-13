# my-svelte-app

[![CI](https://github.com/jan-ru/my-svelte-app/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/jan-ru/my-svelte-app/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/jan-ru/my-svelte-app?include_prereleases&sort=date)](https://github.com/jan-ru/my-svelte-app/releases)
[![API docs](https://img.shields.io/badge/API%20docs-TypeDoc-blue)](https://jan-ru.github.io/my-svelte-app/)

A [SvelteKit](https://svelte.dev/docs/kit) app on Vercel that compares valuation multiples from the [NYU Stern](https://pages.stern.nyu.edu/~adamodar/New_Home_Page/data.html) industry datasets in public, and, behind a shared password, shows a company's financials and values it against peers.

## Pages

- **Multiples** (`/`): pick 1-4 multiples, regions and industries and compare them as grouped bar charts. Every selection is in the URL. [More](docs/pages.md#multiples)
- **Find industry** (`/classification`): link SBI 2025 codes to the Damodaran industries, in both directions. [More](docs/pages.md#industry-classification)
- **Companies** (`/companies`): the companies behind an industry, with filters. [More](docs/pages.md#companies)
- **Countries** and **Industries** (`/countries`, `/industries`): each one's share of the global total, as a treemap and ranked bars. [More](docs/pages.md#countries-and-industries)
- **Financials** (`/financials`, password): income statement, balance sheet and cash flow for the last 5 years, plus ratios, estimates, news and prices, from FMP, Yahoo Finance or Eulerpool. [More](docs/financials.md#using-the-financials-page)
- **Valuation** (`/financials/valuation`, password): values one company with multiples against peers picked by hand, with a football-field chart. [More](docs/financials.md#using-the-valuation-page)
- **About**: the app and its sources in short.

Anonymous visitors see a cached default view of the public pages; the shared password unlocks the interactive versions and `/financials` ([details](docs/pages.md#public-and-logged-in)).

## Quick start

Node.js 24.x (`nvm use` picks it from `.nvmrc`) and npm.

```sh
git clone https://github.com/jan-ru/my-svelte-app.git
cd my-svelte-app
npm install
npm run dev
```

The dev server runs at <http://localhost:5173>. Without environment variables the site still runs, uncached and with no login; [docs/configuration.md](docs/configuration.md) lists them.

## Documentation

| Read | For |
| --- | --- |
| [Overview](docs/overview.md) | The design at a glance, design decisions, release history, quality review and roadmap |
| [Pages](docs/pages.md) | What each public page does |
| [Financials and valuation](docs/financials.md) | Using `/financials` and the valuation page, and how they are built |
| [Configuration](docs/configuration.md) | Environment variables, login, caching, security headers, deployment |
| [Development](docs/development.md) | Scripts, project structure, tech stack, conventions and checks |
| [Workflows](docs/workflows.md) | What runs in CI, what deploys and what is scheduled |
| [Releasing](RELEASING.md) and [Changelog](CHANGELOG.md) | How a release is cut, and what each release brought |
| [Decisions](docs/adr/README.md) and [Quality review](docs/quality/README.md) | One ADR per decision; what CI enforces and what to watch |
| [Classification data](docs/crosswalk.md), [Size pages](docs/size.md), [Design tokens](docs/horizon-tokens.md) | How the generated data and the Horizon theme are built |
| [Svelte MCP](docs/svelte-mcp.md) and [AGENTS.md](AGENTS.md) | Setup for coding agents, and the rules for contributors and agents |
| [API reference](https://jan-ru.github.io/my-svelte-app/) | TypeDoc reference of `src/lib` |

## License

[MIT](LICENSE) © Jan-Ru Muller
