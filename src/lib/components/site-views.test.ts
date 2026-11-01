import { render } from 'svelte/server';
import type { Component, ComponentProps } from 'svelte';
import { describe, expect, it } from 'vitest';
import type { ReverseTrace, Trace } from '../crosswalk';
import { errorView } from '../error-view';
import type { PanelModel } from '../layout';
import ChartPanel from './ChartPanel.svelte';
import CheckGroup from './CheckGroup.svelte';
import ClassificationGlossary from './ClassificationGlossary.svelte';
import CrosswalkTrace from './CrosswalkTrace.svelte';
import ErrorMessage from './ErrorMessage.svelte';
import IndustryPicker from './IndustryPicker.svelte';
import MacroTable from './MacroTable.svelte';
import ReverseTraceView from './ReverseTraceView.svelte';
import SizeSelector from './SizeSelector.svelte';

type Renderer = (component: unknown, options: { props: unknown }) => { body: string };
/** Server-render a component to HTML (see financials-views.test.ts for why the cast). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- see above: ComponentProps needs it
const html = <C extends Component<any>>(component: C, props: ComponentProps<C>): string =>
	(render as unknown as Renderer)(component, { props }).body;

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
		expect(text(body)).toContain('Banks 12.3x unavailable');
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
		expect(body).toContain('<code>6210</code>');
		expect(body).not.toContain('<code>5821</code>');
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

describe('SizeSelector', () => {
	it('lists countries, industries and sectors alphabetically', () => {
		const body = html(SizeSelector, {
			action: '/countries',
			nav: { measure: 'companies', countries: [], industries: [], sectors: [] },
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
