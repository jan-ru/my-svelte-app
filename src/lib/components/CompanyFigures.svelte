<script lang="ts">
	import type { CompanyFigures, Metric } from '#lib/valuation-data';
	import { METRIC_LABELS, formatAmount, scaleFor } from '#lib/valuation-format';

	let { figures }: { figures: CompanyFigures } = $props();

	const ROWS: readonly Metric[] = ['revenue', 'ebitda', 'ebit', 'netIncome', 'bookEquity'];
	const scale = $derived(scaleFor(figures.years.flatMap((y) => ROWS.map((m) => y.values[m]))));
</script>

<section>
	<h2>Company figures <small>({scale.label} of {figures.currency})</small></h2>
	<div class="scroll">
		<table>
			<thead>
				<tr>
					<th scope="col"></th>
					{#each figures.years as y (y.fiscalYear)}
						<th scope="col" class="num" class:forecast={y.kind === 'forecast'}
							>{y.fiscalYear}<br /><small>{y.kind === 'actual' ? 'Actual' : 'Forecast'}</small></th
						>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each ROWS as metric (metric)}
					<tr>
						<th scope="row">{METRIC_LABELS[metric]}</th>
						{#each figures.years as y (y.fiscalYear)}
							<td class="num" class:forecast={y.kind === 'forecast'}>{formatAmount(y.values[metric], scale)}</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
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
	table {
		width: 100%;
		font-size: var(--text-sm);
	}
	.num {
		text-align: right;
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}
	.forecast {
		background: var(--surface-group);
		font-style: italic;
	}
	.scroll {
		overflow-x: auto;
		background: var(--surface-card);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
	}
	.meta {
		margin: var(--space-2) 0;
		color: var(--text-secondary);
		font-size: var(--text-sm);
	}
</style>
