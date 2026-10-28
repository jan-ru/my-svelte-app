<script lang="ts">
	import { fit, squarify, type TreemapItem } from '#lib/size-treemap';
	import { formatPercent } from '#lib/size';

	let {
		items,
		selected = [],
		format,
		measureLabel,
		total
	}: {
		items: TreemapItem[];
		selected?: string[];
		format: (n: number) => string;
		measureLabel: string;
		/** The global total the percentages in the table refer to. */
		total: number;
	} = $props();

	const W = 720;
	const H = 420;
	const rects = $derived(squarify(items, W, H));
	const byId = $derived(new Map(items.map((i) => [i.id, i])));
	const sorted = $derived([...items].filter((i) => i.value > 0).sort((a, b) => b.value - a.value));
	const summary = $derived(
		sorted.length === 0
			? `No ${measureLabel} data for this selection.`
			: `Treemap of ${sorted.length} items by ${measureLabel}. The largest are ` +
					sorted.slice(0, 3).map((i) => `${i.label} (${format(i.value)})`).join(', ') +
					'.'
	);
	const percent = (value: number) => formatPercent(total > 0 ? (100 * value) / total : 0);
	// role="img" would hide the links from assistive technology, so linked treemaps are a labelled group instead
	const linked = $derived(items.some((i) => i.href));
</script>

{#snippet tile(r: { id: string; x: number; y: number; w: number; h: number })}
	{@const item = byId.get(r.id)!}
	<rect
		x={r.x}
		y={r.y}
		width={r.w}
		height={r.h}
		fill={item.fill ?? '#B3D6FF'}
		stroke={selected.includes(r.id) ? '#1D2D3E' : '#FFFFFF'}
		stroke-width={selected.includes(r.id) ? 3 : 1}
	/>
	<title>{item.label}: {format(item.value)} ({percent(item.value)})</title>
	{#if fit(item.label, r.w) && r.h >= 26}
		<text x={r.x + 6} y={r.y + 17} fill="#1D2D3E" font-size="12" font-weight="600">{fit(item.label, r.w)}</text>
		{#if r.h >= 42}
			<text x={r.x + 6} y={r.y + 33} fill="#1D2D3E" font-size="11">{fit(format(item.value), r.w)}</text>
		{/if}
	{/if}
{/snippet}

<figure>
	<figcaption>Area shows {measureLabel}. Percentages are of the global total.</figcaption>
	<svg viewBox="0 0 {W} {H}" role={linked ? 'group' : 'img'} aria-label={summary}>
		{#each rects as r (r.id)}
			{@const item = byId.get(r.id)!}
			{#if item.href}
				<a href={item.href} class="tile">{@render tile(r)}</a>
			{:else}
				<g>{@render tile(r)}</g>
			{/if}
		{/each}
	</svg>
	<details>
		<summary>Show data</summary>
		<table>
			<thead><tr><th scope="col">Name</th><th scope="col">{measureLabel}</th><th scope="col">Share of global</th></tr></thead>
			<tbody>
				{#each sorted as item (item.id)}
					<tr><th scope="row">{item.label}</th><td>{format(item.value)}</td><td>{percent(item.value)}</td></tr>
				{/each}
			</tbody>
		</table>
	</details>
</figure>

<style>
	figure { margin: var(--space-4) 0; }
	svg { width: 100%; height: auto; display: block; background: var(--surface-card); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); }
	.tile:focus-visible rect { stroke: var(--border-focus); stroke-width: 3; }
	.tile:hover rect { opacity: 0.85; }
	figcaption { margin-bottom: var(--space-2); color: var(--text-secondary); font-size: var(--text-sm); }
	details { margin: var(--space-2) 0; }
	table { width: 100%; font-size: var(--text-sm); background: var(--surface-card); }
	th[scope='row'] { text-align: left; font-weight: var(--weight-regular); }
	td { text-align: right; }
</style>
