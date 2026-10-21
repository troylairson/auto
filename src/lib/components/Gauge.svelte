<script lang="ts">
	// A ring gauge. `fill` is 0–1 (null = unknown, drawn dashed). `arc` draws a
	// 270° speedometer-style arc instead of a full ring.
	let {
		fill,
		color,
		size = 96,
		stroke = 9,
		arc = false,
		value = '',
		label = '',
		ariaLabel
	}: {
		fill: number | null;
		color: string;
		size?: number;
		stroke?: number;
		arc?: boolean;
		value?: string;
		label?: string;
		ariaLabel?: string;
	} = $props();

	const r = $derived(50 - stroke / 2 - 1);
	const c = $derived(2 * Math.PI * r);
	const sweep = $derived(arc ? 0.75 : 1);
	const rotate = $derived(arc ? 135 : -90);
	const big = $derived(value.length > 3 ? 26 : 30);
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 100 100"
	role={ariaLabel ? 'img' : undefined}
	aria-label={ariaLabel}
	aria-hidden={ariaLabel ? undefined : 'true'}
	class="shrink-0"
>
	{#if fill === null}
		<circle cx="50" cy="50" {r} fill="none" stroke="var(--dash)" stroke-width={stroke} stroke-dasharray="3 5" />
	{:else}
		<circle cx="50" cy="50" {r} fill="none" stroke="var(--track)" stroke-width={stroke}
			stroke-dasharray="{c * sweep} {c}" stroke-linecap={arc ? 'round' : 'butt'} transform="rotate({rotate} 50 50)" />
		<circle cx="50" cy="50" {r} fill="none" stroke={color} stroke-width={stroke}
			stroke-dasharray="{Math.max(0.001, c * sweep * fill)} {c}" stroke-linecap="round" transform="rotate({rotate} 50 50)" />
	{/if}
	{#if value}
		<text x="50" y={label ? 54 : 58} text-anchor="middle" font-family="Barlow Condensed, sans-serif" font-weight="700"
			font-size={big} fill={fill === null ? 'var(--muted)' : color}>{value}</text>
	{/if}
	{#if label}
		<text x="50" y="70" text-anchor="middle" font-family="Inter Variable, Inter, sans-serif" font-weight="600"
			font-size="9.5" fill="var(--muted)">{label}</text>
	{/if}
</svg>
