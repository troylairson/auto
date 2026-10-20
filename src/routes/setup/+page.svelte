<script lang="ts">
	import UserFields from '$lib/components/UserFields.svelte';

	let { form } = $props();
</script>

<svelte:head><title>Set up · Auto</title></svelte:head>

<div class="mx-auto mt-10 max-w-sm">
	<h1 class="mb-2 text-2xl font-bold">Welcome to Auto</h1>
	<p class="muted mb-6">Create the first login. You can add the rest of the household from Settings.</p>
	<form method="POST" class="card space-y-4">
		<UserFields values={form?.values} errors={form?.errors} />
		<button class="btn-primary w-full">Create account</button>
	</form>
</div>
