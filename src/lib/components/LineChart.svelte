<script lang="ts">
	import { at } from '#lib/at';
	import { PALETTE, monthTicks, priceTicks } from '#lib/chart';
	import { formatPrice } from '#lib/prices';
	import type { PricePoint } from '#lib/source-data';

	let { points }: { points: PricePoint[] } = $props();

	const W = 720;
	const H = 320;
	const M = { top: 14, right: 16, bottom: 30, left: 60 };
	const plotW = W - M.left - M.right;
	const plotH = H - M.top - M.bottom;
	/** Per-point hover targets get heavy beyond about a year of daily data. */
	const MAX_HOVER_POINTS = 260;

	const closes = $derived(points.map((p) => p.close));
	const scale = $derived(priceTicks(Math.min(...closes), Math.max(...closes)));
	const x = (i: number) => M.left + (points.length > 1 ? (plotW * i) / (points.length - 1) : plotW / 2);
	const y = (v: number) => M.top + (plotH * (scale.max - v)) / (scale.max - scale.min);
	const line = $derived(points.map((p, i) => `${x(i).toFixed(1)},${y(p.close).toFixed(1)}`).join(' '));
	const months = $derived(monthTicks(points));
	// the page renders this chart only when there is at least one point
	const first = $derived(at(points, 0));
	const last = $derived(at(points, points.length - 1));
	const summary = $derived(
		`Daily closing price from ${first.date} to ${last.date}: ` +
			`from ${formatPrice(first.close)} to ${formatPrice(last.close)}, ` +
			`low ${formatPrice(Math.min(...closes))}, high ${formatPrice(Math.max(...closes))}.`
	);
	const tickLabel = (v: number) => v.toLocaleString('en', { maximumFractionDigits: 2 });
</script>

<svg viewBox="0 0 {W} {H}" role="img" aria-label={summary}>
	{#each scale.ticks as tick (tick)}
		<line class="gridline" x1={M.left} x2={W - M.right} y1={y(tick)} y2={y(tick)} />
		<text class="tick" x={M.left - 6} y={y(tick) + 4} text-anchor="end">{tickLabel(tick)}</text>
	{/each}

	{#each months as m (m.index)}
		<line class="gridline month" x1={x(m.index)} x2={x(m.index)} y1={M.top} y2={H - M.bottom} />
		<text class="tick" x={x(m.index)} y={H - M.bottom + 18} text-anchor="middle">{m.label}</text>
	{/each}

	{#if points.length > 1}
		<polyline points={line} fill="none" stroke={PALETTE[0]} stroke-width="1.75" stroke-linejoin="round" />
	{:else}
		<circle cx={x(0)} cy={y(first.close)} r="4" fill={PALETTE[0]} />
	{/if}

	{#if points.length <= MAX_HOVER_POINTS}
		{#each points as p, i (p.date)}
			<circle class="hit" cx={x(i)} cy={y(p.close)} r="6">
				<title>{p.date}: {formatPrice(p.close)}</title>
			</circle>
		{/each}
	{/if}
</svg>

<style>
	svg { width: 100%; height: auto; display: block; font-family: var(--font-sans); }
	.gridline { stroke: var(--border-subtle); stroke-width: 1; }
	.month { stroke-dasharray: 2 4; }
	.tick { font-size: 11px; fill: var(--text-secondary); font-variant-numeric: tabular-nums; }
	.hit { fill: transparent; }
	.hit:hover { fill: rgba(0, 114, 178, 0.35); }
</style>
