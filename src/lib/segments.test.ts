import { describe, expect, it } from 'vitest';
import { at } from './at';
import { periodSegments, sourceSegments } from './segments';
import { SOURCES } from './source';

const nav = { tab: 'financials', statement: 'income', period: 'annual' } as const;

describe('periodSegments', () => {
	it('disables TTM under FMP, with the reason, and keeps annual a link', () => {
		const items = periodSegments(nav, 'annual', 'fmp', 'AAPL');
		expect(items.map((i) => i.label)).toEqual(['Latest 5 years', 'TTM']);
		expect(at(items, 0)).toMatchObject({ current: true });
		expect(at(items, 0).href).toContain('period=annual');
		expect(at(items, 1)).toMatchObject({ href: null, current: false });
		expect(at(items, 1).title).toContain('not available from FMP');
	});
	it('offers TTM as a link under Yahoo and marks the chosen period', () => {
		const items = periodSegments(nav, 'ttm', 'yahoo', 'AAPL');
		expect(items.every((i) => i.href !== null)).toBe(true);
		expect(items.filter((i) => i.current).map((i) => i.label)).toEqual(['TTM']);
		expect(at(items, 1).href).toContain('period=ttm');
	});
});

describe('sourceSegments', () => {
	it('links each offered source, keeping the page state, and marks the active one', () => {
		const items = sourceSegments(SOURCES, { ...nav, period: 'ttm' }, 'ttm', 'yahoo', 'AAPL');
		expect(items).toHaveLength(SOURCES.length);
		expect(items.filter((i) => i.current)).toHaveLength(1);
		expect(items.find((i) => i.current)?.label).toBe('Yahoo Finance');
		for (const i of items) expect(i.href).toContain('symbol=AAPL');
		for (const i of items) expect(i.href).toContain('period=ttm');
	});
});
