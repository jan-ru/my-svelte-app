<script lang="ts">
	let {
		chips,
		clearHref
	}: {
		chips: { label: string; href: string }[];
		/** Where "Clear all" goes. */
		clearHref: string;
	} = $props();
</script>

{#if chips.length > 0}
	<div class="bar" role="group" aria-label="Selection">
		<span class="title">Selected:</span>
		{#each chips as c (c.label)}
			<a class="chip" href={c.href} aria-label="Remove {c.label}">{c.label} <span aria-hidden="true">✕</span></a>
		{/each}
		<a class="clear" href={clearHref}>Clear all</a>
	</div>
{/if}

<style>
	.bar { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); margin: var(--space-3) 0; }
	.title { color: var(--text-secondary); font-size: var(--text-sm); }
	.chip { padding: 2px var(--space-3); background: var(--surface-card); border: 1px solid var(--border-subtle); border-radius: 999px; font-size: var(--text-sm); text-decoration: none; }
	.chip:hover { border-color: var(--text-secondary); }
	.clear { font-size: var(--text-sm); }
</style>
