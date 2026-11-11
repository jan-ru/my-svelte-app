<script lang="ts">
	import DataTable from '#lib/components/DataTable.svelte';
	import LineChart from '#lib/components/LineChart.svelte';
	import Status from '#lib/components/Status.svelte';
	import { formatPrice, formatSigned, formatVolume, summarise, trendOf } from '#lib/prices';
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
				<dd>
					<Status trend={trendOf(s.change)}>
						{formatSigned(s.change)}{#if s.changePct !== null}
							({formatSigned(s.changePct)}%){/if}
					</Status>
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
		<DataTable
			tall
			rowHeader="Date"
			columns={[
				{ label: 'Close', numeric: true },
				{ label: 'Volume', numeric: true }
			]}
			rows={[...points].reverse().map((p) => ({
				key: p.date,
				label: p.date,
				cells: [formatPrice(p.close), p.volume === null ? '' : formatVolume(p.volume)]
			}))}
		/>
	</details>
{:else}
	<p>{message}</p>
{/if}

<style>
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
	details {
		margin-top: var(--space-4);
	}
</style>
