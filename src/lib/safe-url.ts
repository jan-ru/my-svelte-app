/** The URL as an absolute string if it is http(s); anything else (javascript:, data:, relative, junk) is null. */
export function safeUrl(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	try {
		const url = new URL(value.trim());
		return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
	} catch {
		return null;
	}
}
