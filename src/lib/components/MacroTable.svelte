<script lang="ts">
	import { formatRate, MACRO_YEARS, type MacroRow, type RateSummary } from '#lib/macro';

	let { rows }: { rows: readonly MacroRow[] } = $props();
</script>

{#snippet latest(s: RateSummary | null)}
	{#if s}{formatRate(s.latest.value)} <span class="year">({s.latest.year})</span>{:else}n/a{/if}
{/snippet}
{#snippet average(s: RateSummary | null)}
	{#if s && s.average !== null}{formatRate(s.average)}
		<span class="year">({s.from}–{s.latest.year})</span>{:else}n/a{/if}
{/snippet}

<div class="scroll">
	<table>
		<caption class="sr-only">Inflation and real GDP growth of the selected countries</caption>
		<thead>
			<tr>
				<th scope="col" rowspan="2">Country</th>
				<th scope="colgroup" colspan="2">Inflation</th>
				<th scope="colgroup" colspan="2">Real GDP growth</th>
			</tr>
			<tr>
				<th scope="col">Latest</th>
				<th scope="col">{MACRO_YEARS}-year average</th>
				<th scope="col">Latest</th>
				<th scope="col">{MACRO_YEARS}-year average</th>
			</tr>
		</thead>
		<tbody>
			{#each rows as r (r.country)}
				<tr>
					<th scope="row">{r.country}</th>
					<td>{@render latest(r.inflation)}</td>
					<td>{@render average(r.inflation)}</td>
					<td>{@render latest(r.growth)}</td>
					<td>{@render average(r.growth)}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.scroll {
		overflow-x: auto;
	}
	table {
		border-collapse: collapse;
		font-size: var(--text-sm);
		margin: var(--space-3) 0;
	}
	th,
	td {
		padding: var(--space-1) var(--space-3);
		text-align: right;
		white-space: nowrap;
	}
	th[scope='row'],
	thead tr:first-child th:first-child {
		text-align: left;
	}
	thead th {
		border-bottom: 1px solid var(--border-strong);
	}
	.year {
		color: var(--text-secondary);
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
</style>
