<script lang="ts">
	import { STATUS_COLOR, statusLine } from '$lib/ui';

	let { data } = $props();
	const short = (name: string) => name.replace(/ \(.*\)$/, '');
	const month = (d: string | null) =>
		d ? new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }) : '';
	const day = (d: string | null) => (d ? String(Number(d.slice(8, 10))) : '');
	const year = (d: string | null) => (d ? d.slice(0, 4) : '');
	const thisYear = new Date().getFullYear().toString();
	const empty = $derived(!data.now.length && !data.soon.length && !data.later.length);
</script>

<svelte:head><title>Timeline · Auto</title></svelte:head>

{#snippet dateBlock(d: string | null)}
	<span class="flex w-10 shrink-0 flex-col items-center leading-none">
		<span class="text-[11px] font-semibold text-muted">{month(d)}</span>
		<span class="num text-2xl font-bold">{day(d)}</span>
		{#if year(d) !== thisYear}<span class="text-[10px] text-muted">{year(d)}</span>{/if}
	</span>
{/snippet}

<header class="mb-4 flex flex-col gap-3">
	<h1 class="text-[28px] font-bold tracking-tight">Timeline</h1>
	<div class="flex flex-wrap gap-2">
		<a href="/timeline" data-sveltekit-replacestate
			class="inline-flex min-h-9 items-center rounded-full border px-3.5 text-sm {data.selected === null ? 'border-text bg-text font-semibold text-bg' : 'border-line bg-panel font-medium'}">All</a>
		{#each data.vehicles as v (v.id)}
			<a href="/timeline?v={v.id}" data-sveltekit-replacestate
				class="inline-flex min-h-9 items-center rounded-full border px-3.5 text-sm {data.selected === v.id ? 'border-text bg-text font-semibold text-bg' : 'border-line bg-panel font-medium'}">{v.nickname}</a>
		{/each}
	</div>
</header>

{#if empty}
	<p class="card text-muted">Nothing scheduled in the next year{data.unknown ? ' that we know of' : ''}.</p>
{/if}

{#if data.now.length}
	<section class="mb-4">
		<h2 class="mb-2 text-sm font-bold text-warn-text">Now</h2>
		<ul class="overflow-hidden rounded-[18px] border border-warn-line bg-panel">
			{#each data.now as r (r.item.id)}
				<li class="flex items-center gap-3 border-b border-line px-3.5 py-2 last:border-b-0">
					{#if r.due.source === 'minder_code' && r.item.minderCode}
						<span class="num w-10 shrink-0 rounded-md bg-warn-soft py-0.5 text-center text-sm font-bold text-warn-on-soft">{r.item.minderCode}</span>
					{:else}
						<span class="flex w-10 shrink-0 justify-center"><span class="size-2.5 rounded-full" style:background={STATUS_COLOR[r.due.status]} style:box-shadow="var(--glow)"></span></span>
					{/if}
					<span class="flex min-w-0 flex-1 flex-col">
						<span class="text-[15px] font-semibold">{short(r.item.name)}</span>
						<span class="text-[13px] text-muted">{r.vehicle.nickname} · {statusLine(r.due)}</span>
					</span>
					<a href="/vehicles/{r.vehicle.id}/log?items={r.item.id}" class="link inline-flex min-h-11 items-center text-sm">Log</a>
				</li>
			{/each}
		</ul>
	</section>
{/if}

{#if data.soon.length}
	<section class="mb-4">
		<h2 class="mb-2 text-sm font-bold text-muted">Next 30 days</h2>
		<ul class="overflow-hidden rounded-[18px] border border-line bg-panel">
			{#each data.soon as r (r.item.id)}
				<li>
					<a href="/vehicles/{r.vehicle.id}/log?items={r.item.id}" class="flex items-center gap-3.5 border-b border-line px-3.5 py-3">
						{@render dateBlock(r.due.status === 'snoozed' ? r.item.snoozedUntil : r.due.effectiveDueDate)}
						<span class="flex min-w-0 flex-1 flex-col">
							<span class="text-[15px] font-semibold">{short(r.item.name)}</span>
							<span class="text-[13px] text-muted">{r.vehicle.nickname} · {statusLine(r.due)}</span>
						</span>
						<span class="size-2.5 shrink-0 rounded-full" style:background={STATUS_COLOR[r.due.status]}></span>
					</a>
				</li>
			{/each}
		</ul>
	</section>
{/if}

{#if data.later.length}
	<section class="mb-4">
		<h2 class="mb-2 text-sm font-bold text-muted">Later</h2>
		<ul class="overflow-hidden rounded-[18px] border border-line bg-panel">
			{#each data.later as r (r.item.id)}
				<li class="flex items-center gap-3.5 border-b border-line px-3.5 py-3 last:border-b-0">
					{@render dateBlock(r.due.effectiveDueDate)}
					<span class="flex min-w-0 flex-1 flex-col">
						<span class="text-[15px] font-medium">{short(r.item.name)}</span>
						<span class="text-[13px] text-muted">
							{r.vehicle.nickname}{r.due.milesLeft !== null ? ` · or ${r.due.dueMileage?.toLocaleString()} mi` : ''}{r.due.source === 'estimate' ? ' · estimate' : ''}
						</span>
					</span>
				</li>
			{/each}
		</ul>
	</section>
{/if}

{#if data.unknown}
	<p class="text-sm text-muted">
		{data.unknown} usual item{data.unknown === 1 ? '' : 's'} can't be placed yet because there's no history. Use
		<span class="font-medium">Catch up</span> on the vehicle page.
	</p>
{/if}
