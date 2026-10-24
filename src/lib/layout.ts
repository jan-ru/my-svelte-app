import { multipleById, regionById, type Role } from './catalog';
import type { Layout, Selection } from './params';
import type { Comparison } from './server/compare';

export interface Bar {
	value: number | null;
	firms: number | null;
	error?: string;
}

export interface PanelModel {
	key: string;
	title: string;
	categories: string[];
	series: string[];
	/** bars[categoryIndex][seriesIndex] */
	bars: Bar[][];
}

export interface LayoutModel {
	/** Shared legend: the labels of the colour dimension. */
	series: string[];
	panels: PanelModel[];
}

interface Item {
	id: string;
	label: string;
}

function itemsFor(role: Role, selection: Selection): Item[] {
	switch (role) {
		case 'multiples':
			return selection.multiples.map((id) => ({ id, label: multipleById(id)?.label ?? id }));
		case 'regions':
			return selection.regions.map((id) => ({ id, label: regionById(id)?.label ?? id }));
		case 'industries':
			return selection.industries.map((name) => ({ id: name, label: name }));
	}
}

export function buildLayout(selection: Selection, layout: Layout, comparison: Comparison): LayoutModel {
	const panelItems = itemsFor(layout.panels, selection);
	const xItems = itemsFor(layout.x, selection);
	const colorItems = itemsFor(layout.color, selection);

	const panels = panelItems.map((panel) => ({
		key: panel.id,
		title: panel.label,
		categories: xItems.map((x) => x.label),
		series: colorItems.map((c) => c.label),
		bars: xItems.map((x) =>
			colorItems.map((color): Bar => {
				const at: Record<Role, string> = { multiples: '', regions: '', industries: '' };
				at[layout.panels] = panel.id;
				at[layout.x] = x.id;
				at[layout.color] = color.id;

				const error = comparison.errors[`${at.multiples}:${at.regions}`];
				if (error) return { value: null, firms: null, error };

				const cell = comparison.cells[at.multiples]?.[at.regions]?.[at.industries];
				return { value: cell?.value ?? null, firms: cell?.firms ?? null };
			})
		)
	}));

	return { series: colorItems.map((c) => c.label), panels };
}
