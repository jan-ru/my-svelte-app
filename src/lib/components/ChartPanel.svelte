<script lang="ts">
	// One panel of the multiples chart, with its figures as a table under "Show data".
	import { formatMultiple } from '#lib/chart';
	import type { PanelModel } from '#lib/layout';
	import GroupedBarChart from './GroupedBarChart.svelte';

	let { panel, colors, uid }: { panel: PanelModel; colors: readonly string[]; uid: number } = $props();
</script>

<section>
	<h2>{panel.title}</h2>
	<GroupedBarChart {panel} {colors} {uid} />
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

<style>
	section {
		padding: var(--space-4);
		background: var(--surface-card);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-1);
	}
	h2 {
		font-size: var(--text-md);
		margin: 0 0 var(--space-1);
	}
	details {
		margin-top: var(--space-2);
	}
	table {
		margin-top: var(--space-2);
		font-size: var(--text-sm);
	}
	th,
	td {
		text-align: right;
	}
	th:first-child {
		text-align: left;
	}
</style>
