<script lang="ts">
	import { formatPercent, type Shares } from '#lib/size';

	let {
		shares,
		format,
		measureLabel
	}: { shares: Shares; format: (n: number) => string; measureLabel: string } = $props();

	const rows = $derived([
		...shares.items.map((i) => ({ id: i.id, label: i.id, value: i.value, percent: i.percent, rest: false })),
		...(shares.rest ? [{ id: shares.rest.id, label: 'Rest of world', value: shares.rest.value, percent: shares.rest.percent, rest: true }] : [])
	]);
	const widest = $derived(Math.max(...rows.map((r) => r.percent), 0.0001));
</script>

{#if rows.length > 0}
	<ul class="bars" role="list" aria-label={`Share of the global total, by ${measureLabel}`}>
		{#each rows as r (r.id)}
			<li>
				<span class="label">{r.label}</span>
				<span class="track" aria-hidden="true"><span class="bar" class:rest={r.rest} style="width: {(100 * r.percent) / widest}%"></span></span>
				<span class="value">{format(r.value)} · {formatPercent(r.percent)}</span>
			</li>
		{/each}
	</ul>
{:else}
	<p class="note">Nothing to show for this selection.</p>
{/if}

<style>
	.bars { list-style: none; margin: var(--space-3) 0; padding: 0; display: grid; gap: var(--space-2); }
	li { display: grid; grid-template-columns: minmax(8rem, 14rem) 1fr minmax(9rem, auto); gap: var(--space-3); align-items: center; font-size: var(--text-sm); }
	.track { display: block; height: 0.9rem; background: var(--surface-group); border-radius: var(--radius-sm); overflow: hidden; }
	.bar { display: block; height: 100%; background: var(--color-primary); }
	.bar.rest { background: var(--grey-05); }
	.value { text-align: right; color: var(--text-secondary); }
	.note { color: var(--text-secondary); }
</style>
