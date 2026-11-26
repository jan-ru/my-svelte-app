// ADR-013 allows Effect in the source modules of src/lib/server/ only. ALLOWED lists the files that have moved so
// far; every other file stays free of it.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '../../..');
const ALLOWED = [
	'src/lib/server/fmp.ts',
	'src/lib/server/http.ts',
	'src/lib/server/yahoo-parse.ts',
	'src/lib/server/yahoo.ts'
];
/** This file, whose examples below would match. */
const SELF = 'src/lib/server/effect-boundary.test.ts';
/** A static, re-exported or dynamic import of `effect`, `effect/...` or `@effect/...`. */
const IMPORTS_EFFECT = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)['"](?:effect|@effect\/[^'"]+)(?:\/[^'"]*)?['"]/;

const sources = (dir: string): string[] =>
	readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
		const path = `${dir}/${entry.name}`;
		if (entry.isDirectory()) return sources(path);
		return /\.(ts|svelte)$/.test(entry.name) ? [path] : [];
	});

const users = (): string[] =>
	[...sources('src'), ...sources('scripts')]
		.filter((path) => path !== SELF && IMPORTS_EFFECT.test(readFileSync(join(ROOT, path), 'utf8')))
		.sort();

describe('the Effect boundary', () => {
	it('finds Effect in each allowed file, so the scan reads what it should', () => {
		expect(users().filter((path) => ALLOWED.includes(path))).toEqual(ALLOWED);
	});
	it('finds it in no other file under src/ or scripts/', () => {
		expect(users().filter((path) => !ALLOWED.includes(path))).toEqual([]);
	});
	it.each([
		"import { Effect } from 'effect';",
		"import * as S from 'effect/Schema';",
		"export { Data } from 'effect';",
		"const e = await import('effect');",
		"import '@effect/platform';",
		'import { x } from "@effect/vitest";'
	])('recognises %s', (line) => {
		expect(IMPORTS_EFFECT.test(line)).toBe(true);
	});
	it.each(["import { effect } from './effect-free';", "import x from 'effectful';", '// the effect of a change'])(
		'ignores %s',
		(line) => {
			expect(IMPORTS_EFFECT.test(line)).toBe(false);
		}
	);
});
