<script lang="ts">
	import { LOW_FIRMS_THRESHOLD, formatMultiple, niceTicks } from '#lib/chart';
	import type { PanelModel } from '#lib/layout';

	let {
		panel,
		colors,
		uid
	}: { panel: PanelModel; colors: readonly string[]; uid: number } = $props();

	const W = 520;
	const H = 300;
	const M = { top: 16, right: 12, bottom: 64, left: 48 };
	const plotW = W - M.left - M.right;
	const plotH = H - M.top - M.bottom;

	const values = $derived(
		panel.bars
			.flat()
			.map((b) => b.value)
			.filter((v): v is number => v !== null)
	);
	const scale = $derived(niceTicks(Math.min(0, ...values), Math.max(0, ...values)));
	const groupW = $derived(plotW / panel.categories.length);
	const inner = $derived(groupW * 0.8);
	const barW = $derived(inner / panel.series.length);

	const y = (v: number) => M.top + (plotH * (scale.max - v)) / (scale.max - scale.min);
	const barX = (ci: number, si: number) => M.left + ci * groupW + (groupW - inner) / 2 + si * barW;
	const short = (s: string) => (s.length > 18 ? `${s.slice(0, 17)}…` : s);
	const isLow = (firms: number | null) => firms !== null && firms < LOW_FIRMS_THRESHOLD;

	const summary = $derived(
		`${panel.title}. ` +
			panel.categories
				.map(
					(cat, ci) =>
						`${cat}: ` +
						panel.series.map((name, si) => `${name} ${formatMultiple(panel.bars[ci][si].value)}`).join(', ')
				)
				.join('; ')
	);
</script>

<svg viewBox="0 0 {W} {H}" role="img" aria-label={summary}>
	<defs>
		{#each panel.series as _, si}
			<pattern
				id="hatch-{uid}-{si}"
				width="6"
				height="6"
				patternUnits="userSpaceOnUse"
				patternTransform="rotate(45)"
			>
				<rect width="6" height="6" fill={colors[si]} />
				<line x1="3" y1="0" x2="3" y2="6" stroke="#fff" stroke-width="2.5" />
			</pattern>
		{/each}
	</defs>

	{#each scale.ticks as tick (tick)}
		<line class="gridline" class:zero={tick === 0} x1={M.left} x2={W - M.right} y1={y(tick)} y2={y(tick)} />
		<text class="tick" x={M.left - 6} y={y(tick) + 4} text-anchor="end">{tick}</text>
	{/each}

	{#each panel.categories as category, ci}
		{#each panel.series as name, si}
			{@const bar = panel.bars[ci][si]}
			<g>
				<title>
					{name} · {category}: {bar.error ?? formatMultiple(bar.value)}{bar.firms !== null
						? ` (${bar.firms} firms)`
						: ''}
				</title>
				{#if bar.value === null}
					<text class="na" x={barX(ci, si) + barW / 2} y={y(0) - 4} text-anchor="middle">{bar.error ? 'unavailable' : 'n/a'}</text>
				{:else}
					<rect
						x={barX(ci, si)}
						y={Math.min(y(bar.value), y(0))}
						width={Math.max(barW - 1, 1)}
						height={Math.abs(y(bar.value) - y(0))}
						fill={isLow(bar.firms) ? `url(#hatch-${uid}-${si})` : colors[si]}
					/>
				{/if}
			</g>
		{/each}
		<text class="category" x={M.left + ci * groupW + groupW / 2} y={H - M.bottom + 18} text-anchor="middle">
			<title>{category}</title>
			{short(category)}
		</text>
	{/each}
</svg>

<style>
	svg {
		width: 100%;
		height: auto;
		display: block;
	}
	.gridline {
		stroke: #ddd;
		stroke-width: 1;
	}
	.gridline.zero {
		stroke: #666;
	}
	.tick {
		font-size: 11px;
		fill: #555;
	}
	.category {
		font-size: 11px;
		fill: #222;
	}
	.na {
		font-size: 9px;
		fill: #888;
	}
</style>
