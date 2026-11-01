<script lang="ts">
	import type { PageProps } from './$types';
	import LoginPrompt from '#lib/components/LoginPrompt.svelte';
	import ShareBars from '#lib/components/ShareBars.svelte';
	import SelectionBar from '#lib/components/SelectionBar.svelte';
	import SizeSelector from '#lib/components/SizeSelector.svelte';
	import Treemap from '#lib/components/Treemap.svelte';
	import { plural } from '#lib/plural';
	import { formatCount, formatPercent, formatUsd, formatUsdCompact, USD_COMPACT_NOTE } from '#lib/size';
	import { sizeHref, toggle } from '#lib/size-nav';

	let { data }: PageProps = $props();

	const view = $derived(data.view);
	const gdp = $derived(view.measureLabel === 'GDP');
	const measureTitle = $derived(gdp ? 'GDP' : 'number of companies');
	const format = $derived(gdp ? formatUsd : formatCount);
	// Tiles link to a narrower view only for logged-in visitors; anonymous pages link to no query variant.
	const tiles = $derived(
		view.tiles.map((t) =>
			data.interactive
				? { ...t, href: sizeHref('/countries', { ...data.nav, countries: toggle(data.nav.countries, t.id) }) }
				: t
		)
	);
	const chips = $derived([
		...data.nav.countries.map((c) => ({
			label: c,
			href: sizeHref('/countries', { ...data.nav, countries: toggle(data.nav.countries, c) })
		})),
		...data.nav.industries.map((i) => ({
			label: i,
			href: sizeHref('/countries', { ...data.nav, industries: toggle(data.nav.industries, i) })
		}))
	]);
	const clearHref = $derived(sizeHref('/countries', { ...data.nav, countries: [], industries: [] }));
	// what the selected countries add up to, so the reader knows what the bars and the industries map below describe
	const summary = $derived.by(() => {
		if (data.nav.countries.length === 0 || view.shares.items.length === 0) return null;
		const value = view.shares.items.reduce((s, i) => s + i.value, 0);
		const percent = view.shares.items.reduce((s, i) => s + i.percent, 0);
		return { value, percent };
	});
	const breakdown = $derived(
		view.breakdown?.map((t) =>
			data.interactive
				? { ...t, href: sizeHref('/countries', { ...data.nav, industries: toggle(data.nav.industries, t.id) }) }
				: t
		) ?? null
	);
</script>

<svelte:head>
	<title>Countries – Size versus global</title>
	<meta
		name="description"
		content="How large each country is as a share of the global total: listed companies and GDP."
	/>
</svelte:head>

<main>
	<h1>Countries</h1>
	<p class="note">
		How large each country is as a share of the global total. Measure: <strong>{measureTitle}</strong>.
		{#if gdp}GDP is the World Bank's gross domestic product in current US$.{:else}Companies are the companies in the NYU
			Stern list, not an economic size.{/if}
	</p>

	<details class="explain">
		<summary>What does this measure mean?</summary>
		<p>
			The number of companies is the count of companies in the NYU Stern list, so a country with many small listings
			looks large. GDP is the World Bank's latest value per country, in current US$; the year differs per country.
			Percentages are always of the global total (all companies in the list, or world GDP), with "rest of world" as the
			remainder.
		</p>
	</details>

	{#if data.interactive}
		<SizeSelector
			action="/countries"
			nav={data.nav}
			countries={data.countries}
			industries={gdp ? [] : data.industries}
			showMeasure
		/>
	{:else}
		<LoginPrompt from="/countries">to choose countries, industries and the measure.</LoginPrompt>
	{/if}

	{#if data.interactive}<SelectionBar {chips} {clearHref} />{/if}

	<h2>All countries by {measureTitle}</h2>
	<Treemap
		items={tiles}
		selected={data.nav.countries}
		{format}
		tileFormat={gdp ? formatUsdCompact : format}
		note={gdp ? USD_COMPACT_NOTE : ''}
		measureLabel={view.measureLabel}
		total={view.total}
	/>

	{#if summary}
		<p class="summary">
			{data.nav.countries.join(' + ')}: {format(summary.value)}
			{view.measureLabel}, {formatPercent(summary.percent)} of the global total{data.nav.industries.length > 0 && !gdp
				? `, counting only ${data.nav.industries.join(' and ')}`
				: ''}.
			{#if breakdown}The industries of these countries are shown further down.{/if}
		</p>
	{/if}

	<h2>{data.nav.countries.length > 0 ? 'Selected countries' : 'Largest countries'} versus global</h2>
	<ShareBars shares={view.shares} {format} measureLabel={view.measureLabel} />

	{#if view.cross}
		<p role="status">
			{formatCount(view.cross.count)}
			{plural(view.cross.count, 'company', 'companies')} in {data.nav.countries[0]} and {data.nav.industries[0]}:
			{formatPercent(view.cross.percentOfGlobal)} of all companies,
			{formatPercent(view.cross.percentOfCountry)} of {data.nav.countries[0]},
			{formatPercent(view.cross.percentOfIndustry)} of {data.nav.industries[0]}.
			<a href={view.cross.href}>List the companies</a>
		</p>
	{/if}

	{#if breakdown}
		<h2>Industries in the selected countries</h2>
		<Treemap
			items={breakdown}
			selected={data.nav.industries}
			format={formatCount}
			measureLabel="companies"
			total={view.breakdownTotal}
		/>
	{/if}

	<p class="note">
		Companies: <a href="https://pages.stern.nyu.edu/~adamodar/New_Home_Page/data.html" rel="noreferrer"
			>NYU Stern (Damodaran) data</a
		>, file built on {data.generated}.
		{#if view.gdpNote}{view.gdpNote}{:else}GDP ({data.interactive
				? 'choose the measure above'
				: 'switch the measure after logging in'}): World Bank, current US$, CC BY 4.0.{/if}
	</p>
</main>

<style>
	main {
		max-width: 64rem;
		margin: 0 auto;
		padding: 0 var(--space-4) var(--space-12);
	}
	h2 {
		margin-top: var(--space-8);
		font-size: var(--text-lg);
	}
	.note {
		color: var(--text-secondary);
	}
	.explain {
		margin: var(--space-2) 0;
		color: var(--text-secondary);
		font-size: var(--text-sm);
	}
	.explain summary {
		cursor: pointer;
	}
	.summary {
		margin: var(--space-4) 0 0;
		font-weight: var(--weight-medium, 500);
	}
</style>
