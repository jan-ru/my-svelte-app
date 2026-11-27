<script lang="ts">
	import Callout from '#lib/components/Callout.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	// After "Create value" the grid shows what was submitted, not the rules in force.
	const rows = $derived(form?.rows ?? data.rows);
	let copied = $state(false);

	async function copy(value: string) {
		try {
			await navigator.clipboard.writeText(value);
			copied = true;
		} catch {
			copied = false;
		}
	}
</script>

<svelte:head>
	<title>Settings – Fetch valuation multiples</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main>
	<h1>Settings</h1>
	<p class="intro">
		Choose which pages each person may use. Administrators always have every page. Saving here changes nothing yet:
		<strong>Create value</strong> gives the new <code>PAGE_ACCESS</code> value to set on the host.
	</p>

	<h2>Page access</h2>
	<form method="POST">
		<div class="table-wrap">
			<table>
				<thead>
					<tr>
						<th scope="col">User</th>
						<th scope="col">All pages</th>
						{#each data.pages as p (p.path)}
							<th scope="col">{p.label}</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each rows as row (row.email)}
						<tr>
							<th scope="row">
								<span class="email">{row.email}</span>
								{#if row.admin}<span class="badge">Administrator</span>{/if}
								{#if !row.canSignIn}<span class="warning">Not on ALLOWED_EMAILS, so cannot sign in</span>{/if}
							</th>
							<td>
								<input
									type="checkbox"
									name={row.admin ? undefined : `access:${row.email}`}
									value="*"
									checked={row.all}
									disabled={row.admin}
									aria-label="{row.email}: all pages"
								/>
							</td>
							{#each data.pages as p (p.path)}
								<td>
									<input
										type="checkbox"
										name={row.admin ? undefined : `access:${row.email}`}
										value={p.path}
										checked={row.all || row.pages.includes(p.path)}
										disabled={row.admin}
										aria-label="{row.email}: {p.label}"
									/>
								</td>
							{/each}
						</tr>
					{:else}
						<tr><td colspan={data.pages.length + 2}>No one is on ALLOWED_EMAILS.</td></tr>
					{/each}
				</tbody>
			</table>
		</div>
		<button type="submit">Create value</button>
	</form>

	{#if form?.value !== undefined}
		<Callout role="status">
			<p class="result-title">New <code>PAGE_ACCESS</code> value</p>
			<textarea readonly rows="3" aria-label="New PAGE_ACCESS value">{form.value}</textarea>
			<p>
				<button type="button" onclick={() => copy(form.value)}>Copy</button>
				{#if copied}<span role="status">Copied.</span>{/if}
			</p>
			<p>
				Set it on the host, then redeploy: on Vercel in the project's Environment Variables, on Cloudflare with
				<code>wrangler secret put PAGE_ACCESS</code>, and on the VPS in the Docker environment file. An empty value
				gives no one but the administrators any page.
			</p>
		</Callout>
	{/if}
</main>

<style>
	main {
		max-width: 84rem;
		margin: 0 auto;
		padding: var(--space-4) var(--space-4) var(--space-8);
		line-height: var(--leading-normal);
	}
	h1 {
		margin: 0;
		font-size: var(--text-2xl);
	}
	.intro {
		max-width: 48rem;
	}
	h2 {
		margin: var(--space-8) 0 var(--space-3);
		font-size: var(--text-xl);
	}
	.table-wrap {
		overflow-x: auto;
		background: var(--surface-card);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
	}
	table {
		width: 100%;
		border-collapse: collapse;
	}
	th,
	td {
		padding: var(--space-2) var(--space-3);
		border-bottom: 1px solid var(--border-subtle);
		text-align: center;
		white-space: nowrap;
	}
	thead th {
		font-size: var(--text-sm);
		font-weight: var(--weight-semibold);
		color: var(--text-secondary);
	}
	tbody th {
		text-align: left;
		font-weight: var(--weight-regular);
	}
	tbody tr:last-child > * {
		border-bottom: 0;
	}
	.badge {
		margin-left: var(--space-2);
		padding: 0 var(--space-2);
		font-size: var(--text-sm);
		background: var(--information-bg);
		border: 1px solid var(--information-border);
		border-radius: var(--radius-sm);
	}
	.warning {
		display: block;
		font-size: var(--text-sm);
		color: var(--negative);
	}
	input[type='checkbox'] {
		width: 1rem;
		height: 1rem;
	}
	button {
		margin-top: var(--space-4);
		padding: var(--space-2) var(--space-4);
		font: inherit;
		color: var(--text-on-primary);
		background: var(--color-primary);
		border: 0;
		border-radius: var(--radius-sm);
		cursor: pointer;
	}
	button:hover {
		background: var(--color-primary-hover);
	}
	.result-title {
		margin: 0 0 var(--space-2);
		font-weight: var(--weight-semibold);
	}
	textarea {
		box-sizing: border-box;
		width: 100%;
		font-family: var(--font-mono);
		font-size: var(--text-sm);
	}
</style>
