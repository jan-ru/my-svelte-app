// src/lib/condensed.ts
// A short balance sheet made from a full one. Each source names its lines differently, so every condensed line lists
// the names it may go by, most specific first; a line the source does not report is left out. The "other" lines are not
// copied from the source but worked out as what is left of a subtotal, so the short sheet adds up (see docs/financials.md).
import type { Statement } from './source-data';

export interface CondensedLine {
	/** The key of the condensed line; the table turns it into the label. */
	readonly key: string;
	/** The names the sources use for it. The first one that has a figure is used. */
	readonly from: readonly string[];
	/**
	 * An "other" line: worked out per year as the signed sum of the `terms` (condensed keys) when every `required` key has
	 * a figure that year. Without one, the line is what the source reports under `from`, if anything.
	 */
	readonly rest?: {
		readonly required: readonly string[];
		readonly terms: readonly { readonly key: string; readonly sign: 1 | -1 }[];
	};
}

export const CONDENSED_BALANCE: readonly CondensedLine[] = [
	{
		key: 'cashAndShortTermInvestments',
		from: ['cashAndShortTermInvestments', 'cashCashEquivalentsAndShortTermInvestments', 'cashAndCashEquivalents']
	},
	{ key: 'receivables', from: ['netReceivables', 'accountsReceivable', 'accountsReceivables', 'receivables'] },
	{ key: 'inventory', from: ['inventory'] },
	{
		key: 'otherCurrentAssets',
		from: ['otherCurrentAssets'],
		rest: {
			required: ['totalCurrentAssets'],
			terms: [
				{ key: 'totalCurrentAssets', sign: 1 },
				{ key: 'cashAndShortTermInvestments', sign: -1 },
				{ key: 'receivables', sign: -1 },
				{ key: 'inventory', sign: -1 }
			]
		}
	},
	{ key: 'totalCurrentAssets', from: ['totalCurrentAssets', 'currentAssets'] },
	{ key: 'propertyPlantAndEquipment', from: ['propertyPlantEquipmentNet', 'netPPE'] },
	{ key: 'goodwillAndIntangibles', from: ['goodwillAndIntangibleAssets', 'goodwillAndOtherIntangibleAssets'] },
	{
		key: 'otherNonCurrentAssets',
		from: ['otherNonCurrentAssets'],
		rest: {
			required: ['totalAssets', 'totalCurrentAssets'],
			terms: [
				{ key: 'totalAssets', sign: 1 },
				{ key: 'totalCurrentAssets', sign: -1 },
				{ key: 'propertyPlantAndEquipment', sign: -1 },
				{ key: 'goodwillAndIntangibles', sign: -1 }
			]
		}
	},
	{ key: 'totalAssets', from: ['totalAssets'] },
	{ key: 'accountsPayable', from: ['accountPayables', 'accountsPayable', 'payables'] },
	{ key: 'shortTermDebt', from: ['shortTermDebt', 'currentDebt'] },
	{
		key: 'otherCurrentLiabilities',
		from: ['otherCurrentLiabilities'],
		rest: {
			required: ['totalCurrentLiabilities'],
			terms: [
				{ key: 'totalCurrentLiabilities', sign: 1 },
				{ key: 'accountsPayable', sign: -1 },
				{ key: 'shortTermDebt', sign: -1 }
			]
		}
	},
	{ key: 'totalCurrentLiabilities', from: ['totalCurrentLiabilities', 'currentLiabilities'] },
	{ key: 'longTermDebt', from: ['longTermDebt'] },
	{
		key: 'otherNonCurrentLiabilities',
		from: ['otherNonCurrentLiabilities'],
		rest: {
			required: ['totalLiabilities', 'totalCurrentLiabilities'],
			terms: [
				{ key: 'totalLiabilities', sign: 1 },
				{ key: 'totalCurrentLiabilities', sign: -1 },
				{ key: 'longTermDebt', sign: -1 }
			]
		}
	},
	{ key: 'totalLiabilities', from: ['totalLiabilities', 'totalLiabilitiesNetMinorityInterest'] },
	{
		key: 'totalEquity',
		from: ['totalStockholdersEquity', 'stockholdersEquity', 'totalEquity', 'totalEquityGrossMinorityInterest']
	},
	{ key: 'totalLiabilitiesAndEquity', from: ['totalLiabilitiesAndTotalEquity', 'totalLiabilitiesAndEquity'] },
	{ key: 'totalDebt', from: ['totalDebt'] },
	{ key: 'netDebt', from: ['netDebt'] }
];

/** The first of a line's names that has a figure in any year, so one source name is used for the whole row. */
const nameOf = (line: CondensedLine, years: Statement['years']): string | undefined =>
	line.from.find((name) => years.some((y) => y.values[name] != null));

/**
 * The condensed lines of a balance sheet, in a fixed order, over the same years. The "other" lines are what is left of a
 * subtotal after the lines shown above them, so the rows add up; where a subtotal is missing, the source's own "other"
 * figure is used. A statement with none of the lines (a source whose names are not known here) comes back unchanged,
 * so the visitor still sees a table.
 */
export function condenseBalance(statement: Statement): Statement {
	const sources = new Map(CONDENSED_BALANCE.map((l) => [l.key, nameOf(l, statement.years)] as const));
	const years = statement.years.map((y) => {
		const simple = new Map(
			CONDENSED_BALANCE.map((l) => {
				const name = sources.get(l.key);
				return [l.key, name === undefined ? null : (y.values[name] ?? null)] as const;
			})
		);
		const values = Object.fromEntries(
			CONDENSED_BALANCE.map((l) => {
				const { rest } = l;
				if (!rest || rest.required.some((k) => simple.get(k) == null))
					return [l.key, simple.get(l.key) ?? null] as const;
				const sum = rest.terms.reduce((acc, t) => acc + t.sign * (simple.get(t.key) ?? 0), 0);
				return [l.key, sum] as const;
			})
		);
		return { ...y, values };
	});
	const lines = CONDENSED_BALANCE.map((l) => l.key).filter((key) => years.some((y) => y.values[key] != null));
	return lines.length === 0 ? statement : { lines, years };
}
