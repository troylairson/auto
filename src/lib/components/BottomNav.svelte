<script lang="ts">
	import { page } from '$app/state';

	const path = $derived(page.url.pathname);
	// The + button logs for the vehicle you're looking at, otherwise asks which.
	const logHref = $derived.by(() => {
		const m = /^\/vehicles\/(\d+)/.exec(path);
		return m ? `/vehicles/${m[1]}/log` : '/log';
	});
	const active = (href: string) =>
		href === '/' ? path === '/' || /^\/vehicles\/\d+(\/)?$/.test(path) : path.startsWith(href);
</script>

<nav
	aria-label="Main"
	class="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-nav/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
>
	<div class="mx-auto grid h-[72px] max-w-xl grid-cols-5 items-start pt-2.5">
		{#snippet tab(href: string, label: string, icon: string)}
			<a {href} class="flex flex-col items-center gap-1 text-[11px] font-semibold {active(href) ? 'text-link' : 'text-muted'}"
				aria-current={active(href) ? 'page' : undefined}>
				<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{@html icon}</svg>
				{label}
			</a>
		{/snippet}
		{@render tab('/', 'Garage', '<path d="M5 17a7 7 0 1 1 14 0"/><path d="M12 17l4-5"/>')}
		{@render tab('/timeline', 'Timeline', '<path d="M8 6h12M8 12h12M8 18h8"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>')}
		<a href={logHref} aria-label="Log service"
			class="-mt-6 flex size-[60px] items-center justify-center justify-self-center rounded-full bg-warn text-on-warn shadow-[var(--fab-shadow)]">
			<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
		</a>
		{@render tab('/history', 'History', '<path d="M12 8v4l3 2"/><circle cx="12" cy="12" r="9"/>')}
		{@render tab('/settings', 'Settings', '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>')}
	</div>
</nav>
