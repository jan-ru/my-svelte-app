<script lang="ts">
	import { isNegative, type Column, type Row } from '#lib/table';

	/**
	 * A table whose first column is the row header: `rowHeader` names it, `columns` describe the others and each row has
	 * one cell per column. It scrolls sideways when it is wide; `tall` caps the height, and the header stays in view.
	 * Negative figures are shown in the negative colour.
	 */
	let {
		rowHeader,
		columns,
		rows,
		tall = false
	}: { rowHeader: string; columns: readonly Column[]; rows: readonly Row[]; tall?: boolean } = $props();
</script>

<div class="scroll" class:tall>
	<table>
		<thead>
			<tr>
				<th scope="col">{rowHeader}</th>
				{#each columns as c, i (i)}
					<th scope="col" class:num={c.numeric}
						>{c.label}{#if c.sub}<br /><small>{c.sub}</small>{/if}</th
					>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each rows as row (row.key)}
				<tr>
					<th scope="row">{row.label}</th>
					{#each row.cells as cell, i (i)}
						<td class:num={columns[i]?.numeric} class:negative={columns[i]?.numeric && isNegative(cell)}>{cell}</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.scroll {
		overflow-x: auto;
		background: var(--surface-card);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
	}
	.tall {
		max-height: 24rem;
		overflow-y: auto;
	}
	table {
		width: 100%;
		font-size: var(--text-sm);
	}
	thead th {
		position: sticky;
		top: 0;
		background: var(--surface-card);
	}
	small {
		font-weight: var(--weight-regular);
	}
	.num {
		text-align: right;
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}
	.negative {
		color: var(--negative);
	}
</style>
