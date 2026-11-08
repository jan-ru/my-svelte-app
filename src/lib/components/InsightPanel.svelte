<script lang="ts">
	import { describeUpside, formatPrice, qualityRows } from '#lib/insight';
	import type { Insight } from '#lib/insight';

	let { insight, symbol }: { insight: Insight; symbol: string } = $props();

	const fair = $derived(insight.fairValue);
	const quality = $derived(insight.quality);
	const FAIR_ROWS = [
		['Income based', 'income'],
		['Revenue based', 'revenue'],
		['Dividend based', 'dividend']
	] as const;
</script>

<section aria-labelledby="insight-heading">
	<h2 id="insight-heading">Eulerpool's view of {symbol}</h2>
	<p class="meta">
		Eulerpool's own estimates, shown for comparison. They do not feed the valuation below and the method is not
		published. Data by <a href="https://eulerpool.com" rel="noopener noreferrer">Eulerpool</a>.
	</p>
	{#if insight.message}<p class="error" role="alert">{insight.message}</p>{/if}
	<div class="panels">
		{#if fair}
			<div class="card">
				<h3>Fair value per share</h3>
				<p class="headline">
					<span class="big">{formatPrice(fair.fairValue, fair.currency)}</span>
					<span class="upside">{describeUpside(fair.upside)}</span>
				</p>
				<table>
					<caption class="sr-only">Fair value by method, against the last price</caption>
					<tbody>
						{#each FAIR_ROWS as [label, key] (key)}
							<tr><th scope="row">{label}</th><td class="num">{formatPrice(fair[key], fair.currency)}</td></tr>
						{/each}
						<tr><th scope="row">Last price</th><td class="num">{formatPrice(fair.lastPrice, fair.currency)}</td></tr>
					</tbody>
				</table>
			</div>
		{/if}
		{#if quality}
			<div class="card">
				<h3>Quality score (AAQS)</h3>
				<p class="headline"><span class="big">{quality.score}</span> <span class="upside">out of 10</span></p>
				<table>
					<caption class="sr-only">The figures behind the quality score</caption>
					<tbody>
						{#each qualityRows(quality) as row (row.label)}
							<tr><th scope="row">{row.label}</th><td class="num">{row.value}</td></tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
</section>

<style>
	h2 {
		font-size: var(--text-lg);
		margin: var(--space-4) 0 var(--space-2);
	}
	h3 {
		font-size: var(--text-base);
		margin: 0 0 var(--space-2);
	}
	.meta {
		margin: var(--space-2) 0;
		color: var(--text-secondary);
		font-size: var(--text-sm);
	}
	.panels {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-4);
	}
	.card {
		flex: 1 1 22rem;
		padding: var(--space-3) var(--space-4);
		background: var(--surface-card);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
	}
	.headline {
		margin: 0 0 var(--space-2);
	}
	.big {
		font-size: var(--text-xl);
		font-weight: var(--weight-bold);
		font-variant-numeric: tabular-nums;
	}
	.upside {
		color: var(--text-secondary);
		font-size: var(--text-sm);
	}
	table {
		width: 100%;
		font-size: var(--text-sm);
	}
	th {
		text-align: left;
		font-weight: var(--weight-regular);
	}
	.num {
		text-align: right;
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}
</style>
