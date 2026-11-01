<script lang="ts">
	// The industries fieldset: the picked ones as removable chips, the rest in a searchable list.
	let { industries, selected, max }: { industries: readonly string[]; selected: readonly string[]; max: number } =
		$props();

	let filter = $state('');
	const visible = $derived(
		industries.filter((n) => !selected.includes(n) && n.toLowerCase().includes(filter.trim().toLowerCase()))
	);
</script>

<fieldset>
	<legend>Industries <span class="count">{selected.length} of {max}</span></legend>
	<input type="hidden" name="i" value="" />
	<div class="chips">
		{#each selected as name (name)}
			<label class="chip">
				<input type="checkbox" name="i" value={name} checked />
				{name} <span aria-hidden="true">✕</span><span class="sr-only">remove</span>
			</label>
		{/each}
	</div>
	<!-- data-nosubmit: typing a search must not submit the form (see the page's onchange) -->
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
				<input type="checkbox" name="i" value={name} disabled={selected.length >= max} />
				{name}
			</label>
		{:else}
			<p class="hint">No matching industries.</p>
		{/each}
	</div>
	<p class="hint"><a href="/classification">Don't know the industry? Find it from an SBI code.</a></p>
</fieldset>

<style>
	fieldset {
		padding: var(--space-2) var(--space-3) var(--space-3);
	}
	.count,
	.hint {
		color: var(--text-secondary);
		font-size: var(--text-sm);
		font-weight: var(--weight-regular);
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin-bottom: var(--space-2);
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
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		padding: 2px 10px;
		font-size: var(--text-sm);
		color: var(--blue-80);
		background: var(--information-bg);
		border: 1px solid var(--information-border);
		border-radius: var(--radius-pill);
		cursor: pointer;
	}
	.chip:hover {
		background: var(--blue-10);
	}
	.chip:focus-within {
		outline: var(--focus-ring) solid var(--border-focus);
		outline-offset: 2px;
	}
	.chip input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}
	input[type='search'] {
		width: 100%;
		margin-bottom: var(--space-2);
	}
	.list {
		max-height: 11rem;
		overflow-y: auto;
		border-top: 1px solid var(--border-subtle);
	}
	.list label {
		display: block;
		line-height: 1.7;
	}
</style>
