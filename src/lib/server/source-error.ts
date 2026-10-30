// src/lib/server/source-error.ts

export type SourceErrorKind = 'config' | 'plan' | 'limit' | 'unavailable';

/** A failure to get data from a source (FMP or Yahoo). The message is safe to show: it never carries a URL or a key. */
export class SourceError extends Error {
	readonly kind: SourceErrorKind;

	constructor(kind: SourceErrorKind, message: string) {
		super(message);
		this.kind = kind;
	}
}
