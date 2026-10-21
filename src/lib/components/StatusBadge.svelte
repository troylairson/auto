<script lang="ts">
	import { STATUS_LABEL, type Status } from '$lib/due';

	let { status, text }: { status: Status; text?: string } = $props();

	const styles: Record<Status, string> = {
		overdue: 'bg-danger-soft text-danger-text',
		due: 'bg-warn-soft text-warn-on-soft',
		soon: 'bg-soon-soft text-soon-text',
		ok: 'bg-ok-soft text-ok-text',
		unknown: 'bg-seg text-muted',
		snoozed: 'bg-seg text-muted'
	};
</script>

<span class="inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap {styles[status]}">
	{text ?? STATUS_LABEL[status]}
</span>
