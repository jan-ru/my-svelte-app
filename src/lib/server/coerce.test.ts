import { describe, expect, it } from 'vitest';
import { field, isRecord, num, str } from './coerce';

describe('isRecord', () => {
	it('accepts plain objects only', () => {
		expect(isRecord({})).toBe(true);
		expect(isRecord({ a: 1 })).toBe(true);
		for (const v of [null, undefined, [], [1], 'x', 1, true]) expect(isRecord(v)).toBe(false);
	});
});

describe('field', () => {
	it('reads a field of an object and gives undefined for anything else', () => {
		expect(field({ price: { currency: 'EUR' } }, 'price')).toEqual({ currency: 'EUR' });
		expect(field({ a: 1 }, 'b')).toBeUndefined();
		expect(field(null, 'a')).toBeUndefined();
		expect(field(['a'], '0')).toBeUndefined();
		expect(field(field({ a: { b: 2 } }, 'a'), 'b')).toBe(2);
	});
});

describe('str and num', () => {
	it('trim strings and read finite numbers', () => {
		expect(str('  x ')).toBe('x');
		expect(str('  ')).toBeNull();
		expect(num('12.5')).toBe(12.5);
		expect(num(Number.NaN)).toBeNull();
		expect(num('')).toBeNull();
	});
});
