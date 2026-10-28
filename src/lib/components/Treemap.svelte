<script lang="ts">
	import { fit, squarify, wrap, type TreemapItem } from '#lib/size-treemap';
	import { formatPercent } from '#lib/size';

	let {
		items,
		selected = [],
		format,
		tileFormat = format,
		note = '',
		measureLabel,
		total
	}: {
		items: TreemapItem[];
		selected?: string[];
		format: (n: number) => string;
		/** A shorter form for the text inside tiles; explain it in `note`. */
		tileFormat?: (n: number) => string;
		/** Added to the caption, for example what a unit suffix means. */
		note?: string;
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

	// the tile under the pointer, in focus or touched: its full name and share are shown under the map
	let active = $state<string | null>(null);
	const activeItem = $derived(active ? byId.get(active) : undefined);
	const readout = $derived(
		activeItem
			? `${activeItem.label}: ${format(activeItem.value)} ${measureLabel} (${percent(activeItem.value)} of global)`
			: (linked ? 'Click a tile to select it, or a selected tile to remove it. Hover or focus a tile for its name and share.' : 'Hover over, focus or tap a tile for its name and share.')
	);
	const LINE = 12;
</script>

{#snippet tile(r: { id: string; x: number; y: number; w: number; h: number })}
	{@const item = byId.get(r.id)!}
	{@const room = Math.floor((r.h - 6) / LINE)}
	{@const lines = wrap(item.label, r.w, Math.min(2, room))}
	{@const value = lines.length > 0 && room > lines.length ? fit(tileFormat(item.value), r.w, 5.8) : ''}
	{@const on = selected.includes(r.id)}
	<rect
		x={r.x}
		y={r.y}
		width={r.w}
		height={r.h}
		fill={item.fill ?? '#B3D6FF'}
		fill-opacity={selected.length > 0 && !on ? 0.45 : 1}
		stroke={on ? '#1D2D3E' : '#FFFFFF'}
		stroke-width={on ? 3 : 2}
	/>
	{#if r.w > 6 && r.h > 6}
		<rect class="edge" x={r.x + 1.5} y={r.y + 1.5} width={r.w - 3} height={r.h - 3} fill="none" stroke="#1D2D3E" />
	{/if}
	<title>{item.label}: {format(item.value)} ({percent(item.value)})</title>
	{#each lines as line, i (i)}
		<text x={r.x + 5} y={r.y + 5 + LINE * (i + 1) - 2} fill="#1D2D3E" font-size="11" font-weight="600">{line}</text>
	{/each}
	{#if value}
		<text x={r.x + 5} y={r.y + 5 + LINE * (lines.length + 1) - 2} fill="#1D2D3E" font-size="10">{value}</text>
	{/if}
{/snippet}

<figure>
	<figcaption>Area shows {measureLabel}. Percentages are of the global total.{note ? ` ${note}` : ''}</figcaption>
	<svg viewBox="0 0 {W} {H}" role={linked ? 'group' : 'img'} aria-label={summary}>
		{#each rects as r (r.id)}
			{@const item = byId.get(r.id)!}
			{#if item.href}
				<a
					href={item.href}
					class="tile"
					onmouseover={() => (active = r.id)}
					onpointerdown={() => (active = r.id)}
					onfocus={() => (active = r.id)}
				>{@render tile(r)}</a>
			{:else}
				<!-- svelte-ignore a11y_no_static_element_interactions, a11y_mouse_events_have_key_events -->
				<g class="tile" onmouseover={() => (active = r.id)} onpointerdown={() => (active = r.id)}>{@render tile(r)}</g>
			{/if}
		{/each}
	</svg>
	<p class="readout">{readout}</p>
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
	.edge { stroke-opacity: 0.25; stroke-width: 1; pointer-events: none; }
	.tile:hover .edge { stroke-opacity: 0.8; stroke-width: 2; }
	.tile:focus-visible { outline: none; }
	.tile:focus-visible .edge { stroke: var(--border-focus); stroke-opacity: 1; stroke-width: 3; }
	text { pointer-events: none; }
	.readout { margin: var(--space-2) 0; min-height: 1.5em; color: var(--text-secondary); font-size: var(--text-sm); }
	figcaption { margin-bottom: var(--space-2); color: var(--text-secondary); font-size: var(--text-sm); }
	details { margin: var(--space-2) 0; }
	table { width: 100%; font-size: var(--text-sm); background: var(--surface-card); }
	th[scope='row'] { text-align: left; font-weight: var(--weight-regular); }
	td { text-align: right; }
</style>
