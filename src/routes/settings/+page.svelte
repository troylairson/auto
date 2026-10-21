<script lang="ts">
	import { page } from '$app/state';
	import UserFields from '$lib/components/UserFields.svelte';
	import { enhance } from '$app/forms';

	let { data, form } = $props();
	const msg = (section: string) => (form?.section === section && 'message' in form ? form.message : null);
	const errs = (section: string): Record<string, string> =>
		form?.section === section && 'errors' in form ? (form.errors as Record<string, string>) : {};
	const subscribeUrl = $derived(data.me.ntfyTopic ? `${data.ntfyServer.replace(/\/$/, '')}/${data.me.ntfyTopic}` : null);
</script>

<svelte:head><title>Settings · Auto</title></svelte:head>

<h1 class="mb-4 text-[26px] font-bold tracking-tight">Settings</h1>

{#if page.url.searchParams.has('welcome')}
	<div class="mb-4 rounded-lg bg-warn-soft p-4 text-sm text-warn-on-soft">
		You're set up. Next: add other household logins below, subscribe to your notification topic in the ntfy app,
		then <a href="/vehicles/new" class="font-semibold underline">add your first vehicle</a>.
	</div>
{/if}

<section class="card mb-4 space-y-3">
	<h2 class="text-lg font-semibold">Appearance</h2>
	<form method="POST" action="?/theme" class="grid grid-cols-3 rounded-xl bg-seg p-1" use:enhance={({ formData }) => {
		const t = String(formData.get('theme'));
		return async ({ update }) => {
			document.documentElement.dataset.theme = t === 'light' || t === 'dark' ? t : 'auto';
			await update({ reset: false });
		};
	}}>
		{#each [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']] as [value, label] (value)}
			<button name="theme" {value} aria-pressed={data.theme === value}
				class="min-h-10 rounded-[9px] text-sm font-semibold {data.theme === value ? 'bg-panel text-text shadow-sm' : 'text-muted'}">{label}</button>
		{/each}
	</form>
	<p class="text-sm text-muted">Auto follows your phone's light/dark setting.</p>
</section>

<section class="card mb-4 space-y-4">
	<h2 class="text-lg font-semibold">You ({data.me.username})</h2>
	<form method="POST" action="?/profile" class="space-y-4">
		<div>
			<label for="name">Name</label>
			<input id="name" name="name" value={data.me.name} required />
		</div>
		<div>
			<label for="ntfyTopic">ntfy topic</label>
			<input id="ntfyTopic" name="ntfyTopic" value={data.me.ntfyTopic ?? ''} class="font-mono text-sm" />
			{#if errs('profile').ntfyTopic}<p class="field-error">{errs('profile').ntfyTopic}</p>{/if}
			<p class="text-muted mt-1 text-sm">
				Install the <strong>ntfy</strong> app, tap +, and subscribe to this topic{#if subscribeUrl}{' '}(or open <a class="link break-all" href={subscribeUrl}>{subscribeUrl}</a>){/if}. Keep it private: anyone with
				the name can read it.
			</p>
		</div>
		<label class="flex items-center gap-2 font-normal">
			<input type="checkbox" name="notifyPush" checked={data.me.notifyPush} /> Send me push reminders
		</label>
		<div class="flex flex-wrap gap-2">
			<button class="btn-primary">Save</button>
			<button class="btn-secondary" formaction="?/testPush">Send test notification</button>
		</div>
		{#if msg('profile')}<p class="text-sm text-ok-text">{msg('profile')}</p>{/if}
	</form>
</section>

<section class="card mb-4 space-y-3">
	<h2 class="text-lg font-semibold">Reminders</h2>
	<p class="text-muted text-sm">
		Checked every day at 7:00. You get a push when an item becomes due soon (30 days / 1,000 mi), due (7 days / 250
		mi), or overdue (repeats weekly), plus a nudge when mileage hasn't been updated in 30 days. Sundays add a summary.
	</p>
	{#if !data.originConfigured}
		<p class="text-sm text-warn-text">ORIGIN isn't set, so notifications won't include a link back to the app.</p>
	{/if}
	<form method="POST" action="?/runReminders">
		<button class="btn-secondary">Run reminder check now</button>
	</form>
	{#if msg('reminders')}<p class="text-sm">{msg('reminders')}</p>{/if}
</section>

<section class="card mb-4 space-y-3">
	<h2 class="text-lg font-semibold">Calendar feed</h2>
	<p class="text-muted text-sm">Subscribe in Google or Apple Calendar to see due dates as all-day events.</p>
	<input readonly value={data.calendarUrl} class="font-mono text-xs" onfocus={(e) => (e.target as HTMLInputElement).select()} />
	<form method="POST" action="?/newCalendarToken">
		<button class="link text-sm">Make a new link (stops the old one)</button>
	</form>
	{#if msg('calendar')}<p class="text-sm">{msg('calendar')}</p>{/if}
</section>

<section class="card mb-4 space-y-3">
	<h2 class="text-lg font-semibold">Household</h2>
	<ul class="text-sm">
		{#each data.household as u (u.id)}<li>{u.name} <span class="text-muted">({u.username})</span></li>{/each}
	</ul>
	<details open={form?.section === 'household' && 'errors' in form}>
		<summary class="link cursor-pointer text-sm">+ Add a person</summary>
		<form method="POST" action="?/addUser" class="mt-3 space-y-3">
			<UserFields values={form?.section === 'household' && 'values' in form ? form.values : {}} errors={errs('household')} />
			<button class="btn-primary">Add</button>
		</form>
	</details>
	{#if msg('household')}<p class="text-sm text-ok-text">{msg('household')}</p>{/if}
</section>

<section class="card mb-4 space-y-3">
	<h2 class="text-lg font-semibold">Backups</h2>
	<p class="text-muted text-sm">
		A copy of the database is saved every night at 3:30 to <code>backups/</code> in the data folder (last 30 kept).
	</p>
	<form method="POST" action="?/backup"><button class="btn-secondary">Back up now</button></form>
	{#if msg('backup')}<p class="text-sm">{msg('backup')}</p>{/if}
</section>

<section class="card space-y-3">
	<h2 class="text-lg font-semibold">Change password</h2>
	<form method="POST" action="?/password" class="space-y-3">
		<div>
			<label for="current">Current password</label>
			<input id="current" name="current" type="password" autocomplete="current-password" required />
			{#if errs('password').current}<p class="field-error">{errs('password').current}</p>{/if}
		</div>
		<div>
			<label for="next">New password</label>
			<input id="next" name="next" type="password" autocomplete="new-password" minlength="8" required />
			{#if errs('password').next}<p class="field-error">{errs('password').next}</p>{/if}
		</div>
		<button class="btn-primary">Change password</button>
		{#if msg('password')}<p class="text-sm text-ok-text">{msg('password')}</p>{/if}
	</form>
</section>
