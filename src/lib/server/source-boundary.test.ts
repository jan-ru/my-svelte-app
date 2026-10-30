import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Every module specifier a file imports with `from '...'`. */
const imports = (relative: string): string[] =>
	[...readFileSync(join(import.meta.dirname, relative), 'utf8').matchAll(/from '([^']+)'/g)].map((m) => m[1]);

describe('source boundaries', () => {
	it.each(['yahoo.ts', 'yahoo-parse.ts'])('%s does not import the FMP modules', (file) => {
		expect(imports(file).filter((path) => /(^|\/)fmp(-info)?$/.test(path))).toEqual([]);
	});
	it.each(['fmp.ts', 'fmp-info.ts'])('%s does not import the Yahoo modules', (file) => {
		expect(imports(file).filter((path) => /(^|\/)yahoo(-parse)?$/.test(path))).toEqual([]);
	});
	it.each(['../prices.ts', '../company.ts', '../statements.ts', '../components/LineChart.svelte'])(
		'%s, which also runs in the browser, imports its types from source-data and not from a server module',
		(file) => {
			expect(imports(file).filter((path) => path.includes('server/'))).toEqual([]);
		}
	);
});
