// src/lib/at.ts
// Indexed reads that the data guarantees, such as an index from a generated file or the last of a non-empty list.

/** The element at `index`; throws a RangeError when there is none, so a broken guarantee fails loudly. */
export function at<T>(list: readonly T[], index: number): T {
	const value = list[index];
	if (value === undefined) throw new RangeError(`No element at index ${index} of a list of ${list.length}`);
	return value;
}

/** The value under `key`; throws a RangeError when there is none. */
export function get<T>(record: Readonly<Record<string, T>>, key: string): T {
	const value = record[key];
	if (value === undefined) throw new RangeError(`No entry for "${key}"`);
	return value;
}
