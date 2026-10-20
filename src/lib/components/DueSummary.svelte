<script lang="ts">
	import { formatDate, relativeDays } from '$lib/dates';
	import type { DueResult } from '$lib/due';

	let { due }: { due: DueResult } = $props();
	const est = $derived(due.source === 'estimate');
</script>

<span class="muted text-sm">
	{#if due.status === 'unknown'}
		{due.note}
	{:else}
		{#if due.source === 'minder_code'}
			{due.note}
		{:else if due.source === 'oil_life'}
			{due.note}{#if due.effectiveDueDate}&nbsp;· 5% around {formatDate(due.effectiveDueDate)}{/if}
		{:else}
			{est ? 'est. ' : ''}{#if due.effectiveDueDate}{formatDate(due.effectiveDueDate)} ({relativeDays(due.daysLeft ?? 0)}){/if}
			{#if due.dueMileage !== null}
				· {due.dueMileage.toLocaleString()} mi
				{#if due.milesLeft !== null}({due.milesLeft >= 0
						? `${due.milesLeft.toLocaleString()} left`
						: `${(-due.milesLeft).toLocaleString()} over`}){/if}
			{/if}
		{/if}
	{/if}
</span>
