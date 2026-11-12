<script lang="ts">
	import DataTable from '#lib/components/DataTable.svelte';
	import { describeSupplyChain, formatCorrelation, relationship } from '#lib/supply-chain';
	import type { SupplyChain } from '#lib/source-data';
	import type { Column, Row } from '#lib/table';

	let {
		chain,
		message,
		hrefFor
	}: { chain: SupplyChain | null; message: string | null; hrefFor: (symbol: string) => string | null } = $props();

	const columns: readonly Column[] = [
		{ label: 'Relationship' },
		{ label: 'Country' },
		{ label: 'Industry' },
		{ label: 'Correlation, 1 year', numeric: true },
		{ label: 'Correlation, 3 months', numeric: true }
	];
	const rows = $derived<readonly Row[]>(
		(chain?.links ?? []).map((link) => ({
			key: link.symbol,
			label: link.name,
			sub: link.symbol,
			href: hrefFor(link.symbol) ?? undefined,
			cells: [
				relationship(link),
				link.country ?? 'n/a',
				link.industry ?? 'n/a',
				formatCorrelation(link.correlation1y),
				formatCorrelation(link.correlation3m)
			]
		}))
	);
</script>

<p class="test" role="note">
	<strong>Test.</strong> This tab is an experiment to see whether Eulerpool's supply chain data is useful. It may change or
	be removed.
</p>
{#if chain}
	<p class="summary">{describeSupplyChain(chain)}</p>
	<p class="meta">
		Treat this as a list of leads, not a verified supply chain. It holds genuine suppliers and customers next to
		unrelated companies, leaves some real ones out, and gives no size for any relationship. It is listed by name. The
		correlations show how closely the share prices have moved together, from −1 to 1; they say nothing about how large
		or real a relationship is. Companies outside the US are covered thinly.
	</p>
	<DataTable
		rowHeader="Company"
		caption="Companies linked to the one shown, as supplier, customer or both"
		{columns}
		{rows}
	/>
{:else}
	<p>{message}</p>
{/if}

<style>
	.test {
		margin: 0 0 var(--space-3);
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--border-subtle);
		border-left-width: 4px;
		border-radius: var(--radius-md);
		background: var(--surface-card);
		font-size: var(--text-sm);
	}
	.summary {
		margin: 0 0 var(--space-1);
	}
	.meta {
		margin: 0 0 var(--space-3);
		color: var(--text-secondary);
		font-size: var(--text-sm);
	}
</style>
