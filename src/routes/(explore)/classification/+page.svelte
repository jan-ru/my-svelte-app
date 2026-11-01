<script lang="ts">
	import ClassificationGlossary from '#lib/components/ClassificationGlossary.svelte';
	import CrosswalkTrace from '#lib/components/CrosswalkTrace.svelte';
	import LoginPrompt from '#lib/components/LoginPrompt.svelte';
	import ReverseTraceView from '#lib/components/ReverseTraceView.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Industry classification – Fetch valuation multiples</title>
	<meta
		name="description"
		content="From an SBI 2025 code to NACE, ISIC, NAICS, SIC and NYU Stern (Damodaran) industries."
	/>
</svelte:head>

<main>
	<h1>Industry classification</h1>
	<p class="lede">
		Find an <abbr title="Standaard Bedrijfsindeling">SBI</abbr> 2025 code (used by
		<abbr title="Centraal Bureau voor de Statistiek">CBS</abbr>
		in the Netherlands) and follow it through
		<abbr title="Nomenclature statistique des activités économiques dans la Communauté européenne">NACE</abbr>,
		<abbr title="International Standard Industrial Classification">ISIC</abbr>,
		<abbr title="North American Industry Classification System">NAICS</abbr> and
		<abbr title="Standard Industrial Classification">SIC</abbr> to the industries in the NYU Stern (Damodaran) data.
	</p>
	<ClassificationGlossary />

	<h2 id="forward">From SBI 2025 to a Damodaran industry</h2>
	<p class="caveat" role="note">
		Every step maps one code to several, so the result is a rough guide, not a rule. The last step counts how the
		{data.companies.toLocaleString('en')} listed companies in the NYU Stern company list, each with a SIC code and an industry,
		are spread over the SIC codes reached.
	</p>

	{#if data.interactive}
		<form method="get" aria-labelledby="forward">
			<label for="q">Search by code or words</label>
			<input id="q" name="q" type="search" value={data.q} placeholder="e.g. 6419, software, retail" maxlength="100" />
			<button type="submit">Search</button>
		</form>
	{:else}
		<LoginPrompt from="/classification">to search the classification.</LoginPrompt>
	{/if}

	{#if data.q !== '' && data.results.length === 0}
		<p role="status">No SBI 2025 code matches “{data.q}”.</p>
	{:else if data.results.length > 0}
		<ul class="results" aria-label="Search results">
			{#each data.results as r (r.code)}
				<li>
					<a href={`/classification?code=${encodeURIComponent(r.code)}&q=${encodeURIComponent(data.q)}`}
						><code>{r.code}</code> {r.title}</a
					>
				</li>
			{/each}
		</ul>
	{/if}

	{#if data.trace}<CrosswalkTrace trace={data.trace} />{/if}

	<h2 id="reverse">From a Damodaran industry to SBI 2025</h2>
	<p>
		Pick an industry to see which SBI 2025 classes match it. The match runs the chain above backwards from the SIC codes
		of the industry's companies. At each step where one code leads to several, its weight is split evenly, so the shares
		add up to 100% of the companies that could be followed, and show where the industry most likely sits.
	</p>
	{#if data.interactive}
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
	{:else}
		<LoginPrompt from="/classification">to search the classification.</LoginPrompt>
	{/if}

	{#if data.industry !== '' && !data.reverse}
		<p role="status">Unknown industry “{data.industry}”.</p>
	{:else if data.reverse}
		<ReverseTraceView reverse={data.reverse} max={data.maxReverse} />
	{/if}

	<h2>Sources</h2>
	<ul class="sources">
		<li>
			<a
				href="https://www.cbs.nl/nl-nl/onze-diensten/methoden/classificaties/activiteiten/standaard-bedrijfsindeling--sbi--"
				rel="noreferrer">CBS: Standaard Bedrijfsindeling 2025</a
			> (structure and conversion table to SBI 2008)
		</li>
		<li>
			<a href="https://unstats.un.org/unsd/classifications/Econ" rel="noreferrer"
				>UN Statistics Division: ISIC and NAICS correspondence tables</a
			>
		</li>
		<li>
			<a href="https://www.census.gov/naics/concordances/concordances.html" rel="noreferrer"
				>US Census Bureau: SIC to NAICS concordance</a
			>
		</li>
		<li>
			<a href="https://pages.stern.nyu.edu/~adamodar/New_Home_Page/data.html" rel="noreferrer"
				>NYU Stern (Damodaran): company list with industry and SIC code</a
			>
		</li>
	</ul>
	<p class="note">
		Built from these tables on {data.generated}. Check the sources for licence terms before reusing the data.
	</p>
</main>

<style>
	main {
		max-width: 56rem;
		margin: 0 auto;
		padding: 0 var(--space-4) var(--space-12);
	}
	.lede {
		font-size: var(--text-md);
	}
	.caveat {
		padding: var(--space-3) var(--space-4);
		background: var(--critical-bg);
		border-left: 4px solid var(--critical);
		border-radius: var(--radius-sm);
	}
	form {
		display: flex;
		gap: var(--space-2);
		align-items: center;
		flex-wrap: wrap;
		margin: var(--space-4) 0;
	}
	input[type='search'] {
		flex: 1 1 18rem;
	}
	.results {
		padding-left: 1.2rem;
	}
	.note {
		color: var(--text-secondary);
		font-weight: var(--weight-regular);
	}
	select {
		max-width: 100%;
	}
</style>
