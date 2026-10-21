<script lang="ts">
	import { formatDate } from '$lib/dates';
	import { miles, money } from '$lib/format';

	let { data } = $props();
	const short = (name: string) => name.replace(/ \(.*\)$/, '');
</script>

<svelte:head><title>History · Auto</title></svelte:head>

<header class="mb-4 flex flex-col gap-3">
	<div class="flex items-end justify-between gap-3">
		<h1 class="text-[28px] font-bold tracking-tight">History</h1>
		<div class="text-right">
			<div class="text-xs text-muted">Spent in {data.year}</div>
			<div class="num text-2xl font-semibold">{money(data.yearTotal) || '$0'}</div>
		</div>
	</div>
	<div class="flex flex-wrap gap-2">
		<a href="/history" data-sveltekit-replacestate
			class="inline-flex min-h-9 items-center rounded-full border px-3.5 text-sm {data.selected === null ? 'border-text bg-text font-semibold text-bg' : 'border-line bg-panel font-medium'}">All</a>
		{#each data.vehicles as v (v.id)}
			<a href="/history?v={v.id}" data-sveltekit-replacestate
				class="inline-flex min-h-9 items-center rounded-full border px-3.5 text-sm {data.selected === v.id ? 'border-text bg-text font-semibold text-bg' : 'border-line bg-panel font-medium'}">{v.nickname}</a>
		{/each}
	</div>
</header>

{#if data.records.length === 0}
	<p class="card text-muted">No service logged yet. Tap + to log the next one.</p>
{:else}
	<ol class="relative">
		<div aria-hidden="true" class="absolute top-3 bottom-3 left-[7px] w-0.5 bg-line"></div>
		{#each data.records as r, i (r.id)}
			<li class="relative pb-5 pl-8">
				<span aria-hidden="true" class="absolute top-2 left-0 size-4 rounded-full border-[3px] bg-bg {i === 0 ? 'border-text' : 'border-dash'}"></span>
				<a href="/vehicles/{r.vehicle.id}/records/{r.id}" class="block">
					<span class="block text-[13px] text-muted">
						{formatDate(r.serviceDate)} · <span class="font-semibold text-text">{r.vehicle.nickname}</span> · {miles(r.mileage)}{r.vendor ? ` · ${r.vendor}` : ''}
					</span>
					<span class="block text-base font-semibold">{r.lines.map((l) => short(l.description)).join(', ')}</span>
					{#if r.totalCostCents !== null || r.minderCode}
						<span class="block text-sm text-muted">
							{money(r.totalCostCents)}{r.totalCostCents !== null && r.minderCode ? ' · ' : ''}{r.minderCode ? `Minder ${r.minderCode}` : ''}
						</span>
					{/if}
				</a>
			</li>
		{/each}
	</ol>
{/if}
