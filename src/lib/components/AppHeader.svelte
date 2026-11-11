<script lang="ts">
	import { mainLinks } from '#lib/nav';
	import { loginHref, logoutAction } from '#lib/return-path';

	/** The bar at the top: the app name, the five pages (the current one by `aria-current`) and Log in or Log out. Works without JavaScript. */
	let {
		name,
		pathname,
		search,
		interactive
	}: { name: string; pathname: string; search: string; interactive: boolean } = $props();

	// The page to come back to after logging in or out, with its query so a selection or ticker survives.
	const here = $derived(pathname + search);
</script>

<nav aria-label="Main">
	<a class="brand" href="/">{name}</a>
	{#each mainLinks(pathname) as link (link.href)}
		<a href={link.href} aria-current={link.current ? 'page' : undefined}>{link.label}</a>
	{/each}
	<span class="spacer"></span>
	{#if interactive}
		<form method="POST" action={logoutAction(here)}>
			<button type="submit" class="link">Log out</button>
		</form>
	{:else}
		<!-- a full load: /login may only restore a cookie and redirect back, which client-side routing would not re-render -->
		<a href={pathname === '/login' ? here : loginHref(here)} data-sveltekit-reload>Log in</a>
	{/if}
</nav>

<style>
	nav {
		display: flex;
		align-items: stretch;
		/* wraps on a phone, where the brand and links do not fit one row; each row stays a 44px touch target */
		flex-wrap: wrap;
		gap: 0 var(--space-1);
		min-height: var(--shell-header-height);
		padding: 0 var(--space-4);
		background: var(--surface-shell);
		border-bottom: 1px solid var(--sapShell_BorderColor);
		box-shadow: var(--sapShell_Shadow);
	}
	nav a {
		display: flex;
		align-items: center;
		min-height: var(--shell-header-height);
		padding: 0 var(--space-3);
		color: var(--sapShell_InteractiveTextColor);
		text-decoration: none;
		border-bottom: 3px solid transparent;
	}
	.brand {
		margin-right: var(--space-4);
		padding-left: 0;
		font-weight: var(--weight-bold);
		color: var(--grey-08);
		letter-spacing: var(--tracking-tight);
	}
	nav a:hover {
		color: var(--color-primary);
		background: var(--surface-group);
	}
	nav a[aria-current='page'] {
		font-weight: var(--weight-semibold);
		color: var(--color-primary);
		border-bottom-color: var(--color-primary);
	}
	.spacer {
		margin-left: auto;
	}
	nav form {
		display: flex;
		align-items: center;
	}
	button.link {
		min-height: var(--shell-header-height);
		padding: 0 var(--space-3);
		font: inherit;
		color: var(--sapShell_InteractiveTextColor);
		background: none;
		border: 0;
		cursor: pointer;
	}
	button.link:hover {
		color: var(--color-primary);
	}
</style>
