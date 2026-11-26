// The shared failures of ADR-013 and their one boundary to SourceError. http.test.ts stays the contract of the steps.
import { describe, expect, it } from 'vitest';
import {
	Config,
	Plan,
	RateLimited,
	type SourceFailure,
	Unavailable,
	Unexpected,
	attempt,
	runSource,
	toSourceError
} from './http';
import { SourceError } from './source-error';

describe('toSourceError', () => {
	const parsers = new SourceError('unavailable', 'Unexpected response from X');
	it.each<[SourceFailure, string, string]>([
		[new Config({ message: 'X rejected the API key' }), 'config', 'X rejected the API key'],
		[new Plan({ message: 'Not available on this X plan' }), 'plan', 'Not available on this X plan'],
		[new RateLimited({ message: 'X rate limit reached' }), 'limit', 'X rate limit reached'],
		[new Unavailable({ message: 'X returned 500', detail: 'HTTP 500' }), 'unavailable', 'X returned 500'],
		[new Unexpected({ error: parsers }), 'unavailable', 'Unexpected response from X']
	])('maps %s', (failure, kind, message) => {
		const error = toSourceError(failure);
		expect(error).toBeInstanceOf(SourceError);
		expect(error.kind).toBe(kind);
		expect(error.message).toBe(message);
	});
	it('keeps the detail and the parser’s own error', () => {
		expect(toSourceError(new Unavailable({ message: 'm', detail: 'TypeError' })).detail).toBe('TypeError');
		const own = new SourceError('plan', 'p');
		expect(toSourceError(new Unexpected({ error: own }))).toBe(own);
	});
});

describe('attempt', () => {
	it('keeps a SourceError a step threw, and hides the text of anything else', async () => {
		const own = new SourceError('unavailable', 'Unexpected response from X');
		const thrown = (error: unknown) =>
			runSource(
				attempt(() => {
					throw error;
				}, 'X')
			).catch((e: unknown) => e);
		expect(await thrown(own)).toBe(own);
		const bug = (await thrown(new TypeError('bad https://example.test/?apikey=SECRET'))) as SourceError;
		expect(bug.message).toBe('X is unavailable');
		expect(bug.detail).toBe('TypeError');
		expect(((await thrown('a string')) as SourceError).detail).toBeUndefined();
	});
	it('passes a value through', async () => {
		expect(await runSource(attempt(() => 1, 'X'))).toBe(1);
	});
});
