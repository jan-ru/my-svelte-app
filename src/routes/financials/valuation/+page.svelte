<!-- src/routes/financials/valuation/+page.svelte -->
<script lang="ts">
	import { page } from '$app/state';
	import { MAX_SELECTION, MULTIPLES, REGIONS } from '#lib/catalog';
	import BandOverrides from '#lib/components/BandOverrides.svelte';
	import CompanyFigures from '#lib/components/CompanyFigures.svelte';
	import FootballField from '#lib/components/FootballField.svelte';
	import LoginPrompt from '#lib/components/LoginPrompt.svelte';
	import MultiplesTable from '#lib/components/MultiplesTable.svelte';
	import PeerPicker from '#lib/components/PeerPicker.svelte';
	import ValuationTable from '#lib/components/ValuationTable.svelte';
	import { fieldModel } from '#lib/football-field';
	import { sourceLabel } from '#lib/source';
	import { encodeCompany } from '#lib/valuation-company';
	import { MAX_PEERS, VALUATION_PATH, valuationHref } from '#lib/valuation-nav';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const view = $derived(data.view);
	const nav = $derived(data.nav);
	const heading = $derived(
		view.state === 'ready' && view.company ? `${view.company.name} valuation` : 'Valuation versus peers'
	);
	const field = $derived(view.state === 'ready' && view.result ? fieldModel(view.result) : null);
	// the upload keeps the rest of the page state and replaces the company
	const uploadAction = $derived(`?/upload&${valuationHref({ ...nav, company: null, symbol: '' }).split('?')[1]}`);
	const clearHref = $derived(valuationHref({ ...nav, company: null }));
	const sectorLabel = $derived(
		nav.industry ? `${nav.industry}, ${REGIONS.find((r) => r.id === nav.region)?.label}` : null
	);
</script>

<svelte:head>
	<title>{heading} – Fetch valuation multiples</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main>
	<h1>{heading}</h1>
	<p class="note">
		Values a company with multiples from peers you pick and from its Damodaran sector. Enter a ticker such as AAPL, or
		ABN.AS for a listing outside the US, or upload the figures of a private company.
	</p>

	{#if view.state === 'locked'}
		{#if data.configured}
			<LoginPrompt from={page.url.pathname + page.url.search}>to value a company.</LoginPrompt>
		{:else}
			<p class="error" role="alert">This page is not configured on this deployment.</p>
		{/if}
	{:else if view.state === 'unconfigured'}
		<p class="error" role="alert">The FMP key is not configured on this deployment.</p>
	{:else}
		<form method="GET" class="controls">
			{#if nav.source}<input type="hidden" name="source" value={nav.source} />{/if}
			<div class="row">
				{#if nav.company}
					<input type="hidden" name="co" value={encodeCompany(nav.company)} />
					<span class="private"
						>Company: <strong>{nav.company.name}</strong> (uploaded) ·
						<a href={clearHref}>Use a ticker instead</a></span
					>
				{:else}
					<label for="symbol">Ticker</label>
					<input
						id="symbol"
						name="symbol"
						value={nav.symbol}
						placeholder="AAPL or ABN.AS"
						maxlength="15"
						autocomplete="off"
					/>
				{/if}
				<label for="region">Region</label>
				<select id="region" name="region">
					{#each REGIONS as r (r.id)}<option value={r.id} selected={r.id === nav.region}>{r.label}</option>{/each}
				</select>
				<label for="industry">Sector</label>
				<select id="industry" name="industry">
					<option value="">None</option>
					{#each data.industries as name (name)}<option value={name} selected={name === nav.industry}>{name}</option
						>{/each}
				</select>
			</div>
			<fieldset class="multiples">
				<legend>Multiples <span class="count">{nav.multiples.length} of {MAX_SELECTION}</span></legend>
				<input type="hidden" name="m" value="" />
				{#each MULTIPLES as m (m.id)}
					{@const checked = nav.multiples.includes(m.id)}
					<label
						><input
							type="checkbox"
							name="m"
							value={m.id}
							{checked}
							disabled={!checked && nav.multiples.length >= MAX_SELECTION}
						/>
						{m.label}</label
					>
				{/each}
			</fieldset>
			{#if view.state === 'ready'}
				<PeerPicker picked={view.peers} suggestions={view.suggestions} max={MAX_PEERS} />
			{:else}
				{#each nav.peers as p (p)}<input type="hidden" name="peer" value={p} />{/each}
			{/if}
			{#if view.state === 'ready' && view.result}
				<BandOverrides benchmarks={view.result.benchmarks} overrides={nav.overrides} />
			{:else}
				{#each Object.entries(nav.overrides) as [id, band] (id)}
					<input type="hidden" name="lo.{id}" value={band.low} />
					<input type="hidden" name="hi.{id}" value={band.high} />
				{/each}
			{/if}
			<button type="submit">Update</button>
		</form>

		<form method="POST" action={uploadAction} enctype="multipart/form-data" class="upload">
			<label for="file">Private company</label>
			<input id="file" name="file" type="file" accept=".xlsx,.xls,.ods,.csv" required />
			<button type="submit">Upload figures</button>
			<a href="{VALUATION_PATH}/template">Download the template</a>
			<span class="hint">The file is read once and not stored; its figures are kept in the page address.</span>
		</form>
		{#if form?.message}<p class="error" role="alert">{form.message}</p>{/if}

		{#if view.state === 'invalid'}
			<p class="error" role="alert">
				That is not a valid ticker. Use letters, digits, dots and dashes, for example BRK-B.
			</p>
		{:else if view.state === 'idle'}
			<p>Enter a ticker to start.</p>
		{:else}
			<p class="meta">
				{#if view.source === 'manual'}Company figures from your upload.{:else}Source for {view.symbol}: {sourceLabel(
						view.source
					)}.{/if}
				Peers with a dot in the ticker come from Yahoo Finance.
			</p>
			{#if view.sectorMessage}<p class="error" role="alert">{view.sectorMessage}</p>{/if}
			{#if view.message}
				<p class="error" role="alert">{view.message}</p>
			{/if}
			{#if view.company}<CompanyFigures figures={view.company} />{/if}
			{#if view.result}
				{#if view.peers.length > 0 || sectorLabel}
					<MultiplesTable peers={view.peers} benchmarks={view.result.benchmarks} {sectorLabel} />
				{/if}
				{#if field}<FootballField model={field} />{/if}
				<ValuationTable result={view.result} />
			{/if}
		{/if}
	{/if}
</main>

<style>
	main {
		max-width: 84rem;
		margin: 0 auto;
		padding: var(--space-4) var(--space-4) var(--space-12);
	}
	.note,
	.count,
	.meta {
		color: var(--text-secondary);
	}
	.meta {
		font-size: var(--text-sm);
	}
	.controls {
		margin: var(--space-4) 0;
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		align-items: center;
	}
	.row select {
		max-width: 20rem;
	}
	.upload {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		align-items: center;
		margin: var(--space-3) 0;
		padding: var(--space-3) var(--space-4);
		background: var(--surface-card);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
	}
	.hint {
		color: var(--text-secondary);
		font-size: var(--text-sm);
	}
	.multiples {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1) var(--space-4);
		margin: var(--space-3) 0;
		padding: var(--space-3) var(--space-4);
		background: var(--surface-card);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
	}
	.multiples legend {
		width: 100%;
	}
	.error {
		padding: var(--space-2) var(--space-3);
		color: var(--negative);
		background: var(--negative-bg);
		border-left: 4px solid var(--negative);
		border-radius: var(--radius-sm);
	}
</style>
