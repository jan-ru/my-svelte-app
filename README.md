# my-svelte-app

A [SvelteKit](https://svelte.dev/docs/kit) app for comparing valuation multiples from the [NYU Stern](https://pages.stern.nyu.edu/~adamodar/New_Home_Page/data.html) industry datasets. It is deployed on Vercel.

## What it does

Pick 1-4 multiples, 1-4 regions and 1-4 industries on the home page and the app draws grouped bar charts:

- **Multiples:** EV/EBITDA, EV/EBIT, P/E (trailing, forward, current), P/B, EV/Invested Capital, P/S, EV/Sales.
- **Regions:** US, Europe, Global, Japan, India, China, Emerging Markets, Australia/NZ/Canada.
- **Industries:** the 94 NYU industries plus the 2 market-wide total rows.

By default each multiple gets its own panel, industries run along the x axis and regions are the colours. The *Chart layout* dropdowns let you swap those roles. Bars based on fewer than 10 firms are hatched, missing values show as "n/a", and *Show data* lists the exact numbers.

Every selection is stored in the URL, so a view can be bookmarked or shared, for example `/?m=pe_trailing&m=pbv&r=us&r=europe&i=Steel&i=Total+Market`. Parameters: `m` multiples, `r` regions, `i` industry names (repeat a parameter for each value), and `p`, `x`, `c` for the panel, x-axis and colour roles.

## How it works

NYU publishes the data as legacy `.xls` workbooks, one per multiple family and region (32 files, updated about once a year). The server downloads only the files a view needs, parses them with [SheetJS](https://sheetjs.com), and keeps them in memory for 24 hours. Responses are cacheable by Vercel's CDN. If NYU is unreachable, a previously cached copy is served.

## Tech stack

- [SvelteKit](https://svelte.dev/docs/kit) 3 with [Svelte](https://svelte.dev) 5 (runes)
- [Vite](https://vite.dev) 8 and TypeScript 6
- [Vitest](https://vitest.dev) for tests
- [`@sveltejs/adapter-vercel`](https://svelte.dev/docs/kit/adapter-vercel) for deployment
- SheetJS `xlsx` 0.20.3, installed from `https://cdn.sheetjs.com` (the npm registry copy is unmaintained). Dependabot cannot update it; check for new releases now and then.

## Getting started

Prerequisites: [Node.js](https://nodejs.org) 24.x (pinned in `package.json` under `engines`) and npm.

```sh
git clone https://github.com/jan-ru/my-svelte-app.git
cd my-svelte-app
npm install
npm run dev
```

The dev server runs at <http://localhost:5173>.

## Scripts

| Command              | Description                                                        |
| -------------------- | ------------------------------------------------------------------ |
| `npm run dev`        | Start the Vite dev server                                          |
| `npm run build`      | Create a production build                                          |
| `npm run preview`    | Preview the production build locally                               |
| `npm test`           | Run the unit tests (no network)                                    |
| `npm run check:data` | Fetch the real NYU files and confirm every multiple still resolves |

Run `npm run check:data` each January after NYU publishes new data. If NYU renames a column, update the matching entry in `src/lib/catalog.ts`.

## Project structure

```
src/
  lib/
    catalog.ts          Multiples, regions, file names
    params.ts           URL parameters
    layout.ts           Reshapes data into chart panels
    chart.ts            Scales and formatting
    components/         GroupedBarChart.svelte
    server/             Workbook download, parsing, cache, comparison
  routes/
    +page.server.ts     Load function
    +page.svelte        Home page
    about/+page.svelte  About page
docs/superpowers/       Design spec and implementation plan
```

## Deployment

The app builds with `adapter-vercel`, configured in `vite.config.ts` (SvelteKit 3 no longer reads `svelte.config.js`, and the `$lib` alias is set there too). Vercel uses the Node version from `engines` in `package.json` and the settings in `vercel.json`. CI (`.github/workflows/ci.yml`) runs the tests and a build on every pull request and push to `main`. Dependabot keeps dependencies up to date.

## License

[MIT](LICENSE) © Jan-Ru Muller
