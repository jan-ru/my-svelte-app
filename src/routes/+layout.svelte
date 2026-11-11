<script lang="ts">
	import '@fontsource-variable/public-sans';
	import '@fontsource/ibm-plex-mono/400.css';
	import '@fontsource/ibm-plex-mono/500.css';
	// Relative on purpose: the #lib/* "types" condition maps to .ts files, which CSS files don't have.
	import '../lib/styles/tokens.css';
	import '../lib/styles/generated/morning.css';
	import '../lib/styles/generated/aliases.css';
	import '../lib/styles/generated/grid.css';
	import '../lib/styles/grid.css';
	import '../lib/styles/global.css';
	import { dev } from '$app/env';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { inject, pageview } from '@vercel/analytics';
	import { injectSpeedInsights } from '@vercel/speed-insights';
	import { onMount } from 'svelte';
	import AppHeader from '#lib/components/AppHeader.svelte';
	import SiteFooter from '#lib/components/SiteFooter.svelte';
	import type { Snippet } from 'svelte';

	let { children, data }: { children: Snippet; data: { interactive: boolean } } = $props();

	const APP_NAME = 'Fetch valuation multiples';

	// Vercel Analytics and Speed Insights through their generic entry points: the `/sveltekit` ones import
	// `$app/stores`, which SvelteKit 3 removed, so they threw on every page load. Route changes are reported here instead.
	const basePath = import.meta.env.VITE_VERCEL_OBSERVABILITY_BASEPATH;
	const config = import.meta.env.VITE_VERCEL_OBSERVABILITY_CLIENT_CONFIG;
	let speedInsights: ReturnType<typeof injectSpeedInsights> = null;
	onMount(() => {
		const framework = 'sveltekit';
		inject({ mode: dev ? 'development' : 'production', framework, basePath, disableAutoTrack: true }, config);
		speedInsights = injectSpeedInsights({ route: page.route.id, framework, basePath }, config);
	});
	afterNavigate(() => {
		const route = page.route.id;
		if (!route) return;
		pageview({ route, path: page.url.pathname });
		speedInsights?.setRoute(route);
	});
</script>

<AppHeader name={APP_NAME} pathname={page.url.pathname} search={page.url.search} interactive={data.interactive} />

{@render children()}

<SiteFooter />
