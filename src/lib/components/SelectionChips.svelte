<script lang="ts">
	// What a view shows, as read-only chips per group (SAP's tokens): "Multiples: EV/EBITDA, P/E".
	let { groups }: { groups: readonly { readonly label: string; readonly items: readonly string[] }[] } = $props();
</script>

<dl class="chips" aria-label="Selection">
	{#each groups as group (group.label)}
		{#if group.items.length > 0}
			<div class="group">
				<dt>{group.label}</dt>
				{#each group.items as item (item)}<dd>{item}</dd>{/each}
			</div>
		{/if}
	{/each}
</dl>

<style>
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2) var(--space-6);
		margin: var(--space-3) 0;
	}
	.group {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1) var(--space-2);
	}
	dt {
		font-size: var(--text-sm);
		color: var(--text-secondary);
	}
	dt::after {
		content: ':';
	}
	dd {
		margin: 0;
		padding: 0.125rem var(--space-2);
		font-size: var(--text-sm);
		background: var(--surface-card);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
	}
</style>
