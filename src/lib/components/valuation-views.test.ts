import { render } from 'svelte/server';
import type { Component, ComponentProps } from 'svelte';
import { describe, expect, it } from 'vitest';
import { valuationView } from '../valuation/valuation';
import type { CompanyFigures, PeerRow } from '../valuation/data';
import { fieldModel } from '../football-field';
import type { Insight } from '../insight';
import BandOverrides from './BandOverrides.svelte';
import CompanyFiguresView from './CompanyFigures.svelte';
import FootballField from './FootballField.svelte';
import InsightPanel from './InsightPanel.svelte';
import MultiplesTable from './MultiplesTable.svelte';
import PeerPicker from './PeerPicker.svelte';
import ValuationTable from './ValuationTable.svelte';

type Renderer = (component: unknown, options: { props: unknown }) => { body: string };
/** Server-render a component to HTML (see financials-views.test.ts for why the cast). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- see above: ComponentProps needs it
const html = <C extends Component<any>>(component: C, props: ComponentProps<C>): string =>
	(render as unknown as Renderer)(component, { props }).body;
const text = (body: string) =>
	body
		.replaceAll('\u00a0', ' ')
		.replace(/<!--[^]*?-->/g, '')
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ');

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
	{
		symbol: 'CCC',
		name: 'Gamma',
		multiples: { ev_ebitda: null, ps: null },
		message: 'No market cap for CCC, so no multiples.'
	}
];
const result = valuationView({
	figures,
	multiples: ['ev_ebitda', 'ps', 'pbv'],
	peers,
	sectors: { ev_ebitda: 7 },
	overrides: { ps: { low: 3, high: 5 } }
});

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
		const body = html(PeerPicker, {
			picked: peers.slice(0, 2),
			suggestions: [{ symbol: 'DDD', name: 'Delta', price: null, marketCap: null }],
			max: 8
		});
		expect(body).toMatch(/name="peer" value="AAA" checked/);
		expect(body).toMatch(/name="peer" value="DDD"/);
		expect(body).not.toMatch(/value="DDD"[^>]*checked/);
		expect(text(body)).toContain('2 of 8');
		expect(text(body)).toContain('Suggested by FMP');
	});
	it('says when none are picked and disables adding once full', () => {
		expect(text(html(PeerPicker, { picked: [], suggestions: [], max: 8 }))).toContain('No peers picked yet');
		const full = html(PeerPicker, {
			picked: peers.slice(0, 2),
			suggestions: [{ symbol: 'DDD', name: null, price: null, marketCap: null }],
			max: 2
		});
		expect(full).toMatch(/value="DDD" disabled/);
	});
});

describe('MultiplesTable', () => {
	it('lists each peer, the percentiles and the sector row', () => {
		const body = text(
			html(MultiplesTable, { peers, benchmarks: result.benchmarks, sectorLabel: 'Semiconductor, Europe' })
		);
		expect(body).toContain('EV/EBITDA');
		expect(body).toContain('AAA Alpha 6.0x 1.0x');
		expect(body).toContain('No market cap for CCC');
		expect(body).toContain('Peers, median 8.0x 2.0x n/a');
		expect(body).toContain('Sector: Semiconductor, Europe 7.0x n/a n/a');
	});
	it('leaves out the sector row without an industry', () => {
		expect(text(html(MultiplesTable, { peers, benchmarks: result.benchmarks, sectorLabel: null }))).not.toContain(
			'Sector:'
		);
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

describe('FootballField', () => {
	const model = fieldModel(result)!;
	it('draws a bar per method and summarises the chart for screen readers', () => {
		const body = html(FootballField, { model });
		expect(body).toContain('role="img"');
		expect(body).toMatch(
			/aria-label="Equity value range per method, thousands of EUR\. EV\/EBITDA \(EBITDA 2025, 7\.0x to 9\.0x\): 420 to 555, mid 488, at sector 420/
		);
		expect((body.match(/class="range[^"]*"/g) ?? []).length).toBe(2);
		expect((body.match(/class="sector[^"]*"/g) ?? []).length).toBe(1);
		const t = text(body);
		expect(t).toContain('Equity value (thousands of EUR)');
		expect(t).toContain('P/S');
		expect(t).toContain('· manual');
		expect(t).toContain('Not shown: P/B (see the table).');
		expect(t).toMatch(/Average [\d,]+/);
	});
	it('has no average line or skipped note when there is nothing to show', () => {
		const body = html(FootballField, { model: { ...model, average: null, skipped: [] } });
		expect(body).not.toMatch(/class="average/);
		expect(text(body)).not.toContain('Not shown');
	});
});

describe('BandOverrides', () => {
	it('offers low and high per multiple, filled from the URL, with the peer percentiles as placeholders', () => {
		const body = html(BandOverrides, { benchmarks: result.benchmarks, overrides: { ps: { low: 3, high: 5 } } });
		expect(body).toMatch(/name="lo\.ev_ebitda"[^>]*value=""[^>]*placeholder="7\.0"/);
		expect(body).toMatch(/name="hi\.ev_ebitda"[^>]*placeholder="9\.0"/);
		expect(body).toMatch(/name="lo\.ps"[^>]*value="3"/);
		expect(body).toMatch(/name="hi\.ps"[^>]*value="5"/);
		expect(body).toMatch(/name="lo\.pbv"[^>]*placeholder=""/);
		expect(text(body)).toContain('manual');
	});
});

describe('InsightPanel', () => {
	const full: Insight = {
		fairValue: {
			fairValue: 1342.11,
			income: 1342.11,
			revenue: 1141.36,
			dividend: 1347.73,
			lastPrice: 1283.6,
			upside: 4.56,
			currency: 'EUR'
		},
		quality: {
			score: 10,
			revenueGrowth10Y: 0.179,
			revenueGrowth3Y: 0.155,
			ebitGrowth10Y: 0.225,
			ebitGrowth3Y: 0.201,
			profitContinuity10Y: 10,
			netDebtToEbit: -2.05,
			ebitMaxDrawdown10Y: -0.059,
			returnOnEquity: 0.49,
			roce: 0.43,
			expectedReturn: 0.363
		},
		message: null
	};
	const panel = (insight: Insight) => text(html(InsightPanel, { insight, symbol: 'ASML.AS' }));

	it('shows the fair value, each method, the last price and what the upside means', () => {
		const out = panel(full);
		expect(out).toContain("Eulerpool's view of ASML.AS");
		expect(out).toContain('EUR 1,342.11');
		expect(out).toContain('+4.6% (price below fair value)');
		for (const row of ['Income based', 'Revenue based', 'Dividend based', 'Last price']) expect(out).toContain(row);
		expect(out).toContain('EUR 1,141.36');
	});
	it('shows the quality score out of ten with the figures behind it', () => {
		const out = panel(full);
		expect(out).toContain('Quality score (AAQS)');
		expect(out).toMatch(/10\s+out of 10/);
		expect(out).toContain('Return on equity 49.0%');
		expect(out).toContain('Net debt to EBIT -2.0×');
	});
	it('credits Eulerpool and says it does not feed the valuation', () => {
		const body = html(InsightPanel, { insight: full, symbol: 'ASML.AS' });
		expect(body).toContain('href="https://eulerpool.com"');
		expect(text(body)).toContain('do not feed the valuation');
	});
	it('shows a part that is there and the reason for the one that is not', () => {
		const out = panel({ ...full, quality: null, message: 'Eulerpool has no quality score for ASML.AS.' });
		expect(out).toContain('Fair value per share');
		expect(out).not.toContain('Quality score (AAQS)');
		expect(out).toContain('Eulerpool has no quality score for ASML.AS.');
	});
	it('shows only the message when there is nothing', () => {
		const out = panel({ fairValue: null, quality: null, message: 'Eulerpool is unavailable right now for X.' });
		expect(out).toContain('Eulerpool is unavailable right now for X.');
		expect(out).not.toContain('Fair value per share');
	});
});
