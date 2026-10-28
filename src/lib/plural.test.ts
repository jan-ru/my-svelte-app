import { describe, expect, it } from 'vitest';
import { plural } from './plural';

describe('plural', () => {
	it('uses the singular for exactly one', () => {
		expect(plural(1, 'company', 'companies')).toBe('company');
		for (const n of [0, 2, 10, 1.5]) expect(plural(n, 'company', 'companies')).toBe('companies');
	});
});
