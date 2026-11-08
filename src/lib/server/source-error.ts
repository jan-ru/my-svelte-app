// src/lib/server/source-error.ts

export type SourceErrorKind = 'config' | 'plan' | 'limit' | 'unavailable';

/** A failure to get data from a source (FMP, Yahoo or Eulerpool). The message is safe to show: it never carries a URL or a key. */
export class SourceError extends Error {
	readonly kind: SourceErrorKind;

	constructor(kind: SourceErrorKind, message: string) {
		super(message);
		this.kind = kind;
	}
}

/** The kind of a failure for the log: a `SourceError`'s kind, or `error` for anything else. */
export const failureKind = (error: unknown): SourceErrorKind | 'error' =>
	error instanceof SourceError ? error.kind : 'error';

/**
 * What a visitor reads when a source failed to deliver something for `symbol`; `label` names the source and
 * `keyName` is the environment variable of its key.
 * Only a `SourceError`'s message is quoted, since it is safe by construction; any other error's text is never shown.
 */
export function sourceFailureMessage(error: unknown, symbol: string, label: string, keyName = 'FMP_API_KEY'): string {
	if (error instanceof SourceError) {
		switch (error.kind) {
			case 'config':
				return `The ${label} key was not accepted. Check ${keyName}.`;
			case 'plan':
				return `${label} does not provide this for ${symbol} on your plan (${error.message}).`;
			case 'limit':
				return `${label} rate limit reached. Try again in a minute.`;
		}
	}
	return `${label} is unavailable right now for ${symbol}. Try again shortly.`;
}
