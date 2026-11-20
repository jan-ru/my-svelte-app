<script lang="ts">
	import type { Band } from '#lib/size/bands';

	let {
		band,
		total,
		noun,
		href
	}: {
		/** The band the treemap shows. */
		band: Band;
		/** How many items the ranking holds in all. */
		total: number;
		/** What the items are, plural: "countries" or "industries". */
		noun: string;
		/** The URL of band `index` (1-based). */
		href: (index: number) => string;
	} = $props();
</script>

{#if band.count > 1}
	<nav class="bands" aria-label="Zoom through the {noun}">
		{#if band.index > 1}
			<a href={href(band.index - 1)} rel="prev">◀ Larger {noun}</a>
		{/if}
		<span class="where">Ranks {band.first} to {band.last} of {total}</span>
		{#if band.index < band.count}
			<a href={href(band.index + 1)} rel="next">Smaller {noun} ▶</a>
		{/if}
	</nav>
{/if}

<style>
	.bands {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--space-2) var(--space-4);
		margin: var(--space-2) 0;
		font-size: var(--text-sm);
	}
	.where {
		color: var(--text-secondary);
	}
</style>
