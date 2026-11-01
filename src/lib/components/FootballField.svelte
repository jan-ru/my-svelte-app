<script lang="ts">
	import { PALETTE } from '#lib/chart';
	import { describeRow, type FieldModel } from '#lib/football-field';
	import { formatAmount } from '#lib/valuation-format';

	let { model }: { model: FieldModel } = $props();

	const W = 720;
	const ROW_H = 50;
	const M = { top: 12, right: 24, bottom: 44, left: 250 };
	const plotW = W - M.left - M.right;
	const H = $derived(M.top + model.rows.length * ROW_H + M.bottom);
	const plotBottom = $derived(H - M.bottom);
	const BAR_H = 18;

	const x = (v: number) => M.left + (plotW * (v - model.min)) / (model.max - model.min);
	const rowY = (i: number) => M.top + i * ROW_H + ROW_H / 2;
	const f = (v: number) => formatAmount(v, model.scale);
	const short = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
	const summary = $derived(
		`Equity value range per method, ${model.scale.label} of ${model.currency}. ` +
			model.rows.map((r) => describeRow(r, model)).join('; ') +
			(model.average === null ? '' : `. Average ${f(model.average)}`)
	);
</script>

<figure>
	<svg viewBox="0 0 {W} {H}" role="img" aria-label={summary}>
		{#each model.ticks as tick (tick)}
			<line class="grid" class:zero={tick === 0} x1={x(tick)} x2={x(tick)} y1={M.top} y2={plotBottom} />
			<text class="tick" x={x(tick)} y={plotBottom + 16} text-anchor="middle">{f(tick)}</text>
		{/each}
		<text class="axis" x={M.left + plotW / 2} y={H - 6} text-anchor="middle"
			>Equity value ({model.scale.label} of {model.currency})</text
		>

		<!-- drawn before the rows so the bars and value labels sit on top of it -->
		{#if model.average !== null}
			<line class="average" x1={x(model.average)} x2={x(model.average)} y1={M.top - 4} y2={plotBottom} />
		{/if}

		{#each model.rows as row, i (row.label)}
			{@const y = rowY(i)}
			<g class="row">
				<title>{describeRow(row, model)}</title>
				<rect class="hit" x={M.left} y={y - ROW_H / 2} width={plotW} height={ROW_H} />
				<text class="label" x={M.left - 10} y={y - 3} text-anchor="end">{row.label}</text>
				<text class="detail" x={M.left - 10} y={y + 11} text-anchor="end"
					>{short(row.detail, 36)}{row.manual ? ' · manual' : ''}</text
				>
				<rect
					class="range"
					x={x(row.low)}
					y={y - BAR_H / 2}
					width={Math.max(x(row.high) - x(row.low), 2)}
					height={BAR_H}
					rx="4"
					fill={PALETTE[0]}
				/>
				<line class="mid" x1={x(row.mid)} x2={x(row.mid)} y1={y - BAR_H / 2 - 3} y2={y + BAR_H / 2 + 3} />
				{#if row.sector !== null}
					{@const sx = x(row.sector)}
					<!-- below the bar, so it never covers the value labels at its ends -->
					<path
						class="sector"
						d="M {sx} {y + BAR_H / 2 + 2} L {sx + 6} {y + BAR_H / 2 + 11} L {sx - 6} {y + BAR_H / 2 + 11} Z"
					/>
				{/if}
				<text class="value" x={x(row.low) - 4} y={y + 4} text-anchor="end">{f(row.low)}</text>
				<text class="value" x={x(row.high) + 4} y={y + 4}>{f(row.high)}</text>
			</g>
		{/each}
	</svg>
	<figcaption>
		<span class="key"
			><span class="swatch" style:background={PALETTE[0]}></span>P25 to P75 of peers (or manual band)</span
		>
		<span class="key"><span class="tick-key"></span>Median (midpoint of a manual band)</span>
		<span class="key"><span class="triangle"></span>At sector multiple</span>
		{#if model.average !== null}<span class="key"><span class="dash"></span>Average {f(model.average)}</span>{/if}
		{#if model.skipped.length > 0}<span class="skipped">Not shown: {model.skipped.join(', ')} (see the table).</span
			>{/if}
	</figcaption>
</figure>

<style>
	figure {
		margin: var(--space-4) 0;
		padding: var(--space-3);
		background: var(--surface-card);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
	}
	svg {
		width: 100%;
		height: auto;
		display: block;
		font-family: var(--font-sans);
	}
	.grid {
		stroke: var(--border-subtle);
		stroke-width: 1;
	}
	.grid.zero {
		stroke: var(--grey-07);
	}
	.tick,
	.detail,
	.value {
		font-size: 11px;
		fill: var(--text-secondary);
		font-variant-numeric: tabular-nums;
	}
	/* a halo keeps the end values readable where the average line crosses them */
	.value {
		paint-order: stroke;
		stroke: var(--surface-card);
		stroke-width: 4px;
		stroke-linejoin: round;
	}
	.axis {
		font-size: 11px;
		fill: var(--text-secondary);
	}
	.label {
		font-size: 13px;
		font-weight: 600;
		fill: var(--text-primary);
	}
	.hit {
		fill: transparent;
	}
	.row:hover .hit {
		fill: var(--surface-hover);
	}
	.mid {
		stroke: var(--text-primary);
		stroke-width: 2;
	}
	.sector {
		fill: var(--text-primary);
	}
	.average {
		stroke: var(--text-primary);
		stroke-width: 2;
		stroke-dasharray: 5 4;
	}
	figcaption {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2) var(--space-4);
		margin-top: var(--space-2);
		font-size: var(--text-sm);
		color: var(--text-secondary);
	}
	.key {
		display: inline-flex;
		gap: 6px;
		align-items: center;
	}
	.swatch {
		width: 18px;
		height: 10px;
		border-radius: 3px;
	}
	.tick-key {
		width: 2px;
		height: 14px;
		background: var(--text-primary);
	}
	.triangle {
		width: 0;
		height: 0;
		border-left: 6px solid transparent;
		border-right: 6px solid transparent;
		border-bottom: 9px solid var(--text-primary);
	}
	.dash {
		width: 18px;
		border-top: 2px dashed var(--text-primary);
	}
</style>
