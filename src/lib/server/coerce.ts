// src/lib/server/coerce.ts
// Read a value of unknown type from an API response.

export const str = (value: unknown): string | null =>
	typeof value === 'string' && value.trim() !== '' ? value.trim() : null;

export const num = (value: unknown): number | null => {
	const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
	return typeof n === 'number' && Number.isFinite(n) ? n : null;
};
