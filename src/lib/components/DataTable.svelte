<script lang="ts">
	import { isNegative, type Column, type Row } from '#lib/table';

	/**
	 * A table whose first column is the row header: `rowHeader` names it, `columns` describe the others and each row has
	 * one cell per column. It scrolls sideways when it is wide; `tall` caps the height, and the header stays in view.
	 * Negative figures are shown in the negative colour. A row can also link its label (`href`), add small text after it
	 * (`sub`), show one `note` across all columns instead of its cells, or be a `summary` row; a column can be a
	 * `forecast`. `caption` names the table for screen readers. Cells are plain text: a table that needs markup in its
	 * cells stays hand-written.
	 */
	let {
		rowHeader,
		columns,
		rows,
		tall = false,
		caption
	}: {
		rowHeader: string;
		columns: readonly Column[];
		rows: readonly Row[];
		tall?: boolean;
		caption?: string;
	} = $props();
</script>

<div class="scroll" class:tall>
	<table>
		{#if caption}<caption class="sr-only">{caption}</caption>{/if}
		<thead>
			<tr>
				<th scope="col">{rowHeader}</th>
				{#each columns as c, i (i)}
					<th scope="col" class:num={c.numeric} class:forecast={c.forecast}
						>{c.label}{#if c.sub}<br /><small>{c.sub}</small>{/if}</th
					>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each rows as row (row.key)}
				<tr class:summary={row.summary}>
					<th scope="row"
						>{#if row.href}<a href={row.href}>{row.label}</a>{:else}{row.label}{/if}{#if row.sub}{' '}<small class="sub"
								>{row.sub}</small
							>{/if}</th
					>
					{#if row.note}
						<td colspan={columns.length} class="note">{row.note}</td>
					{:else}
						{#each row.cells as cell, i (i)}
							<td
								class:num={columns[i]?.numeric}
								class:negative={columns[i]?.numeric && isNegative(cell)}
								class:forecast={columns[i]?.forecast}>{cell}</td
							>
						{/each}
					{/if}
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
	.sub,
	.note {
		color: var(--text-secondary);
	}
	.forecast {
		background: var(--surface-group);
		font-style: italic;
	}
	.summary th,
	.summary td {
		border-top: 1px solid var(--border-strong);
		font-weight: var(--weight-semibold);
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
