<script lang="ts">
	import { MEASURES } from '#lib/size';
	import { sizeHref, type SizeNav, type SizePage } from '#lib/size-nav';

	let {
		action,
		nav,
		countries = [],
		industries = [],
		sectors = [],
		showMeasure = false
	}: {
		action: SizePage;
		nav: SizeNav;
		countries?: readonly string[];
		industries?: readonly string[];
		sectors?: readonly string[];
		showMeasure?: boolean;
	} = $props();

	const picked = $derived(nav.countries.length + nav.industries.length + nav.sectors.length);
	// GDP exists per country only, so switching to it drops any industry or sector restriction
	const measureHref = (id: SizeNav['measure']) =>
		sizeHref(action, id === 'gdp' ? { ...nav, measure: id, industries: [], sectors: [] } : { ...nav, measure: id });
</script>

{#if showMeasure}
	<div class="measure" role="group" aria-label="Measure">
		<span class="title">Measure</span>
		<div class="segments">
			{#each MEASURES as m (m.id)}
				<a class="segment" class:on={m.id === nav.measure} href={measureHref(m.id)} aria-current={m.id === nav.measure ? 'true' : undefined}>{m.label}</a>
			{/each}
		</div>
		{#if nav.measure === 'gdp'}<span class="hint">GDP is per country, so it cannot be split by industry.</span>{/if}
	</div>
{/if}

<details class="filters">
	<summary>Choose from a list{picked > 0 ? ` (${picked} selected)` : ''}</summary>
<form method="GET" {action}>
	{#if showMeasure}<input type="hidden" name="measure" value={nav.measure} />{/if}
	{#if countries.length > 0}
		<div class="field">
			<label for="country">Countries</label>
			<select id="country" name="country" multiple size="6">
				{#each countries as name (name)}<option value={name} selected={nav.countries.includes(name)}>{name}</option>{/each}
			</select>
		</div>
	{/if}
	{#if industries.length > 0}
		<div class="field">
			<label for="industry">Industries</label>
			<select id="industry" name="industry" multiple size="6">
				{#each industries as name (name)}<option value={name} selected={nav.industries.includes(name)}>{name}</option>{/each}
			</select>
		</div>
	{/if}
	{#if sectors.length > 0}
		<div class="field">
			<label for="sector">Sectors</label>
			<select id="sector" name="sector" multiple size="6">
				{#each sectors as name (name)}<option value={name} selected={nav.sectors.includes(name)}>{name}</option>{/each}
			</select>
		</div>
	{/if}
	<button type="submit">Show</button>
	<a class="button" href={sizeHref(action, { measure: nav.measure, countries: [], industries: [], sectors: [] })}>Clear</a>
	<p class="hint block">Hold Ctrl or Cmd to pick several. Nothing selected shows everything. You can also click tiles in the map.</p>
</form>
</details>

<style>
	form { display: flex; gap: var(--space-2) var(--space-4); align-items: flex-start; flex-wrap: wrap; margin: var(--space-4) 0; padding: var(--space-3) var(--space-4); background: var(--surface-card); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); }
	.field { display: flex; flex-direction: column; gap: var(--space-1); }
	select { max-width: 100%; }
	.hint { color: var(--text-secondary); font-size: var(--text-sm); }
	.hint.block { flex-basis: 100%; margin: 0; }
	.measure { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2) var(--space-3); margin: var(--space-4) 0 var(--space-2); }
	.title { font-weight: var(--weight-medium, 500); }
	.segments { display: inline-flex; border: 1px solid var(--border-subtle); border-radius: var(--radius-md); overflow: hidden; }
	.segment { padding: var(--space-2) var(--space-4); background: var(--surface-card); text-decoration: none; }
	.segment + .segment { border-left: 1px solid var(--border-subtle); }
	.segment.on { background: var(--border-focus); color: #fff; font-weight: 600; }
	.filters { margin: var(--space-2) 0; }
	.filters summary { cursor: pointer; color: var(--text-secondary); font-size: var(--text-sm); }
</style>
