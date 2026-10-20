<script lang="ts">
	import { page } from '$app/state';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import DueSummary from '$lib/components/DueSummary.svelte';
	import { formatDate } from '$lib/dates';
	import { interval, miles, money } from '$lib/format';

	let { data } = $props();
	const tab = $derived(page.url.searchParams.get('tab') ?? 'schedule');
	const v = $derived(data.vehicle);
	const tabs = [
		['schedule', 'Schedule'],
		['history', 'History'],
		['info', 'Info']
	] as const;
</script>

<svelte:head><title>{v.nickname} · Auto</title></svelte:head>

<div class="mb-4 flex flex-wrap items-start justify-between gap-3">
	<div>
		<h1 class="text-2xl font-bold">{v.nickname}</h1>
		<p class="muted">{v.year} {v.make} {v.model}{v.trim ? ` ${v.trim}` : ''}</p>
		<p class="mt-1 text-sm">
			<span class="font-semibold tabular-nums">~{miles(data.estimate.mileage)}</span>
			<span class="muted">
				{#if data.estimate.lastReadingDate}
					· last reading {miles(data.estimate.lastReadingMileage)} on {formatDate(data.estimate.lastReadingDate)}
					· {Math.round(data.estimate.milesPerDay * 365).toLocaleString()} mi/yr{data.estimate.fromHistory ? '' : ' (assumed)'}
				{/if}
			</span>
		</p>
	</div>
	<div class="flex gap-2">
		<a href="/vehicles/{v.id}/log" class="btn-primary">Log service</a>
		<a href="/vehicles/{v.id}/mileage" class="btn-secondary">Mileage</a>
	</div>
</div>

{#if data.estimate.stale}
	<a href="/vehicles/{v.id}/mileage" class="mb-4 block rounded-lg bg-orange-100 px-4 py-2 text-sm text-orange-900 dark:bg-orange-950 dark:text-orange-200">
		The last odometer reading is {data.estimate.daysSinceReading ?? '?'} days old. Update the mileage to keep due dates accurate →
	</a>
{/if}

<nav class="mb-4 flex gap-1 border-b border-slate-200 dark:border-slate-800">
	{#each tabs as [key, label] (key)}
		<a
			href="?tab={key}"
			data-sveltekit-replacestate
			class="-mb-px border-b-2 px-3 py-2 text-sm font-medium {tab === key
				? 'border-sky-600 text-sky-700 dark:text-sky-400'
				: 'muted border-transparent'}">{label}</a
		>
	{/each}
</nav>

{#if tab === 'schedule'}
	<ul class="card divide-y divide-slate-200 p-0 dark:divide-slate-800">
		{#each data.items as { item, due } (item.id)}
			<li class="px-4 py-3">
				<div class="flex items-start gap-3">
					<div class="min-w-0 flex-1">
						<div class="font-medium">
							{item.name}
							{#if item.minderCode}<span class="muted ml-1 text-xs font-normal">Minder {item.minderCode}</span>{/if}
						</div>
						<div><DueSummary {due} /></div>
						<div class="muted text-xs">
							{interval(item.intervalMiles, item.intervalMonths)}
							{#if due.lastDone}· last {formatDate(due.lastDone.date)}{due.lastDone.mileage !== null ? ` at ${miles(due.lastDone.mileage)}` : ''}{/if}
							{#if !item.verified}· <span title="Not yet checked against the owner's manual">unverified</span>{/if}
						</div>
					</div>
					<div class="flex flex-col items-end gap-1">
						<StatusBadge status={due.status} />
						{#if due.status === 'snoozed'}
							<form method="POST" action="?/unsnooze">
								<input type="hidden" name="itemId" value={item.id} />
								<button class="link text-xs">until {formatDate(item.snoozedUntil)} · undo</button>
							</form>
						{:else if due.status === 'unknown'}
							<a href="/vehicles/{v.id}/catch-up" class="link text-xs">Set last done</a>
						{:else if due.status !== 'ok'}
							<div class="flex gap-2 text-xs">
								<a href="/vehicles/{v.id}/log?items={item.id}" class="link">Log</a>
								<form method="POST" action="?/snooze">
									<input type="hidden" name="itemId" value={item.id} />
									<input type="hidden" name="days" value="14" />
									<button class="link">Snooze 2 wk</button>
								</form>
							</div>
						{/if}
					</div>
				</div>
			</li>
		{/each}
	</ul>
	<div class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
		<a href="/vehicles/{v.id}/schedule" class="link">Edit schedule</a>
		<a href="/vehicles/{v.id}/catch-up" class="link">Catch up (set last-done)</a>
		{#if data.disabledItems.length}<span class="muted">{data.disabledItems.length} disabled item(s)</span>{/if}
	</div>
{:else if tab === 'history'}
	{#if data.records.length === 0}
		<p class="card muted">No service logged yet.</p>
	{:else}
		<ul class="space-y-3">
			{#each data.records as r (r.id)}
				<li>
					<a href="/vehicles/{v.id}/records/{r.id}" class="card block hover:border-sky-400">
						<div class="flex justify-between gap-3">
							<div class="font-semibold">{formatDate(r.serviceDate)}</div>
							<div class="font-semibold">{money(r.totalCostCents)}</div>
						</div>
						<div class="muted text-sm">
							{miles(r.mileage)}{r.vendor ? ` · ${r.vendor}` : ''}{r.minderCode ? ` · Minder ${r.minderCode}` : ''}
						</div>
						<ul class="mt-1 text-sm">
							{#each r.lines as line, i (i)}<li>• {line.description}</li>{/each}
						</ul>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
{:else}
	<div class="card space-y-3 text-sm">
		<dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
			<dt class="muted">VIN</dt><dd class="font-mono">{v.vin ?? '—'}</dd>
			<dt class="muted">Plate</dt><dd>{v.licensePlate ?? '—'}</dd>
			<dt class="muted">Drivetrain</dt><dd>{v.drivetrain?.toUpperCase() ?? '—'}</dd>
			<dt class="muted">Transmission</dt><dd>{v.transmission ?? '—'}</dd>
			<dt class="muted">Usage</dt><dd>{v.usageProfile === 'severe' ? 'Severe' : 'Normal'}</dd>
			<dt class="muted">In service</dt><dd>{formatDate(v.inServiceDate)}</dd>
			<dt class="muted">Reminders go to</dt><dd>{data.driver ?? 'Everyone'}</dd>
			<dt class="muted">Maintenance Minder</dt><dd>{v.maintenanceMinder ? 'Yes' : 'No'}</dd>
			<dt class="muted">Total spent</dt><dd>{money(data.totalSpend)}</dd>
			{#each data.spendByYear as [year, cents] (year)}
				<dt class="muted pl-3">{year}</dt><dd>{money(cents)}</dd>
			{/each}
		</dl>
		{#if v.notes}<p class="whitespace-pre-line">{v.notes}</p>{/if}
		<div>
			<h3 class="mb-1 font-semibold">Recent odometer readings</h3>
			<ul class="muted">
				{#each data.readings as r (r.id)}
					<li>
						{formatDate(r.readingDate)} · {miles(r.mileage)}
						{#if r.oilLifePct !== null}· oil {r.oilLifePct}%{/if}
						{#if r.minderCode}· code {r.minderCode}{/if}
						· {r.source}
					</li>
				{/each}
			</ul>
		</div>
		<a href="/vehicles/{v.id}/edit" class="btn-secondary">Edit vehicle</a>
	</div>
{/if}
