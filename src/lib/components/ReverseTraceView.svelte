<script lang="ts">
	// The reverse match from one Damodaran industry to SBI 2025 classes, on the /classification page.
	import DataTable from '#lib/components/DataTable.svelte';
	import { formatShare, type ReverseTrace } from '#lib/crosswalk';
	import { plural } from '#lib/plural';

	let { reverse: r, max }: { reverse: ReverseTrace; max: number } = $props();

	const columns = [{ label: 'Title' }, { label: 'Share', numeric: true }];
	const rows = $derived(
		r.sbi25.slice(0, max).map((c) => ({
			key: c.code,
			label: c.code,
			href: `/classification?code=${encodeURIComponent(c.code)}#start`,
			cells: [c.title, formatShare(c.share)]
		}))
	);
</script>

<h3>
	{r.industry} <a class="note" href={`/companies?industry=${encodeURIComponent(r.industry)}`}>list companies</a>
</h3>
<p class="note">
	{r.companies.toLocaleString('en')}
	{plural(r.companies, 'company', 'companies')} in {r.sic.length}
	{plural(r.sic.length, 'SIC code', 'SIC codes')}. Showing the {Math.min(r.sbi25.length, max)}
	best of {r.sbi25.length} SBI 2025 classes. {formatShare(r.followed)} of the companies could be followed through every step;
	the rest have SIC codes missing from one of the correspondence tables.
</p>
<DataTable rowHeader="SBI 2025" {columns} {rows} />
<details>
	<summary>SIC codes of this industry <span class="count">({r.sic.length})</span></summary>
	<ul>
		{#each r.sic as s (s.code)}
			<li>
				<a href={`/companies?sic=${s.code}`}><code>{s.code}</code></a>
				{s.title}
				<span class="count">({s.companies.toLocaleString('en')} {plural(s.companies, 'company', 'companies')})</span>
			</li>
		{/each}
	</ul>
</details>

<style>
	details {
		margin: var(--space-2) 0;
	}
	summary {
		font-weight: var(--weight-semibold);
		color: var(--text-primary);
	}
	.count,
	.note {
		color: var(--text-secondary);
		font-weight: var(--weight-regular);
	}
</style>
