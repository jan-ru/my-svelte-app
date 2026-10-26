import type { Profile } from './server/fmp-info';

export interface Field {
	label: string;
	value: string;
	href?: string;
}

function scaled(value: number): string {
	const abs = Math.abs(value);
	const [n, unit] =
		abs >= 1e12 ? [value / 1e12, ' trillion'] : abs >= 1e9 ? [value / 1e9, ' billion'] : abs >= 1e6 ? [value / 1e6, ' million'] : [value, ''];
	return `${(n as number).toLocaleString('en-US', { maximumFractionDigits: 1 })}${unit}`;
}

export function profileFields(p: Profile): Field[] {
	const cur = p.currency ? ` ${p.currency}` : '';
	const host = (url: string) => new URL(url).host;
	const candidates: Array<Field | null> = [
		p.name ? { label: 'Company', value: p.name } : null,
		p.exchange ? { label: 'Exchange', value: p.exchange } : null,
		p.sector ? { label: 'Sector', value: p.sector } : null,
		p.industry ? { label: 'Industry', value: p.industry } : null,
		p.country ? { label: 'Country', value: p.country } : null,
		p.ceo ? { label: 'CEO', value: p.ceo } : null,
		p.employees !== null ? { label: 'Employees', value: p.employees.toLocaleString('en-US') } : null,
		p.website ? { label: 'Website', value: host(p.website), href: p.website } : null,
		p.ipoDate ? { label: 'IPO date', value: p.ipoDate } : null,
		p.currency ? { label: 'Currency', value: p.currency } : null,
		p.price !== null ? { label: 'Price', value: `${p.price.toFixed(2)}${cur}` } : null,
		p.marketCap !== null ? { label: 'Market cap', value: `${scaled(p.marketCap)}${cur}` } : null,
		p.beta !== null ? { label: 'Beta', value: p.beta.toFixed(2) } : null
	];
	return candidates.filter((f): f is Field => f !== null);
}

export function formatNewsDate(date: string | null): string | null {
	if (date === null) return null;
	return /^\d{4}-\d{2}-\d{2}/.test(date) ? date.slice(0, 10) : date;
}
