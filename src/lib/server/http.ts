// src/lib/server/http.ts
// Reading an HTTP response safely, shared by the source modules (none of which may import another source's module).
// Each step fails with a fixed message naming the source, never the underlying error's text, which can carry the
// request URL and so a key. The steps are Effects (ADR-013) that fail with the tagged failures below, and every
// source turns them into a `SourceError` here, at its promise boundary.
import * as Data from 'effect/Data';
import * as Effect from 'effect/Effect';
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

// The failures of a source, one per `SourceError` kind. `message` is what a visitor may read: fixed text naming the
// source (FMP's own `Error Message` is the one exception, cleaned in fmp.ts). `detail` is for the log: a class name or
// a status, never upstream text.
type Said = { readonly message: string; readonly detail?: string };
export class Config extends Data.TaggedError('Config')<Said> {}
export class Plan extends Data.TaggedError('Plan')<Said> {}
export class RateLimited extends Data.TaggedError('RateLimited')<Said> {}
export class Unavailable extends Data.TaggedError('Unavailable')<Said> {}
/** The source knows no such security: an answer, which each source turns into its own empty value. */
export class NotFound extends Data.TaggedError('NotFound') {}
/** A parser found the response unusable and said so with a `SourceError` of its own, which is kept as it is. */
export class Unexpected extends Data.TaggedError('Unexpected')<{ readonly error: SourceError }> {}
export type SourceFailure = Config | Plan | RateLimited | Unavailable | Unexpected;

/** The one boundary from a failure to the `SourceError` that callers see. */
export function toSourceError(failure: SourceFailure): SourceError {
	switch (failure._tag) {
		case 'Config':
			return new SourceError('config', failure.message, failure.detail);
		case 'Plan':
			return new SourceError('plan', failure.message, failure.detail);
		case 'RateLimited':
			return new SourceError('limit', failure.message, failure.detail);
		case 'Unavailable':
			return new SourceError('unavailable', failure.message, failure.detail);
		case 'Unexpected':
			return failure.error;
	}
}

/** Runs a source's program at its promise boundary: every failure becomes a `SourceError`. */
export const runSource = <A>(program: Effect.Effect<A, SourceFailure>): Promise<A> =>
	Effect.runPromise(program.pipe(Effect.mapError(toSourceError)));

/** `runSource` for a program that may find nothing: `NotFound` is the answer `empty`, which the cache may keep. */
export const runSourceOr = <A>(program: Effect.Effect<A, SourceFailure | NotFound>, empty: A): Promise<A> =>
	runSource(program.pipe(Effect.catchTag('NotFound', () => Effect.succeed(empty))));

/** The class name of whatever was thrown, for `detail`. Never its message. */
const nameOf = (error: unknown): string | undefined => (error instanceof Error ? error.name : undefined);

/**
 * Sorts anything a parser or other synchronous step threw: its own `SourceError` is kept, anything else (a bug, whose
 * text may carry a URL) is `<label> is unavailable` with only the class name.
 */
export const classify =
	(label: string) =>
	(error: unknown): Unexpected | Unavailable =>
		error instanceof SourceError
			? new Unexpected({ error })
			: new Unavailable({ message: `${label} is unavailable`, detail: nameOf(error) });

/** A synchronous step that may throw, such as a parser, as an Effect that fails with `classify`. */
export const attempt = <A>(run: () => A, label: string): Effect.Effect<A, Unexpected | Unavailable> =>
	Effect.try({ try: run, catch: classify(label) });

/** `fetch` with the shared timeout; a failure to connect, or the timeout, is `<label> could not be reached`. */
export const fetchE = (
	fetchFn: typeof fetch,
	url: string,
	init: RequestInit,
	label: string
): Effect.Effect<Response, Unavailable> =>
	Effect.tryPromise({
		try: () => fetchFn(url, { ...init, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }),
		catch: (error) => new Unavailable({ message: `${label} could not be reached`, detail: nameOf(error) })
	});

/** The body as text, at most `MAX_BYTES`, judged by the declared length first and then by what arrives. */
export const readBodyE = (response: Response, label: string): Effect.Effect<string, Unavailable> => {
	const tooLarge = new Unavailable({ message: `${label} response too large` });
	if (Number(response.headers.get('content-length')) > MAX_BYTES) return Effect.fail(tooLarge);
	return Effect.tryPromise({
		try: () => readCapped(response, MAX_BYTES),
		// a timeout or reset mid-body
		catch: (error) => new Unavailable({ message: `${label} response could not be read`, detail: nameOf(error) })
	}).pipe(Effect.flatMap((text) => (text === null ? Effect.fail(tooLarge) : Effect.succeed(text))));
};

/** The failure for an HTTP status that is not a success, or null for one that is. */
export function statusFailure(status: number, label: string): Config | Plan | RateLimited | Unavailable | null {
	if (status >= 200 && status < 300) return null;
	if (status === 401) return new Config({ message: `${label} rejected the API key` });
	if (status === 402 || status === 403) return new Plan({ message: `Not available on this ${label} plan` });
	if (status === 429) return new RateLimited({ message: `${label} rate limit reached` });
	return new Unavailable({ message: `${label} returned ${status}` });
}
