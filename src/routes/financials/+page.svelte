<!-- src/routes/financials/+page.svelte -->
<script lang="ts">
	import type { PageProps } from './$types';
	import { formatNewsDate, profileFields } from '#lib/company';
	import { PERIODS, STATEMENTS, TABS, navHref } from '#lib/financials-nav';

	let { data, form }: PageProps = $props();
	const view = $derived(data.view);
	const nav = $derived(data.nav);
	const tabLabel = $derived(TABS.find((t) => t.id === nav.tab)?.label ?? '');
</script>

<svelte:head>
	<title>Company financials</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main>
	<h1>Company financials</h1>

	{#if view.state === 'locked'}
		<p>This page is password protected.</p>
		{#if !data.configured}
			<p class="error" role="alert">This page is not configured on this deployment.</p>
		{:else}
			<form method="POST" action="?/login">
				<label for="password">Password</label>
				<input id="password" name="password" type="password" autocomplete="current-password" required />
				<button type="submit">Log in</button>
			</form>
		{/if}
		{#if form?.message}<p class="error" role="alert">{form.message}</p>{/if}
	{:else}
		<div class="bar">
			<form method="GET">
				<input type="hidden" name="tab" value={nav.tab} />
				<input type="hidden" name="statement" value={nav.statement} />
				<input type="hidden" name="period" value={nav.period} />
				<label for="symbol">Ticker</label>
				<input id="symbol" name="symbol" value={data.symbol} placeholder="AAPL or ABN.AS" maxlength="15" autocomplete="off" />
				<button type="submit">Show</button>
			</form>
			<form method="POST" action="?/logout"><button type="submit">Log out</button></form>
		</div>

		<div class="layout">
			<nav class="side" aria-label="Sections">
				<ul>
					{#each TABS as t (t.id)}
						<li><a href={navHref({ ...nav, tab: t.id }, data.symbol)} aria-current={nav.tab === t.id ? 'page' : undefined}>{t.label}</a></li>
					{/each}
				</ul>
			</nav>

			<div class="content">
				{#if nav.tab === 'financials'}
					<nav class="tabs" aria-label="Statements">
						{#each STATEMENTS as s (s.id)}
							<a href={navHref({ ...nav, statement: s.id }, data.symbol)} aria-current={nav.statement === s.id ? 'page' : undefined}>{s.label}</a>
						{/each}
					</nav>
					<nav class="period" aria-label="Period">
						{#each PERIODS as p (p.id)}
							<a href={navHref({ ...nav, period: p.id }, data.symbol)} aria-current={nav.period === p.id ? 'page' : undefined}>{p.label}</a>
						{/each}
					</nav>
				{/if}

				{#if view.state === 'soon'}
					<h2>{tabLabel}</h2>
					<p>Coming soon.</p>
				{:else if view.state === 'unconfigured'}
					<p class="error" role="alert">The FMP key is not configured on this deployment.</p>
				{:else if view.state === 'invalid'}
					<p class="error" role="alert">That is not a valid ticker. Use letters, digits, dots and dashes, for example BRK-B.</p>
				{:else if view.state === 'idle'}
					<p>Enter an FMP ticker to see its data.</p>
				{:else if view.state === 'profile'}
					<h2 class="symbol">{view.symbol}</h2>
					{#if view.profile}
						<dl class="facts">
							{#each profileFields(view.profile) as f (f.label)}
								<dt>{f.label}</dt>
								<dd>
									{#if f.href}<a href={f.href} target="_blank" rel="noopener noreferrer">{f.value}</a>{:else}{f.value}{/if}
								</dd>
							{/each}
						</dl>
						{#if view.profile.description}
							<h3>About</h3>
							<p class="desc">{view.profile.description}</p>
						{/if}
					{:else}
						<p>{view.message}</p>
					{/if}
				{:else if view.state === 'news'}
					<h2 class="symbol">{view.symbol}</h2>
					{#if view.items.length > 0}
						<ul class="news">
							{#each view.items as item, i (i)}
								<li>
									<h3>
										{#if item.url}<a href={item.url} target="_blank" rel="noopener noreferrer">{item.title}</a>{:else}{item.title}{/if}
									</h3>
									<p class="meta">{[item.publisher, formatNewsDate(item.date)].filter(Boolean).join(' · ')}</p>
									{#if item.text}<p>{item.text}</p>{/if}
								</li>
							{/each}
						</ul>
					{:else}
						<p>{view.message}</p>
					{/if}
				{:else if view.state === 'ready'}
					<h2 class="symbol">{view.symbol}</h2>
					<section>
						<h3>{view.title}{#if view.table?.currency} <small>(millions of {view.table.currency}; per-share figures as reported)</small>{/if}</h3>
						{#if view.table}
							<div class="scroll">
								<table>
									<thead>
										<tr>
											<th scope="col">Line item</th>
											{#each view.table.columns as c, i (i)}
												<th scope="col" class="num">{c.year}<br /><small>{c.date}</small></th>
											{/each}
										</tr>
									</thead>
									<tbody>
										{#each view.table.rows as row (row.key)}
											<tr>
												<th scope="row">{row.label}</th>
												{#each row.cells as cell, i (i)}<td class="num">{cell}</td>{/each}
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						{:else}
							<p>{view.message}</p>
						{/if}
					</section>
				{/if}
			</div>
		</div>
	{/if}
</main>

<style>
	main { max-width: 72rem; margin: 0 auto; padding: 0 1rem 3rem; }
	.bar { display: flex; gap: 1rem; justify-content: space-between; flex-wrap: wrap; align-items: center; }
	form { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; margin: 1rem 0; }
	input { padding: 0.4rem 0.5rem; }
	table { border-collapse: collapse; width: 100%; }
	th, td { padding: 0.3rem 0.6rem; border-bottom: 1px solid #ddd; text-align: left; }
	.num { text-align: right; font-variant-numeric: tabular-nums; }
	thead th { white-space: nowrap; }
	small { font-weight: 400; color: #555; }
	.error { color: #b00020; }
	.symbol { margin-bottom: 0; }
	.layout { display: grid; grid-template-columns: 11rem 1fr; gap: 1.5rem; align-items: start; }
	.side ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
	.side a, .tabs a, .period a { padding: 0.45rem 0.8rem; text-decoration: none; color: inherit; border: 1px solid transparent; }
	.side a { display: block; }
	.side a[aria-current='page'] { font-weight: 600; background: #eef2ff; border-left: 3px solid #3730a3; }
	.tabs { display: flex; flex-wrap: wrap; border-bottom: 1px solid #ddd; }
	.tabs a[aria-current='page'] { font-weight: 600; border: 1px solid #ddd; border-bottom-color: #fff; margin-bottom: -1px; }
	.period { display: inline-flex; margin: 0.8rem 0; border: 1px solid #ddd; border-radius: 0.3rem; overflow: hidden; }
	.period a[aria-current='page'] { background: #3730a3; color: #fff; }
	.content { min-width: 0; }
	.scroll { overflow-x: auto; }
	.facts { display: grid; grid-template-columns: max-content 1fr; gap: 0.3rem 1rem; margin: 1rem 0; }
	.facts dt { font-weight: 600; }
	.facts dd { margin: 0; }
	.desc { max-width: 60rem; line-height: 1.5; }
	.news { list-style: none; margin: 0; padding: 0; }
	.news li { padding: 0.8rem 0; border-bottom: 1px solid #ddd; }
	.news h3 { margin: 0 0 0.2rem; font-size: 1rem; }
	.meta { margin: 0 0 0.3rem; color: #555; font-size: 0.85rem; }
	@media (max-width: 40rem) {
		.layout { grid-template-columns: 1fr; }
		.side ul { flex-direction: row; flex-wrap: wrap; }
	}
</style>
