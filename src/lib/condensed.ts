// src/lib/condensed.ts
// A short balance sheet made from a full one. Each source names its lines differently, so every condensed line lists
// the names it may go by, most specific first; a line the source does not report is left out.
import type { Statement } from './source-data';

interface CondensedLine {
	/** The key of the condensed line; the table turns it into the label. */
	readonly key: string;
	/** The names the sources use for it. The first one that has a figure is used. */
	readonly from: readonly string[];
}

export const CONDENSED_BALANCE: readonly CondensedLine[] = [
	{
		key: 'cashAndShortTermInvestments',
		from: ['cashAndShortTermInvestments', 'cashCashEquivalentsAndShortTermInvestments', 'cashAndCashEquivalents']
	},
	{ key: 'receivables', from: ['netReceivables', 'accountsReceivable', 'accountsReceivables', 'receivables'] },
	{ key: 'inventory', from: ['inventory'] },
	{ key: 'otherCurrentAssets', from: ['otherCurrentAssets'] },
	{ key: 'totalCurrentAssets', from: ['totalCurrentAssets', 'currentAssets'] },
	{ key: 'propertyPlantAndEquipment', from: ['propertyPlantEquipmentNet', 'netPPE'] },
	{
		key: 'goodwillAndIntangibles',
		from: ['goodwillAndIntangibleAssets', 'goodwillAndOtherIntangibleAssets']
	},
	{ key: 'otherNonCurrentAssets', from: ['otherNonCurrentAssets'] },
	{ key: 'totalAssets', from: ['totalAssets'] },
	{ key: 'accountsPayable', from: ['accountPayables', 'accountsPayable', 'payables'] },
	{ key: 'shortTermDebt', from: ['shortTermDebt', 'currentDebt'] },
	{ key: 'otherCurrentLiabilities', from: ['otherCurrentLiabilities'] },
	{ key: 'totalCurrentLiabilities', from: ['totalCurrentLiabilities', 'currentLiabilities'] },
	{ key: 'longTermDebt', from: ['longTermDebt'] },
	{ key: 'otherNonCurrentLiabilities', from: ['otherNonCurrentLiabilities'] },
	{
		key: 'totalLiabilities',
		from: ['totalLiabilities', 'totalLiabilitiesNetMinorityInterest']
	},
	{
		key: 'totalEquity',
		from: ['totalStockholdersEquity', 'stockholdersEquity', 'totalEquity', 'totalEquityGrossMinorityInterest']
	},
	{ key: 'totalLiabilitiesAndEquity', from: ['totalLiabilitiesAndTotalEquity', 'totalLiabilitiesAndEquity'] },
	{ key: 'totalDebt', from: ['totalDebt'] },
	{ key: 'netDebt', from: ['netDebt'] }
];

/**
 * The condensed lines of a balance sheet, in a fixed order, over the same years. A statement that has none of them
 * (a source whose names are not known here) comes back unchanged, so the visitor still sees a table.
 */
export function condenseBalance(statement: Statement): Statement {
	const picked = CONDENSED_BALANCE.flatMap((line) => {
		const source = line.from.find((name) => statement.years.some((y) => y.values[name] != null));
		return source === undefined ? [] : [{ key: line.key, source }];
	});
	if (picked.length === 0) return statement;
	return {
		lines: picked.map((p) => p.key),
		years: statement.years.map((y) => ({
			...y,
			values: Object.fromEntries(picked.map((p) => [p.key, y.values[p.source] ?? null]))
		}))
	};
}
