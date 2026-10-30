<script lang="ts">
	import { formatNewsDate } from '#lib/company';
	import type { Source } from '#lib/source';
	import type { NewsItem } from '#lib/source-data';

	let { items, message, source }: { items: NewsItem[]; message: string | null; source: Source } = $props();
</script>

{#if source === 'yahoo'}<p class="meta">Matched by company name, so some headlines may be only loosely related.</p>{/if}
{#if items.length > 0}
	<ul class="news">
		{#each items as item, i (i)}
			<li>
				<h2>
					{#if item.url}<a href={item.url} target="_blank" rel="noopener noreferrer">{item.title}</a>{:else}{item.title}{/if}
				</h2>
				{#if item.publisher || item.date}
					<p class="meta">{[item.publisher, formatNewsDate(item.date)].filter(Boolean).join(' · ')}</p>
				{/if}
				{#if item.text}<p>{item.text}</p>{/if}
			</li>
		{/each}
	</ul>
{:else}
	<p>{message}</p>
{/if}

<style>
	.news { list-style: none; margin: 0; padding: 0; }
	.news li { padding: var(--space-3) 0; border-bottom: 1px solid var(--border-subtle); }
	.news h2 { margin: 0 0 var(--space-1); font-size: var(--text-md); }
	.meta { margin: 0 0 var(--space-1); color: var(--text-secondary); font-size: var(--text-sm); }
</style>
