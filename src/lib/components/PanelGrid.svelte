<script lang="ts">
	// The chart panels of the multiples view on the Horizon grid: stacked below L, side by side from L.
	import type { PanelModel } from '#lib/layout';
	import ChartPanel from './ChartPanel.svelte';

	let { panels, colors }: { panels: readonly PanelModel[]; colors: readonly string[] } = $props();
</script>

<div class="panels grid" class:single={panels.length === 1}>
	{#each panels as panel, index (panel.key)}
		<div class="panel span-4 span-m-8 span-l-6 span-xl-8">
			<ChartPanel {panel} {colors} uid={index} />
		</div>
	{/each}
</div>

<style>
	.panels.single .panel {
		max-width: 40rem;
	}
</style>
