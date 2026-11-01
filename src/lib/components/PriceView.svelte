<script lang="ts">
	import LineChart from '#lib/components/LineChart.svelte';
	import { formatPrice, formatSigned, formatVolume, summarise } from '#lib/prices';
	import type { PricePoint } from '#lib/source-data';

	let { points, message }: { points: PricePoint[]; message: string | null } = $props();
	const s = $derived(summarise(points));
</script>

{#if s}
	<p class="meta">Last close, {s.date}. End-of-day prices, not live.</p>
	<dl class="quote">
		<div>
			<dt>Close</dt>
			<dd>{formatPrice(s.close)}</dd>
		</div>
		{#if s.change !== null}
			<div>
				<dt>Day change</dt>
				<dd class:up={s.change > 0} class:down={s.change < 0}>
					{formatSigned(s.change)}{#if s.changePct !== null}
						({formatSigned(s.changePct)}%){/if}
				</dd>
			</div>
		{/if}
		<div>
			<dt>52-week high</dt>
			<dd>{formatPrice(s.high)}</dd>
		</div>
		<div>
			<dt>52-week low</dt>
			<dd>{formatPrice(s.low)}</dd>
		</div>
		{#if s.volume !== null}<div>
				<dt>Volume</dt>
				<dd>{formatVolume(s.volume)}</dd>
			</div>{/if}
	</dl>
	<LineChart {points} />
	<details>
		<summary>Show data</summary>
		<div class="scroll tall">
			<table>
				<thead>
					<tr><th scope="col">Date</th><th scope="col" class="num">Close</th><th scope="col" class="num">Volume</th></tr
					>
				</thead>
				<tbody>
					{#each [...points].reverse() as p (p.date)}
						<tr>
							<th scope="row">{p.date}</th>
							<td class="num">{formatPrice(p.close)}</td>
							<td class="num">{p.volume === null ? '' : formatVolume(p.volume)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</details>
{:else}
	<p>{message}</p>
{/if}

<style>
	table {
		width: 100%;
		font-size: var(--text-sm);
	}
	.num {
		text-align: right;
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}
	.meta {
		margin: 0 0 var(--space-1);
		color: var(--text-secondary);
		font-size: var(--text-sm);
	}
	.quote {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2) var(--space-8);
		margin: var(--space-3) 0 var(--space-4);
	}
	.quote div {
		display: flex;
		flex-direction: column;
	}
	.quote dt {
		color: var(--text-secondary);
		font-size: var(--text-sm);
	}
	.quote dd {
		margin: 0;
		font-family: var(--font-mono);
		font-size: var(--text-lg);
		font-weight: var(--weight-medium);
		font-variant-numeric: tabular-nums;
	}
	.up {
		color: var(--positive);
	}
	.down {
		color: var(--negative);
	}
	.scroll {
		overflow-x: auto;
		background: var(--surface-card);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
	}
	.tall {
		max-height: 24rem;
		overflow-y: auto;
	}
	details {
		margin-top: var(--space-4);
	}
</style>
