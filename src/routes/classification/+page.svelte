<script lang="ts">
	import type { PageProps } from './$types';
	import type { Item } from '$lib/crosswalk';

	let { data }: PageProps = $props();

	const steps: { key: 'nace21' | 'nace2' | 'isic31' | 'naics' | 'sic'; label: string; note: string }[] = [
		{ key: 'nace21', label: 'NACE Rev. 2.1', note: 'The first four digits of SBI 2025 are NACE Rev. 2.1.' },
		{ key: 'nace2', label: 'NACE Rev. 2 (= SBI 2008 = ISIC Rev. 4)', note: 'Via the CBS conversion table SBI 2025 to SBI 2008.' },
		{ key: 'isic31', label: 'ISIC Rev. 3.1', note: 'Via the UN correspondence table ISIC Rev. 4 to Rev. 3.1.' },
		{ key: 'naics', label: 'NAICS 2002 (US)', note: 'Via the UN correspondence table ISIC Rev. 3.1 to NAICS 2002.' },
		{ key: 'sic', label: 'SIC 1987 (US)', note: 'Via the US Census table NAICS 2002 to SIC 1987.' }
	];

	const percent = (share: number) => `${(share * 100).toFixed(1)}%`;
</script>

<svelte:head>
	<title>Industry classification – Fetch valuation multiples</title>
	<meta name="description" content="From an SBI 2025 code to NACE, ISIC, NAICS, SIC and NYU Stern (Damodaran) industries." />
</svelte:head>

<nav>
	<a href="/">home</a>
	<a href="/classification" aria-current="page">classification</a>
	<a href="/about">about</a>
</nav>

<main>
	<h1>Industry classification</h1>
	<p class="lede">
		Find an SBI 2025 code (used by CBS in the Netherlands) and follow it through NACE, ISIC, NAICS and SIC to the
		industries in the NYU Stern (Damodaran) data.
	</p>
	<p class="caveat" role="note">
		Every step maps one code to several, so the result is a rough guide, not a rule. The last step counts how the
		{data.companies.toLocaleString('en')} listed companies in the NYU Stern company list, each with a SIC code and an
		industry, are spread over the SIC codes reached.
	</p>

	<form method="get">
		<label for="q">Search by code or words</label>
		<input id="q" name="q" type="search" value={data.q} placeholder="e.g. 6419, software, retail" maxlength="100" />
		<button type="submit">Search</button>
	</form>

	{#if data.q !== '' && data.results.length === 0}
		<p role="status">No SBI 2025 code matches “{data.q}”.</p>
	{:else if data.results.length > 0}
		<ul class="results" aria-label="Search results">
			{#each data.results as r (r.code)}
				<li><a href={`/classification?code=${encodeURIComponent(r.code)}&q=${encodeURIComponent(data.q)}`}><code>{r.code}</code> {r.title}</a></li>
			{/each}
		</ul>
	{/if}

	{#if data.trace}
		{@const t = data.trace}
		<section aria-labelledby="start">
			<h2 id="start">SBI 2025 <code>{t.start.code}</code>: {t.start.title}</h2>

			{#each steps as step (step.key)}
				{@const items: Item[] = t[step.key]}
				<details open={step.key === 'sic' ? false : items.length <= 12}>
					<summary>{step.label} <span class="count">({items.length})</span></summary>
					<p class="note">{step.note}</p>
					{#if items.length === 0}
						<p>No match in the correspondence table.</p>
					{:else}
						<ul>
							{#each items as item (item.code)}
								<li><code>{item.code}</code>{item.title ? ` ${item.title}` : ''}</li>
							{/each}
						</ul>
					{/if}
				</details>
			{/each}

			<h3>Damodaran industries</h3>
			{#if t.damodaran.length === 0}
				<p>No companies in the NYU list share these SIC codes.</p>
			{:else}
				<table>
					<thead><tr><th scope="col">Industry</th><th scope="col" class="num">Companies</th><th scope="col" class="num">Share</th></tr></thead>
					<tbody>
						{#each t.damodaran as m (m.industry)}
							<tr>
								<th scope="row"><a href={`/?i=${encodeURIComponent(m.industry)}`}>{m.industry}</a></th>
								<td class="num">{m.companies.toLocaleString('en')}</td>
								<td class="num">{percent(m.share)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</section>
	{/if}

	<h2>Sources</h2>
	<ul class="sources">
		<li><a href="https://www.cbs.nl/nl-nl/onze-diensten/methoden/classificaties/activiteiten/standaard-bedrijfsindeling--sbi--" rel="noreferrer">CBS: Standaard Bedrijfsindeling 2025</a> (structure and conversion table to SBI 2008)</li>
		<li><a href="https://unstats.un.org/unsd/classifications/Econ" rel="noreferrer">UN Statistics Division: ISIC and NAICS correspondence tables</a></li>
		<li><a href="https://www.census.gov/naics/concordances/concordances.html" rel="noreferrer">US Census Bureau: SIC to NAICS concordance</a></li>
		<li><a href="https://pages.stern.nyu.edu/~adamodar/New_Home_Page/data.html" rel="noreferrer">NYU Stern (Damodaran): company list with industry and SIC code</a></li>
	</ul>
	<p class="note">Built from these tables on {data.generated}. Check the sources for licence terms before reusing the data.</p>
</main>

<style>
	nav { display: flex; gap: 1rem; padding: 1rem; }
	main { max-width: 56rem; margin: 0 auto; padding: 0 1rem 3rem; }
	.lede { font-size: 1.05rem; }
	.caveat { background: #fff7e0; border-left: 4px solid #e69f00; padding: 0.6rem 0.9rem; }
	form { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; margin: 1rem 0; }
	input[type='search'] { flex: 1 1 18rem; padding: 0.4rem 0.5rem; }
	.results { padding-left: 1.2rem; }
	details { margin: 0.5rem 0; }
	summary { cursor: pointer; font-weight: 600; }
	.count, .note { color: #595959; font-weight: 400; }
	table { border-collapse: collapse; width: 100%; }
	th, td { text-align: left; padding: 0.3rem 0.6rem; border-bottom: 1px solid #ddd; }
	.num { text-align: right; font-variant-numeric: tabular-nums; }
	code { font-size: 0.9em; }
</style>
