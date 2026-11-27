<script lang="ts">
	// One panel of the multiples view: the chart with its figures under "Show data", or the figures as a table alone.
	import type { Display } from '#lib/params';
	import type { PanelModel } from '#lib/layout';
	import GroupedBarChart from './GroupedBarChart.svelte';
	import PanelTable from './PanelTable.svelte';

	let {
		panel,
		colors,
		uid,
		display = 'chart'
	}: { panel: PanelModel; colors: readonly string[]; uid: number; display?: Display } = $props();
</script>

<section>
	<h2>{panel.title}</h2>
	{#if display === 'table'}
		<PanelTable {panel} />
	{:else}
		<GroupedBarChart {panel} {colors} {uid} />
		<details>
			<summary>Show data</summary>
			<PanelTable {panel} />
		</details>
	{/if}
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
</style>
