<script lang="ts">
	import { page } from '$app/state';
	import { MAX_SELECTION, MULTIPLES, REGIONS, type Role } from '#lib/catalog';
	import { LOW_FIRMS_THRESHOLD, PALETTE, formatMultiple } from '#lib/chart';
	import GroupedBarChart from '#lib/components/GroupedBarChart.svelte';
	import LoginPrompt from '#lib/components/LoginPrompt.svelte';
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

		const control = target instanceof HTMLSelectElement ? layoutControls.find((c) => c.name === target.name) : undefined;
		if (target instanceof HTMLSelectElement && control) {
			const next = applyRole(layout, control.key, target.value as Role);
			for (const c of layoutControls) {
				(form.elements.namedItem(c.name) as HTMLSelectElement).value = next[c.key];
			}
		}
		form.requestSubmit();
	}
</script>

<svelte:head>
	<title>Valuation multiples – Fetch valuation multiples</title>
	<meta name="description" content="Compare NYU Stern industry valuation multiples across regions." />
</svelte:head>

<main>
	<h1>Valuation multiples</h1>
	<p class="source">
		Source:
		<a href="https://pages.stern.nyu.edu/~adamodar/New_Home_Page/data.html" rel="noreferrer">NYU Stern</a>{#if updatedLabel},
			data updated {updatedLabel}{/if}.
	</p>

	{#if data.interactive}
		<form method="GET" data-sveltekit-replacestate data-sveltekit-keepfocus data-sveltekit-noscroll {onchange}>
			<div class="controls">
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
					<p class="hint"><a href="/classification">Don't know the industry? Find it from an SBI code.</a></p>
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

			</div>

			<details class="pivot">
				<summary>Chart options</summary>
				<div class="pivot-controls">
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
			</details>

			<noscript><button type="submit">Update</button></noscript>
		</form>
	{:else}
		<LoginPrompt from="/">to change the selection and the chart options.</LoginPrompt>
	{/if}

	{#if data.loadError}
		<p class="notice" role="alert">
			{data.loadError}
			<a href={data.interactive ? `${page.url.pathname}${page.url.search}` : '/'} data-sveltekit-reload>Try again</a>
		</p>
	{:else if !ready}
		<p class="notice">Pick at least one multiple, region and industry.</p>
	{:else if data.model}
		<ul class="legend" aria-label="Legend">
			{#each data.model.series as name, i (name)}
				<li><span class="swatch" style:background={PALETTE[i]}></span>{name}</li>
			{/each}
		</ul>

		<p class="peers">
			Companies in
			{#each selection.industries as name, i (name)}{i > 0 ? ', ' : ''}{#if data.interactive}<a href={`/companies?industry=${encodeURIComponent(name)}`}>{name}</a>{:else}{name}{/if}{/each}
		</p>

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
	main { max-width: 80rem; margin: 0 auto; padding: 0 var(--space-4) var(--space-12); }
	h1 { margin-bottom: var(--space-1); }
	.source { margin-top: 0; color: var(--text-secondary); }
	.controls { display: grid; grid-template-columns: 1.4fr 1fr 1fr; gap: var(--space-4); align-items: start; }
	fieldset { padding: var(--space-2) var(--space-3) var(--space-3); }
	fieldset > label { display: block; line-height: 1.8; }
	.count, .hint { color: var(--text-secondary); font-size: var(--text-sm); font-weight: var(--weight-regular); }
	.chips { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-bottom: var(--space-2); }
	.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
	.chip { position: relative; display: inline-flex; align-items: center; gap: var(--space-1); padding: 2px 10px; font-size: var(--text-sm); color: var(--blue-80); background: var(--information-bg); border: 1px solid var(--information-border); border-radius: var(--radius-pill); cursor: pointer; }
	.chip:hover { background: var(--blue-10); }
	.chip:focus-within { outline: var(--focus-ring) solid var(--border-focus); outline-offset: 2px; }
	.chip input { position: absolute; opacity: 0; pointer-events: none; }
	.industries input[type='search'] { width: 100%; margin-bottom: var(--space-2); }
	.list { max-height: 11rem; overflow-y: auto; border-top: 1px solid var(--border-subtle); }
	.list label { display: block; line-height: 1.7; }
	.pivot { margin: var(--space-4) 0; padding: var(--space-2) var(--space-4); background: var(--surface-card); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); }
	.pivot-controls { display: flex; align-items: center; flex-wrap: wrap; gap: var(--space-4); padding-top: var(--space-2); }
	.pivot label { display: inline-flex; align-items: center; gap: var(--space-2); font-size: var(--text-sm); }
	.peers { margin: 0 0 var(--space-3); font-size: var(--text-sm); color: var(--text-secondary); }
	.legend { display: flex; flex-wrap: wrap; gap: var(--space-5); list-style: none; padding: 0; font-size: var(--text-sm); }
	.swatch { display: inline-block; width: 0.9rem; height: 0.9rem; margin-right: 0.4rem; vertical-align: -0.1rem; border-radius: var(--radius-xs); }
	.panels { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-6); }
	.panels.single { grid-template-columns: minmax(0, 40rem); }
	section { padding: var(--space-4); background: var(--surface-card); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); box-shadow: var(--shadow-1); }
	h2 { font-size: var(--text-md); margin: 0 0 var(--space-1); }
	details { margin-top: var(--space-2); }
	table { margin-top: var(--space-2); font-size: var(--text-sm); }
	th, td { text-align: right; }
	th:first-child { text-align: left; }
	.notice { padding: var(--space-3) var(--space-4); background: var(--information-bg); border: 1px solid var(--information-border); border-left: 4px solid var(--information); border-radius: var(--radius-sm); }
	.notice[role='alert'] { background: var(--negative-bg); border-color: var(--negative-border); border-left-color: var(--negative); }
	.footnote { color: var(--text-secondary); font-size: var(--text-sm); }
</style>
