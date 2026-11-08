import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FairValue, QualityScore } from '../insight';
import { INSIGHT_TTL_MS, insightFetchers, loadInsight, type InsightFetchers } from './insight';
import { SourceError } from './source-error';

const fair: FairValue = {
	fairValue: 278.5,
	income: 278.5,
	revenue: 260.9,
	dividend: 270.4,
	lastPrice: 342.4,
	upside: -18.65,
	currency: 'USD'
};
const quality: QualityScore = {
	score: 8,
	revenueGrowth10Y: 0.06,
	revenueGrowth3Y: 0.02,
	ebitGrowth10Y: 0.06,
	ebitGrowth3Y: 0.04,
	profitContinuity10Y: 10,
	netDebtToEbit: 0.5,
	ebitMaxDrawdown10Y: -0.16,
	returnOnEquity: 1.5,
	roce: 0.69,
	expectedReturn: 0.15
};
const fetchers = (o: Partial<InsightFetchers> = {}): InsightFetchers => ({
	fairValue: vi.fn(async () => fair),
	quality: vi.fn(async () => quality),
	...o
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('loadInsight', () => {
	it('returns both estimates with no message', async () => {
		const f = fetchers();
		expect(await loadInsight('AAPL', 'EKEY', f)).toEqual({ fairValue: fair, quality, message: null });
		expect(f.fairValue).toHaveBeenCalledWith('AAPL', 'EKEY');
		expect(f.quality).toHaveBeenCalledWith('AAPL', 'EKEY');
	});
	it('keeps the part that worked when the other fails, and says why without the key or a URL', async () => {
		const log = vi.spyOn(console, 'error').mockImplementation(() => {});
		const f = fetchers({ fairValue: vi.fn().mockRejectedValue(new SourceError('limit', 'x')) });
		const insight = await loadInsight('AAPL', 'EKEY', f);
		expect(insight).toEqual({
			fairValue: null,
			quality,
			message: 'Eulerpool rate limit reached. Try again in a minute.'
		});
		expect(log).toHaveBeenCalledWith('Eulerpool fair value for AAPL failed (limit)');
		expect(JSON.stringify(log.mock.calls)).not.toContain('EKEY');
	});
	it('names the key when it is rejected', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const bad = vi.fn().mockRejectedValue(new SourceError('config', 'x'));
		const insight = await loadInsight('AAPL', 'EKEY', fetchers({ fairValue: bad, quality: bad }));
		expect(insight.message).toBe('The Eulerpool key was not accepted. Check EULERPOOL_API_KEY.');
	});
	it('never shows the text of an unexpected error', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const boom = vi.fn().mockRejectedValue(new Error('https://api.eulerpool.com/?token=secret'));
		const insight = await loadInsight('AAPL', 'EKEY', fetchers({ quality: boom }));
		expect(insight.message).toBe('Eulerpool is unavailable right now for AAPL. Try again shortly.');
		expect(insight.fairValue).toEqual(fair);
	});
	it.each([
		[null, null, 'Eulerpool has no fair value or quality score for AAPL.'],
		[null, quality, 'Eulerpool has no fair value for AAPL.'],
		[fair, null, 'Eulerpool has no quality score for AAPL.']
	])('says what Eulerpool lacks (%#)', async (f, q, message) => {
		const insight = await loadInsight(
			'AAPL',
			'EKEY',
			fetchers({ fairValue: vi.fn(async () => f), quality: vi.fn(async () => q) })
		);
		expect(insight.message).toBe(message);
	});
});

describe('insightFetchers', () => {
	it('are cached for a day', () => {
		expect(INSIGHT_TTL_MS).toBe(24 * 60 * 60 * 1000);
		expect(Object.keys(insightFetchers).sort()).toEqual(['fairValue', 'quality']);
	});
});
