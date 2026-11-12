import { render } from 'svelte/server';
import type { Component, ComponentProps } from 'svelte';
import { describe, expect, it } from 'vitest';
import { formatPrice, summarise } from '../prices';
import type { NewsItem, Peer, PricePoint, PriceTarget, Profile, SupplyChain } from '../source-data';
import type { StatementTable } from '../statements';
import FinancialTable from './FinancialTable.svelte';
import NewsList from './NewsList.svelte';
import SegmentedNav from './SegmentedNav.svelte';
import PeersList from './PeersList.svelte';
import PriceView from './PriceView.svelte';
import ProfileView from './ProfileView.svelte';
import SupplyChainView from './SupplyChainView.svelte';

type Renderer = (component: unknown, options: { props: unknown }) => { body: string };

/**
 * Server-render a component to HTML: enough to check what a visitor would read, with no DOM library.
 * `render` has a conditional signature that a generic call cannot satisfy, hence the cast; `props` is still checked
 * against the component. `any` is what `ComponentProps` itself requires of the constraint.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- see above: ComponentProps needs it
const html = <C extends Component<any>>(component: C, props: ComponentProps<C>): string =>
	(render as unknown as Renderer)(component, { props }).body;

const profile: Profile = {
	name: 'Apple Inc.',
	exchange: 'NASDAQ',
	sector: 'Technology',
	industry: 'Consumer Electronics',
	country: 'US',
	ceo: 'Tim Cook',
	website: 'https://www.apple.com',
	ipoDate: null,
	currency: 'USD',
	description: 'Apple designs phones.',
	employees: 164000,
	price: 189.5,
	marketCap: 2.9e12,
	beta: 1.24
};

describe('ProfileView', () => {
	it('shows the facts, an external website link and the description', () => {
		const out = html(ProfileView, { profile, message: null });
		expect(out).toContain('Technology');
		expect(out).toContain('href="https://www.apple.com"');
		expect(out).toContain('rel="noopener noreferrer"');
		expect(out).toContain('aria-label="(opens in a new tab)"');
		expect(out).toMatch(/<h2[^>]*>About<\/h2>/);
		expect(out).toContain('Apple designs phones.');
	});
	it('shows the message and no About section without a profile', () => {
		const out = html(ProfileView, { profile: null, message: 'No company profile found for ZZZ.' });
		expect(out).toContain('No company profile found for ZZZ.');
		expect(out).not.toContain('About');
	});
});

const item = (over: Partial<NewsItem> = {}): NewsItem => ({
	title: 'Apple ships a phone',
	publisher: 'Wire',
	date: '2026-10-22T10:00:00Z',
	text: 'It is a phone.',
	url: 'https://example.com/a',
	...over
});

describe('NewsList', () => {
	it('lists headlines as external links with publisher and snippet', () => {
		const out = html(NewsList, { items: [item()], message: null, source: 'fmp' });
		expect(out).toContain('href="https://example.com/a"');
		expect(out).toContain('Apple ships a phone');
		expect(out).toContain('Wire');
		expect(out).toContain('It is a phone.');
	});
	it('shows a headline without a link as plain text', () => {
		const out = html(NewsList, { items: [item({ url: null })], message: null, source: 'fmp' });
		expect(out).toContain('Apple ships a phone');
		expect(out).not.toContain('<a href');
	});
	it('warns that Yahoo matches by company name, and FMP does not', () => {
		expect(html(NewsList, { items: [item()], message: null, source: 'yahoo' })).toContain('Matched by company name');
		expect(html(NewsList, { items: [item()], message: null, source: 'fmp' })).not.toContain('Matched by company name');
	});
	it('escapes text that came from an API', () => {
		const out = html(NewsList, {
			items: [item({ title: '<script>alert(1)</script>', text: '<img src=x onerror=alert(1)>' })],
			message: null,
			source: 'fmp'
		});
		// escaping `<` is what stops an element from starting, so that is what is checked
		expect(out).not.toContain('<script');
		expect(out).not.toContain('<img');
		expect(out).toContain('&lt;script');
		expect(out).toContain('&lt;img src=x onerror=alert(1)>');
	});
	it('shows the message when there are no headlines', () => {
		expect(html(NewsList, { items: [], message: 'No recent news found for ZZZ.', source: 'fmp' })).toContain(
			'No recent news found for ZZZ.'
		);
	});
});

const points: PricePoint[] = [
	{ date: '2026-10-22', close: 100, volume: 10 },
	{ date: '2026-10-23', close: 101, volume: 11 }
];

describe('PriceView', () => {
	it('shows the last close, the day change, the chart and the data table (newest first)', () => {
		const out = html(PriceView, { points, message: null });
		const s = summarise(points)!;
		expect(out).toContain(`Last close, ${s.date}`);
		expect(out).toContain(formatPrice(s.close));
		expect(out).toContain('Day change');
		expect(out).toContain('<svg');
		expect(out.indexOf('2026-10-23')).toBeLessThan(out.lastIndexOf('2026-10-22'));
	});
	it('shows the message and no chart without prices', () => {
		const out = html(PriceView, { points: [], message: 'No price history found for ZZZ.' });
		expect(out).toContain('No price history found for ZZZ.');
		expect(out).not.toContain('<svg');
	});
});

const peers: Peer[] = [
	{ symbol: 'MSFT', name: 'Microsoft', price: 400, marketCap: 3e12 },
	{ symbol: 'NOPRICE', name: null, price: null, marketCap: null }
];

describe('PeersList', () => {
	it('links each peer through hrefFor, with its name and price when known', () => {
		const out = html(PeersList, { peers, message: null, hrefFor: (symbol: string) => `/x?symbol=${symbol}` });
		expect(out).toContain('href="/x?symbol=MSFT"');
		expect(out).toContain('href="/x?symbol=NOPRICE"');
		expect(out).toContain('Microsoft');
		expect(out).toContain(formatPrice(400));
	});
	it('shows the message when there are no peers', () => {
		const out = html(PeersList, { peers: [], message: 'No peers found for ZZZ.', hrefFor: () => '/' });
		expect(out).toContain('No peers found for ZZZ.');
		expect(out).not.toContain('<ul');
	});
});

const table: StatementTable = {
	currency: 'USD',
	columns: [{ year: '2024', date: '2024-12-31' }],
	rows: [{ key: 'revenue', label: 'Revenue', cells: ['5.0'] }]
};
const target: PriceTarget = { consensus: 205.5, median: 210, high: 250, low: null };

describe('FinancialTable', () => {
	it('shows the title, the currency note, the column headers and each row', () => {
		const out = html(FinancialTable, { title: 'Income statement', table, message: null });
		expect(out).toContain('Income statement');
		expect(out).toContain('millions of USD');
		expect(out).toContain('2024');
		expect(out).toContain('2024-12-31');
		expect(out).toContain('Revenue');
		expect(out).toContain('5.0');
	});
	it('has no currency note when the table has no currency', () => {
		expect(
			html(FinancialTable, { title: 'Financial ratios', table: { ...table, currency: null }, message: null })
		).not.toContain('millions of');
	});
	it('shows the message instead of a table', () => {
		const out = html(FinancialTable, { title: 'Earnings', table: null, message: 'FMP has no earnings for ZZZ.' });
		expect(out).toContain('FMP has no earnings for ZZZ.');
		expect(out).not.toContain('<table');
	});
	it('shows the price target, leaving out a figure that is missing', () => {
		const out = html(FinancialTable, { title: 'Analyst estimates', table, message: null, target });
		expect(out).toContain('Price target, consensus');
		expect(out).toContain(formatPrice(205.5));
		expect(out).toContain('Median');
		expect(out).toContain('High');
		expect(out).not.toContain('Low');
	});
	it('shows no price target block without one', () => {
		for (const t of [undefined, null]) {
			expect(html(FinancialTable, { title: 'Analyst estimates', table, message: null, target: t })).not.toContain(
				'Price target'
			);
		}
	});
});

describe('SupplyChainView', () => {
	const plain = (body: string) =>
		body
			.replace(/<!--[^]*?-->/g, '')
			.replace(/<[^>]+>/g, ' ')
			.replace(/\s+/g, ' ');
	const chain: SupplyChain = {
		total: 3,
		suppliers: 2,
		customers: 2,
		both: 1,
		links: [
			{
				symbol: 'TSM',
				name: 'Taiwan Semiconductor',
				country: 'TW',
				industry: 'Semiconductors',
				supplier: true,
				customer: false,
				correlation1y: 0.81,
				correlation3m: -0.2
			},
			{
				symbol: 'A&B',
				name: 'Odd <Ticker> Co',
				country: null,
				industry: null,
				supplier: true,
				customer: true,
				correlation1y: null,
				correlation3m: null
			}
		]
	};
	const hrefFor = (symbol: string) => (symbol === 'A&B' ? null : `/financials?symbol=${symbol}`);

	it('lists each company with what it is, where, its industry and both correlations', () => {
		const out = plain(html(SupplyChainView, { chain, message: null, hrefFor }));
		expect(out).toContain('Eulerpool lists 3 linked companies: 2 suppliers, 2 customers; 1 is both.');
		expect(out).toContain('Taiwan Semiconductor TSM Supplier TW Semiconductors +0.81 −0.20');
		expect(out).toContain('Supplier and customer n/a n/a n/a n/a');
	});
	it('names the table for screen readers and sets the ticker beside the company', () => {
		const body = html(SupplyChainView, { chain, message: null, hrefFor });
		expect(body).toContain(
			'<caption class="sr-only">Companies linked to the one shown, as supplier, customer or both</caption>'
		);
		expect(body.replace(/<!--[^]*?-->/g, '')).toMatch(/Taiwan Semiconductor<\/a><small[^>]*> TSM<\/small>/);
	});
	it('links a company whose ticker is usable and leaves the others as text, escaping names', () => {
		const body = html(SupplyChainView, { chain, message: null, hrefFor });
		expect(body).toContain('<a href="/financials?symbol=TSM">Taiwan Semiconductor</a>');
		expect(body).not.toContain('href="/financials?symbol=A&amp;B"');
		expect(body).toContain('Odd &lt;Ticker');
		expect(body).not.toContain('<Ticker');
	});
	it('warns that the list is leads to check, not a verified supply chain, and not ranked by size', () => {
		const out = plain(html(SupplyChainView, { chain, message: null, hrefFor }));
		expect(out).toContain('Treat this as a list of leads, not a verified supply chain');
		expect(out).toContain('gives no size for any relationship');
		expect(out).toContain('It is listed by name');
	});
	it('says it is a test, with or without data', () => {
		for (const props of [
			{ chain, message: null, hrefFor },
			{ chain: null, message: 'Eulerpool lists no suppliers.', hrefFor }
		]) {
			const out = plain(html(SupplyChainView, props));
			expect(out).toContain('Test. This tab is an experiment');
			expect(out).toContain('may change or be removed');
		}
	});
	it('shows only the message when there is no supply chain', () => {
		const out = plain(html(SupplyChainView, { chain: null, message: 'Eulerpool lists no suppliers.', hrefFor }));
		expect(out).toContain('Eulerpool lists no suppliers.');
		expect(out).not.toContain('Company Relationship');
	});
});

describe('SegmentedNav', () => {
	it('shows an option without a link as disabled, with its reason', () => {
		const out = html(SegmentedNav, {
			label: 'Period',
			items: [
				{ label: 'Latest 5 years', href: '/x?period=annual', current: true },
				{ label: 'TTM', href: null, current: false, title: 'Not available here' }
			]
		});
		expect(out).toMatch(/<span[^>]*aria-disabled="true"[^>]*title="Not available here"[^>]*>TTM<\/span>/);
		expect(out).toContain('aria-current="page"');
		expect(out).not.toMatch(/<a[^>]*>TTM<\/a>/);
	});
	it('shows the caption before the control', () => {
		const out = html(SegmentedNav, { label: 'Data source', caption: 'Source', items: [] });
		expect(out).toContain('<span class="caption');
		expect(out).toContain('aria-label="Data source"');
	});
});
