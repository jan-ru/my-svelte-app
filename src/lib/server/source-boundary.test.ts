import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Every module specifier a file imports with `from '...'`. */
const imports = (relative: string): string[] =>
	[...readFileSync(join(import.meta.dirname, relative), 'utf8').matchAll(/from '([^']+)'/g)].map((m) => m[1] ?? '');

describe('source boundaries', () => {
	const FMP = /(^|\/)fmp(-info)?$/;
	const YAHOO = /(^|\/)yahoo(-parse)?$/;
	const EULERPOOL = /(^|\/)eulerpool(-parse)?$/;
	it.each(['yahoo.ts', 'yahoo-parse.ts'])('%s imports neither the FMP nor the Eulerpool modules', (file) => {
		expect(imports(file).filter((path) => FMP.test(path) || EULERPOOL.test(path))).toEqual([]);
	});
	it.each(['fmp.ts', 'fmp-info.ts'])('%s imports neither the Yahoo nor the Eulerpool modules', (file) => {
		expect(imports(file).filter((path) => YAHOO.test(path) || EULERPOOL.test(path))).toEqual([]);
	});
	it.each(['eulerpool.ts', 'eulerpool-parse.ts'])('%s imports neither the FMP nor the Yahoo modules', (file) => {
		expect(imports(file).filter((path) => FMP.test(path) || YAHOO.test(path))).toEqual([]);
	});
	it.each([
		'../prices.ts',
		'../company.ts',
		'../statements.ts',
		'../components/LineChart.svelte',
		'../components/FinancialTable.svelte',
		'../components/NewsList.svelte',
		'../components/PeersList.svelte',
		'../components/PriceView.svelte',
		'../components/ProfileView.svelte'
	])('%s, which also runs in the browser, imports its types from source-data and not from a server module', (file) => {
		expect(imports(file).filter((path) => path.includes('server/'))).toEqual([]);
	});
});
