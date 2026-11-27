<script lang="ts">
	// The figures of one chart panel as a table: the chart's categories as rows and its series as columns, each value
	// with its number of firms; a value from fewer than LOW_FIRMS_THRESHOLD firms is marked with an asterisk.
	import { LOW_FIRMS_THRESHOLD, formatMultiple } from '#lib/chart';
	import type { Bar, PanelModel } from '#lib/layout';

	let { panel }: { panel: PanelModel } = $props();

	const low = (bar: Bar): boolean => bar.firms !== null && bar.firms < LOW_FIRMS_THRESHOLD;
</script>

<table>
	<thead>
		<tr>
			<th scope="col"></th>
			{#each panel.series as name (name)}<th scope="col">{name}</th>{/each}
		</tr>
	</thead>
	<tbody>
		{#each panel.categories as category, ci (category)}
			<tr>
				<th scope="row">{category}</th>
				{#each panel.bars[ci] ?? [] as bar, si (si)}
					<td title={bar.error}>
						{#if bar.error}
							unavailable
						{:else}
							{formatMultiple(bar.value)}{#if low(bar)}<span class="low">*</span>{/if}
							{#if bar.firms !== null}<small>{bar.firms} firms</small>{/if}
						{/if}
					</td>
				{/each}
			</tr>
		{/each}
	</tbody>
</table>

<style>
	table {
		margin-top: var(--space-2);
		font-size: var(--text-sm);
		border-collapse: collapse;
	}
	th,
	td {
		padding: var(--space-1) var(--space-3);
		text-align: right;
		vertical-align: top;
		border-bottom: 1px solid var(--border-subtle);
	}
	th:first-child {
		padding-left: 0;
		text-align: left;
	}
	small {
		display: block;
		color: var(--text-secondary);
	}
	.low {
		color: var(--text-secondary);
	}
</style>
