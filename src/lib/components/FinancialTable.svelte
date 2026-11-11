<script lang="ts">
	import DataTable from '#lib/components/DataTable.svelte';
	import { formatPrice } from '#lib/prices';
	import type { StatementTable } from '#lib/statements';
	import type { PriceTarget } from '#lib/source-data';

	let {
		title,
		table,
		message,
		target
	}: { title: string; table: StatementTable | null; message: string | null; target?: PriceTarget | null } = $props();
</script>

<section>
	<h2>
		{title}{#if table?.currency}
			<small>(millions of {table.currency}; per-share figures as reported)</small>{/if}
	</h2>
	{#if target}
		<dl class="facts">
			{#if target.consensus !== null}<dt>Price target, consensus</dt>
				<dd>{formatPrice(target.consensus)}</dd>{/if}
			{#if target.median !== null}<dt>Median</dt>
				<dd>{formatPrice(target.median)}</dd>{/if}
			{#if target.high !== null}<dt>High</dt>
				<dd>{formatPrice(target.high)}</dd>{/if}
			{#if target.low !== null}<dt>Low</dt>
				<dd>{formatPrice(target.low)}</dd>{/if}
		</dl>
	{/if}
	{#if table}
		<DataTable
			rowHeader="Line item"
			columns={table.columns.map((c) => ({ label: c.year, sub: c.date, numeric: true }))}
			rows={table.rows.map((r) => ({ key: r.key, label: r.label, cells: r.cells }))}
		/>
	{:else}
		<p>{message}</p>
	{/if}
</section>

<style>
	h2 {
		font-size: var(--text-lg);
		margin: var(--space-4) 0 var(--space-2);
	}
	small {
		font-weight: var(--weight-regular);
	}
	.facts {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: var(--space-1) var(--space-4);
		margin: var(--space-4) 0;
	}
	.facts dt {
		font-weight: var(--weight-semibold);
		color: var(--text-secondary);
	}
	.facts dd {
		margin: 0;
	}
</style>
