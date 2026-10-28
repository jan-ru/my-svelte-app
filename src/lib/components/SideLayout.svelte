<script lang="ts">
	import type { Snippet } from 'svelte';

	// One frame for every page with a vertical menu (Explore, Financials), so the menu sits in the same place on both.
	let { menu, children }: { menu: Snippet; children: Snippet } = $props();
</script>

<div class="frame">
	<aside>{@render menu()}</aside>
	<div class="content">{@render children()}</div>
</div>

<style>
	.frame { display: grid; grid-template-columns: 11rem minmax(0, 1fr); gap: var(--space-6); align-items: start; max-width: 84rem; margin: 0 auto; padding: var(--space-4) var(--space-4) 0; }
	aside { position: sticky; top: var(--space-4); }
</style>
