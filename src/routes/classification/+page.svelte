<script lang="ts">
	import type { PageProps } from './$types';
	import type { Item } from '$lib/crosswalk';

	let { data }: PageProps = $props();

	const steps: { key: 'nace21' | 'nace2' | 'isic4' | 'isic31' | 'naics' | 'sic'; label: string; note: string }[] = [
		{ key: 'nace21', label: 'NACE Rev. 2.1', note: 'The first four digits of SBI 2025 are NACE Rev. 2.1.' },
		{ key: 'nace2', label: 'NACE Rev. 2 (= SBI 2008)', note: 'Via the CBS conversion table SBI 2025 to SBI 2008.' },
		{ key: 'isic4', label: 'ISIC Rev. 4', note: 'A NACE Rev. 2 class is an ISIC Rev. 4 class or a subdivision of one.' },
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
		Find an <abbr title="Standaard Bedrijfsindeling">SBI</abbr> 2025 code (used by <abbr title="Centraal Bureau voor de Statistiek">CBS</abbr>
		in the Netherlands) and follow it through <abbr title="Nomenclature statistique des activités économiques dans la Communauté européenne">NACE</abbr>,
		<abbr title="International Standard Industrial Classification">ISIC</abbr>,
		<abbr title="North American Industry Classification System">NAICS</abbr> and
		<abbr title="Standard Industrial Classification">SIC</abbr> to the industries in the NYU Stern (Damodaran) data.
	</p>
	<details class="glossary" open>
		<summary>What the abbreviations mean</summary>
		<dl>
			<dt>SBI</dt>
			<dd>Standaard Bedrijfsindeling (Dutch Standard Industrial Classification). SBI 2025 is the current version; SBI 2008 is the previous one.</dd>
			<dt>CBS</dt>
			<dd>Centraal Bureau voor de Statistiek (Statistics Netherlands), which maintains the SBI.</dd>
			<dt>NACE</dt>
			<dd>Nomenclature statistique des activités économiques dans la Communauté européenne (the EU statistical classification of economic activities). Rev. 2.1 is the newest revision; the first four digits of SBI 2025 follow it. Rev. 2 matches SBI 2008.</dd>
			<dt>ISIC</dt>
			<dd>International Standard Industrial Classification of All Economic Activities, published by the United Nations. Rev. 4 is the version NACE Rev. 2 is built on.</dd>
			<dt>NAICS</dt>
			<dd>North American Industry Classification System, the US, Canadian and Mexican classification. The 2002 edition is the one with a published link to SIC.</dd>
			<dt>SIC</dt>
			<dd>Standard Industrial Classification, the older US system (1987 edition) that the NYU Stern company list uses.</dd>
			<dt>NYU Stern</dt>
			<dd>The business school of New York University, where Aswath Damodaran publishes the industry data this app uses. “Damodaran industries” are his 94 industry groups.</dd>
			<dt>UN</dt>
			<dd>United Nations (Statistics Division), which publishes the ISIC and the ISIC–NAICS correspondence tables.</dd>
			<dt>Rev.</dt>
			<dd>Revision, the numbered edition of a classification.</dd>
		</dl>
	</details>

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
								<td class="num">{Math.round(m.companies).toLocaleString('en')}</td>
								<td class="num">{percent(m.share)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</section>
	{/if}

	<h2 id="reverse">From a Damodaran industry to SBI 2025</h2>
	<p>
		Pick an industry to see which SBI 2025 classes match it. The match runs the chain above backwards from the SIC
		codes of the industry's companies. At each step where one code leads to several, its weight is split evenly, so
		the shares add up to 100% of the companies that could be followed, and show where the industry most likely sits.
	</p>
	<form method="get" aria-labelledby="reverse">
		<label for="industry">Industry</label>
		<select id="industry" name="industry">
			<option value="">Choose an industry</option>
			{#each data.industries as name (name)}
				<option value={name} selected={name === data.industry}>{name}</option>
			{/each}
		</select>
		<button type="submit">Show SBI codes</button>
	</form>

	{#if data.industry !== '' && !data.reverse}
		<p role="status">Unknown industry “{data.industry}”.</p>
	{:else if data.reverse}
		{@const r = data.reverse}
		<h3>{r.industry}</h3>
		<p class="note">
			{r.companies.toLocaleString('en')} companies in {r.sic.length} SIC codes. Showing the {Math.min(r.sbi25.length, data.maxReverse)}
			best of {r.sbi25.length} SBI 2025 classes. {percent(r.followed)} of the companies could be followed through every step; the rest have SIC codes missing from one of the correspondence tables.
		</p>
		<table>
			<thead><tr><th scope="col">SBI 2025</th><th scope="col">Title</th><th scope="col" class="num">Share</th></tr></thead>
			<tbody>
				{#each r.sbi25.slice(0, data.maxReverse) as c (c.code)}
					<tr>
						<th scope="row"><a href={`/classification?code=${encodeURIComponent(c.code)}#start`}><code>{c.code}</code></a></th>
						<td>{c.title}</td>
						<td class="num">{percent(c.share)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
		<details>
			<summary>SIC codes of this industry <span class="count">({r.sic.length})</span></summary>
			<ul>
				{#each r.sic as s (s.code)}
					<li><code>{s.code}</code> {s.title} <span class="count">({s.companies.toLocaleString('en')} companies)</span></li>
				{/each}
			</ul>
		</details>
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
	select { padding: 0.4rem 0.5rem; max-width: 100%; }
	.glossary { margin: 1rem 0; }
	dl { display: grid; grid-template-columns: max-content 1fr; gap: 0.3rem 1rem; margin: 0.5rem 0 0; }
	dt { font-weight: 600; }
	dd { margin: 0; }
	code { font-size: 0.9em; }
</style>
