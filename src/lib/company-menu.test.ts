import { describe, expect, it } from 'vitest';
import { at } from './at';
import { companyMenu } from './company-menu';
import { TABS } from './financials-nav';

describe('companyMenu', () => {
	it('lists every Financials tab, then Valuation', () => {
		const items = companyMenu({ symbol: 'AAPL', current: 'news' });
		expect(items.map((i) => i.label)).toEqual([...TABS.map((t) => t.label), 'Valuation']);
	});
	it('marks the current tab only', () => {
		const items = companyMenu({ symbol: 'AAPL', current: 'news' });
		expect(items.filter((i) => i.current).map((i) => i.label)).toEqual(['News']);
	});
	it('marks Valuation as current on the valuation page', () => {
		const items = companyMenu({ symbol: 'AAPL', current: 'valuation' });
		expect(items.filter((i) => i.current).map((i) => i.label)).toEqual(['Valuation']);
	});
	it('carries the ticker to every link', () => {
		for (const i of companyMenu({ symbol: 'ABN.AS', current: 'valuation' })) expect(i.href).toContain('symbol=ABN.AS');
	});
	it('keeps the statement, period and source of the Financials page', () => {
		const items = companyMenu({
			symbol: 'AAPL',
			current: 'financials',
			nav: { tab: 'financials', statement: 'balance', period: 'ttm', source: 'yahoo' }
		});
		expect(at(items, 0).href).toBe('/financials?symbol=AAPL&tab=financials&statement=balance&period=ttm&source=yahoo');
		expect(items.at(-1)?.href).toBe('/financials/valuation?symbol=AAPL&source=yahoo');
	});
	it('opens the tabs at their defaults and Valuation bare without a ticker', () => {
		const items = companyMenu({ symbol: '', current: 'valuation' });
		expect(at(items, 0).href).toBe('/financials?tab=financials&statement=income&period=annual');
		expect(items.at(-1)?.href).toBe('/financials/valuation');
	});
});
