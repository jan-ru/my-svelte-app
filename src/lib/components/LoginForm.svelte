<script lang="ts">
	import Callout from '#lib/components/Callout.svelte';
	let { configured, from, error }: { configured: boolean; from: string | null; error: 'denied' | 'failed' | null } =
		$props();

	const start = $derived(from ? `/login/google?from=${encodeURIComponent(from)}` : '/login/google');
</script>

<p class="note">
	The data on every page is open to all. Logging in adds the selection and chart controls, and the Financials and
	Valuation pages.
</p>
{#if !configured}
	<Callout variant="negative">Logging in is only available on the production site.</Callout>
{:else}
	<p class="login"><a href={start} data-sveltekit-reload>Sign in with Google</a></p>
{/if}
{#if error === 'denied'}
	<Callout variant="negative">This Google account has no access.</Callout>
{:else if error === 'failed'}
	<Callout variant="negative">Signing in did not work. Try again.</Callout>
{/if}
{#if from}<p class="note"><a href={from}>Back without logging in</a></p>{/if}

<style>
	.note {
		color: var(--text-secondary);
	}
	.login {
		margin: var(--space-4) 0;
		padding: var(--space-3) var(--space-4);
		background: var(--surface-card);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
	}
</style>
