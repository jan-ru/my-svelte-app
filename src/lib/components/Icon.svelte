<script lang="ts">
	import { ICONS, type IconName } from '#lib/icons';

	/** `label` names an icon that carries meaning on its own; without one the icon is decoration and hidden from screen readers. */
	let { name, label }: { name: IconName; label?: string } = $props();
</script>

<svg
	class="icon"
	viewBox="0 0 16 16"
	width="1em"
	height="1em"
	fill="none"
	stroke="currentColor"
	stroke-width="1.5"
	stroke-linecap="round"
	stroke-linejoin="round"
	role={label === undefined ? undefined : 'img'}
	aria-label={label}
	aria-hidden={label === undefined ? 'true' : undefined}
>
	<path d={ICONS[name]} />
</svg>

<style>
	.icon {
		flex: none;
		margin-inline-start: 0.25em;
		vertical-align: -0.125em;
	}
</style>
