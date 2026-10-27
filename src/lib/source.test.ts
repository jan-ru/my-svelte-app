import { describe, expect, it } from 'vitest';
import {
	FMP_SUPPORTS_TTM,
	effectivePeriod,
	isUsListing,
	parseSource,
	periodAvailable,
	resolveSource,
	sourceLabel
} from './source';

describe('isUsListing', () => {
	it('treats tickers without a dot as US, including dashed share classes', () => {
		expect(isUsListing('AAPL')).toBe(true);
		expect(isUsListing('BRK-B')).toBe(true);
		expect(isUsListing('')).toBe(true);
	});
	it('treats a dot suffix as an exchange suffix', () => {
		for (const s of ['ABN.AS', 'SAP.DE', '7203.T']) expect(isUsListing(s), s).toBe(false);
	});
});

describe('parseSource', () => {
	it('accepts the two sources and ignores everything else', () => {
		expect(parseSource('fmp')).toBe('fmp');
		expect(parseSource('yahoo')).toBe('yahoo');
		expect(parseSource('YAHOO')).toBeUndefined();
		expect(parseSource('bloomberg')).toBeUndefined();
		expect(parseSource(null)).toBeUndefined();
	});
});

describe('resolveSource', () => {
	it('uses FMP for US tickers unless Yahoo is requested', () => {
		expect(resolveSource(undefined, 'AAPL')).toBe('fmp');
		expect(resolveSource('fmp', 'AAPL')).toBe('fmp');
		expect(resolveSource('yahoo', 'AAPL')).toBe('yahoo');
	});
	it('forces Yahoo for non-US tickers, whatever was requested', () => {
		expect(resolveSource(undefined, 'ABN.AS')).toBe('yahoo');
		expect(resolveSource('fmp', 'ABN.AS')).toBe('yahoo');
		expect(resolveSource('yahoo', 'ABN.AS')).toBe('yahoo');
	});
});

describe('periods', () => {
	it('keeps TTM unavailable for FMP while the plan lacks it, and available for Yahoo', () => {
		expect(FMP_SUPPORTS_TTM).toBe(false);
		expect(periodAvailable('fmp', 'ttm')).toBe(false);
		expect(periodAvailable('yahoo', 'ttm')).toBe(true);
		expect(periodAvailable('fmp', 'annual')).toBe(true);
		expect(periodAvailable('yahoo', 'annual')).toBe(true);
	});
	it('turns an unavailable period into annual', () => {
		expect(effectivePeriod('fmp', 'ttm')).toBe('annual');
		expect(effectivePeriod('yahoo', 'ttm')).toBe('ttm');
		expect(effectivePeriod('fmp', 'annual')).toBe('annual');
	});
});

describe('sourceLabel', () => {
	it('names the sources for visitors', () => {
		expect(sourceLabel('fmp')).toBe('FMP');
		expect(sourceLabel('yahoo')).toBe('Yahoo Finance');
	});
});
