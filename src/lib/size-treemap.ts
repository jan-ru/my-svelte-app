export interface TreemapItem {
	id: string;
	label: string;
	value: number;
	fill?: string;
	/** Only set for interactive visitors: anonymous pages link to no query variant. */
	href?: string;
	/** Id of the group (for example a sector) the tile sits in; used with `nest`. */
	group?: string;
}

export interface Rect {
	id: string;
	x: number;
	y: number;
	w: number;
	h: number;
}

/** Squarified treemap (Bruls, Huizing, van Wijk): rectangles with areas proportional to the values, as square as it can. Zero and negative values are dropped. */
export function squarify<T extends { id: string; value: number }>(items: readonly T[], width: number, height: number): Rect[] {
	const sorted = items.filter((i) => Number.isFinite(i.value) && i.value > 0).sort((a, b) => b.value - a.value);
	if (sorted.length === 0 || width <= 0 || height <= 0) return [];
	const total = sorted.reduce((s, i) => s + i.value, 0);
	const scale = (width * height) / total;
	const queue = sorted.map((i) => ({ id: i.id, area: i.value * scale }));
	const out: Rect[] = [];
	let x = 0;
	let y = 0;
	let w = width;
	let h = height;
	let row: { id: string; area: number }[] = [];

	const sum = (r: { area: number }[]) => r.reduce((s, n) => s + n.area, 0);
	const worst = (r: { area: number }[], side: number) => {
		const s = sum(r);
		const areas = r.map((n) => n.area);
		return Math.max((side * side * Math.max(...areas)) / (s * s), (s * s) / (side * side * Math.min(...areas)));
	};
	const layout = (r: { id: string; area: number }[]) => {
		const s = sum(r);
		if (w >= h) {
			// a column on the left, as tall as what is left
			const cw = s / h;
			let cy = y;
			for (const n of r) {
				out.push({ id: n.id, x, y: cy, w: cw, h: n.area / cw });
				cy += n.area / cw;
			}
			x += cw;
			w -= cw;
		} else {
			// a row on top, as wide as what is left
			const rh = s / w;
			let cx = x;
			for (const n of r) {
				out.push({ id: n.id, x: cx, y, w: n.area / rh, h: rh });
				cx += n.area / rh;
			}
			y += rh;
			h -= rh;
		}
	};

	while (queue.length > 0) {
		const side = Math.min(w, h);
		const next = queue[0];
		if (row.length === 0 || worst([...row, next], side) <= worst(row, side)) {
			row.push(queue.shift()!);
		} else {
			layout(row);
			row = [];
		}
	}
	if (row.length > 0) layout(row);
	return out;
}

/** A label shortened to fit a tile of the given width (about 6.5 px per character); '' when there is no room. */
export function fit(label: string, width: number, charWidth = 6.5): string {
	const max = Math.floor((width - 8) / charWidth);
	if (max < 3) return '';
	return label.length <= max ? label : `${label.slice(0, max - 1)}…`;
}

/** A label wrapped on spaces into at most `maxLines` lines that fit a tile of the given width; the last line ends in '…' when words are left over; [] when there is no room. */
export function wrap(label: string, width: number, maxLines: number, charWidth = 5.8): string[] {
	const max = Math.floor((width - 8) / charWidth);
	if (max < 3 || maxLines < 1) return [];
	const lines: string[] = [];
	let cur = '';
	for (const word of label.split(/\s+/).filter(Boolean)) {
		// a word that is wider than the tile is cut with an ellipsis rather than broken mid-word
		const w = word.length > max ? `${word.slice(0, max - 1)}…` : word;
		if (!cur) cur = w;
		else if (cur.length + 1 + w.length <= max) cur += ` ${w}`;
		else {
			lines.push(cur);
			cur = w;
		}
	}
	if (cur) lines.push(cur);
	if (lines.length <= maxLines) return lines;
	const kept = lines.slice(0, maxLines);
	const last = kept[maxLines - 1];
	kept[maxLines - 1] = `${last.length >= max ? last.slice(0, max - 1) : last}…`;
	return kept;
}

export interface NestedLayout {
	/** One block per group, sized by the sum of its tiles. */
	groups: (Rect & { value: number })[];
	tiles: Rect[];
}

/** Two levels: groups laid out by their totals, each group's items squarified inside it below a header strip. */
export function nest<T extends { id: string; value: number; group: string }>(items: readonly T[], width: number, height: number, header = 18, pad = 2): NestedLayout {
	const sums = new Map<string, number>();
	for (const i of items) if (Number.isFinite(i.value) && i.value > 0) sums.set(i.group, (sums.get(i.group) ?? 0) + i.value);
	const blocks = squarify([...sums].map(([id, value]) => ({ id, value })), width, height);
	const groups = blocks.map((b) => ({ ...b, value: sums.get(b.id)! }));
	const tiles: Rect[] = [];
	for (const g of groups) {
		const inner = { x: g.x + pad, y: g.y + header, w: g.w - 2 * pad, h: g.h - header - pad };
		const members = items.filter((i) => i.group === g.id);
		for (const t of squarify(members, inner.w, inner.h)) tiles.push({ ...t, x: t.x + inner.x, y: t.y + inner.y });
	}
	return { groups, tiles };
}
