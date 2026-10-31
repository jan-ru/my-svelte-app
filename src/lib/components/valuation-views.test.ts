import { render } from 'svelte/server';
import type { Component, ComponentProps } from 'svelte';
import { describe, expect, it } from 'vitest';
import { valuationView } from '../valuation';
import type { CompanyFigures, PeerRow } from '../valuation-data';
import CompanyFiguresView from './CompanyFigures.svelte';
import MultiplesTable from './MultiplesTable.svelte';
import PeerPicker from './PeerPicker.svelte';
import ValuationTable from './ValuationTable.svelte';

type Renderer = (component: unknown, options: { props: unknown }) => { body: string };
/** Server-render a component to HTML (see financials-views.test.ts for why the cast). */
const html = <C extends Component<any>>(component: C, props: ComponentProps<C>): string =>
	(render as unknown as Renderer)(component, { props }).body;
const text = (body: string) => body.replace(/<!--[^]*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

const figures: CompanyFigures = {
	name: 'ACCENSS BV',
	currency: 'EUR',
	origin: 'manual',
	netDebt: 50_000,
	years: [
		{ fiscalYear: '2025', kind: 'actual', values: { revenue: 238_251, ebitda: 67_208, netIncome: -39_781 } },
		{ fiscalYear: '2026', kind: 'forecast', values: { revenue: 285_901, ebitda: 80_818 } }
	]
};
const peers: PeerRow[] = [
	{ symbol: 'AAA', name: 'Alpha', multiples: { ev_ebitda: 6, ps: 1 }, message: null },
	{ symbol: 'BBB', name: 'BBB', multiples: { ev_ebitda: 10, ps: 3 }, message: null },
	{ symbol: 'CCC', name: 'Gamma', multiples: { ev_ebitda: null, ps: null }, message: 'No market cap for CCC, so no multiples.' }
];
const result = valuationView({ figures, multiples: ['ev_ebitda', 'ps', 'pbv'], peers, sectors: { ev_ebitda: 7 }, overrides: { ps: { low: 3, high: 5 } } });

describe('CompanyFigures', () => {
	it('shows actual and forecast years in a readable unit, negatives in brackets', () => {
		const body = text(html(CompanyFiguresView, { figures }));
		expect(body).toContain('(thousands of EUR)');
		expect(body).toContain('2025 Actual');
		expect(body).toContain('2026 Forecast');
		expect(body).toContain('238');
		expect(body).toContain('(40)');
		expect(body).toContain('Net debt (latest balance sheet): 50');
	});
});

describe('PeerPicker', () => {
	it('ticks the picked peers, offers the suggestions and a field for more', () => {
		const body = html(PeerPicker, { picked: peers.slice(0, 2), suggestions: [{ symbol: 'DDD', name: 'Delta', price: null, marketCap: null }], max: 8 });
		expect(body).toMatch(/name="peer" value="AAA" checked/);
		expect(body).toMatch(/name="peer" value="DDD"/);
		expect(body).not.toMatch(/value="DDD"[^>]*checked/);
		expect(text(body)).toContain('2 of 8');
		expect(text(body)).toContain('Suggested by FMP');
	});
	it('says when none are picked and disables adding once full', () => {
		expect(text(html(PeerPicker, { picked: [], suggestions: [], max: 8 }))).toContain('No peers picked yet');
		const full = html(PeerPicker, { picked: peers.slice(0, 2), suggestions: [{ symbol: 'DDD', name: null, price: null, marketCap: null }], max: 2 });
		expect(full).toMatch(/value="DDD" disabled/);
	});
});

describe('MultiplesTable', () => {
	it('lists each peer, the percentiles and the sector row', () => {
		const body = text(html(MultiplesTable, { peers, benchmarks: result.benchmarks, sectorLabel: 'Semiconductor, Europe' }));
		expect(body).toContain('EV/EBITDA');
		expect(body).toContain('AAA Alpha 6.0x 1.0x');
		expect(body).toContain('No market cap for CCC');
		expect(body).toContain('Peers, median 8.0x 2.0x n/a');
		expect(body).toContain('Sector: Semiconductor, Europe 7.0x n/a n/a');
	});
	it('leaves out the sector row without an industry', () => {
		expect(text(html(MultiplesTable, { peers, benchmarks: result.benchmarks, sectorLabel: null }))).not.toContain('Sector:');
	});
});

describe('ValuationTable', () => {
	it('shows the range per method, a manual band, the reason a method is missing, and the average', () => {
		const body = text(html(ValuationTable, { result }));
		expect(body).toContain('(thousands of EUR)');
		expect(body).toContain('EV/EBITDA EBITDA 2025 7.0x to 9.0x 420 488 555 420');
		expect(body).toContain('3.0x to 5.0x manual');
		expect(body).toContain('The company figure for this multiple is missing.');
		expect(body).toMatch(/Average [\d,]+/);
	});
});
