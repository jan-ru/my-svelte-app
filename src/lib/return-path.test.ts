import { describe, expect, it } from 'vitest';
import { RETURN_PATHS, returnPath } from './return-path';

describe('returnPath', () => {
	it('accepts exactly the allow-listed local pages', () => {
		for (const p of RETURN_PATHS) expect(returnPath(p)).toBe(p);
	});
	it('rejects everything else', () => {
		for (const bad of [
			'//evil.com',
			'https://evil.com',
			'/financials/x',
			'/companies?x=1',
			'',
			'companies',
			null,
			undefined
		]) {
			expect(returnPath(bad)).toBeNull();
		}
	});
});
