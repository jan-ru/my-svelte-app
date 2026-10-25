import { describe, expect, it } from 'vitest';
import { parseSymbol } from './symbol';

describe('parseSymbol', () => {
	it('upper-cases and trims', () => {
		expect(parseSymbol('aapl')).toBe('AAPL');
		expect(parseSymbol('  abn.as ')).toBe('ABN.AS');
	});
	it('accepts dots, dashes and a leading caret', () => {
		expect(parseSymbol('BRK-B')).toBe('BRK-B');
		expect(parseSymbol('7203.T')).toBe('7203.T');
		expect(parseSymbol('^GSPC')).toBe('^GSPC');
	});
	it('rejects empty, missing and over-long input', () => {
		expect(parseSymbol('')).toBeNull();
		expect(parseSymbol('   ')).toBeNull();
		expect(parseSymbol(null)).toBeNull();
		expect(parseSymbol(undefined)).toBeNull();
		expect(parseSymbol('A'.repeat(16))).toBeNull();
	});
	it('rejects characters that could alter a URL', () => {
		for (const bad of ['A B', 'AAPL&x=1', 'a/b', 'A?B', 'A#B', 'A%20B', 'A=B', "A'B"]) {
			expect(parseSymbol(bad), bad).toBeNull();
		}
	});
});
