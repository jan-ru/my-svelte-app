<script lang="ts">
	// The chart panels of the multiples view on the Horizon grid: stacked below L, side by side from L.
	import type { PanelModel } from '#lib/layout';
	import type { Display } from '#lib/params';
	import ChartPanel from './ChartPanel.svelte';

	let {
		panels,
		colors,
		display = 'chart'
	}: { panels: readonly PanelModel[]; colors: readonly string[]; display?: Display } = $props();
</script>

<div class="panels grid" class:single={panels.length === 1}>
	{#each panels as panel, index (panel.key)}
		<div class="panel span-4 span-m-8 span-l-6 span-xl-8">
			<ChartPanel {panel} {colors} uid={index} {display} />
		</div>
	{/each}
</div>

<style>
	.panels.single .panel {
		max-width: 40rem;
	}
</style>
