<script lang="ts">
	import type { PageProps } from './$types';
	import LoginPrompt from '#lib/components/LoginPrompt.svelte';
	import ShareBars from '#lib/components/ShareBars.svelte';
	import SizeSelector from '#lib/components/SizeSelector.svelte';
	import Treemap from '#lib/components/Treemap.svelte';
	import { formatCount, formatPercent, formatUsd } from '#lib/size';
	import { sizeHref, toggle } from '#lib/size-nav';

	let { data }: PageProps = $props();

	const view = $derived(data.view);
	const format = $derived(view.measureLabel === 'GDP' ? formatUsd : formatCount);
	// Tiles link to a narrower view only for logged-in visitors; anonymous pages link to no query variant.
	const tiles = $derived(
		view.tiles.map((t) => (data.interactive ? { ...t, href: sizeHref('/countries', { ...data.nav, countries: toggle(data.nav.countries, t.id) }) } : t))
	);
	const breakdown = $derived(
		view.breakdown?.map((t) => (data.interactive ? { ...t, href: sizeHref('/countries', { ...data.nav, industries: toggle(data.nav.industries, t.id) }) } : t)) ?? null
	);
</script>

<svelte:head>
	<title>Countries – Size versus global</title>
	<meta name="description" content="How large each country is as a share of the global total: listed companies and GDP." />
</svelte:head>

<main>
	<h1>Countries</h1>
	<p class="note">
		How large each country is as a share of the global total. Measure: <strong>{view.measureLabel}</strong>.
		Companies are the companies in the NYU Stern list, not an economic size.
	</p>

	{#if data.interactive}
		<SizeSelector action="/countries" nav={data.nav} countries={data.countries} industries={data.industries} showMeasure />
	{:else}
		<LoginPrompt from="/countries">to choose countries, industries and the measure.</LoginPrompt>
	{/if}

	<h2>All countries by {view.measureLabel}</h2>
	<Treemap items={tiles} selected={data.nav.countries} {format} measureLabel={view.measureLabel} total={view.total} />

	<h2>{data.nav.countries.length > 0 ? 'Selected countries' : 'Largest countries'} versus global</h2>
	<ShareBars shares={view.shares} {format} measureLabel={view.measureLabel} />

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
		<h2>Industries in the selected countries</h2>
		<Treemap items={breakdown} selected={data.nav.industries} format={formatCount} measureLabel="companies" total={view.breakdownTotal} />
	{/if}

	<p class="note">
		Companies: <a href="https://pages.stern.nyu.edu/~adamodar/New_Home_Page/data.html" rel="noreferrer">NYU Stern (Damodaran) data</a>, file built on {data.generated}.
		{#if view.gdpNote}{view.gdpNote}{:else}GDP (switch the measure after logging in): World Bank, current US$, CC BY 4.0.{/if}
	</p>
</main>

<style>
	main { max-width: 64rem; margin: 0 auto; padding: 0 var(--space-4) var(--space-12); }
	h2 { margin-top: var(--space-8); font-size: var(--text-lg); }
	.note { color: var(--text-secondary); }
</style>
