// src/lib/supply-chain.ts
// Wording and formatting for the supply chain tab. The data itself is built in server/eulerpool-parse.ts.
import type { SupplyChain, SupplyLink } from './source-data';

/** What the company is to the one asked for. */
export function relationship(link: Pick<SupplyLink, 'supplier' | 'customer'>): string {
	if (link.supplier && link.customer) return 'Supplier and customer';
	return link.supplier ? 'Supplier' : 'Customer';
}

/** A correlation with its sign and two decimals ("+0.46", "−0.74"), or n/a. */
export function formatCorrelation(value: number | null): string {
	if (value === null) return 'n/a';
	if (value === 0) return '0.00';
	return `${value > 0 ? '+' : '−'}${Math.abs(value).toFixed(2)}`;
}

const count = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** How many links Eulerpool lists and how many of them the page shows. */
export function describeSupplyChain(chain: SupplyChain): string {
	const listed = count(chain.total, 'linked company', 'linked companies');
	const parts = `${count(chain.suppliers, 'supplier', 'suppliers')}, ${count(chain.customers, 'customer', 'customers')}`;
	const both = chain.both > 0 ? `; ${chain.both} ${chain.both === 1 ? 'is' : 'are'} both` : '';
	const shown = chain.links.length < chain.total ? ` Showing the first ${chain.links.length} by name.` : '';
	return `Eulerpool lists ${listed}: ${parts}${both}.${shown}`;
}
