<script lang="ts">
	import { profileFields } from '#lib/company';
	import type { Profile } from '#lib/source-data';

	let { profile, message }: { profile: Profile | null; message: string | null } = $props();
</script>

{#if profile}
	<dl class="facts">
		{#each profileFields(profile) as f (f.label)}
			<dt>{f.label}</dt>
			<dd>
				{#if f.href}<a href={f.href} target="_blank" rel="noopener noreferrer">{f.value}</a>{:else}{f.value}{/if}
			</dd>
		{/each}
	</dl>
	{#if profile.description}
		<h2>About</h2>
		<p class="desc">{profile.description}</p>
	{/if}
{:else}
	<p>{message}</p>
{/if}

<style>
	h2 { font-size: var(--text-lg); margin: var(--space-4) 0 var(--space-2); }
	.facts { display: grid; grid-template-columns: max-content 1fr; gap: var(--space-1) var(--space-4); margin: var(--space-4) 0; }
	.facts dt { font-weight: var(--weight-semibold); color: var(--text-secondary); }
	.facts dd { margin: 0; }
	.desc { max-width: 60rem; line-height: var(--leading-normal); }
</style>
