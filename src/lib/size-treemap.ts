export interface TreemapItem {
	id: string;
	label: string;
	value: number;
	fill?: string;
	/** Only set for interactive visitors: anonymous pages link to no query variant. */
	href?: string;
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
