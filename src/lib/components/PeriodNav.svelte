<script lang="ts">
	import { PERIODS, navHref, type Nav, type Period } from '#lib/financials-nav';
	import { periodAvailable, sourceLabel, type Source } from '#lib/source';

	/** Annual or trailing twelve months. A period the source cannot serve is shown disabled, with the reason. */
	let { nav, period, source, symbol }: { nav: Nav; period: Period; source: Source; symbol: string } = $props();
</script>

<nav class="period" aria-label="Period">
	{#each PERIODS as p (p.id)}
		{#if periodAvailable(source, p.id)}
			<a href={navHref({ ...nav, period: p.id }, symbol)} aria-current={period === p.id ? 'page' : undefined}
				>{p.label}</a
			>
		{:else}
			<span
				class="disabled"
				aria-disabled="true"
				title="Trailing twelve months is not available from {sourceLabel(source)}. Choose Yahoo.">{p.label}</span
			>
		{/if}
	{/each}
</nav>

<style>
	.period {
		display: inline-flex;
		margin: var(--space-3) 0;
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
