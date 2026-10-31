<script lang="ts">
	import { multipleById } from '#lib/catalog';
	import { formatMultiple } from '#lib/chart';
	import type { Benchmark, PeerRow } from '#lib/valuation-data';

	let { peers, benchmarks, sectorLabel }: { peers: readonly PeerRow[]; benchmarks: readonly Benchmark[]; sectorLabel: string | null } = $props();

	const label = (id: string) => multipleById(id)?.label ?? id;
	const stats = [
		{ key: 'p25', label: 'Peers, 25th percentile' },
		{ key: 'median', label: 'Peers, median' },
		{ key: 'p75', label: 'Peers, 75th percentile' }
	] as const;
</script>

<section>
	<h2>Multiples</h2>
	<div class="scroll">
		<table>
			<thead>
				<tr>
					<th scope="col">Company</th>
					{#each benchmarks as b (b.multiple)}<th scope="col" class="num">{label(b.multiple)}</th>{/each}
				</tr>
			</thead>
			<tbody>
				{#each peers as p (p.symbol)}
					<tr>
						<th scope="row">{p.symbol}{#if p.name !== p.symbol} <small>{p.name}</small>{/if}</th>
						{#if p.message}
							<td colspan={benchmarks.length} class="note">{p.message}</td>
						{:else}
							{#each benchmarks as b (b.multiple)}<td class="num">{formatMultiple(p.multiples[b.multiple] ?? null)}</td>{/each}
						{/if}
					</tr>
				{/each}
			</tbody>
			<tbody class="stats">
				{#each stats as s (s.key)}
					<tr>
						<th scope="row">{s.label}</th>
						{#each benchmarks as b (b.multiple)}<td class="num">{formatMultiple(b[s.key])}</td>{/each}
					</tr>
				{/each}
				{#if sectorLabel}
					<tr>
						<th scope="row">Sector: {sectorLabel}</th>
						{#each benchmarks as b (b.multiple)}<td class="num">{formatMultiple(b.sector)}</td>{/each}
					</tr>
				{/if}
			</tbody>
		</table>
	</div>
	<p class="meta">Zero and negative multiples are left out of the percentiles.</p>
</section>

<style>
	h2 { font-size: var(--text-lg); margin: var(--space-4) 0 var(--space-2); }
	small, .note, .meta { color: var(--text-secondary); font-weight: var(--weight-regular); }
	table { width: 100%; font-size: var(--text-sm); }
	.num { text-align: right; font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
	.stats th, .stats td { border-top: 1px solid var(--border-strong); font-weight: var(--weight-semibold); }
	.scroll { overflow-x: auto; background: var(--surface-card); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); }
	.meta { margin: var(--space-2) 0; font-size: var(--text-sm); }
</style>
