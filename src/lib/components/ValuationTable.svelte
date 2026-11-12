<script lang="ts">
	import { formatMultiple } from '#lib/chart';
	import DataTable from '#lib/components/DataTable.svelte';
	import type { Column, Row } from '#lib/table';
	import type { ValuationView } from '#lib/valuation/data';
	import { METRIC_LABELS, REASON_TEXT, formatAmount, scaleFor } from '#lib/valuation/format';

	let { result }: { result: ValuationView } = $props();

	const scale = $derived(scaleFor(result.methods.flatMap((m) => (m.ok ? [m.low, m.mid, m.high, m.sector] : []))));
	const columns: readonly Column[] = [
		{ label: 'Applied to' },
		{ label: 'Band', numeric: true },
		{ label: 'Low', numeric: true },
		{ label: 'Mid', numeric: true },
		{ label: 'High', numeric: true },
		{ label: 'At sector', numeric: true }
	];
	const rows: readonly Row[] = $derived([
		...result.methods.map((m): Row =>
			m.ok
				? {
						key: m.multiple,
						label: m.label,
						cells: [
							`${METRIC_LABELS[m.metric]} ${m.fiscalYear}`,
							`${formatMultiple(m.band.low)} to ${formatMultiple(m.band.high)}${m.bandSource === 'manual' ? ' (manual)' : ''}`,
							formatAmount(m.low, scale),
							formatAmount(m.mid, scale),
							formatAmount(m.high, scale),
							formatAmount(m.sector, scale)
						]
					}
				: { key: m.multiple, label: m.label, cells: [], note: REASON_TEXT[m.reason] }
		),
		{
			key: 'average',
			label: 'Average',
			summary: true,
			cells: ['', '', '', formatAmount(result.average, scale), '', '']
		}
	]);
</script>

<section>
	<h2>Equity value <small>({scale.label} of {result.currency})</small></h2>
	<DataTable rowHeader="Method" {columns} {rows} />
	<p class="meta">
		Low and high use the peers' 25th and 75th percentile, mid the median. EV multiples subtract net debt.
	</p>
</section>

<style>
	h2 {
		font-size: var(--text-lg);
		margin: var(--space-4) 0 var(--space-2);
	}
	small,
	.meta {
		color: var(--text-secondary);
		font-weight: var(--weight-regular);
	}
	.meta {
		margin: var(--space-2) 0;
		font-size: var(--text-sm);
	}
</style>
