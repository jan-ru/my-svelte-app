<script lang="ts">
	import DataTable from '#lib/components/DataTable.svelte';
	import type { CompanyFigures, Metric } from '#lib/valuation/data';
	import { METRIC_LABELS, formatAmount, scaleFor } from '#lib/valuation/format';

	let { figures }: { figures: CompanyFigures } = $props();

	const ROWS: readonly Metric[] = ['revenue', 'ebitda', 'ebit', 'netIncome', 'bookEquity'];
	const scale = $derived(scaleFor(figures.years.flatMap((y) => ROWS.map((m) => y.values[m]))));
	const columns = $derived(
		figures.years.map((y) => ({
			label: String(y.fiscalYear),
			sub: y.kind === 'actual' ? 'Actual' : 'Forecast',
			numeric: true,
			forecast: y.kind === 'forecast'
		}))
	);
	const rows = $derived(
		ROWS.map((metric) => ({
			key: metric,
			label: METRIC_LABELS[metric],
			cells: figures.years.map((y) => formatAmount(y.values[metric], scale))
		}))
	);
</script>

<section>
	<h2>Company figures <small>({scale.label} of {figures.currency})</small></h2>
	<DataTable rowHeader="" {columns} {rows} />
	<p class="meta">Net debt (latest balance sheet): {formatAmount(figures.netDebt, scale)}</p>
</section>

<style>
	h2 {
		font-size: var(--text-lg);
		margin: var(--space-4) 0 var(--space-2);
	}
	small {
		font-weight: var(--weight-regular);
		color: var(--text-secondary);
	}
	.meta {
		margin: var(--space-2) 0;
		color: var(--text-secondary);
		font-size: var(--text-sm);
	}
</style>
