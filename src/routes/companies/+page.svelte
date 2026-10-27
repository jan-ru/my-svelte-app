<script lang="ts">
	import type { PageProps } from './$types';
	import { financialsLink } from '#lib/companies';
	import { quoteLink } from '#lib/quote';

	let { data }: PageProps = $props();

	/** The current filters with one more (or changed) value, back on page 1: clicking a cell narrows the list. */
	const narrow = (key: string, value: string) => {
		const sp = new URLSearchParams();
		for (const [k, v] of Object.entries({ ...data.filters, [key]: value })) if (v) sp.set(k, v);
		return `/companies?${sp}`;
	};
	const filtered = $derived(Object.values(data.filters).some(Boolean));

	const plural = (n: number, one: string, many: string) => `${n.toLocaleString('en')} ${n === 1 ? one : many}`;

	const href = (page: number, without?: string) => {
		const sp = new URLSearchParams();
		for (const [key, value] of Object.entries(data.filters)) if (value && key !== without) sp.set(key, value);
		if (page > 1) sp.set('page', String(page));
		const query = sp.toString();
		return query ? `/companies?${query}` : '/companies';
	};
</script>

<svelte:head>
	<title>Companies – Fetch valuation multiples</title>
	<meta name="description" content="Listed companies in the NYU Stern (Damodaran) industry data, by industry, SIC code and country." />
</svelte:head>

<main>
	<h1>Companies</h1>
	<p class="lede">
		The listed companies in the NYU Stern (Damodaran) company list, with the industry and
		<abbr title="Standard Industrial Classification">SIC</abbr> code each one is filed under.
	</p>

	<form method="get">
		<label for="industry">Industry</label>
		<select id="industry" name="industry">
			<option value="">All industries</option>
			{#each data.industries as name (name)}
				<option value={name} selected={name === data.filters.industry}>{name}</option>
			{/each}
		</select>

		<label for="sector">Sector</label>
		<select id="sector" name="sector">
			<option value="">All sectors</option>
			{#each data.sectors as name (name)}
				<option value={name} selected={name === data.filters.sector}>{name}</option>
			{/each}
		</select>

		<label for="region">Region</label>
		<select id="region" name="region">
			<option value="">All regions</option>
			{#each data.regions as name (name)}
				<option value={name} selected={name === data.filters.region}>{name}</option>
			{/each}
		</select>

		<label for="country">Country</label>
		<select id="country" name="country">
			<option value="">All countries</option>
			{#each data.result.countries as [name, count] (name)}
				<option value={name} selected={name === data.filters.country}>{name} ({count.toLocaleString('en')})</option>
			{/each}
		</select>

		<label for="q">Name or ticker</label>
		<input id="q" name="q" type="search" value={data.filters.q} maxlength="100" />

		{#if data.filters.sic}<input type="hidden" name="sic" value={data.filters.sic} />{/if}
		<button type="submit">Show</button>
		{#if filtered}<a class="button" href="/companies">Reset filters</a>{/if}
	</form>

	{#if data.filters.sic}
		<p class="note">
			Only companies with SIC code <code>{data.filters.sic}</code>{data.sicTitle ? ` (${data.sicTitle})` : ''}.
			<a href={href(1, 'sic')}>Remove this filter</a>
		</p>
	{/if}

	{#if data.unknownIndustry}
		<p role="status">Unknown industry “{data.filters.industry}”.</p>
	{:else}
		<p role="status" class="note">
			{data.result.total.toLocaleString('en')} {data.result.total === 1 ? 'company' : 'companies'}{#if data.result.total > 0}
				in {plural(data.result.distinct.industries, 'industry', 'industries')},
				{plural(data.result.distinct.sectors, 'sector', 'sectors')},
				{plural(data.result.distinct.regions, 'region', 'regions')},
				{plural(data.result.distinct.subGroups, 'sub group', 'sub groups')} and
				{plural(data.result.distinct.exchanges, 'exchange', 'exchanges')}{/if}.
			{#if data.result.pages > 1}Page {data.result.page} of {data.result.pages}.{/if}
		</p>

		{#if data.result.rows.length > 0}
			<table>
				<thead>
					<tr>
						<th scope="col">Company</th><th scope="col">Ticker</th><th scope="col">SIC</th>
						<th scope="col">Industry</th><th scope="col">Sector</th><th scope="col">Region</th>
						<th scope="col">Country</th><th scope="col">Financials</th>
					</tr>
				</thead>
				<tbody>
					{#each data.result.rows as c (c.ticker + c.name)}
						<tr>
							<th scope="row">{c.name}</th>
							<td>
								{#if quoteLink(c.ticker, c.name)}
									{@const q = quoteLink(c.ticker, c.name)!}
									<a href={q.url} target="_blank" rel="noopener noreferrer">{c.ticker}</a>
									<small class="src" title={`${q.source === 'YF' ? 'Yahoo' : 'Google'} Finance${q.search ? ' search' : ''}`}>{q.source}{q.search ? ' search' : ''}</small>
								{:else}{c.ticker}{/if}
							</td>
							<td>{#if c.sic}<a href={narrow('sic', c.sic)}><code>{c.sic}</code></a>{/if}</td>
							<td>
								<a href={narrow('industry', c.industry)}>{c.industry}</a>
								<a class="src" href={`/?i=${encodeURIComponent(c.industry)}`} aria-label={`Multiples for ${c.industry}`}>multiples</a>
							</td>
							<td><a href={narrow('sector', c.sector)}>{c.sector}</a></td>
							<td><a href={narrow('region', c.region)}>{c.region}</a></td>
							<td><a href={narrow('country', c.country)}>{c.country}</a></td>
							<td>
								{#if financialsLink(c)}
									<a class="button" href={financialsLink(c)} aria-label={`Financials for ${c.name}`}>Financials</a>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>

			{#if data.result.pages > 1}
				<nav class="pager" aria-label="Pages">
					{#if data.result.page > 1}<a href={href(data.result.page - 1)} rel="prev">Previous</a>{/if}
					{#if data.result.page < data.result.pages}<a href={href(data.result.page + 1)} rel="next">Next</a>{/if}
				</nav>
			{/if}
		{/if}
	{/if}

	<p class="note">
		Source: <a href="https://pages.stern.nyu.edu/~adamodar/New_Home_Page/data.html" rel="noreferrer">NYU Stern (Damodaran) data</a>,
		file built on {data.generated}. The industry shown is the one NYU assigns, not one derived here.
	</p>
</main>

<style>
	.src { margin-left: var(--space-1); color: var(--text-secondary); font-size: var(--text-xs); }
	main { max-width: 64rem; margin: 0 auto; padding: 0 var(--space-4) var(--space-12); }
	form { display: flex; gap: var(--space-2) var(--space-4); align-items: center; flex-wrap: wrap; margin: var(--space-4) 0; padding: var(--space-3) var(--space-4); background: var(--surface-card); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); }
	select, input[type='search'] { max-width: 100%; }
	table { width: 100%; font-size: var(--text-sm); background: var(--surface-card); }
	.note { color: var(--text-secondary); }
	.pager { display: flex; gap: var(--space-2); padding: var(--space-4) 0; }
	.pager a { padding: 5px 14px; font-weight: var(--weight-semibold); text-decoration: none; background: var(--white); border: 1px solid var(--border-strong); border-radius: var(--radius-sm); }
	.pager a:hover { background: var(--blue-05); border-color: var(--color-primary); }
	.button { display: inline-block; padding: 2px 10px; font-size: var(--text-sm); font-weight: var(--weight-semibold); color: var(--color-primary); text-decoration: none; background: var(--white); border: 1px solid var(--border-strong); border-radius: var(--radius-sm); }
	.button:hover, .button:focus-visible { color: var(--text-on-primary); background: var(--color-primary); border-color: var(--color-primary); }
</style>
