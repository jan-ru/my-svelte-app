<!-- src/routes/financials/+page.svelte -->
<script lang="ts">
	import type { PageProps } from './$types';
	import LineChart from '#lib/components/LineChart.svelte';
	import { formatNewsDate, profileFields } from '#lib/company';
	import { SOURCES, effectivePeriod, isUsListing, periodAvailable, resolveSource, sourceLabel } from '#lib/source';
	import { PERIODS, STATEMENTS, TABS, loginAction, navHref } from '#lib/financials-nav';
	import { formatPrice, formatSigned, formatVolume, summarise } from '#lib/prices';

	let { data, form }: PageProps = $props();
	const view = $derived(data.view);
	const nav = $derived(data.nav);
	const source = $derived(resolveSource(nav.source, data.symbol));
	const period = $derived(effectivePeriod(source, nav.period));
	// The ticker becomes the page heading once a company is shown.
	const heading = $derived('symbol' in view && view.symbol ? view.symbol : 'Company financials');
</script>

<svelte:head>
	<title>{heading} – Fetch valuation multiples</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main>
	<div class="head">
		<h1>{heading}</h1>
		{#if view.state !== 'locked'}<form method="POST" action="?/logout"><button type="submit">Log out</button></form>{/if}
	</div>

	{#if view.state === 'locked'}
		<p>This page is password protected.</p>
		{#if !data.configured}
			<p class="error" role="alert">This page is not configured on this deployment.</p>
		{:else}
			<form method="POST" action={loginAction(nav, data.symbol, data.from)}>
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
				<input type="hidden" name="period" value={period} />
				{#if nav.source}<input type="hidden" name="source" value={nav.source} />{/if}
				<label for="symbol">Ticker</label>
				<input id="symbol" name="symbol" value={data.symbol} placeholder="AAPL or ABN.AS" maxlength="15" autocomplete="off" />
				<button type="submit">Show</button>
			</form>
		</div>

		<div class="layout">
			<nav class="side" aria-label="Sections">
				<ul>
					{#each TABS as t (t.id)}
						<li><a href={navHref({ ...nav, period, tab: t.id }, data.symbol)} aria-current={nav.tab === t.id ? 'page' : undefined}>{t.label}</a></li>
					{/each}
				</ul>
			</nav>

			<div class="content">
				{#if data.symbol}
					{#if isUsListing(data.symbol)}
						<nav class="source" aria-label="Data source">
							<span>Source</span>
							{#each SOURCES as s (s.id)}
								<a href={navHref({ ...nav, period, source: s.id }, data.symbol)} aria-current={source === s.id ? 'page' : undefined}>{s.label}</a>
							{/each}
						</nav>
					{:else}
						<p class="source-note">Source: {sourceLabel(source)}</p>
					{/if}
					{#if source === 'yahoo'}<p class="meta">Yahoo Finance data is unofficial and may be delayed.</p>{/if}
					<p class="meta"><a href={`/companies?q=${encodeURIComponent(data.symbol)}`}>Find this company's industry and peers</a></p>
				{/if}
				{#if nav.tab === 'financials'}
					<nav class="tabs" aria-label="Statements">
						{#each STATEMENTS as s (s.id)}
							<a href={navHref({ ...nav, period, statement: s.id }, data.symbol)} aria-current={nav.statement === s.id ? 'page' : undefined}>{s.label}</a>
						{/each}
					</nav>
					<nav class="period" aria-label="Period">
						{#each PERIODS as p (p.id)}
							{#if periodAvailable(source, p.id)}
								<a href={navHref({ ...nav, period: p.id }, data.symbol)} aria-current={period === p.id ? 'page' : undefined}>{p.label}</a>
							{:else}
								<span class="disabled" aria-disabled="true" title="Trailing twelve months is not available from {sourceLabel(source)}. Choose Yahoo.">{p.label}</span>
							{/if}
						{/each}
					</nav>
				{/if}

				{#if view.state === 'unconfigured'}
					<p class="error" role="alert">The FMP key is not configured on this deployment.</p>
				{:else if view.state === 'invalid'}
					<p class="error" role="alert">That is not a valid ticker. Use letters, digits, dots and dashes, for example BRK-B.</p>
				{:else if view.state === 'idle'}
					<p>Enter a ticker to see its data. US tickers work with FMP or Yahoo Finance; others, such as ABN.AS, use Yahoo Finance.</p>
				{:else if view.state === 'profile'}
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
							<h2>About</h2>
							<p class="desc">{view.profile.description}</p>
						{/if}
					{:else}
						<p>{view.message}</p>
					{/if}
				{:else if view.state === 'news'}
					{#if source === 'yahoo'}<p class="meta">Matched by company name, so some headlines may be only loosely related.</p>{/if}
					{#if view.items.length > 0}
						<ul class="news">
							{#each view.items as item, i (i)}
								<li>
									<h2>
										{#if item.url}<a href={item.url} target="_blank" rel="noopener noreferrer">{item.title}</a>{:else}{item.title}{/if}
									</h2>
									{#if item.publisher || item.date}
										<p class="meta">{[item.publisher, formatNewsDate(item.date)].filter(Boolean).join(' · ')}</p>
									{/if}
									{#if item.text}<p>{item.text}</p>{/if}
								</li>
							{/each}
						</ul>
					{:else}
						<p>{view.message}</p>
					{/if}
				{:else if view.state === 'price'}
					{#if view.points.length > 0}
						{@const s = summarise(view.points)!}
						<p class="meta">Last close, {s.date}. End-of-day prices, not live.</p>
						<dl class="quote">
							<div><dt>Close</dt><dd>{formatPrice(s.close)}</dd></div>
							{#if s.change !== null}
								<div>
									<dt>Day change</dt>
									<dd class:up={s.change > 0} class:down={s.change < 0}>
										{formatSigned(s.change)}{#if s.changePct !== null} ({formatSigned(s.changePct)}%){/if}
									</dd>
								</div>
							{/if}
							<div><dt>52-week high</dt><dd>{formatPrice(s.high)}</dd></div>
							<div><dt>52-week low</dt><dd>{formatPrice(s.low)}</dd></div>
							{#if s.volume !== null}<div><dt>Volume</dt><dd>{formatVolume(s.volume)}</dd></div>{/if}
						</dl>
						<LineChart points={view.points} />
						<details>
							<summary>Show data</summary>
							<div class="scroll tall">
								<table>
									<thead>
										<tr><th scope="col">Date</th><th scope="col" class="num">Close</th><th scope="col" class="num">Volume</th></tr>
									</thead>
									<tbody>
										{#each [...view.points].reverse() as p (p.date)}
											<tr>
												<th scope="row">{p.date}</th>
												<td class="num">{formatPrice(p.close)}</td>
												<td class="num">{p.volume === null ? '' : formatVolume(p.volume)}</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						</details>
					{:else}
						<p>{view.message}</p>
					{/if}
				{:else if view.state === 'ready'}
					<section>
						<h2>{view.title}{#if view.table?.currency} <small>(millions of {view.table.currency}; per-share figures as reported)</small>{/if}</h2>
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
	main { max-width: 72rem; margin: 0 auto; padding: 0 var(--space-4) var(--space-12); }
	.bar { display: flex; gap: var(--space-4); justify-content: space-between; flex-wrap: wrap; align-items: center; }
	form { display: flex; gap: var(--space-2); align-items: center; flex-wrap: wrap; margin: var(--space-4) 0; }
	form[action='?/logout'] button { color: var(--color-primary); background: var(--white); border-color: var(--border-strong); }
	form[action='?/logout'] button:hover { background: var(--blue-05); border-color: var(--color-primary); }
	table { width: 100%; font-size: var(--text-sm); }
	.num { text-align: right; font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
	small { font-weight: var(--weight-regular); }
	.error { padding: var(--space-2) var(--space-3); color: var(--negative); background: var(--negative-bg); border-left: 4px solid var(--negative); border-radius: var(--radius-sm); }
	.head { display: flex; align-items: center; justify-content: space-between; gap: var(--space-4); flex-wrap: wrap; }
	.head form { margin: var(--space-6) 0 var(--space-2); }
	.layout { display: grid; grid-template-columns: 11rem 1fr; gap: var(--space-6); align-items: start; }
	.side { padding: var(--space-2) 0; background: var(--surface-card); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); }
	.side ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
	.side a, .tabs a, .period a { padding: 6px 14px; text-decoration: none; color: inherit; }
	.side a { display: block; border-left: 3px solid transparent; }
	.side a:hover { background: var(--surface-hover); }
	.side a[aria-current='page'] { font-weight: var(--weight-semibold); color: var(--blue-80); background: var(--blue-05); border-left-color: var(--color-primary); }
	.tabs { display: flex; flex-wrap: wrap; gap: var(--space-1); border-bottom: 1px solid var(--border-subtle); }
	.tabs a { border-bottom: 3px solid transparent; margin-bottom: -1px; }
	.tabs a:hover { color: var(--color-primary); }
	.tabs a[aria-current='page'] { font-weight: var(--weight-semibold); color: var(--color-primary); border-bottom-color: var(--color-primary); }
	.period { display: inline-flex; margin: var(--space-3) 0; background: var(--white); border: 1px solid var(--border-strong); border-radius: var(--radius-sm); overflow: hidden; }
	.period a:hover { background: var(--blue-05); }
	.period a[aria-current='page'] { color: var(--text-on-primary); background: var(--color-primary); }
	.period .disabled { padding: 6px 14px; color: var(--text-disabled); background: var(--grey-02); cursor: not-allowed; }
	.content { min-width: 0; }
	.content h2 { font-size: var(--text-lg); margin: var(--space-4) 0 var(--space-2); }
	.scroll { overflow-x: auto; background: var(--surface-card); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); }
	.facts { display: grid; grid-template-columns: max-content 1fr; gap: var(--space-1) var(--space-4); margin: var(--space-4) 0; }
	.facts dt { font-weight: var(--weight-semibold); color: var(--text-secondary); }
	.facts dd { margin: 0; }
	.desc { max-width: 60rem; line-height: var(--leading-normal); }
	.news { list-style: none; margin: 0; padding: 0; }
	.news li { padding: var(--space-3) 0; border-bottom: 1px solid var(--border-subtle); }
	.news h2 { margin: 0 0 var(--space-1); font-size: var(--text-md); }
	.meta { margin: 0 0 var(--space-1); color: var(--text-secondary); font-size: var(--text-sm); }
	.quote { display: flex; flex-wrap: wrap; gap: var(--space-2) var(--space-8); margin: var(--space-3) 0 var(--space-4); }
	.quote div { display: flex; flex-direction: column; }
	.quote dt { color: var(--text-secondary); font-size: var(--text-sm); }
	.quote dd { margin: 0; font-family: var(--font-mono); font-size: var(--text-lg); font-weight: var(--weight-medium); font-variant-numeric: tabular-nums; }
	.up { color: var(--positive); }
	.down { color: var(--negative); }
	.tall { max-height: 24rem; overflow-y: auto; }
	details { margin-top: var(--space-4); }
	.source { display: flex; gap: var(--space-2); align-items: center; margin: 0 0 var(--space-3); font-size: var(--text-sm); }
	.source a { padding: 3px 10px; color: var(--color-primary); text-decoration: none; background: var(--white); border: 1px solid var(--border-strong); border-radius: var(--radius-sm); }
	.source a:hover { background: var(--blue-05); }
	.source a[aria-current='page'] { color: var(--text-on-primary); background: var(--color-primary); border-color: var(--color-primary); }
	.source-note { margin: 0 0 var(--space-3); font-weight: var(--weight-semibold); }
	@media (max-width: 40rem) {
	.layout { grid-template-columns: 1fr; }
	.side ul { flex-direction: row; flex-wrap: wrap; }
	}
</style>
