<!-- src/routes/financials/+page.svelte -->
<script lang="ts">
	import { page } from '$app/state';
	import type { PageProps } from './$types';
	import LoginPrompt from '#lib/components/LoginPrompt.svelte';
	import FinancialTable from '#lib/components/FinancialTable.svelte';
	import NewsList from '#lib/components/NewsList.svelte';
	import PeersList from '#lib/components/PeersList.svelte';
	import PriceView from '#lib/components/PriceView.svelte';
	import ProfileView from '#lib/components/ProfileView.svelte';
	import SideLayout from '#lib/components/SideLayout.svelte';
	import SideMenu from '#lib/components/SideMenu.svelte';
	import { SOURCES, effectivePeriod, isUsListing, periodAvailable, resolveSource, sourceLabel } from '#lib/source';
	import { PERIODS, STATEMENTS, TABS, navHref } from '#lib/financials-nav';

	let { data }: PageProps = $props();
	const view = $derived(data.view);
	const nav = $derived(data.nav);
	const source = $derived(resolveSource(nav.source, data.symbol));
	const period = $derived(effectivePeriod(source, nav.period));
	// The ticker becomes the page heading once a company is shown.
	const heading = $derived('symbol' in view && view.symbol ? view.symbol : 'Company financials');
</script>

<svelte:head>
	<title>{heading} – Fetch valuation multiples</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<SideLayout>
	{#snippet menu()}
		<SideMenu
			label="Sections"
			items={TABS.map((t) => ({
				href: navHref({ ...nav, period, tab: t.id }, data.symbol),
				label: t.label,
				current: nav.tab === t.id
			}))}
		/>
	{/snippet}
	<main>
		<h1>{heading}</h1>

		{#if view.state === 'locked'}
			<p class="note">
				Profile, news, stock prices and the financial statements of one company, from Financial Modeling Prep and Yahoo
				Finance. Enter a ticker such as AAPL, or ABN.AS for a listing outside the US.
			</p>
			{#if !data.configured}
				<p class="error" role="alert">This page is not configured on this deployment.</p>
			{:else}
				<LoginPrompt from={page.url.pathname + page.url.search}>to look up a company.</LoginPrompt>
			{/if}
		{:else}
			<div class="bar">
				<form method="GET">
					<input type="hidden" name="tab" value={nav.tab} />
					<input type="hidden" name="statement" value={nav.statement} />
					<input type="hidden" name="period" value={period} />
					{#if nav.source}<input type="hidden" name="source" value={nav.source} />{/if}
					<label for="symbol">Ticker</label>
					<input
						id="symbol"
						name="symbol"
						value={data.symbol}
						placeholder="AAPL or ABN.AS"
						maxlength="15"
						autocomplete="off"
					/>
					<button type="submit">Show</button>
				</form>
			</div>

			{#if data.symbol}
				{#if isUsListing(data.symbol)}
					<nav class="source" aria-label="Data source">
						<span>Source</span>
						{#each SOURCES as s (s.id)}
							<a
								href={navHref({ ...nav, period, source: s.id }, data.symbol)}
								aria-current={source === s.id ? 'page' : undefined}>{s.label}</a
							>
						{/each}
					</nav>
				{:else}
					<p class="source-note">Source: {sourceLabel(source)}</p>
				{/if}
				{#if source === 'yahoo'}<p class="meta">Yahoo Finance data is unofficial and may be delayed.</p>{/if}
				<p class="meta">
					<a href={`/companies?q=${encodeURIComponent(data.symbol)}`}>Find this company's industry and peers</a>
				</p>
			{/if}
			{#if nav.tab === 'financials'}
				<nav class="tabs" aria-label="Statements">
					{#each STATEMENTS as s (s.id)}
						<a
							href={navHref({ ...nav, period, statement: s.id }, data.symbol)}
							aria-current={nav.statement === s.id ? 'page' : undefined}>{s.label}</a
						>
					{/each}
				</nav>
				<nav class="period" aria-label="Period">
					{#each PERIODS as p (p.id)}
						{#if periodAvailable(source, p.id)}
							<a
								href={navHref({ ...nav, period: p.id }, data.symbol)}
								aria-current={period === p.id ? 'page' : undefined}>{p.label}</a
							>
						{:else}
							<span
								class="disabled"
								aria-disabled="true"
								title="Trailing twelve months is not available from {sourceLabel(source)}. Choose Yahoo."
								>{p.label}</span
							>
						{/if}
					{/each}
				</nav>
			{/if}

			{#if view.state === 'unconfigured'}
				<p class="error" role="alert">The FMP key is not configured on this deployment.</p>
			{:else if view.state === 'invalid'}
				<p class="error" role="alert">
					That is not a valid ticker. Use letters, digits, dots and dashes, for example BRK-B.
				</p>
			{:else if view.state === 'idle'}
				<p>
					Enter a ticker to see its data. US tickers work with FMP or Yahoo Finance; others, such as ABN.AS, use Yahoo
					Finance.
				</p>
			{:else if view.state === 'profile'}
				<ProfileView profile={view.profile} message={view.message} />
			{:else if view.state === 'news'}
				<NewsList items={view.items} message={view.message} {source} />
			{:else if view.state === 'price'}
				<PriceView points={view.points} message={view.message} />
			{:else if view.state === 'peers'}
				<PeersList
					peers={view.peers}
					message={view.message}
					hrefFor={(symbol: string) => navHref({ ...nav, period, tab: 'ratios' }, symbol)}
				/>
			{:else}
				<FinancialTable title={view.title} table={view.table} message={view.message} target={view.target} />
			{/if}
		{/if}
	</main>
</SideLayout>

<style>
	main {
		min-width: 0;
		padding: 0 0 var(--space-12);
	}
	.note {
		color: var(--text-secondary);
	}
	.bar {
		display: flex;
		gap: var(--space-4);
		justify-content: space-between;
		flex-wrap: wrap;
		align-items: center;
	}
	form {
		display: flex;
		gap: var(--space-2);
		align-items: center;
		flex-wrap: wrap;
		margin: var(--space-4) 0;
	}
	.error {
		padding: var(--space-2) var(--space-3);
		color: var(--negative);
		background: var(--negative-bg);
		border-left: 4px solid var(--negative);
		border-radius: var(--radius-sm);
	}
	.tabs a,
	.period a {
		padding: 6px 14px;
		text-decoration: none;
		color: inherit;
	}
	.tabs {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
		border-bottom: 1px solid var(--border-subtle);
	}
	.tabs a {
		border-bottom: 3px solid transparent;
		margin-bottom: -1px;
	}
	.tabs a:hover {
		color: var(--color-primary);
	}
	.tabs a[aria-current='page'] {
		font-weight: var(--weight-semibold);
		color: var(--color-primary);
		border-bottom-color: var(--color-primary);
	}
	.period {
		display: inline-flex;
		margin: var(--space-3) 0;
		background: var(--white);
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-sm);
		overflow: hidden;
	}
	.period a:hover {
		background: var(--blue-05);
	}
	.period a[aria-current='page'] {
		color: var(--text-on-primary);
		background: var(--color-primary);
	}
	.period .disabled {
		padding: 6px 14px;
		color: var(--text-disabled);
		background: var(--grey-02);
		cursor: not-allowed;
	}
	.meta {
		margin: 0 0 var(--space-1);
		color: var(--text-secondary);
		font-size: var(--text-sm);
	}
	.source {
		display: flex;
		gap: var(--space-2);
		align-items: center;
		margin: 0 0 var(--space-3);
		font-size: var(--text-sm);
	}
	.source a {
		padding: 3px 10px;
		color: var(--color-primary);
		text-decoration: none;
		background: var(--white);
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-sm);
	}
	.source a:hover {
		background: var(--blue-05);
	}
	.source a[aria-current='page'] {
		color: var(--text-on-primary);
		background: var(--color-primary);
		border-color: var(--color-primary);
	}
	.source-note {
		margin: 0 0 var(--space-3);
		font-weight: var(--weight-semibold);
	}
</style>
