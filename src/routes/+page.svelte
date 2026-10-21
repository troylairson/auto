<script lang="ts">
	import Gauge from '$lib/components/Gauge.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import { STATUS_COLOR, gaugeText, ringFill, statusLine } from '$lib/ui';

	let { data } = $props();
	const dateLabel = $derived(
		new Date(`${data.today}T12:00:00Z`).toLocaleDateString('en-US', {
			weekday: 'long',
			month: 'short',
			day: 'numeric',
			timeZone: 'UTC'
		})
	);
	const short = (name: string) => name.replace(/ \(.*\)$/, '');
</script>

<svelte:head><title>Garage · Auto</title></svelte:head>

<header class="mb-4 flex items-center justify-between">
	<div>
		<div class="text-[13px] font-medium text-muted">{dateLabel}</div>
		<h1 class="text-[28px] font-bold tracking-tight">Garage</h1>
	</div>
	<a href="/vehicles/new" aria-label="Add a vehicle"
		class="flex size-11 items-center justify-center rounded-full border border-line bg-panel text-text">
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
	</a>
</header>

{#if data.vehicles.length === 0}
	<div class="card mt-6 text-center">
		<h2 class="mb-2 text-xl font-bold">No vehicles yet</h2>
		<p class="mb-4 text-muted">Add a vehicle to get its maintenance schedule.</p>
		<a href="/vehicles/new" class="btn-primary">Add a vehicle</a>
	</div>
{:else}
	<div class="flex flex-col gap-3.5">
		{#each data.vehicles as v (v.vehicle.id)}
			{@const t = v.hero ? gaugeText(v.hero.due) : null}
			<a href="/vehicles/{v.vehicle.id}" class="card flex flex-col gap-3.5 hover:border-warn-line">
				<div class="flex items-center gap-4">
					{#if v.hero && t}
						<Gauge fill={ringFill(v.hero.due)} color={STATUS_COLOR[v.hero.due.status]} value={t.value}
							label={t.label === 'mi left' && /oil/i.test(v.hero.item.name) ? 'mi to oil' : t.label}
							ariaLabel="{v.hero.item.name}: {statusLine(v.hero.due)}" />
					{:else}
						<Gauge fill={null} color="var(--dash)" value="—" label="set up" />
					{/if}
					<div class="flex min-w-0 flex-1 flex-col gap-0.5">
						<div class="flex items-center justify-between gap-2">
							<h2 class="truncate text-xl font-bold">{v.vehicle.nickname}</h2>
							{#if v.attention.length}
								<StatusBadge status={v.overdue ? 'overdue' : 'due'} text="{v.attention.length} {v.overdue ? 'overdue' : 'due'}" />
							{:else if v.unknown}
								<StatusBadge status="unknown" text="Set up" />
							{:else}
								<StatusBadge status="ok" text="On track" />
							{/if}
						</div>
						<span class="truncate text-[13px] text-muted">{v.vehicle.year} {v.vehicle.make} {v.vehicle.model}</span>
						<span class="num text-[28px] font-semibold leading-tight">
							{v.estimate.mileage.toLocaleString()} <span class="text-[15px] text-muted">mi</span>
						</span>
					</div>
				</div>
				<div class="flex items-center gap-2 text-[13px] text-muted">
					{#if v.minderCode}
						<span class="num rounded-md bg-warn-soft px-2 py-0.5 text-sm font-bold text-warn-on-soft">{v.minderCode}</span>
					{/if}
					{#if v.attention.length}
						<span class="truncate">{v.attention.map(short).join(' · ')}</span>
					{:else if v.estimate.stale}
						<span class="text-warn-text">Mileage is {v.estimate.daysSinceReading ?? '?'} days old — tap to update</span>
					{:else if v.next}
						<span class="truncate">Next: {short(v.next.item.name)} · {statusLine(v.next.due)}</span>
					{:else if v.unknown}
						<span>Fill in when things were last done</span>
					{/if}
				</div>
			</a>
		{/each}
	</div>

	<section class="mt-5">
		<h2 class="section-title mb-2">Up next</h2>
		{#if data.upNext.length === 0}
			<p class="card text-muted">Nothing due in the next 30 days.</p>
		{:else}
			<ul class="overflow-hidden rounded-[18px] border border-line bg-panel">
				{#each data.upNext as row (row.item.id)}
					<li class="border-b border-line last:border-b-0">
						<a href="/vehicles/{row.vehicle.id}/log?items={row.item.id}" class="flex items-center gap-3 px-4 py-3.5">
							<span class="size-2.5 shrink-0 rounded-full" style:background={STATUS_COLOR[row.due.status]}
								style:box-shadow={row.due.status === 'due' ? 'var(--glow)' : 'none'}></span>
							<span class="flex-1 text-[15px] font-semibold">{short(row.item.name)}</span>
							<span class="text-[13px] text-muted">{row.vehicle.nickname}{row.due.status === 'soon' ? ` · ${statusLine(row.due)}` : ''}</span>
						</a>
					</li>
				{/each}
			</ul>
		{/if}
		<a href="/timeline" class="link mt-1 inline-flex min-h-11 items-center text-sm">See full timeline</a>
		{#if data.unknownCount}
			<p class="mt-1 text-sm text-muted">
				{data.unknownCount} usual item{data.unknownCount === 1 ? ' has' : 's have'} no history yet. Open a vehicle and use
				<span class="font-medium">Catch up</span> to fill them in.
			</p>
		{/if}
	</section>
{/if}
