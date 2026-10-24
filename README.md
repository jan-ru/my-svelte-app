# my-svelte-app

A [SvelteKit](https://svelte.dev/docs/kit) app for fetching valuation multiples from the NYU (Stern) database. It is deployed on Vercel.

> **Status:** early scaffold. The about page is done. The home page is still a Svelte 5 runes demo (two linked number/range inputs), and the data fetching has not been implemented yet.

## Tech stack

- [SvelteKit](https://svelte.dev/docs/kit) 3 with [Svelte](https://svelte.dev) 5 (runes)
- [Vite](https://vite.dev) 8
- TypeScript 6
- [`@sveltejs/adapter-vercel`](https://svelte.dev/docs/kit/adapter-vercel) for deployment

## Getting started

Prerequisites: [Node.js](https://nodejs.org) 24.x (pinned in `package.json` under `engines`) and npm.

```sh
git clone https://github.com/jan-ru/my-svelte-app.git
cd my-svelte-app
npm install
npm run dev
```

The dev server runs at <http://localhost:5173>. Add `-- --open` to open it in your browser.

## Scripts

| Command           | Description                               |
| ----------------- | ----------------------------------------- |
| `npm run dev`     | Start the Vite dev server                 |
| `npm run build`   | Create a production build                 |
| `npm run preview` | Preview the production build locally      |

## Project structure

```
src/
  app.html              HTML shell
  routes/
    +page.svelte        Home page
    about/+page.svelte  About page
static/                 Static assets (favicon, logos)
vite.config.ts          Vite and SvelteKit config (Vercel adapter)
vercel.json             Vercel build settings
.github/dependabot.yml  Dependency update automation
```

## Deployment

The app builds with `adapter-vercel`, configured in `vite.config.ts` (SvelteKit 3 no longer reads `svelte.config.js`). The Node version comes from `engines` in `package.json`. Connect the repository to a Vercel project and it will use the settings in `vercel.json` (`npm run build`, framework `sveltekit`). Dependabot keeps dependencies up to date.

## License

[MIT](LICENSE) © Jan-Ru Muller
