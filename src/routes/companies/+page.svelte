<script lang="ts">
	import type { PageProps } from './$types';
	import { yahooUrl } from '#lib/yahoo';

	let { data }: PageProps = $props();

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

<nav>
	<a href="/">home</a>
	<a href="/classification">classification</a>
	<a href="/companies" aria-current="page">companies</a>
	<a href="/about">about</a>
</nav>

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
			{data.result.total.toLocaleString('en')} {data.result.total === 1 ? 'company' : 'companies'}.
			{#if data.result.pages > 1}Page {data.result.page} of {data.result.pages}.{/if}
		</p>

		{#if data.result.rows.length > 0}
			<table>
				<thead>
					<tr>
						<th scope="col">Company</th><th scope="col">Ticker</th><th scope="col">SIC</th>
						<th scope="col">Industry</th><th scope="col">Country</th>
					</tr>
				</thead>
				<tbody>
					{#each data.result.rows as c (c.ticker + c.name)}
						<tr>
							<th scope="row">{c.name}</th>
							<td>{#if yahooUrl(c.ticker, c.name)}<a href={yahooUrl(c.ticker, c.name)} target="_blank" rel="noopener noreferrer">{c.ticker}</a>{:else}{c.ticker}{/if}</td>
							<td>{#if c.sic}<a href={`/companies?sic=${c.sic}`}><code>{c.sic}</code></a>{/if}</td>
							<td><a href={`/companies?industry=${encodeURIComponent(c.industry)}`}>{c.industry}</a></td>
							<td>{c.country}</td>
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
	nav { display: flex; gap: 1rem; padding: 1rem; }
	main { max-width: 64rem; margin: 0 auto; padding: 0 1rem 3rem; }
	form { display: flex; gap: 0.5rem 1rem; align-items: center; flex-wrap: wrap; margin: 1rem 0; }
	select, input[type='search'] { padding: 0.4rem 0.5rem; max-width: 100%; }
	table { border-collapse: collapse; width: 100%; }
	th, td { text-align: left; padding: 0.3rem 0.6rem; border-bottom: 1px solid #ddd; }
	.note { color: #595959; }
	.pager { display: flex; gap: 1rem; padding: 1rem 0; }
	code { font-size: 0.9em; }
</style>
