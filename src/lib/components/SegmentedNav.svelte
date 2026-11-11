<script lang="ts">
	import type { Segment } from '#lib/segments';

	/** A link-based segmented control: it works without JavaScript. An option without an `href` is shown disabled. */
	let { label, caption, items }: { label: string; caption?: string; items: readonly Segment[] } = $props();
</script>

<div class="wrap">
	{#if caption}<span class="caption">{caption}</span>{/if}
	<nav class="segmented" aria-label={label}>
		{#each items as item (item.label)}
			{#if item.href !== null}
				<a href={item.href} aria-current={item.current ? 'page' : undefined}>{item.label}</a>
			{:else}
				<span class="disabled" aria-disabled="true" title={item.title}>{item.label}</span>
			{/if}
		{/each}
	</nav>
</div>

<style>
	.wrap {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin: var(--space-3) 0;
		font-size: var(--text-sm);
	}
	.segmented {
		display: inline-flex;
		background: var(--white);
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-sm);
		overflow: hidden;
	}
	a,
	.disabled {
		padding: 6px 14px;
	}
	a {
		text-decoration: none;
		color: inherit;
	}
	a:hover {
		background: var(--blue-05);
	}
	a[aria-current='page'] {
		color: var(--text-on-primary);
		background: var(--color-primary);
	}
	.disabled {
		color: var(--text-disabled);
		background: var(--grey-02);
		cursor: not-allowed;
	}
</style>
