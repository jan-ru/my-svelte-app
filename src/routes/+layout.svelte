<script lang="ts">
	import { page } from '$app/state';
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();

	const links = [
		{ href: '/', label: 'home' },
		{ href: '/classification', label: 'classification' },
		{ href: '/companies', label: 'companies' },
		{ href: '/about', label: 'about' }
	];
</script>

<nav aria-label="Main">
	{#each links as link (link.href)}
		<a href={link.href} aria-current={page.url.pathname === link.href ? 'page' : undefined}>{link.label}</a>
	{/each}
</nav>

{@render children()}

<style>
	nav {
		display: flex;
		gap: 1rem;
		padding: 1rem;
	}

	nav a[aria-current='page'] {
		font-weight: 600;
		text-decoration: none;
	}
</style>
