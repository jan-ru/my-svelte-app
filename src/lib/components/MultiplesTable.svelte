<script lang="ts">
	import { multipleById } from '#lib/catalog';
	import { formatMultiple } from '#lib/chart';
	import DataTable from '#lib/components/DataTable.svelte';
	import type { Column, Row } from '#lib/table';
	import type { Benchmark, PeerRow } from '#lib/valuation/data';

	let {
		peers,
		benchmarks,
		sectorLabel
	}: { peers: readonly PeerRow[]; benchmarks: readonly Benchmark[]; sectorLabel: string | null } = $props();

	const label = (id: string) => multipleById(id)?.label ?? id;
	const stats = [
		{ key: 'p25', label: 'Peers, 25th percentile' },
		{ key: 'median', label: 'Peers, median' },
		{ key: 'p75', label: 'Peers, 75th percentile' }
	] as const;
	const columns = $derived<readonly Column[]>(benchmarks.map((b) => ({ label: label(b.multiple), numeric: true })));
	const rows = $derived<readonly Row[]>([
		...peers.map((p): Row => ({
			key: p.symbol,
			label: p.symbol,
			sub: p.name !== p.symbol ? p.name : undefined,
			cells: p.message ? [] : benchmarks.map((b) => formatMultiple(p.multiples[b.multiple] ?? null)),
			note: p.message || undefined
		})),
		...stats.map((s): Row => ({
			key: s.key,
			label: s.label,
			summary: true,
			cells: benchmarks.map((b) => formatMultiple(b[s.key]))
		})),
		...(sectorLabel
			? [
					{
						key: 'sector',
						label: `Sector: ${sectorLabel}`,
						summary: true,
						cells: benchmarks.map((b) => formatMultiple(b.sector))
					} satisfies Row
				]
			: [])
	]);
</script>

<section>
	<h2>Multiples</h2>
	<DataTable rowHeader="Company" {columns} {rows} />
	<p class="meta">Zero and negative multiples are left out of the percentiles.</p>
</section>

<style>
	h2 {
		font-size: var(--text-lg);
		margin: var(--space-4) 0 var(--space-2);
	}
	.meta {
		color: var(--text-secondary);
		font-weight: var(--weight-regular);
	}
	.meta {
		margin: var(--space-2) 0;
		font-size: var(--text-sm);
	}
</style>
