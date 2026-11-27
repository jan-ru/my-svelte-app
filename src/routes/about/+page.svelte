<script lang="ts">
	import Callout from '#lib/components/Callout.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import SideLayout from '#lib/components/SideLayout.svelte';
	import SideMenu from '#lib/components/SideMenu.svelte';
	import { ABOUT_SECTIONS } from '#lib/nav';

	// Static text only, so it never varies the cached page.
	interface PageCard {
		readonly href: string;
		readonly title: string;
		readonly text: string;
		readonly signIn: boolean;
	}

	const groups: readonly { readonly title: string; readonly pages: readonly PageCard[] }[] = [
		{
			title: 'Multiples',
			pages: [
				{
					href: '/',
					title: 'Multiples',
					text: 'Valuation multiples, such as EV/EBITDA and P/E, by industry and region.',
					signIn: false
				}
			]
		},
		{
			title: 'Explore',
			pages: [
				{
					href: '/countries',
					title: 'Countries',
					text: 'How large each country is as a share of the global total: number of listed companies, or GDP.',
					signIn: false
				},
				{
					href: '/industries',
					title: 'Industries',
					text: 'How large each industry is as a share of all listed companies, grouped by sector.',
					signIn: false
				},
				{
					href: '/companies',
					title: 'Companies',
					text: 'The listed companies in each industry, filtered by industry, region, sector, SIC code and country.',
					signIn: false
				},
				{
					href: '/classification',
					title: 'Find Industry',
					text: 'From a Dutch SBI 2025 code to the matching NYU Stern industries, and back.',
					signIn: false
				}
			]
		},
		{
			title: 'Financials',
			pages: [
				{
					href: '/financials',
					title: 'Financials',
					text: 'Financial statements, ratios, estimates, news, prices and the company profile of one listed company, from Financial Modeling Prep, Yahoo Finance or Eulerpool.',
					signIn: true
				},
				{
					href: '/financials/valuation',
					title: 'Valuation',
					text: 'Values one company with multiples against peers you pick and its Damodaran sector, as a football-field chart. Works for a listed ticker or a private company uploaded from an Excel template, which is read once and not stored.',
					signIn: true
				}
			]
		}
	];

	const sources: readonly {
		readonly name: string;
		readonly href?: string;
		readonly logo?: string;
		readonly text: string;
	}[] = [
		{
			name: 'NYU Stern School of Business (Aswath Damodaran)',
			href: 'https://pages.stern.nyu.edu/~adamodar/',
			logo: '/nyu_stern.svg',
			text: 'Industry multiples and the company list.'
		},
		{ name: 'CBS, UN Statistics Division and US Census Bureau', text: 'The classification tables.' },
		{ name: 'World Bank', text: 'GDP (current US$), licensed CC BY 4.0.' },
		{
			name: 'Financial Modeling Prep and Yahoo Finance',
			text: 'Company financials, prices, news, analyst estimates and peer suggestions.'
		},
		{ name: 'Eulerpool', text: 'Company financials, a fair value and a quality score.' }
	];
</script>

<svelte:head>
	<title>About – Fetch valuation multiples</title>
	<meta name="description" content="What this app does and where its valuation multiples come from." />
</svelte:head>

<SideLayout>
	{#snippet menu()}
		<SideMenu
			label="On this page"
			items={ABOUT_SECTIONS.map((s) => ({ href: `#${s.id}`, label: s.label, current: false }))}
		/>
	{/snippet}
	<main>
		<header class="title">
			<h1>About</h1>
			<span class="badge">In development</span>
		</header>
		<p class="intro">
			This app helps value a company against its industry peers. It brings together valuation multiples, industry
			classifications, a company list and company financials.
		</p>

		<h2 id="pages">Pages</h2>
		{#each groups as group (group.title)}
			<h3>{group.title}</h3>
			<ul class="grid cards">
				{#each group.pages as p (p.href)}
					<li class="span-4 span-l-6 span-xl-8">
						<a class="card" href={p.href}>
							<span class="card-title">{p.title}</span>
							<span>{p.text}</span>
							{#if p.signIn}
								<span class="status"><Icon name="locked" />Sign-in required</span>
							{/if}
						</a>
					</li>
				{/each}
			</ul>
		{/each}

		<h2 id="access">Public and signed in</h2>
		<div class="grid">
			<section class="panel span-4 span-l-6 span-xl-8" aria-labelledby="public">
				<h3 id="public">Without signing in</h3>
				<ul>
					<li>The default view of each public page</li>
					<li>Cached for a day</li>
				</ul>
			</section>
			<section class="panel span-4 span-l-6 span-xl-8" aria-labelledby="signed-in">
				<h3 id="signed-in">Signed in with Google</h3>
				<ul>
					<li>Filters, search and paging on the public pages</li>
					<li>The Financials and Valuation pages, never cached publicly</li>
					<li>Only for permitted accounts</li>
				</ul>
			</section>
		</div>

		<h2 id="sources">Data sources</h2>
		<ul class="sources">
			{#each sources as s (s.name)}
				<li>
					<span class="source-name">
						{#if s.href}<a href={s.href} rel="noreferrer">{s.name}</a>{:else}{s.name}{/if}
					</span>
					<span>{s.text}</span>
					{#if s.logo}<img class="logo" src={s.logo} alt="" />{/if}
				</li>
			{/each}
		</ul>
		<Callout role="note">
			The app only reads this data and does not change it. Check each source for the date, methodology and licence terms
			before relying on a figure.
		</Callout>
	</main>
</SideLayout>

<style>
	main {
		max-width: 60rem;
		padding: 0 0 var(--space-8);
		line-height: var(--leading-normal);
	}
	.title {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3);
	}
	h1 {
		margin: 0;
		font-size: var(--text-2xl);
	}
	.badge {
		padding: 0 var(--space-2);
		font-size: var(--text-sm);
		background: var(--information-bg);
		border: 1px solid var(--information-border);
		border-radius: var(--radius-sm);
	}
	.intro {
		max-width: 40rem;
		margin: var(--space-3) 0 0;
		font-size: var(--text-md);
	}
	h2 {
		margin: var(--space-8) 0 0;
		font-size: var(--text-xl);
	}
	h3 {
		margin: var(--space-5) 0 var(--space-2);
		font-size: var(--text-lg);
	}
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.card {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		height: 100%;
		box-sizing: border-box;
		padding: var(--space-4);
		color: inherit;
		text-decoration: none;
		background: var(--surface-card);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-1);
	}
	.card:hover {
		background: var(--surface-hover);
	}
	.card-title {
		font-size: var(--text-md);
		font-weight: var(--weight-semibold);
		color: var(--text-link);
	}
	.status {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		margin-top: auto;
		padding-top: var(--space-2);
		font-size: var(--text-sm);
		color: var(--text-secondary);
	}
	.status :global(.icon) {
		margin: 0;
	}

	.panel {
		padding: var(--space-4);
		background: var(--surface-card);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
	}
	.panel h3 {
		margin-top: 0;
		font-size: var(--text-md);
	}
	.panel ul {
		padding-left: var(--space-5);
		list-style: disc;
	}

	.sources {
		margin-top: var(--space-4);
		background: var(--surface-card);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
	}
	.sources li {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		column-gap: var(--space-4);
		align-items: center;
		padding: var(--space-3) var(--space-4);
	}
	.sources li + li {
		border-top: 1px solid var(--border-subtle);
	}
	.source-name {
		font-weight: var(--weight-semibold);
	}
	.sources li > span:not(.source-name) {
		grid-column: 1;
		color: var(--text-secondary);
	}
	.logo {
		grid-column: 2;
		grid-row: 1 / span 2;
		height: 2rem;
		width: auto;
	}
</style>
