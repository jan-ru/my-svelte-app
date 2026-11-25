// src/lib/server/http.ts
// Reading an HTTP response safely, shared by the source modules (none of which may import another source's module).
// Each step throws a `SourceError` with a fixed message naming the source, never the underlying error's text, which
// can carry the request URL and so a key.
import { SourceError } from './source-error';

export const FETCH_TIMEOUT_MS = 10_000;
export const MAX_BYTES = 5 * 1024 * 1024;

/**
 * The body as text, or null as soon as it passes `maxBytes`. Reads the stream, so a body with no or a wrong
 * content-length is never held in memory past the cap.
 */
export async function readCapped(response: Response, maxBytes: number): Promise<string | null> {
	if (!response.body) return '';
	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let size = 0;
	let text = '';
	for (;;) {
		const { done, value } = await reader.read();
		if (done) return text + decoder.decode();
		size += value.byteLength;
		if (size > maxBytes) {
			await reader.cancel();
			return null;
		}
		text += decoder.decode(value, { stream: true });
	}
}

/** `fetch` with the shared timeout; a failure to connect, or the timeout, is `<label> could not be reached`. */
export async function fetchWithTimeout(
	fetchFn: typeof fetch,
	url: string,
	init: RequestInit,
	label: string
): Promise<Response> {
	try {
		return await fetchFn(url, { ...init, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
	} catch {
		throw new SourceError('unavailable', `${label} could not be reached`);
	}
}

/** The body as text, at most `MAX_BYTES`, judged by the declared length first and then by what arrives. */
export async function readBody(response: Response, label: string): Promise<string> {
	const tooLarge = () => new SourceError('unavailable', `${label} response too large`);
	if (Number(response.headers.get('content-length')) > MAX_BYTES) throw tooLarge();
	let text: string | null;
	try {
		text = await readCapped(response, MAX_BYTES);
	} catch {
		// a timeout or reset mid-body
		throw new SourceError('unavailable', `${label} response could not be read`);
	}
	if (text === null) throw tooLarge();
	return text;
}

/** The error for an HTTP status that is not a success, or null for one that is. */
export function statusError(status: number, label: string): SourceError | null {
	if (status >= 200 && status < 300) return null;
	if (status === 401) return new SourceError('config', `${label} rejected the API key`);
	if (status === 402 || status === 403) return new SourceError('plan', `Not available on this ${label} plan`);
	if (status === 429) return new SourceError('limit', `${label} rate limit reached`);
	return new SourceError('unavailable', `${label} returned ${status}`);
}
