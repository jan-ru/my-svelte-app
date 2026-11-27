import { render } from 'svelte/server';
import { createRawSnippet, type Component, type ComponentProps } from 'svelte';
import { describe, expect, it } from 'vitest';
import type { ReverseTrace, Trace } from '../crosswalk';
import { errorView } from '../error-view';
import type { PanelModel } from '../layout';
import ChartPanel from './ChartPanel.svelte';
import AppHeader from './AppHeader.svelte';
import Callout from './Callout.svelte';
import CheckGroup from './CheckGroup.svelte';
import ClassificationGlossary from './ClassificationGlossary.svelte';
import CrosswalkTrace from './CrosswalkTrace.svelte';
import DataTable from './DataTable.svelte';
import DisplaySwitch from './DisplaySwitch.svelte';
import SelectionChips from './SelectionChips.svelte';
import ErrorMessage from './ErrorMessage.svelte';
import Icon from './Icon.svelte';
import IndustryPicker from './IndustryPicker.svelte';
import Status from './Status.svelte';
import MacroTable from './MacroTable.svelte';
import PanelGrid from './PanelGrid.svelte';
import ReverseTraceView from './ReverseTraceView.svelte';
import SizeSelector from './SizeSelector.svelte';
import Treemap from './Treemap.svelte';
import BandNav from './BandNav.svelte';
import { MORE_FILL, MORE_ID } from '../size/bands';

type Renderer = (component: unknown, options: { props: unknown }) => { body: string };
/** Server-render a component to HTML (see financials-views.test.ts for why the cast). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- see above: ComponentProps needs it
const html = <C extends Component<any>>(component: C, props: ComponentProps<C>): string =>
	(render as unknown as Renderer)(component, { props }).body;

describe('Status', () => {
	const text = createRawSnippet(() => ({ render: () => '<b>+1.2</b>' }));
	it('shows an arrow and the colour class for a move, and nothing extra when flat', () => {
		const up = html(Status, { trend: 'up', children: text });
		expect(up).toContain('status up');
		expect(up).toContain('<svg');
		expect(up).toContain('aria-hidden="true"');
		expect(html(Status, { trend: 'down', children: text })).toContain('status down');
		expect(html(Status, { trend: 'flat', children: text })).not.toContain('<svg');
	});
});

describe('DataTable', () => {
	const props = {
		rowHeader: 'Line item',
		columns: [{ label: '2025', sub: '2025-12-31', numeric: true }, { label: 'Note' }],
		rows: [{ key: 'ni', label: 'Net income', cells: ['-12.5', '-see note'] }]
	};
	/** The markup without Svelte's comment markers, which sit around every `{#if}` and `{#each}`. */
	const table = (p: ComponentProps<typeof DataTable>) => html(DataTable, p).replace(/<!--[^]*?-->/g, '');
	it('writes the headers, with the row label as a row header', () => {
		const out = table(props);
		expect(out).toMatch(/<th scope="col"[^>]*>Line item<\/th>/);
		expect(out).toContain('2025-12-31');
		expect(out).toMatch(/<th scope="row"[^>]*>Net income<\/th>/);
	});
	it('aligns and colours only the negative numeric cells', () => {
		const out = table(props);
		expect(out).toMatch(
			/<td class="[^"]*num[^"]*negative[^"]*">-12.5<\/td>|<td class="[^"]*negative[^"]*num[^"]*">-12.5<\/td>/
		);
		expect(out).not.toMatch(/<td class="[^"]*negative[^"]*">-see note<\/td>/);
	});
	it('caps the height when tall', () => {
		expect(table({ ...props, tall: true })).toMatch(/class="scroll [^"]*\btall\b/);
		expect(table(props)).not.toMatch(/\btall\b/);
	});
	it('writes a caption for screen readers only when given one', () => {
		expect(table({ ...props, caption: 'Figures by year' })).toMatch(
			/<table[^>]*><caption class="sr-only">Figures by year<\/caption><thead/
		);
		expect(table(props)).not.toContain('<caption');
	});
	it('links the row label and writes the sub text after it, escaping both', () => {
		const rows = [{ key: 'a', label: 'A&B <Co>', sub: 'ticker', href: '/x?a=1&b=2', cells: ['1', '2'] }];
		expect(table({ ...props, rows })).toMatch(
			/<th scope="row"[^>]*><a href="\/x\?a=1&amp;b=2">A&amp;B &lt;Co><\/a><small[^>]*> ticker<\/small><\/th>/
		);
	});
	it('keeps a row label without href as text', () => {
		const out = table({ ...props, rows: [{ key: 'a', label: 'Plain', sub: 'sub', cells: ['1', '2'] }] });
		expect(out).toMatch(/<th scope="row"[^>]*>Plain<small[^>]*> sub<\/small><\/th>/);
		expect(out).not.toContain('<a ');
	});
	it('shows a note in one cell across every column instead of the cells', () => {
		const rows = [{ key: 'c', label: 'CCC', cells: [], note: 'No market cap for CCC' }];
		const out = table({ ...props, rows });
		expect(out).toMatch(/<td colspan="2" class="[^"]*\bnote\b[^"]*">No market cap for CCC<\/td>/);
		expect(out.match(/<td/g)).toHaveLength(1);
	});
	it('marks a summary row', () => {
		const rows = [
			{ key: 'a', label: 'One', cells: ['1', '2'] },
			{ key: 'm', label: 'Median', summary: true, cells: ['3', '4'] }
		];
		const out = table({ ...props, rows });
		expect(out.match(/<tr class="[^"]*\bsummary\b[^"]*">/g)).toHaveLength(1);
		expect(out).toMatch(/<tr class="[^"]*\bsummary\b[^"]*"><th scope="row"[^>]*>Median<\/th>/);
	});
	it('shades a forecast column in its header and in every cell', () => {
		const columns = [{ label: '2025' }, { label: '2026', forecast: true }];
		const out = table({ ...props, columns, rows: [{ key: 'r', label: 'Revenue', cells: ['1', '2'] }] });
		expect(out.match(/<th scope="col" class="[^"]*\bforecast\b/g)).toHaveLength(1);
		expect(out.match(/<td class="[^"]*\bforecast\b[^"]*">2<\/td>/g)).toHaveLength(1);
		expect(out).not.toMatch(/<td class="[^"]*\bforecast\b[^"]*">1<\/td>/);
	});
});

describe('AppHeader', () => {
	const props = { name: 'App', pathname: '/financials', search: '?symbol=AAPL', interactive: false };
	it('links the pages and marks the current one', () => {
		const out = html(AppHeader, props);
		expect(out).toContain('aria-label="Main"');
		expect(out).toMatch(/<a[^>]*aria-current="page"[^>]*>Financials<\/a>/);
		expect(out).toContain('>Valuation</a>');
	});
	it('puts the work pages first and About after them, on the right', () => {
		const labels = [...html(AppHeader, props).matchAll(/<a[^>]*>([^<]+)<\/a>/g)].map((m) => m[1]);
		expect(labels).toEqual(['App', 'Explore', 'Multiples', 'Financials', 'Valuation', 'About', 'Log in']);
	});
	it('shows Settings as a labelled gear only to an admin', () => {
		expect(html(AppHeader, props)).not.toContain('/settings');
		const out = html(AppHeader, { ...props, interactive: true, admin: true });
		expect(out).toMatch(/<a[^>]*href="\/settings"[^>]*aria-label="Settings"/);
		expect(out).toMatch(/href="\/about"[\s\S]*href="\/settings"[\s\S]*Log out/);
	});
	it('offers Log in with the way back when logged out', () => {
		const out = html(AppHeader, props);
		expect(out).toContain('Log in');
		expect(out).toContain(encodeURIComponent('/financials?symbol=AAPL'));
		expect(out).not.toContain('Log out');
	});
	it('offers Log out as a form when logged in', () => {
		const out = html(AppHeader, { ...props, interactive: true });
		expect(out).toContain('Log out');
		expect(out).toContain('method="POST"');
		expect(out).not.toContain('>Log in<');
	});
});

describe('Callout', () => {
	const text = createRawSnippet(() => ({ render: () => '<span>Careful</span>' }));
	it('announces an error: negative is role alert by default', () => {
		const out = html(Callout, { variant: 'negative', children: text });
		expect(out).toContain('role="alert"');
		expect(out).toContain('callout negative');
		expect(out).toContain('<span>Careful</span>');
	});
	it('has no role as an info notice, and takes the role it is given', () => {
		expect(html(Callout, { children: text })).not.toContain('role=');
		expect(html(Callout, { variant: 'critical', role: 'note', children: text })).toContain('role="note"');
	});
});

describe('Icon', () => {
	it('is hidden from screen readers when it is decoration', () => {
		const out = html(Icon, { name: 'close' });
		expect(out).toContain('aria-hidden="true"');
		expect(out).not.toContain('role="img"');
		expect(out).toContain('d="M4 4l8 8M12 4l-8 8"');
	});
	it('is an image with a name when given a label', () => {
		const out = html(Icon, { name: 'external', label: '(opens in a new tab)' });
		expect(out).toContain('role="img"');
		expect(out).toContain('aria-label="(opens in a new tab)"');
		expect(out).not.toContain('aria-hidden');
	});
});

describe('ErrorMessage', () => {
	it('shows the status, title and a way back', () => {
		const body = html(ErrorMessage, { status: 404, view: errorView(404, 'Not Found') });
		expect(body).toContain('Error 404');
		expect(body).toContain('<h1>Page not found</h1>');
		expect(body).toContain('href="/"');
		expect(body).not.toContain('Reference');
	});

	it('quotes the reference of an unexpected error', () => {
		const body = html(ErrorMessage, { status: 500, view: errorView(500, 'Something went wrong.', 'ref-1') });
		expect(body).toContain('<code>ref-1</code>');
	});
});

/** The text a visitor reads: tags and comments removed, spaces collapsed. */
const text = (body: string) =>
	body
		.replace(/<!--[^]*?-->/g, '')
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ');
const checkboxes = (body: string) => body.match(/<input type="checkbox"[^>]*>/g) ?? [];

describe('CheckGroup', () => {
	const options = [
		{ id: 'us', label: 'US' },
		{ id: 'eu', label: 'Europe' },
		{ id: 'jp', label: 'Japan' }
	];

	it('ticks the selected options and keeps the parameter with an empty hidden input', () => {
		const body = html(CheckGroup, { legend: 'Regions', name: 'r', options, selected: ['eu'], max: 3 });
		expect(body).toContain('1 of 3');
		expect(body).toContain('<input type="hidden" name="r" value=""');
		const boxes = checkboxes(body);
		expect(boxes).toHaveLength(3);
		expect(boxes.filter((b) => b.includes('checked'))).toHaveLength(1);
		expect(boxes.some((b) => b.includes('disabled'))).toBe(false);
	});

	it('disables the unticked options once the maximum is reached', () => {
		const body = html(CheckGroup, { legend: 'Regions', name: 'r', options, selected: ['us', 'eu'], max: 2 });
		const boxes = checkboxes(body);
		expect(boxes.filter((b) => b.includes('disabled'))).toHaveLength(1);
		expect(boxes.find((b) => b.includes('disabled'))).toContain('value="jp"');
	});
});

describe('IndustryPicker', () => {
	const industries = ['Banks', 'Retail', 'Software'];

	it('shows picked industries as chips and the rest in the list', () => {
		const body = html(IndustryPicker, { industries, selected: ['Retail'], max: 3 });
		expect(body).toContain('1 of 3');
		const boxes = checkboxes(body);
		expect(boxes).toHaveLength(3);
		expect(boxes.filter((b) => b.includes('checked'))).toEqual([expect.stringContaining('value="Retail"')]);
		expect(body).toContain('data-nosubmit');
	});

	it('disables the list when full and says when nothing is left', () => {
		const full = html(IndustryPicker, { industries, selected: ['Banks'], max: 1 });
		expect(checkboxes(full).filter((b) => b.includes('disabled'))).toHaveLength(2);
		expect(html(IndustryPicker, { industries: ['Banks'], selected: ['Banks'], max: 3 })).toContain(
			'No matching industries.'
		);
	});
});

describe('ChartPanel', () => {
	it('renders the chart and a data table with unavailable cells marked', () => {
		const panel: PanelModel = {
			key: 'k',
			title: 'EV/EBITDA',
			categories: ['Banks'],
			series: ['US', 'Europe'],
			bars: [
				[
					{ value: 12.345, firms: 40 },
					{ value: null, firms: null, error: 'no data' }
				]
			]
		};
		const body = html(ChartPanel, { panel, colors: ['#000', '#111'], uid: 0 });
		expect(body).toMatch(/<h2[^>]*>EV\/EBITDA<\/h2>/);
		expect(body).toContain('<svg');
		expect(body).toMatch(/<th scope="row"[^>]*>Banks<\/th>/);
		expect(text(body)).toContain('Banks 12.3x 40 firms unavailable');
		expect(body).toContain('Show data');
	});
	it('shows only the table, without the chart, as a table', () => {
		const panel: PanelModel = {
			key: 'k',
			title: 'EV/EBITDA',
			categories: ['Banks'],
			series: ['US'],
			bars: [[{ value: 8, firms: 3 }]]
		};
		const body = html(ChartPanel, { panel, colors: ['#000'], uid: 0, display: 'table' });
		expect(body).not.toContain('<svg');
		expect(body).not.toContain('Show data');
		expect(body).toMatch(/<th scope="col"[^>]*>US<\/th>/);
		// 3 firms is below LOW_FIRMS_THRESHOLD: the value is marked
		expect(text(body)).toContain('Banks 8.0x * 3 firms');
		expect(body).toMatch(/<span class="low[^"]*">\*<\/span>/);
	});
});

describe('SelectionChips', () => {
	it('writes each group with its chips and leaves out an empty group', () => {
		const body = html(SelectionChips, {
			groups: [
				{ label: 'Multiples', items: ['EV/EBITDA', 'P/E (trailing)'] },
				{ label: 'Regions', items: [] }
			]
		}).replace(/<!--[^]*?-->/g, '');
		expect(body).toContain('aria-label="Selection"');
		expect(body).toMatch(/<dt[^>]*>Multiples<\/dt>\s*<dd[^>]*>EV\/EBITDA<\/dd>\s*<dd[^>]*>P\/E \(trailing\)<\/dd>/);
		expect(body).not.toContain('Regions');
	});
});

describe('DisplaySwitch', () => {
	it('links both displays, keeps the query and marks the current one', () => {
		const body = html(DisplaySwitch, { display: 'table', search: '?m=pe_trailing&v=table' });
		expect(body).toMatch(/<a href="\?m=pe_trailing"[^>]*>Chart<\/a>/);
		expect(body).toMatch(/<a href="\?m=pe_trailing&amp;v=table"[^>]*aria-current="true"[^>]*>Table<\/a>/);
	});
});

describe('PanelGrid', () => {
	const panel = (key: string): PanelModel => ({
		key,
		title: `Panel ${key}`,
		categories: ['Banks'],
		series: ['US'],
		bars: [[{ value: 10, firms: 40 }]]
	});
	const colors = ['#000'];

	it('puts each panel in a wrapper that spans the whole grid on a phone and half of it from L', () => {
		const body = html(PanelGrid, { panels: [panel('a'), panel('b')], colors });
		expect(body).toMatch(/<div class="panels grid[^"]*"/);
		expect(body.match(/class="panel span-4 span-m-8 span-l-6 span-xl-8[ "]/g)).toHaveLength(2);
		expect(body).toMatch(/<h2[^>]*>Panel a<\/h2>/);
		expect(body).toMatch(/<h2[^>]*>Panel b<\/h2>/);
		expect(body).not.toContain('single');
	});

	it('marks a lone panel as single, which caps its width', () => {
		const body = html(PanelGrid, { panels: [panel('a')], colors });
		expect(body).toMatch(/<div class="panels grid[^"]*single/);
		expect(body.match(/class="panel span-4 span-m-8 span-l-6 span-xl-8[ "]/g)).toHaveLength(1);
	});

	it('gives each chart its own id prefix, so their SVG ids do not clash', () => {
		const body = html(PanelGrid, { panels: [panel('a'), panel('b')], colors });
		const ids = [...body.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
		expect(new Set(ids).size).toBe(ids.length);
	});
});

describe('classification views', () => {
	it('explains the abbreviations', () => {
		const body = html(ClassificationGlossary, {});
		expect(body).toMatch(/<dt[^>]*>SBI<\/dt>/);
		expect(body).toMatch(/<dt[^>]*>NAICS<\/dt>/);
	});

	it('follows an SBI code to SIC links and Damodaran industries', () => {
		const item = (code: string) => ({ code, title: `Title ${code}` });
		const trace: Trace = {
			start: item('6419'),
			nace21: [item('6419')],
			nace2: [item('6419')],
			isic4: [item('6419')],
			isic31: [],
			naics: [],
			sic: [item('6021')],
			damodaran: [{ industry: 'Banks (Regional)', companies: 12.4, share: 0.125 }]
		};
		const body = html(CrosswalkTrace, { trace });
		expect(body).toContain('<code>6419</code>');
		expect(body).toContain('No match in the correspondence table.');
		expect(body).toContain('href="/companies?sic=6021"');
		expect(body).toContain(`href="/?i=${encodeURIComponent('Banks (Regional)')}"`);
		expect(body).toContain('12.5%');
	});

	it('says when no companies share the SIC codes', () => {
		const empty = { code: '1', title: '' };
		const trace: Trace = {
			start: empty,
			nace21: [],
			nace2: [],
			isic4: [],
			isic31: [],
			naics: [],
			sic: [],
			damodaran: []
		};
		expect(html(CrosswalkTrace, { trace })).toContain('No companies in the NYU list share these SIC codes.');
	});

	it('ranks SBI classes for an industry and caps the list', () => {
		const reverse: ReverseTrace = {
			industry: 'Software',
			companies: 1,
			followed: 0.9,
			sic: [{ code: '7372', title: 'Prepackaged software', companies: 1 }],
			sbi25: [
				{ code: '6210', title: 'Programming', share: 0.6 },
				{ code: '5821', title: 'Publishing', share: 0.4 }
			]
		};
		const body = html(ReverseTraceView, { reverse, max: 1 });
		expect(text(body)).toContain('1 company in 1 SIC code');
		expect(text(body)).toContain('Showing the 1 best of 2');
		expect(body).toMatch(/<a href="\/classification\?code=6210#start">6210<\/a>/);
		expect(body).not.toContain('code=5821');
		expect(body).toContain('90.0%');
	});
});

describe('MacroTable', () => {
	const rows = [
		{
			country: 'Netherlands',
			inflation: { latest: { year: 2025, value: 2.9 }, average: 4.9, from: 2021 },
			growth: { latest: { year: 2025, value: -0.4 }, average: null, from: 2024 }
		},
		{ country: 'Taiwan', inflation: null, growth: null }
	];
	it('shows the latest value and the average per rate, with their years', () => {
		const t = text(html(MacroTable, { rows }));
		expect(t).toContain('Netherlands 2.9% (2025) 4.9% (2021–2025) −0.4% (2025) n/a');
		expect(t).toContain('Taiwan n/a n/a n/a n/a');
		expect(t).toContain('5-year average');
	});
});

describe('Treemap data table', () => {
	const items = [
		{ id: 'a', label: 'Alpha', value: 30 },
		{ id: 'b', label: 'Beta', value: 70 },
		{ id: 'z', label: 'Zero', value: 0 }
	];
	const props = { items, format: (n: number) => `${n} bn`, measureLabel: 'GDP', total: 200 };
	const dataTable = (body: string) => text(body.slice(body.indexOf('<details')));
	it('lists the items largest first with their share of the global total', () => {
		const table = dataTable(html(Treemap, props));
		expect(table).toContain('Name GDP Share of global');
		expect(table).toContain('Beta 70 bn 35% Alpha 30 bn 15%');
	});
	it('leaves out an item without a value', () => {
		expect(dataTable(html(Treemap, props))).not.toContain('Zero');
	});
});

describe('Treemap with a band', () => {
	const all = [
		{ id: 'a', label: 'Alpha', value: 300 },
		{ id: 'b', label: 'Beta', value: 200 },
		{ id: 'c', label: 'Gamma', value: 5 },
		{ id: 'd', label: 'Delta', value: 4 }
	];
	const moreTile = { id: MORE_ID, label: '2 smaller countries', value: 9, fill: MORE_FILL, href: '/countries?band=2' };
	const props = {
		items: [...all.slice(0, 2), moreTile],
		all,
		format: (n: number) => String(n),
		measureLabel: 'companies',
		total: 509
	};
	const dataTable = (body: string) => text(body.slice(body.indexOf('<details')));
	it('links the grey "more" tile to the next band and says what it is, without offering to select', () => {
		const body = html(Treemap, props);
		expect(body).toContain('href="/countries?band=2"');
		expect(body).toContain('role="group"');
		expect(text(body)).toContain('The grey tile is 2 smaller countries: click it to see them.');
		expect(text(body)).not.toContain('Click a tile to select it');
	});
	it('lists every item in the data table, the band\'s and the smaller ones, but not the "more" tile', () => {
		const table = dataTable(html(Treemap, props));
		expect(table).toContain('Alpha 300');
		expect(table).toContain('Delta 4');
		expect(table).not.toContain('smaller countries');
	});
	it('dims the other tiles only when a selected item is drawn in this band', () => {
		expect(html(Treemap, { ...props, selected: ['a'] })).toContain('fill-opacity="0.45"');
		// Delta is selected but sits in a smaller band: nothing here is dimmed
		expect(html(Treemap, { ...props, selected: ['d'] })).not.toContain('fill-opacity="0.45"');
	});
	it('leaves the "more" tile out of the summary of the largest items', () => {
		const body = html(Treemap, { ...props, items: [all[0] ?? moreTile, moreTile] });
		expect(body).toMatch(/aria-label="Treemap of 1 items by companies\. The largest are Alpha \(300\)\."/);
	});
});

describe('BandNav', () => {
	const href = (i: number) => `/countries?band=${String(i)}`;
	it('links to the larger and the smaller band, and says which ranks are shown', () => {
		const body = html(BandNav, {
			band: { index: 2, count: 3, first: 21, last: 50 },
			total: 180,
			noun: 'countries',
			href
		});
		expect(body).toContain('href="/countries?band=1"');
		expect(body).toContain('href="/countries?band=3"');
		expect(text(body)).toContain('◀ Larger countries Ranks 21 to 50 of 180 Smaller countries ▶');
	});
	it('offers only the way that exists at either end, and nothing for a single band', () => {
		expect(
			text(html(BandNav, { band: { index: 1, count: 3, first: 1, last: 20 }, total: 180, noun: 'countries', href }))
		).not.toContain('Larger');
		expect(
			text(html(BandNav, { band: { index: 3, count: 3, first: 51, last: 180 }, total: 180, noun: 'countries', href }))
		).not.toContain('Smaller');
		expect(
			html(BandNav, { band: { index: 1, count: 1, first: 1, last: 9 }, total: 9, noun: 'countries', href })
		).not.toContain('<nav');
	});
});

describe('SizeSelector', () => {
	it('lists countries, industries and sectors alphabetically', () => {
		const body = html(SizeSelector, {
			action: '/countries',
			nav: { measure: 'companies', countries: [], industries: [], sectors: [], band: 1 },
			countries: ['Romania', 'United Kingdom', 'China', 'Åland', 'germany'],
			industries: ['Steel', 'Banks'],
			sectors: ['Utilities', 'Energy']
		});
		const options = [...body.matchAll(/<option value="([^"]+)"/g)].map((m) => m[1]);
		expect(options).toEqual([
			'Åland',
			'China',
			'germany',
			'Romania',
			'United Kingdom',
			'Banks',
			'Steel',
			'Energy',
			'Utilities'
		]);
	});
});
