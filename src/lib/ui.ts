import type { DueResult, Status } from './due';

/** CSS colour for a status, used by gauge rings and dots. */
export const STATUS_COLOR: Record<Status, string> = {
	overdue: 'var(--danger)',
	due: 'var(--warn)',
	soon: 'var(--soon)',
	ok: 'var(--ok)',
	unknown: 'var(--dash)',
	snoozed: 'var(--dash)'
};

/** Text colour class for a status line. */
export const STATUS_TEXT: Record<Status, string> = {
	overdue: 'text-danger-text',
	due: 'text-warn-text',
	soon: 'text-soon-text',
	ok: 'text-muted',
	unknown: 'text-muted',
	snoozed: 'text-muted'
};

/** How much of a ring to fill: what's left of the interval, or full when due. */
export function ringFill(due: DueResult): number | null {
	if (due.oilLifePct !== null) return Math.max(0.03, due.oilLifePct / 100);
	if (due.status === 'unknown') return null;
	if (due.underlying === 'due' || due.underlying === 'overdue') return 1;
	if (due.progress === null) return null;
	return Math.max(0.03, 1 - due.progress);
}

function shortMiles(n: number): string {
	return n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : `${n}`;
}

/** Big number + caption for a gauge centre, e.g. "15%" / "oil life", "5k" / "mi left". */
export function gaugeText(due: DueResult): { value: string; label: string } {
	if (due.oilLifePct !== null) return { value: `${due.oilLifePct}%`, label: 'oil life' };
	if (due.status === 'unknown') return { value: '—', label: 'no history' };
	if (due.underlying === 'overdue') return { value: 'Over', label: 'due' };
	if (due.underlying === 'due') return { value: 'Due', label: 'now' };
	const mileageFirst =
		due.milesLeft !== null && (due.dueDate === null || (due.effectiveDueDate ?? '') < due.dueDate);
	if (mileageFirst && due.milesLeft !== null) return { value: shortMiles(due.milesLeft), label: 'mi left' };
	const days = due.daysLeft ?? 0;
	if (days > 60) return { value: `${Math.round(days / 30.4)}`, label: 'mo left' };
	return { value: `${days}`, label: days === 1 ? 'day left' : 'days left' };
}

/** One-line status for tiles and lists. */
export function statusLine(due: DueResult): string {
	if (due.status === 'snoozed') return 'Snoozed';
	if (due.status === 'unknown') return 'No history yet';
	if (due.source === 'minder_code') return due.underlying === 'overdue' ? 'Overdue · dash code' : 'Dash code';
	if (due.underlying === 'overdue') {
		if (due.milesLeft !== null && due.milesLeft < 0) return `Overdue · ${(-due.milesLeft).toLocaleString()} mi over`;
		return 'Overdue';
	}
	const t = gaugeText(due);
	if (due.underlying === 'due') return 'Due now';
	if (t.label === 'oil life') return `Oil life ${t.value}`;
	const n = t.label === 'mi left' && due.milesLeft !== null ? due.milesLeft.toLocaleString() : t.value;
	return `${n} ${t.label}`;
}
