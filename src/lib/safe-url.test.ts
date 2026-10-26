import { describe, expect, it } from 'vitest';
import { safeUrl } from './safe-url';

describe('safeUrl', () => {
	it('accepts http and https', () => {
		expect(safeUrl('https://example.com/a?b=1')).toBe('https://example.com/a?b=1');
		expect(safeUrl('http://example.com')).toBe('http://example.com/');
		expect(safeUrl('  https://example.com/x  ')).toBe('https://example.com/x');
	});
	it('rejects other schemes', () => {
		expect(safeUrl('javascript:alert(1)')).toBeNull();
		expect(safeUrl('JaVaScRiPt:alert(1)')).toBeNull();
		expect(safeUrl('data:text/html,<b>x</b>')).toBeNull();
		expect(safeUrl('ftp://example.com/file')).toBeNull();
		expect(safeUrl('file:///etc/passwd')).toBeNull();
	});
	it('rejects relative, malformed, empty and non-string values', () => {
		expect(safeUrl('/relative/path')).toBeNull();
		expect(safeUrl('example.com')).toBeNull();
		expect(safeUrl('not a url')).toBeNull();
		expect(safeUrl('')).toBeNull();
		expect(safeUrl(null)).toBeNull();
		expect(safeUrl(undefined)).toBeNull();
		expect(safeUrl(42)).toBeNull();
	});
});
