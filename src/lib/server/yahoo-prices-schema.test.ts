// ADR-012 judges the pilot's Schema parser on whether it is as strict as the hand-written one it replaced. That one is
// kept here, word for word, as the reference: both must give the same result, or both reject, on every input below.
import { describe, expect, it } from 'vitest';
import type { PricePoint } from '../source-data';
import { isRecord, num } from './coerce';
import { SourceError } from './source-error';
import { parseYahooPrices, toDate } from './yahoo-parse';

const isoDate = (date: Date, offsetSeconds = 0): string =>
	new Date(date.getTime() + offsetSeconds * 1000).toISOString().slice(0, 10);

/** parseYahooPrices before ADR-012 (2026.11.23), on `num`, `toDate` and `isRecord`. */
function reference(quotes: unknown, gmtoffsetSeconds = 0): PricePoint[] {
	if (!Array.isArray(quotes)) throw new SourceError('unavailable', 'Unexpected response from Yahoo Finance');
	const byDate = new Map<string, PricePoint>();
	for (const rec of quotes.filter(isRecord)) {
		const when = toDate(rec.date);
		const close = num(rec.close);
		if (!when || close === null) continue;
		const date = isoDate(when, gmtoffsetSeconds);
		byDate.set(date, { date, close, volume: num(rec.volume) });
	}
	return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

const outcome = (parse: () => PricePoint[]) => {
	try {
		return { points: parse() };
	} catch (error) {
		return { rejected: error instanceof SourceError ? error.message : 'not a SourceError' };
	}
};

const DATES: unknown[] = [
	new Date('2026-10-23T08:00:00Z'),
	new Date('not a date'),
	1767139200,
	1767139200000,
	99_999_999_999,
	100_000_000_000,
	0,
	-1,
	Number.NaN,
	Number.POSITIVE_INFINITY,
	'2026-10-23',
	' 2026-10-23T08:00:00Z ',
	' 2026-10-23 ',
	'',
	'   ',
	'nope',
	null,
	undefined,
	true,
	{}
];
const NUMBERS: unknown[] = [
	39.5,
	0,
	-0,
	-2,
	'39.5',
	' 39.5 ',
	'1e3',
	'0x10',
	'',
	'  ',
	'x',
	Number.NaN,
	null,
	undefined,
	true,
	[]
];

describe('the Schema parser of the pilot, against the hand-written one', () => {
	it.each(DATES)('agrees on the date %s', (date) => {
		const quotes = [{ date, close: 1, volume: 2 }];
		expect(outcome(() => parseYahooPrices(quotes))).toEqual(outcome(() => reference(quotes)));
	});
	it.each(NUMBERS)('agrees on the close and the volume %s', (value) => {
		const quotes = [{ date: 1767139200, close: value, volume: value }];
		expect(outcome(() => parseYahooPrices(quotes))).toEqual(outcome(() => reference(quotes)));
	});
	it.each<[string, unknown]>([
		['an object', { quotes: [] }],
		['a string', 'quotes'],
		['null', null],
		['undefined', undefined],
		['a number', 1]
	])('rejects the same response that is not a list: %s', (_what, quotes) => {
		expect(outcome(() => parseYahooPrices(quotes))).toEqual(outcome(() => reference(quotes)));
		expect(outcome(() => parseYahooPrices(quotes))).toEqual({ rejected: 'Unexpected response from Yahoo Finance' });
	});
	it('agrees on a list with rows to skip, a repeated date and an exchange offset', () => {
		const quotes = [
			null,
			'row',
			[1, 2],
			{ close: 3 },
			{ date: 1767139200 },
			{ date: new Date('2026-10-26T23:00:00Z'), close: 5, volume: 1, adjclose: 5 },
			{ date: new Date('2026-10-26T23:30:00Z'), close: 6 },
			{ date: '2026-10-20T12:00:00Z', close: '4.25', volume: '1000' }
		];
		for (const offset of [0, 39600, -18000]) {
			expect(parseYahooPrices(quotes, offset)).toEqual(reference(quotes, offset));
		}
		expect(parseYahooPrices(quotes, 39600)).toHaveLength(2);
	});
});
