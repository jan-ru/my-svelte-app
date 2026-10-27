<script lang="ts">
	import '@fontsource-variable/public-sans';
	import '@fontsource/ibm-plex-mono/400.css';
	import '@fontsource/ibm-plex-mono/500.css';
	// Relative on purpose: the #lib/* "types" condition maps to .ts files, which CSS files don't have.
	import '../lib/styles/tokens.css';
	import '../lib/styles/global.css';
	import { page } from '$app/state';
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();

	const APP_NAME = 'Fetch valuation multiples';

	// Workflow order: result first, then find the industry, its peers, one company in detail.
	const links = [
		{ href: '/', label: 'Multiples' },
		{ href: '/classification', label: 'Find industry' },
		{ href: '/companies', label: 'Companies' },
		{ href: '/financials', label: 'Financials' },
		{ href: '/about', label: 'About' }
	];
</script>

<nav aria-label="Main">
	<a class="brand" href="/">{APP_NAME}</a>
	{#each links as link (link.href)}
		<a href={link.href} aria-current={page.url.pathname === link.href ? 'page' : undefined}>{link.label}</a>
	{/each}
</nav>

{@render children()}

<style>
	nav { display: flex; align-items: stretch; gap: var(--space-1); height: var(--shell-header-height); padding: 0 var(--space-4); background: var(--surface-shell); border-bottom: 1px solid var(--border-subtle); box-shadow: var(--shadow-1); }
	nav a { display: flex; align-items: center; padding: 0 var(--space-3); color: var(--text-primary); text-decoration: none; border-bottom: 3px solid transparent; }
	.brand { margin-right: var(--space-4); padding-left: 0; font-weight: var(--weight-bold); color: var(--grey-08); letter-spacing: var(--tracking-tight); }
	nav a:hover { color: var(--color-primary); background: var(--surface-group); }
	nav a[aria-current='page'] { font-weight: var(--weight-semibold); color: var(--color-primary); border-bottom-color: var(--color-primary); }
</style>
