<script lang="ts">
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
	<h2>{title}{#if table?.currency} <small>(millions of {table.currency}; per-share figures as reported)</small>{/if}</h2>
	{#if target}
		<dl class="facts">
			{#if target.consensus !== null}<dt>Price target, consensus</dt><dd>{formatPrice(target.consensus)}</dd>{/if}
			{#if target.median !== null}<dt>Median</dt><dd>{formatPrice(target.median)}</dd>{/if}
			{#if target.high !== null}<dt>High</dt><dd>{formatPrice(target.high)}</dd>{/if}
			{#if target.low !== null}<dt>Low</dt><dd>{formatPrice(target.low)}</dd>{/if}
		</dl>
	{/if}
	{#if table}
		<div class="scroll">
			<table>
				<thead>
					<tr>
						<th scope="col">Line item</th>
						{#each table.columns as c, i (i)}
							<th scope="col" class="num">{c.year}<br /><small>{c.date}</small></th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each table.rows as row (row.key)}
						<tr>
							<th scope="row">{row.label}</th>
							{#each row.cells as cell, i (i)}<td class="num">{cell}</td>{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else}
		<p>{message}</p>
	{/if}
</section>

<style>
	h2 { font-size: var(--text-lg); margin: var(--space-4) 0 var(--space-2); }
	small { font-weight: var(--weight-regular); }
	table { width: 100%; font-size: var(--text-sm); }
	.num { text-align: right; font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
	.scroll { overflow-x: auto; background: var(--surface-card); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); }
	.facts { display: grid; grid-template-columns: max-content 1fr; gap: var(--space-1) var(--space-4); margin: var(--space-4) 0; }
	.facts dt { font-weight: var(--weight-semibold); color: var(--text-secondary); }
	.facts dd { margin: 0; }
</style>
