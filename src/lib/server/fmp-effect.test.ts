// What ADR-013 adds to the FMP source: a parser bug (M9) and the log `detail` (M4) never carry upstream text, and
// FMP's own error body wins over its status. fmp.test.ts and fmp-info.test.ts stay the contract.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchStatement } from './fmp';
import { fetchProfile } from './fmp-info';
import { SourceError } from './source-error';

const SECRET = 'https://financialmodelingprep.com/stable/profile?apikey=SECRET';

const failure = (promise: Promise<unknown>) =>
	promise.then(
		() => undefined,
		(e: unknown) => e
	);
const answer = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status }));

/** Everything a failure carries that could reach a log or a visitor. */
const said = (error: unknown) =>
	error instanceof SourceError ? `${error.message} ${error.detail ?? ''}` : 'not a SourceError';

afterEach(() => {
	vi.restoreAllMocks();
});

describe('a parser bug', () => {
	it.each<[string, (fetchFn: typeof fetch) => Promise<unknown>]>([
		['a statement', (f) => fetchStatement('income', 'AAPL', 'K', 'annual', f)],
		['the profile', (f) => fetchProfile('AAPL', 'K', f)]
	])('makes %s unavailable, with only the class name', async (_what, fetch) => {
		// a record whose every field throws when read, as a bug in a parser would
		const bad: unknown = [
			new Proxy(
				{ date: '2024-12-31' },
				{
					get() {
						throw new TypeError(`cannot read ${SECRET}`);
					}
				}
			)
		];
		vi.spyOn(JSON, 'parse').mockReturnValue(bad);
		const error = await failure(fetch(answer([])));
		expect(error).toBeInstanceOf(SourceError);
		expect((error as SourceError).kind).toBe('unavailable');
		expect((error as SourceError).message).toBe('FMP is unavailable');
		expect((error as SourceError).detail).toBe('TypeError');
	});
});

describe('the log detail', () => {
	it('names the class of a failed connection, never its text', async () => {
		const fetchFn = vi.fn(async () => {
			throw new TypeError(`fetch failed for ${SECRET}`);
		});
		const error = await failure(fetchProfile('AAPL', 'SECRET', fetchFn));
		expect((error as SourceError).message).toBe('FMP could not be reached');
		expect((error as SourceError).detail).toBe('TypeError');
		expect(said(error)).not.toMatch(/SECRET|https?:/);
	});
	it('names the class of a body that fails mid-read, never its text', async () => {
		const body = new ReadableStream({
			pull(controller) {
				controller.error(new Error(`reset for ${SECRET}`));
			}
		});
		const error = await failure(
			fetchProfile(
				'AAPL',
				'SECRET',
				vi.fn(async () => new Response(body))
			)
		);
		expect((error as SourceError).message).toBe('FMP response could not be read');
		expect((error as SourceError).detail).toBe('Error');
		expect(said(error)).not.toMatch(/SECRET|https?:/);
	});
	it('keeps the key out of a plan message that echoes it', async () => {
		const error = await failure(
			fetchProfile('AAPL', 'SECRET', answer({ 'Error Message': `Not on your plan: ${SECRET}` }, 403))
		);
		expect((error as SourceError).kind).toBe('plan');
		expect(said(error)).not.toMatch(/SECRET/);
	});
});

describe('a failed status', () => {
	it('takes FMP’s own message over the status', async () => {
		const error = await failure(fetchProfile('AAPL', 'K', answer({ 'Error Message': 'Limit Reach.' }, 403)));
		expect((error as SourceError).kind).toBe('limit');
		expect((error as SourceError).message).toBe('FMP rate limit reached');
	});
	it('falls back to the status when the body is not FMP’s error', async () => {
		const error = await failure(fetchProfile('AAPL', 'K', answer({ other: 1 }, 401)));
		expect((error as SourceError).kind).toBe('config');
		expect((error as SourceError).message).toBe('FMP rejected the API key');
	});
	it('reads a success that is not JSON as an unexpected response', async () => {
		const fetchFn = vi.fn(async () => new Response('<html>'));
		const error = await failure(fetchProfile('AAPL', 'K', fetchFn));
		expect((error as SourceError).message).toBe('Unexpected response from FMP');
	});
});
