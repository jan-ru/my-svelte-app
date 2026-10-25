const PATTERN = /^[A-Z0-9.^-]{1,15}$/;

/** A ticker in FMP style (AAPL, ABN.AS, BRK-B), upper-cased; null when it is not safe to send to FMP. */
export function parseSymbol(raw: string | null | undefined): string | null {
	const symbol = (raw ?? '').trim().toUpperCase();
	return PATTERN.test(symbol) ? symbol : null;
}
