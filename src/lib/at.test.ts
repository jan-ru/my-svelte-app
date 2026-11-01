import { describe, expect, it } from 'vitest';
import { at, get } from './at';

describe('at', () => {
	it('returns the element, including negative-free edge positions', () => {
		expect(at(['a', 'b'], 0)).toBe('a');
		expect(at(['a', 'b'], 1)).toBe('b');
	});
	it('throws for a missing index', () => {
		expect(() => at(['a'], 1)).toThrow(RangeError);
		expect(() => at([], 0)).toThrow('No element at index 0 of a list of 0');
	});
});

describe('get', () => {
	it('returns the value or throws for a missing key', () => {
		expect(get({ a: 1 }, 'a')).toBe(1);
		expect(() => get({ a: 1 }, 'b')).toThrow('No entry for "b"');
	});
});
