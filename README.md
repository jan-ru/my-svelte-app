# my-svelte-app

A [SvelteKit](https://svelte.dev/docs/kit) app for fetching valuation multiples from the NYU (Stern) database. It is deployed on Vercel.

> **Status:** early scaffold. The home page is currently a Svelte 5 runes demo (two linked number/range inputs) and the about page is a placeholder. The data-fetching functionality has not been implemented yet.

## Tech stack

- [SvelteKit](https://svelte.dev/docs/kit) 2 with [Svelte](https://svelte.dev) 5 (runes)
- [Vite](https://vite.dev) 6
- TypeScript
- [`@sveltejs/adapter-vercel`](https://svelte.dev/docs/kit/adapter-vercel) for deployment

## Getting started

Prerequisites: a recent [Node.js](https://nodejs.org) LTS release and npm.

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
svelte.config.js        SvelteKit config (Vercel adapter)
vercel.json             Vercel build settings
.github/dependabot.yml  Dependency update automation
```

## Deployment

The app builds with `adapter-vercel`. Connect the repository to a Vercel project and it will use the settings in `vercel.json` (`npm run build`, framework `sveltekit`). Dependabot keeps dependencies up to date.

## License

[MIT](LICENSE) © Jan-Ru Muller
