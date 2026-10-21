<script lang="ts">
	let { form } = $props();
</script>

<svelte:head><title>Sign in · Auto</title></svelte:head>

<div class="mx-auto mt-12 max-w-sm">
	<div class="mb-6 flex items-center gap-3">
		<img src="/icon.svg" alt="" class="size-10" />
		<h1 class="text-[26px] font-bold tracking-tight">Auto</h1>
	</div>
	<form method="POST" class="card space-y-4">
		<div>
			<label for="username">Username</label>
			<input id="username" name="username" autocomplete="username" autocapitalize="none" value={form?.username ?? ''} required />
		</div>
		<div>
			<label for="password">Password</label>
			<input id="password" name="password" type="password" autocomplete="current-password" required />
		</div>
		{#if form?.error}<p class="field-error">{form.error}</p>{/if}
		<button class="btn-primary w-full">Sign in</button>
	</form>
</div>
