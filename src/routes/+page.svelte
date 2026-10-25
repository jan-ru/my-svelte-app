<script lang="ts">
	import { page } from '$app/state';
	import { MAX_SELECTION, MULTIPLES, REGIONS, type Role } from '#lib/catalog';
	import { LOW_FIRMS_THRESHOLD, PALETTE, formatMultiple } from '#lib/chart';
	import GroupedBarChart from '#lib/components/GroupedBarChart.svelte';
	import { applyRole } from '#lib/params';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const selection = $derived(data.view.selection);
	const layout = $derived(data.view.layout);

	const roles: { id: Role; label: string }[] = [
		{ id: 'multiples', label: 'Multiples' },
		{ id: 'regions', label: 'Regions' },
		{ id: 'industries', label: 'Industries' }
	];
	const layoutControls = [
		{ name: 'p', label: 'Panels', key: 'panels' },
		{ name: 'x', label: 'X axis', key: 'x' },
		{ name: 'c', label: 'Colour', key: 'color' }
	] as const;

	let filter = $state('');
	const unselected = $derived(data.industries.filter((n) => !selection.industries.includes(n)));
	const visible = $derived(
		unselected.filter((n) => n.toLowerCase().includes(filter.trim().toLowerCase()))
	);
	const isFull = (list: string[]) => list.length >= MAX_SELECTION;

	const ready = $derived(
		selection.multiples.length > 0 && selection.regions.length > 0 && selection.industries.length > 0
	);
	const bars = $derived(data.model?.panels.flatMap((p) => p.bars.flat()) ?? []);
	const hasLowFirms = $derived(bars.some((b) => b.firms !== null && b.firms < LOW_FIRMS_THRESHOLD));
	const errors = $derived([...new Set(bars.map((b) => b.error).filter((e): e is string => !!e))]);
	const updatedLabel = $derived(
		data.updated
			? new Date(data.updated).toLocaleDateString('en-GB', { dateStyle: 'long', timeZone: 'UTC' })
			: null
	);

	function onchange(event: Event & { currentTarget: HTMLFormElement }) {
		const form = event.currentTarget;
		const target = event.target;
		if (target instanceof HTMLElement && target.dataset.nosubmit !== undefined) return;

		if (target instanceof HTMLSelectElement && layoutControls.some((c) => c.name === target.name)) {
			const control = layoutControls.find((c) => c.name === target.name)!;
			const next = applyRole(layout, control.key, target.value as Role);
			for (const c of layoutControls) {
				(form.elements.namedItem(c.name) as HTMLSelectElement).value = next[c.key];
			}
		}
		form.requestSubmit();
	}
</script>

<svelte:head>
	<title>Fetch valuation multiples</title>
	<meta name="description" content="Compare NYU Stern industry valuation multiples across regions." />
</svelte:head>

<main>
	<h1>Valuation multiples by industry</h1>
	<p class="source">
		Source:
		<a href="https://pages.stern.nyu.edu/~adamodar/New_Home_Page/data.html" rel="noreferrer">NYU Stern</a>{#if updatedLabel},
			data updated {updatedLabel}{/if}.
	</p>

	<form method="GET" data-sveltekit-replacestate data-sveltekit-keepfocus data-sveltekit-noscroll {onchange}>
		<div class="controls">
			<fieldset>
				<legend>Multiples <span class="count">{selection.multiples.length} of {MAX_SELECTION}</span></legend>
				<input type="hidden" name="m" value="" />
				{#each MULTIPLES as multiple (multiple.id)}
					{@const checked = selection.multiples.includes(multiple.id)}
					<label>
						<input
							type="checkbox"
							name="m"
							value={multiple.id}
							{checked}
							disabled={!checked && isFull(selection.multiples)}
						/>
						{multiple.label}
					</label>
				{/each}
			</fieldset>

			<fieldset>
				<legend>Regions <span class="count">{selection.regions.length} of {MAX_SELECTION}</span></legend>
				<input type="hidden" name="r" value="" />
				{#each REGIONS as region (region.id)}
					{@const checked = selection.regions.includes(region.id)}
					<label>
						<input
							type="checkbox"
							name="r"
							value={region.id}
							{checked}
							disabled={!checked && isFull(selection.regions)}
						/>
						{region.label}
					</label>
				{/each}
			</fieldset>

			<fieldset class="industries">
				<legend>Industries <span class="count">{selection.industries.length} of {MAX_SELECTION}</span></legend>
				<input type="hidden" name="i" value="" />
				<div class="chips">
					{#each selection.industries as name (name)}
						<label class="chip">
							<input type="checkbox" name="i" value={name} checked />
							{name} <span aria-hidden="true">✕</span><span class="sr-only">remove</span>
						</label>
					{/each}
				</div>
				<input
					type="search"
					placeholder="Search industries…"
					aria-label="Search industries"
					data-nosubmit
					bind:value={filter}
				/>
				<div class="list">
					{#each visible as name (name)}
						<label>
							<input type="checkbox" name="i" value={name} disabled={isFull(selection.industries)} />
							{name}
						</label>
					{:else}
						<p class="hint">No matching industries.</p>
					{/each}
				</div>
			</fieldset>
		</div>

		<div class="pivot">
			<span class="label">Chart layout</span>
			{#each layoutControls as control (control.name)}
				<label>
					{control.label}
					<select name={control.name}>
						{#each roles as role (role.id)}
							<option value={role.id} selected={layout[control.key] === role.id}>{role.label}</option>
						{/each}
					</select>
				</label>
			{/each}
		</div>

		<noscript><button type="submit">Update</button></noscript>
	</form>

	{#if data.loadError}
		<p class="notice" role="alert">
			{data.loadError}
			<a href="{page.url.pathname}{page.url.search}" data-sveltekit-reload>Try again</a>
		</p>
	{:else if !ready}
		<p class="notice">Pick at least one multiple, region and industry.</p>
	{:else if data.model}
		<ul class="legend" aria-label="Legend">
			{#each data.model.series as name, i (name)}
				<li><span class="swatch" style:background={PALETTE[i]}></span>{name}</li>
			{/each}
		</ul>

		<div class="panels" class:single={data.model.panels.length === 1}>
			{#each data.model.panels as panel, index (panel.key)}
				<section>
					<h2>{panel.title}</h2>
					<GroupedBarChart {panel} colors={PALETTE} uid={index} />
					<details>
						<summary>Show data</summary>
						<table>
							<thead>
								<tr>
									<th></th>
									{#each panel.series as name (name)}<th>{name}</th>{/each}
								</tr>
							</thead>
							<tbody>
								{#each panel.categories as category, ci (category)}
									<tr>
										<th scope="row">{category}</th>
										{#each panel.bars[ci] as bar, si (si)}
											<td title={bar.error}>{bar.error ? 'unavailable' : formatMultiple(bar.value)}</td>
										{/each}
									</tr>
								{/each}
							</tbody>
						</table>
					</details>
				</section>
			{/each}
		</div>

		{#if hasLowFirms}
			<p class="footnote">Hatched bars are based on fewer than {LOW_FIRMS_THRESHOLD} firms.</p>
		{/if}
		{#if errors.length > 0}
			<p class="footnote" role="status">Some data is unavailable: {errors.join('; ')}</p>
		{/if}
	{/if}
</main>

<style>
	main {
		max-width: 80rem;
		margin: 0 auto;
		padding: 0 1rem 3rem;
	}
	h1 {
		color: #ff3e00;
		font-weight: 300;
		margin-bottom: 0.25rem;
	}
	.source {
		margin-top: 0;
		color: #555;
	}
	.controls {
		display: grid;
		grid-template-columns: 1fr 1fr 1.4fr;
		gap: 1rem;
		align-items: start;
	}
	fieldset {
		border: 1px solid #ccc;
		border-radius: 6px;
		padding: 0.5rem 0.75rem 0.75rem;
	}
	fieldset > label {
		display: block;
		line-height: 1.6;
	}
	.count,
	.hint {
		color: #777;
		font-size: 0.85em;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-bottom: 0.5rem;
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
	.chip {
		position: relative;
		background: #e8f0fe;
		border-radius: 1rem;
		padding: 0.1rem 0.6rem;
		cursor: pointer;
	}
	.chip:focus-within {
		outline: 2px solid #1a56db;
		outline-offset: 2px;
	}
	.chip input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}
	.industries input[type='search'] {
		width: 100%;
		box-sizing: border-box;
		margin-bottom: 0.4rem;
	}
	.list {
		max-height: 11rem;
		overflow-y: auto;
		border-top: 1px solid #eee;
	}
	.list label {
		display: block;
		line-height: 1.5;
	}
	.pivot {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin: 1rem 0;
	}
	.label {
		font-weight: 600;
	}
	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 1.25rem;
		list-style: none;
		padding: 0;
	}
	.swatch {
		display: inline-block;
		width: 0.9rem;
		height: 0.9rem;
		margin-right: 0.4rem;
		vertical-align: -0.1rem;
	}
	.panels {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.5rem;
	}
	.panels.single {
		grid-template-columns: minmax(0, 40rem);
	}
	h2 {
		font-size: 1.1rem;
		margin: 0 0 0.25rem;
	}
	details {
		margin-top: 0.5rem;
	}
	table {
		border-collapse: collapse;
		margin-top: 0.5rem;
		font-size: 0.9rem;
	}
	th,
	td {
		padding: 0.2rem 0.6rem;
		text-align: right;
		border-bottom: 1px solid #eee;
	}
	th:first-child {
		text-align: left;
	}
	.notice {
		padding: 1rem;
		border: 1px solid #ccc;
		border-radius: 6px;
		background: #fafafa;
	}
	.footnote {
		color: #555;
		font-size: 0.9rem;
	}
</style>
