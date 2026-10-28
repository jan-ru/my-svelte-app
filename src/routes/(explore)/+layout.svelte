<script lang="ts">
	import { page } from '$app/state';
	import { EXPLORE_LINKS, EXPLORE_SOURCE } from '#lib/nav';
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

<div class="explore">
	<nav class="side" aria-label="Explore">
		<p class="title">Explore</p>
		<p class="source">Data: {EXPLORE_SOURCE}</p>
		<ul>
			{#each EXPLORE_LINKS as link (link.href)}
				<li><a href={link.href} aria-current={page.url.pathname === link.href ? 'page' : undefined}>{link.label}</a></li>
			{/each}
		</ul>
	</nav>
	<div class="content">{@render children()}</div>
</div>

<style>
	.explore { display: flex; align-items: flex-start; gap: var(--space-4); max-width: 84rem; margin: 0 auto; padding: var(--space-4) var(--space-4) 0; }
	.content { flex: 1; min-width: 0; }
	.side { flex: 0 0 11rem; position: sticky; top: var(--space-4); }
	.title { margin: 0; font-weight: var(--weight-semibold); }
	.source { margin: var(--space-1) 0 var(--space-3); color: var(--text-secondary); font-size: var(--text-sm); }
	ul { margin: 0; padding: 0; list-style: none; }
	li a { display: block; padding: var(--space-2) var(--space-3); color: var(--text-primary); text-decoration: none; border-left: 3px solid transparent; }
	li a:hover { color: var(--color-primary); background: var(--surface-group); }
	li a[aria-current='page'] { font-weight: var(--weight-semibold); color: var(--color-primary); border-left-color: var(--color-primary); }
	@media (max-width: 48rem) {
		.explore { flex-direction: column; gap: 0; }
		.side { flex: none; position: static; width: 100%; }
		ul { display: flex; flex-wrap: wrap; gap: var(--space-1); }
		li a { border-left: 0; border-bottom: 3px solid transparent; }
		li a[aria-current='page'] { border-left-color: transparent; border-bottom-color: var(--color-primary); }
	}
</style>
