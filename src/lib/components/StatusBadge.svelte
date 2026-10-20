<script lang="ts">
	import { STATUS_LABEL, type Status } from '$lib/due';

	let { status }: { status: Status } = $props();

	const styles: Record<Status, string> = {
		overdue: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
		due: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300',
		soon: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300',
		ok: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
		unknown: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
		snoozed: 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
	};
</script>

<span class="inline-block rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap {styles[status]}">
	{STATUS_LABEL[status]}
</span>
