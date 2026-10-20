<script lang="ts">
	let {
		values = {},
		errors = {}
	}: { values?: Record<string, string>; errors?: Record<string, string> } = $props();
</script>

<div>
	<label for="name">Name</label>
	<input id="name" name="name" value={values.name ?? ''} required />
	{#if errors.name}<p class="field-error">{errors.name}</p>{/if}
</div>
<div>
	<label for="username">Username</label>
	<input id="username" name="username" autocapitalize="none" autocomplete="off" value={values.username ?? ''} required />
	{#if errors.username}<p class="field-error">{errors.username}</p>{/if}
</div>
<div>
	<label for="password">Password</label>
	<input id="password" name="password" type="password" autocomplete="new-password" minlength="8" required />
	{#if errors.password}<p class="field-error">{errors.password}</p>{/if}
</div>
