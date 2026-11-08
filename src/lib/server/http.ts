// src/lib/server/http.ts
// Reading an HTTP response safely, shared by the source modules (none of which may import another source's module).

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
