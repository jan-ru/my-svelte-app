<script lang="ts">
	import '@fontsource-variable/public-sans';
	import '@fontsource/ibm-plex-mono/400.css';
	import '@fontsource/ibm-plex-mono/500.css';
	// Relative on purpose: the #lib/* "types" condition maps to .ts files, which CSS files don't have.
	import '../lib/styles/tokens.css';
	import '../lib/styles/global.css';
	import { dev } from '$app/env';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { inject, pageview } from '@vercel/analytics';
	import { injectSpeedInsights } from '@vercel/speed-insights';
	import { onMount } from 'svelte';
	import { EXPLORE_HOME, inExplore } from '#lib/nav';
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

	// Result first, then the reference data (NYU Stern and World Bank), then the company data from FMP and Yahoo Finance.
	const links = [
		{ href: '/', label: 'Multiples', current: () => page.url.pathname === '/' },
		{ href: EXPLORE_HOME, label: 'Explore', current: () => inExplore(page.url.pathname) },
		{ href: '/financials', label: 'Financials', current: () => page.url.pathname === '/financials' },
		{ href: '/financials/valuation', label: 'Valuation', current: () => page.url.pathname === '/financials/valuation' },
		{ href: '/about', label: 'About', current: () => page.url.pathname === '/about' }
	];
</script>

<nav aria-label="Main">
	<a class="brand" href="/">{APP_NAME}</a>
	{#each links as link (link.href)}
		<a href={link.href} aria-current={link.current() ? 'page' : undefined}>{link.label}</a>
	{/each}
	<span class="spacer"></span>
	{#if data.interactive}
		<form method="POST" action={`/financials?/logout&from=${encodeURIComponent(page.url.pathname)}`}>
			<button type="submit" class="link">Log out</button>
		</form>
	{:else}
		<a
			href={page.url.pathname === '/financials'
				? '#login'
				: `/financials?from=${encodeURIComponent(page.url.pathname)}`}>Log in</a
		>
	{/if}
</nav>

{@render children()}

<SiteFooter />

<style>
	nav {
		display: flex;
		align-items: stretch;
		gap: var(--space-1);
		height: var(--shell-header-height);
		padding: 0 var(--space-4);
		background: var(--surface-shell);
		border-bottom: 1px solid var(--border-subtle);
		box-shadow: var(--shadow-1);
	}
	nav a {
		display: flex;
		align-items: center;
		padding: 0 var(--space-3);
		color: var(--text-primary);
		text-decoration: none;
		border-bottom: 3px solid transparent;
	}
	.brand {
		margin-right: var(--space-4);
		padding-left: 0;
		font-weight: var(--weight-bold);
		color: var(--grey-08);
		letter-spacing: var(--tracking-tight);
	}
	nav a:hover {
		color: var(--color-primary);
		background: var(--surface-group);
	}
	nav a[aria-current='page'] {
		font-weight: var(--weight-semibold);
		color: var(--color-primary);
		border-bottom-color: var(--color-primary);
	}
	.spacer {
		margin-left: auto;
	}
	nav form {
		display: flex;
		align-items: center;
	}
	button.link {
		padding: 0 var(--space-3);
		font: inherit;
		color: var(--text-primary);
		background: none;
		border: 0;
		cursor: pointer;
	}
	button.link:hover {
		color: var(--color-primary);
	}
</style>
