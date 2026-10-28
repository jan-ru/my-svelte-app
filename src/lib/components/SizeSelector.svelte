<script lang="ts">
	import { MEASURES } from '#lib/size';
	import type { SizeNav, SizePage } from '#lib/size-nav';

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
</script>

<form method="GET" {action}>
	{#if showMeasure}
		<label for="measure">Measure</label>
		<select id="measure" name="measure">
			{#each MEASURES as m (m.id)}<option value={m.id} selected={m.id === nav.measure}>{m.label}</option>{/each}
		</select>
	{/if}
	{#if countries.length > 0}
		<label for="country">Countries</label>
		<select id="country" name="country" multiple size="6">
			{#each countries as name (name)}<option value={name} selected={nav.countries.includes(name)}>{name}</option>{/each}
		</select>
	{/if}
	{#if industries.length > 0}
		<label for="industry">Industries</label>
		<select id="industry" name="industry" multiple size="6">
			{#each industries as name (name)}<option value={name} selected={nav.industries.includes(name)}>{name}</option>{/each}
		</select>
	{/if}
	{#if sectors.length > 0}
		<label for="sector">Sectors</label>
		<select id="sector" name="sector" multiple size="6">
			{#each sectors as name (name)}<option value={name} selected={nav.sectors.includes(name)}>{name}</option>{/each}
		</select>
	{/if}
	<button type="submit">Show</button>
	<a class="button" href={action}>Clear</a>
	<p class="hint">Hold Ctrl or Cmd to pick several. Nothing selected shows everything.</p>
</form>

<style>
	form { display: flex; gap: var(--space-2) var(--space-4); align-items: flex-start; flex-wrap: wrap; margin: var(--space-4) 0; padding: var(--space-3) var(--space-4); background: var(--surface-card); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); }
	select { max-width: 100%; }
	.button { display: inline-block; padding: 2px 10px; font-size: var(--text-sm); font-weight: var(--weight-semibold); color: var(--color-primary); text-decoration: none; background: var(--white); border: 1px solid var(--border-strong); border-radius: var(--radius-sm); }
	.button:hover, .button:focus-visible { color: var(--text-on-primary); background: var(--color-primary); border-color: var(--color-primary); }
	.hint { flex-basis: 100%; margin: 0; color: var(--text-secondary); font-size: var(--text-sm); }
</style>
