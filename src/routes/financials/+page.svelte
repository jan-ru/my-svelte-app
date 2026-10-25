<!-- src/routes/financials/+page.svelte -->
<script lang="ts">
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const view = $derived(data.view);
</script>

<svelte:head>
	<title>Financial statements</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main>
	<h1>Financial statements</h1>

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
				<label for="symbol">Ticker</label>
				<input id="symbol" name="symbol" placeholder="AAPL or ABN.AS" maxlength="15" autocomplete="off" />
				<button type="submit">Show</button>
			</form>
			<form method="POST" action="?/logout"><button type="submit">Log out</button></form>
		</div>

		{#if view.state === 'unconfigured'}
			<p class="error" role="alert">The FMP key is not configured on this deployment.</p>
		{:else if view.state === 'invalid'}
			<p class="error" role="alert">That is not a valid ticker. Use letters, digits, dots and dashes, for example BRK-B.</p>
		{:else if view.state === 'idle'}
			<p>Enter an FMP ticker to see five years of annual statements.</p>
		{:else if view.state === 'ready'}
			<h2 class="symbol">{view.symbol}</h2>
			{#each view.tables as t (t.kind)}
				<section>
					<h2>{t.title}{#if t.table?.currency} <small>(millions of {t.table.currency}; per-share figures as reported)</small>{/if}</h2>
					{#if t.table}
						<table>
							<thead>
								<tr>
									<th scope="col">Line item</th>
									{#each t.table.columns as c, i (i)}
										<th scope="col" class="num">{c.year}<br /><small>{c.date}</small></th>
									{/each}
								</tr>
							</thead>
							<tbody>
								{#each t.table.rows as row (row.key)}
									<tr>
										<th scope="row">{row.label}</th>
										{#each row.cells as cell, i (i)}<td class="num">{cell}</td>{/each}
									</tr>
								{/each}
							</tbody>
						</table>
					{:else}
						<p>{t.message}</p>
					{/if}
				</section>
			{/each}
		{/if}
	{/if}
</main>

<style>
	main { max-width: 64rem; margin: 0 auto; padding: 0 1rem 3rem; }
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
</style>
