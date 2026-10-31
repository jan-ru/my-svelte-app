<script lang="ts">
	import { formatMultiple } from '#lib/chart';
	import type { ValuationView } from '#lib/valuation-data';
	import { METRIC_LABELS, REASON_TEXT, formatAmount, scaleFor } from '#lib/valuation-format';

	let { result }: { result: ValuationView } = $props();

	const scale = $derived(
		scaleFor(result.methods.flatMap((m) => (m.ok ? [m.low, m.mid, m.high, m.sector] : [])))
	);
</script>

<section>
	<h2>Equity value <small>({scale.label} of {result.currency})</small></h2>
	<div class="scroll">
		<table>
			<thead>
				<tr>
					<th scope="col">Method</th>
					<th scope="col">Applied to</th>
					<th scope="col" class="num">Band</th>
					<th scope="col" class="num">Low</th>
					<th scope="col" class="num">Mid</th>
					<th scope="col" class="num">High</th>
					<th scope="col" class="num">At sector</th>
				</tr>
			</thead>
			<tbody>
				{#each result.methods as m (m.multiple)}
					<tr>
						<th scope="row">{m.label}</th>
						{#if m.ok}
							<td>{METRIC_LABELS[m.metric]} {m.fiscalYear}</td>
							<td class="num">{formatMultiple(m.band.low)} to {formatMultiple(m.band.high)}{#if m.bandSource === 'manual'} <small>manual</small>{/if}</td>
							<td class="num">{formatAmount(m.low, scale)}</td>
							<td class="num">{formatAmount(m.mid, scale)}</td>
							<td class="num">{formatAmount(m.high, scale)}</td>
							<td class="num">{formatAmount(m.sector, scale)}</td>
						{:else}
							<td colspan="6" class="note">{REASON_TEXT[m.reason]}</td>
						{/if}
					</tr>
				{/each}
			</tbody>
			<tfoot>
				<tr>
					<th scope="row">Average</th>
					<td colspan="3"></td>
					<td class="num">{formatAmount(result.average, scale)}</td>
					<td colspan="2"></td>
				</tr>
			</tfoot>
		</table>
	</div>
	<p class="meta">Low and high use the peers' 25th and 75th percentile, mid the median. EV multiples subtract net debt.</p>
</section>

<style>
	h2 { font-size: var(--text-lg); margin: var(--space-4) 0 var(--space-2); }
	small, .note, .meta { color: var(--text-secondary); font-weight: var(--weight-regular); }
	table { width: 100%; font-size: var(--text-sm); }
	.num { text-align: right; font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
	tfoot th, tfoot td { border-top: 1px solid var(--border-strong); font-weight: var(--weight-semibold); }
	.scroll { overflow-x: auto; background: var(--surface-card); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); }
	.meta { margin: var(--space-2) 0; font-size: var(--text-sm); }
</style>
