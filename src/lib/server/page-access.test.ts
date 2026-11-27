import { describe, expect, it } from 'vitest';
import {
	ACCESS_PAGES,
	ALL_PAGES,
	accessPageOf,
	formatPageAccess,
	mayUse,
	parsePageAccess,
	rulesFromForm,
	type AccessRules,
	type Grant
} from './page-access';
import { parseAllowed } from './session';

const admins = parseAllowed('Boss@Example.test');

describe('accessPageOf', () => {
	it('maps each page and the paths below it, the longest match first', () => {
		for (const p of ACCESS_PAGES) expect(accessPageOf(p.path)).toBe(p.path);
		expect(accessPageOf('/financials/valuation/template')).toBe('/financials/valuation');
		expect(accessPageOf('/financials/other')).toBe('/financials');
	});
	it('covers no other path', () => {
		for (const p of ['/about', '/login', '/login/google/callback', '/financialsx', '/countriesx'])
			expect(accessPageOf(p)).toBeNull();
	});
});

describe('parsePageAccess', () => {
	it('reads all pages and lists of pages, lower-casing the address', () => {
		const rules = parsePageAccess(' A@X.test = * ; b@y.test=/financials, /countries ');
		expect(rules.get('a@x.test')).toBe(ALL_PAGES);
		expect(rules.get('b@y.test')).toEqual(new Set(['/financials', '/countries']));
	});
	it('fails closed on anything it cannot read', () => {
		expect(parsePageAccess(undefined).size).toBe(0);
		expect(parsePageAccess('').size).toBe(0);
		const rules = parsePageAccess('no-equals; not-an-address=*; c@z.test=/about,/nope; d@z.test,e@z.test=*');
		expect(rules.has('not-an-address')).toBe(false);
		expect(rules.get('c@z.test')).toEqual(new Set());
		expect(rules.has('d@z.test')).toBe(false);
		expect(rules.has('e@z.test')).toBe(false);
	});
});

describe('formatPageAccess', () => {
	it('writes a stable value that reads back the same', () => {
		const rules: AccessRules = new Map<string, Grant>([
			['b@y.test', new Set(['/financials/valuation', '/'] as const)],
			['a@x.test', ALL_PAGES],
			['c@z.test', new Set()]
		]);
		const value = formatPageAccess(rules);
		expect(value).toBe('a@x.test=*; b@y.test=/,/financials/valuation');
		expect(formatPageAccess(parsePageAccess(value))).toBe(value);
	});
});

describe('mayUse', () => {
	const rules = parsePageAccess('reader@example.test=/countries,/financials; all@example.test=*');
	it('opens a page only to a granted person', () => {
		expect(mayUse('reader@example.test', '/countries', admins, rules)).toBe(true);
		expect(mayUse('Reader@Example.test', '/financials', admins, rules)).toBe(true);
		expect(mayUse('reader@example.test', '/companies', admins, rules)).toBe(false);
		expect(mayUse('reader@example.test', '/financials/valuation', admins, rules)).toBe(false);
		expect(mayUse('all@example.test', '/financials/valuation/template', admins, rules)).toBe(true);
		expect(mayUse('nobody@example.test', '/', admins, rules)).toBe(false);
		expect(mayUse(null, '/', admins, rules)).toBe(false);
	});
	it('gives an admin every page and alone the settings page', () => {
		for (const p of ACCESS_PAGES) expect(mayUse('boss@example.test', p.path, admins, rules)).toBe(true);
		expect(mayUse('boss@example.test', '/settings', admins, rules)).toBe(true);
		expect(mayUse('all@example.test', '/settings', admins, rules)).toBe(false);
		expect(mayUse(null, '/settings', admins, rules)).toBe(false);
	});
	it('leaves pages no permission covers open', () => {
		expect(mayUse('reader@example.test', '/about', admins, rules)).toBe(true);
		expect(mayUse(null, '/login', admins, rules)).toBe(true);
	});
});

describe('rulesFromForm', () => {
	it('reads one field per address and ignores other names and unknown pages', () => {
		const form = new FormData();
		form.append('access:a@x.test', '/countries');
		form.append('access:a@x.test', '/nope');
		form.append('access:b@y.test', ALL_PAGES);
		form.append('access:b@y.test', '/countries');
		form.append('access:intruder@evil.test', ALL_PAGES);
		const rules = rulesFromForm(form, ['a@x.test', 'b@y.test', 'c@z.test']);
		expect(rules.get('a@x.test')).toEqual(new Set(['/countries']));
		expect(rules.get('b@y.test')).toBe(ALL_PAGES);
		expect(rules.get('c@z.test')).toEqual(new Set());
		expect(rules.has('intruder@evil.test')).toBe(false);
	});
});
