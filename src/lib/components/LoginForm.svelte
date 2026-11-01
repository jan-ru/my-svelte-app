<script lang="ts">
	let { configured, from, message }: { configured: boolean; from: string | null; message?: string | undefined } =
		$props();

	const action = $derived(from ? `?/login&from=${encodeURIComponent(from)}` : '?/login');
</script>

<p class="note">
	The data on every page is open to all. Logging in adds the selection and chart controls, and the Financials and
	Valuation pages.
</p>
{#if !configured}
	<p class="error" role="alert">Logging in is not configured on this deployment.</p>
{:else}
	<form class="login" method="POST" {action}>
		<label for="password">Password</label>
		<input id="password" name="password" type="password" autocomplete="current-password" required />
		<button type="submit">Log in</button>
	</form>
{/if}
{#if message}<p class="error" role="alert">{message}</p>{/if}
{#if from}<p class="note"><a href={from}>Back without logging in</a></p>{/if}

<style>
	.note {
		color: var(--text-secondary);
	}
	.login {
		display: flex;
		gap: var(--space-2);
		align-items: center;
		flex-wrap: wrap;
		margin: var(--space-4) 0;
		padding: var(--space-3) var(--space-4);
		background: var(--surface-card);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
	}
	.error {
		padding: var(--space-2) var(--space-3);
		color: var(--negative);
		background: var(--negative-bg);
		border-left: 4px solid var(--negative);
		border-radius: var(--radius-sm);
	}
</style>
