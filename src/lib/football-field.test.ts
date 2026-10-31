import { describe, expect, it } from 'vitest';
import { describeRow, fieldModel } from './football-field';
import { valuationView } from './valuation';
import type { CompanyFigures, PeerRow } from './valuation-data';

const figures: CompanyFigures = {
	name: 'Example',
	currency: 'EUR',
	origin: 'manual',
	netDebt: 100,
	years: [{ fiscalYear: '2025', kind: 'actual', values: { revenue: 1000, ebitda: 200 } }]
};
const peers: PeerRow[] = [
	{ symbol: 'A', name: 'A', multiples: { ev_ebitda: 6, ev_sales: 1 }, message: null },
	{ symbol: 'B', name: 'B', multiples: { ev_ebitda: 10, ev_sales: 3 }, message: null }
];

describe('fieldModel', () => {
	it('has one row per method with a range, ticks covering every value, the average and what it leaves out', () => {
		const view = valuationView({
			figures,
			multiples: ['ev_ebitda', 'ev_sales', 'pbv'],
			peers,
			sectors: { ev_ebitda: 12 },
			overrides: { ev_sales: { low: 2, high: 4 } }
		});
		const model = fieldModel(view)!;
		expect(model.rows).toEqual([
			{ label: 'EV/EBITDA', detail: 'EBITDA 2025, 7.0x to 9.0x', manual: false, low: 1300, mid: 1500, high: 1700, sector: 2300 },
			{ label: 'EV/Sales', detail: 'Revenue 2025, 2.0x to 4.0x', manual: true, low: 1900, mid: 2900, high: 3900, sector: null }
		]);
		expect(model.skipped).toEqual(['P/B']);
		expect(model.average).toBe(2200);
		expect(model.min).toBe(0);
		expect(model.max).toBeGreaterThanOrEqual(3900);
		expect(model.ticks[0]).toBe(0);
		expect(model.scale).toEqual({ divisor: 1, label: 'units' });
		expect(model.currency).toBe('EUR');
	});
	it('is null when no method has a range', () => {
		expect(fieldModel(valuationView({ figures, multiples: ['pbv'], peers, sectors: {} }))).toBeNull();
	});
	it('spans negative equity values', () => {
		const model = fieldModel(valuationView({ figures: { ...figures, netDebt: 2000 }, multiples: ['ev_ebitda'], peers, sectors: {} }))!;
		expect(model.min).toBeLessThan(0);
	});
});

describe('describeRow', () => {
	it('reads a row as one line, with the sector and manual markers when present', () => {
		const model = fieldModel(
			valuationView({ figures, multiples: ['ev_ebitda', 'ev_sales'], peers, sectors: { ev_ebitda: 12 }, overrides: { ev_sales: { low: 2, high: 4 } } })
		)!;
		expect(describeRow(model.rows[0], model)).toBe('EV/EBITDA (EBITDA 2025, 7.0x to 9.0x): 1,300 to 1,700, mid 1,500, at sector 2,300');
		expect(describeRow(model.rows[1], model)).toBe('EV/Sales (Revenue 2025, 2.0x to 4.0x, manual): 1,900 to 3,900, mid 2,900');
	});
});
