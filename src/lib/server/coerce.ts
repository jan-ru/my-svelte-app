// src/lib/server/coerce.ts
// Read a value of unknown type from an API response.

/** A plain object (not null, not an array) whose fields can be read as `unknown`. */
export const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

/** The field `key` of an object; undefined when `value` is not one. */
export const field = (value: unknown, key: string): unknown => (isRecord(value) ? value[key] : undefined);

export const str = (value: unknown): string | null =>
	typeof value === 'string' && value.trim() !== '' ? value.trim() : null;

export const num = (value: unknown): number | null => {
	const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
	return typeof n === 'number' && Number.isFinite(n) ? n : null;
};
