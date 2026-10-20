<script lang="ts">
	import VehicleFields from '$lib/components/VehicleFields.svelte';

	let { data, form } = $props();
	const values = $derived(form?.values ?? (data.vehicle as unknown as Record<string, string | number | null>));
</script>

<svelte:head><title>Edit {data.vehicle.nickname} · Auto</title></svelte:head>

<a href="/vehicles/{data.vehicle.id}?tab=info" class="link text-sm">← {data.vehicle.nickname}</a>
<h1 class="mt-1 mb-4 text-2xl font-bold">Edit vehicle</h1>

<form method="POST" action="?/save" class="card space-y-5">
	<VehicleFields {values} errors={form?.errors} users={data.users} />
	<p class="muted text-sm">
		Changing usage or drivetrain doesn't rewrite the schedule. Use <a class="link" href="/vehicles/{data.vehicle.id}/schedule">Edit schedule</a>
		to reset items to template intervals or add items.
	</p>
	<button class="btn-primary">Save</button>
</form>

<div class="card mt-6 space-y-4">
	<form method="POST" action="?/archive" class="flex items-center justify-between gap-3">
		<div>
			<div class="font-semibold">{data.vehicle.archivedAt ? 'Restore vehicle' : 'Archive vehicle'}</div>
			<p class="muted text-sm">Sold or retired: hides it and stops reminders, keeps its history.</p>
		</div>
		<button class="btn-secondary">{data.vehicle.archivedAt ? 'Restore' : 'Archive'}</button>
	</form>
	<form method="POST" action="?/delete" class="space-y-2 border-t border-slate-200 pt-4 dark:border-slate-800">
		<div class="font-semibold text-red-700 dark:text-red-400">Delete permanently</div>
		<p class="muted text-sm">Removes the vehicle and all its service history. Type its nickname to confirm.</p>
		<div class="flex gap-2">
			<input name="confirm" placeholder={data.vehicle.nickname} />
			<button class="btn-danger">Delete</button>
		</div>
		{#if form?.deleteError}<p class="field-error">{form.deleteError}</p>{/if}
	</form>
</div>
