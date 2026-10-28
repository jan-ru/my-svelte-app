<script lang="ts">
	import type { PageProps } from './$types';
	import LoginPrompt from '#lib/components/LoginPrompt.svelte';
	import ShareBars from '#lib/components/ShareBars.svelte';
	import SizeSelector from '#lib/components/SizeSelector.svelte';
	import Treemap from '#lib/components/Treemap.svelte';
	import { formatCount, formatPercent } from '#lib/size';
	import { sizeHref, toggle } from '#lib/size-nav';

	let { data }: PageProps = $props();

	const view = $derived(data.view);
	// Tiles and legend link to a narrower view only for logged-in visitors; anonymous pages link to no query variant.
	const tiles = $derived(
		view.tiles.map((t) => (data.interactive ? { ...t, href: sizeHref('/industries', { ...data.nav, industries: toggle(data.nav.industries, t.id) }) } : t))
	);
	const breakdown = $derived(
		view.breakdown?.map((t) => (data.interactive ? { ...t, href: sizeHref('/industries', { ...data.nav, countries: toggle(data.nav.countries, t.id) }) } : t)) ?? null
	);
	const sectorHref = (sector: string) => sizeHref('/industries', { ...data.nav, sectors: toggle(data.nav.sectors, sector) });
</script>

<svelte:head>
	<title>Industries – Size versus global</title>
	<meta name="description" content="How large each industry is as a share of all listed companies, coloured by sector." />
</svelte:head>

<main>
	<h1>Industries</h1>
	<p class="note">
		How large each industry is as a share of all companies in the NYU Stern list. Measure: <strong>companies</strong>
		(there is no value per industry in dollars). Colour shows the sector most of an industry's companies belong to.
	</p>

	{#if data.interactive}
		<SizeSelector action="/industries" nav={data.nav} countries={data.countries} industries={data.industries} sectors={data.sectors} />
	{:else}
		<LoginPrompt from="/industries">to choose industries, sectors and countries.</LoginPrompt>
	{/if}

	<h2>All industries by companies</h2>
	<ul class="legend" aria-label="Sectors">
		{#each view.legend as l (l.sector)}
			<li>
				<span class="swatch" style="background: {l.fill}"></span>
				{#if data.interactive}
					<a href={sectorHref(l.sector)} aria-current={data.nav.sectors.includes(l.sector) ? 'true' : undefined}>{l.sector}</a>
				{:else}
					{l.sector}
				{/if}
				({formatCount(l.value)})
			</li>
		{/each}
	</ul>
	<Treemap items={tiles} selected={data.nav.industries} format={formatCount} measureLabel="companies" total={view.total} />

	<h2>{data.nav.industries.length > 0 ? 'Selected industries' : 'Largest industries'} versus global</h2>
	<ShareBars shares={view.shares} format={formatCount} measureLabel="companies" />

	{#if view.cross}
		<p role="status">
			{formatCount(view.cross.count)} companies in {data.nav.countries[0]} and {data.nav.industries[0]}:
			{formatPercent(view.cross.percentOfGlobal)} of all companies,
			{formatPercent(view.cross.percentOfCountry)} of {data.nav.countries[0]},
			{formatPercent(view.cross.percentOfIndustry)} of {data.nav.industries[0]}.
			<a href={view.cross.href}>List the companies</a>
		</p>
	{/if}

	{#if breakdown}
		<h2>Countries of the selected industries</h2>
		<Treemap items={breakdown} selected={data.nav.countries} format={formatCount} measureLabel="companies" total={view.total} />
	{/if}

	<p class="note">
		Source: <a href="https://pages.stern.nyu.edu/~adamodar/New_Home_Page/data.html" rel="noreferrer">NYU Stern (Damodaran) data</a>, file built on {data.generated}.
		The industry shown for a company is the one NYU assigns, not one derived here.
	</p>
</main>

<style>
	main { max-width: 64rem; margin: 0 auto; padding: 0 var(--space-4) var(--space-12); }
	h2 { margin-top: var(--space-8); font-size: var(--text-lg); }
	.note { color: var(--text-secondary); }
	.legend { list-style: none; display: flex; flex-wrap: wrap; gap: var(--space-2) var(--space-4); margin: var(--space-3) 0; padding: 0; font-size: var(--text-sm); }
	.swatch { display: inline-block; width: 0.8rem; height: 0.8rem; margin-right: var(--space-1); border: 1px solid var(--border-strong); border-radius: 2px; vertical-align: middle; }
</style>
