<script lang="ts">
	// A fieldset of checkboxes for one query parameter, capped at `max` picks.
	// The empty hidden input keeps the parameter in the query when nothing is ticked.
	let {
		legend,
		name,
		options,
		selected,
		max
	}: {
		legend: string;
		name: string;
		options: readonly { readonly id: string; readonly label: string }[];
		selected: readonly string[];
		max: number;
	} = $props();
</script>

<fieldset>
	<legend>{legend} <span class="count">{selected.length} of {max}</span></legend>
	<input type="hidden" {name} value="" />
	{#each options as option (option.id)}
		{@const checked = selected.includes(option.id)}
		<label>
			<input type="checkbox" {name} value={option.id} {checked} disabled={!checked && selected.length >= max} />
			{option.label}
		</label>
	{/each}
</fieldset>

<style>
	fieldset {
		padding: var(--space-2) var(--space-3) var(--space-3);
	}
	label {
		display: block;
		line-height: 1.8;
	}
	.count {
		color: var(--text-secondary);
		font-size: var(--text-sm);
		font-weight: var(--weight-regular);
	}
</style>
