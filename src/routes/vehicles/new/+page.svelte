<script lang="ts">
	import VehicleFields from '$lib/components/VehicleFields.svelte';

	let { data, form } = $props();

	let make = $state('');
	let model = $state('');
	let templateId = $state('');
	let touched = $state(false);

	// Pick a matching template from make/model unless the user chose one.
	function suggest(make: string, model: string): string {
		const text = `${make} ${model}`.toLowerCase();
		const byKey = (key: string) => String(data.templates.find((t) => t.key === key)?.id ?? '');
		if (text.includes('pilot')) return byKey('honda-pilot-2021');
		if (text.includes('tacoma')) return byKey('toyota-tacoma-2011-v6');
		return byKey('generic-gas');
	}
	$effect(() => {
		if (!touched) templateId = form?.values?.templateId ?? suggest(make, model);
	});
</script>

<svelte:head><title>Add vehicle · Auto</title></svelte:head>

<h1 class="mb-4 text-2xl font-bold">Add a vehicle</h1>

<form
	method="POST"
	class="card space-y-5"
	oninput={(e) => {
		const t = e.target as HTMLInputElement;
		if (t.name === 'make') make = t.value;
		if (t.name === 'model') model = t.value;
	}}
>
	<VehicleFields values={form?.values} errors={form?.errors} users={data.users} />

	<div class="grid gap-4 sm:grid-cols-2">
		<div>
			<label for="currentMileage">Current odometer</label>
			<input id="currentMileage" name="currentMileage" inputmode="numeric" value={form?.values?.currentMileage ?? ''} required />
			{#if form?.errors?.currentMileage}<p class="field-error">{form.errors.currentMileage}</p>{/if}
		</div>
		<div>
			<label for="templateId">Maintenance schedule</label>
			<select id="templateId" name="templateId" bind:value={templateId} onchange={() => (touched = true)}>
				{#each data.templates as t (t.id)}
					<option value={String(t.id)}>{t.name}</option>
				{/each}
			</select>
		</div>
	</div>
	<p class="muted text-sm">
		The schedule is copied onto this vehicle. You can edit any interval afterwards. Items that don't match the
		drivetrain (e.g. 4x4-only items) are skipped.
	</p>
	<button class="btn-primary w-full sm:w-auto">Add vehicle</button>
</form>
