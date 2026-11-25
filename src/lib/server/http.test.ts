// The fetch steps that FMP and Eulerpool share: fixed messages that name the source and never carry the error's text.
import { describe, expect, it, vi } from 'vitest';
import { MAX_BYTES, fetchWithTimeout, readBody, readCapped, statusError } from './http';
import { SourceError } from './source-error';

const failure = (promise: Promise<unknown>) =>
	promise.then(
		() => undefined,
		(e: unknown) => e
	);

describe('statusError', () => {
	it.each([200, 204, 299])('is null for the success %i', (status) => {
		expect(statusError(status, 'X')).toBeNull();
	});
	it.each<[number, string, string]>([
		[401, 'config', 'X rejected the API key'],
		[402, 'plan', 'Not available on this X plan'],
		[403, 'plan', 'Not available on this X plan'],
		[429, 'limit', 'X rate limit reached'],
		[404, 'unavailable', 'X returned 404'],
		[500, 'unavailable', 'X returned 500'],
		[302, 'unavailable', 'X returned 302']
	])('sorts %i as %s', (status, kind, message) => {
		const error = statusError(status, 'X');
		expect(error).toBeInstanceOf(SourceError);
		expect(error?.kind).toBe(kind);
		expect(error?.message).toBe(message);
	});
});

describe('fetchWithTimeout', () => {
	it('passes the request on with the shared timeout', async () => {
		const fetchFn = vi.fn(async () => new Response('ok'));
		const response = await fetchWithTimeout(fetchFn, 'https://example.test/a', { headers: { A: '1' } }, 'X');
		expect(await response.text()).toBe('ok');
		const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
		expect(url).toBe('https://example.test/a');
		expect(init.headers).toEqual({ A: '1' });
		expect(init.signal).toBeInstanceOf(AbortSignal);
	});
	it('says the source could not be reached, without the error text', async () => {
		const fetchFn = vi.fn(async () => {
			throw new TypeError('fetch failed for https://example.test/?apikey=SECRET');
		});
		const error = await failure(fetchWithTimeout(fetchFn, 'https://example.test/', {}, 'X'));
		expect(error).toBeInstanceOf(SourceError);
		expect((error as SourceError).message).toBe('X could not be reached');
	});
});

describe('readBody', () => {
	it('returns the text', async () => {
		expect(await readBody(new Response('{"a":1}'), 'X')).toBe('{"a":1}');
	});
	it('refuses a body whose declared length is over the cap, before reading it', async () => {
		const response = new Response('small', { headers: { 'content-length': String(MAX_BYTES + 1) } });
		expect(((await failure(readBody(response, 'X'))) as SourceError).message).toBe('X response too large');
	});
	it('refuses a body that grows past the cap without declaring it', async () => {
		const response = new Response(new Uint8Array(MAX_BYTES + 1));
		expect(((await failure(readBody(response, 'X'))) as SourceError).message).toBe('X response too large');
	});
	it('says the body could not be read when the stream fails, without the error text', async () => {
		const body = new ReadableStream({
			pull(controller) {
				controller.error(new Error('reset for https://example.test/?apikey=SECRET'));
			}
		});
		const error = await failure(readBody(new Response(body), 'X'));
		expect((error as SourceError).message).toBe('X response could not be read');
	});
	it('reads an empty response as empty text', async () => {
		expect(await readCapped(new Response(null), MAX_BYTES)).toBe('');
	});
});
