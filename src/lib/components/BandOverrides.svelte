<script lang="ts">
	import { multipleById } from '#lib/catalog';
	import type { Band, Benchmark } from '#lib/valuation-data';

	let { benchmarks, overrides }: { benchmarks: readonly Benchmark[]; overrides: Readonly<Record<string, Band>> } =
		$props();

	const label = (id: string) => multipleById(id)?.label ?? id;
	const hint = (v: number | null) => (v === null ? '' : v.toFixed(1));
</script>

<!-- Part of the page's GET form: `lo.<id>` and `hi.<id>`; leave both empty to use the peers' P25 to P75. -->
<fieldset class="bands">
	<legend>Manual bands <span class="hint">optional; empty uses the peers' 25th to 75th percentile</span></legend>
	{#each benchmarks as b (b.multiple)}
		<div class="band">
			<span class="name">{label(b.multiple)}</span>
			<label
				>Low <input
					type="number"
					name="lo.{b.multiple}"
					step="any"
					min="0"
					inputmode="decimal"
					value={overrides[b.multiple]?.low ?? ''}
					placeholder={hint(b.p25)}
				/></label
			>
			<label
				>High <input
					type="number"
					name="hi.{b.multiple}"
					step="any"
					min="0"
					inputmode="decimal"
					value={overrides[b.multiple]?.high ?? ''}
					placeholder={hint(b.p75)}
				/></label
			>
			{#if overrides[b.multiple]}<span class="hint">manual</span>{/if}
		</div>
	{/each}
</fieldset>

<style>
	.bands {
		margin: var(--space-3) 0;
		padding: var(--space-3) var(--space-4);
		background: var(--surface-card);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
	}
	.hint {
		color: var(--text-secondary);
		font-size: var(--text-sm);
		font-weight: var(--weight-regular);
	}
	.band {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		align-items: center;
		padding: var(--space-1) 0;
	}
	.name {
		min-width: 9rem;
		font-weight: var(--weight-semibold);
	}
	input {
		width: 6rem;
	}
</style>
