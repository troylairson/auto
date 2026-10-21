<script lang="ts">
	import { page } from '$app/state';
	import Gauge from '$lib/components/Gauge.svelte';
	import { formatDate } from '$lib/dates';
	import { miles, money } from '$lib/format';
	import { STATUS_COLOR, STATUS_TEXT, gaugeText, ringFill, statusLine } from '$lib/ui';

	let { data } = $props();
	const tab = $derived(page.url.searchParams.get('tab') ?? 'schedule');
	const v = $derived(data.vehicle);
	const heroText = $derived(data.hero ? gaugeText(data.hero.due) : null);
	const tabs = [
		['schedule', 'Schedule'],
		['history', 'History'],
		['info', 'Info']
	] as const;
	const short = (name: string) => name.replace(/ \(.*\)$/, '');
</script>

<svelte:head><title>{v.nickname} · Auto</title></svelte:head>

{#snippet tile({ item, due }: (typeof data.items)[number])}
	{@const actionable = due.status === 'overdue' || due.status === 'due' || due.status === 'soon'}
	<li class="flex flex-col gap-1 rounded-2xl border bg-panel p-3
		{due.status === 'unknown' ? 'border-dashed border-dash' : actionable && due.status !== 'soon' ? (due.status === 'overdue' ? 'border-danger/50' : 'border-warn-line') : 'border-line'}">
		<a href={due.status === 'unknown' ? `/vehicles/${v.id}/catch-up` : `/vehicles/${v.id}/log?items=${item.id}`}
			class="flex items-center gap-2.5">
			<Gauge fill={ringFill(due)} color={STATUS_COLOR[due.status]} size={46} stroke={12} />
			<span class="flex min-w-0 flex-col">
				<span class="text-sm leading-snug font-semibold">{short(item.name)}</span>
				<span class="text-xs font-semibold {STATUS_TEXT[due.status]}">
					{due.status === 'unknown' ? 'Set last done' : statusLine(due)}{item.minderCode && due.source === 'minder_code' ? ` ${item.minderCode}` : ''}
				</span>
			</span>
		</a>
		{#if due.status === 'snoozed'}
			<form method="POST" action="?/unsnooze" class="pl-[56px]">
				<input type="hidden" name="itemId" value={item.id} />
				<button class="text-xs font-semibold text-link">Until {formatDate(item.snoozedUntil)} · undo</button>
			</form>
		{:else if actionable}
			<form method="POST" action="?/snooze" class="pl-[56px]">
				<input type="hidden" name="itemId" value={item.id} />
				<input type="hidden" name="days" value="14" />
				<button class="text-xs font-medium text-muted hover:text-text">Snooze 2 wk</button>
			</form>
		{/if}
	</li>
{/snippet}

<div class="-mt-2 mb-2 flex items-center justify-between">
	<a href="/" class="inline-flex min-h-11 items-center gap-1 text-[15px] font-semibold text-link">
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
		Garage
	</a>
	<a href="/vehicles/{v.id}/mileage" class="inline-flex min-h-11 items-center text-[15px] font-semibold text-link">Update mileage</a>
</div>

<section class="mb-4 flex items-center gap-4">
	{#if data.hero && heroText}
		<Gauge arc size={148} stroke={7} fill={ringFill(data.hero.due)} color={STATUS_COLOR[data.hero.due.status]}
			value={heroText.value} label={heroText.label === 'mi left' && /oil/i.test(data.hero.item.name) ? 'mi to oil' : heroText.label}
			ariaLabel="{data.hero.item.name}: {statusLine(data.hero.due)}" />
	{:else}
		<Gauge arc size={148} stroke={7} fill={null} color="var(--dash)" value="—" label="set up" />
	{/if}
	<div class="flex min-w-0 flex-col gap-1">
		<h1 class="text-[28px] leading-tight font-bold tracking-tight">{v.nickname}</h1>
		<span class="text-[13px] text-muted">
			{v.year} {v.make} {v.model}{v.drivetrain ? ` · ${v.drivetrain.toUpperCase()}` : ''}
		</span>
		<span class="num text-[26px] leading-tight font-semibold">
			{data.estimate.mileage.toLocaleString()} <span class="text-sm text-muted">mi</span>
		</span>
		{#if data.minderCode}
			<span class="num self-start rounded-md bg-warn-soft px-2 py-0.5 text-[15px] font-bold text-warn-on-soft">Dash: {data.minderCode}</span>
		{/if}
	</div>
</section>

{#if data.estimate.stale}
	<a href="/vehicles/{v.id}/mileage" class="mb-4 block rounded-xl border border-warn-line bg-panel px-4 py-3 text-sm text-warn-text">
		The last odometer reading is {data.estimate.daysSinceReading ?? '?'} days old. Update it to keep due dates accurate →
	</a>
{/if}

<nav aria-label="Vehicle sections" class="mb-4 grid grid-cols-3 rounded-xl bg-seg p-1">
	{#each tabs as [key, label] (key)}
		<a href="?tab={key}" data-sveltekit-replacestate aria-current={tab === key ? 'page' : undefined}
			class="flex min-h-9 items-center justify-center rounded-[9px] text-sm font-semibold {tab === key ? 'bg-panel text-text shadow-sm' : 'text-muted'}">{label}</a>
	{/each}
</nav>

{#if tab === 'schedule'}
	<ul class="grid grid-cols-2 gap-2.5">
		{#each data.items as row (row.item.id)}{@render tile(row)}{/each}
	</ul>
	{#if data.moreItems.length}
		<details class="card mt-3 p-0">
			<summary class="flex min-h-12 items-center justify-between px-4 text-[15px] font-semibold">
				<span>More items <span class="font-medium text-muted">· {data.moreItems.length}, none due</span></span>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
			</summary>
			<p class="px-4 pb-2 text-sm text-muted">These move up into the grid once they're coming due.</p>
			<ul class="grid grid-cols-2 gap-2.5 px-3 pb-3">
				{#each data.moreItems as row (row.item.id)}{@render tile(row)}{/each}
			</ul>
		</details>
	{/if}
	<div class="mt-3 flex flex-wrap gap-x-5 text-sm">
		<a href="/vehicles/{v.id}/schedule" class="link inline-flex min-h-11 items-center">Edit schedule</a>
		<a href="/vehicles/{v.id}/catch-up" class="link inline-flex min-h-11 items-center">Catch up</a>
		{#if data.disabledItems.length}<span class="inline-flex min-h-11 items-center text-muted">{data.disabledItems.length} disabled</span>{/if}
	</div>
{:else if tab === 'history'}
	{#if data.records.length === 0}
		<p class="card text-muted">No service logged yet. Use the + button after the next oil change.</p>
	{:else}
		<ol class="relative">
			<div aria-hidden="true" class="absolute top-3 bottom-3 left-[7px] w-0.5 bg-line"></div>
			{#each data.records as r, i (r.id)}
				<li class="relative pb-5 pl-8">
					<span aria-hidden="true" class="absolute top-2 left-0 size-4 rounded-full border-[3px] bg-bg {i === 0 ? 'border-text' : 'border-dash'}"></span>
					<a href="/vehicles/{v.id}/records/{r.id}" class="block">
						<span class="block text-[13px] text-muted">
							{formatDate(r.serviceDate)} · {miles(r.mileage)}{r.vendor ? ` · ${r.vendor}` : ''}
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
{:else}
	<div class="card space-y-4 text-sm">
		<dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
			<dt class="text-muted">VIN</dt><dd class="font-mono">{v.vin ?? '—'}</dd>
			<dt class="text-muted">Plate</dt><dd>{v.licensePlate ?? '—'}</dd>
			<dt class="text-muted">Drivetrain</dt><dd>{v.drivetrain?.toUpperCase() ?? '—'}</dd>
			<dt class="text-muted">Transmission</dt><dd>{v.transmission ?? '—'}</dd>
			<dt class="text-muted">Usage</dt><dd>{v.usageProfile === 'severe' ? 'Severe' : 'Normal'}</dd>
			<dt class="text-muted">In service</dt><dd>{formatDate(v.inServiceDate)}</dd>
			<dt class="text-muted">Reminders go to</dt><dd>{data.driver ?? 'Everyone'}</dd>
			<dt class="text-muted">Maintenance Minder</dt><dd>{v.maintenanceMinder ? 'Yes' : 'No'}</dd>
			<dt class="text-muted">Mileage estimate</dt>
			<dd>
				{Math.round(data.estimate.milesPerDay * 365).toLocaleString()} mi/yr{data.estimate.fromHistory ? '' : ' (assumed)'}
				{#if data.estimate.lastReadingDate}· last reading {formatDate(data.estimate.lastReadingDate)}{/if}
			</dd>
			<dt class="text-muted">Total spent</dt><dd class="font-semibold">{money(data.totalSpend) || '$0.00'}</dd>
			{#each data.spendByYear as [year, cents] (year)}
				<dt class="pl-3 text-muted">{year}</dt><dd>{money(cents)}</dd>
			{/each}
		</dl>
		{#if v.notes}<p class="whitespace-pre-line">{v.notes}</p>{/if}
		<div>
			<h3 class="mb-1 font-semibold">Recent odometer readings</h3>
			<ul class="text-muted">
				{#each data.readings as r (r.id)}
					<li>
						{formatDate(r.readingDate)} · {miles(r.mileage)}
						{#if r.oilLifePct !== null}· oil {r.oilLifePct}%{/if}
						{#if r.minderCode}· code {r.minderCode}{/if}
					</li>
				{/each}
			</ul>
		</div>
		<a href="/vehicles/{v.id}/edit" class="btn-secondary">Edit vehicle</a>
	</div>
{/if}
