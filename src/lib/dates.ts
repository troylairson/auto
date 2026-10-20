// Calendar dates are 'YYYY-MM-DD' strings. Arithmetic is done on whole days in UTC
// so time zones and DST never shift a date.

const DAY_MS = 86_400_000;

export function todayLocal(): string {
	// en-CA formats as YYYY-MM-DD; uses the process time zone (TZ env var on the server).
	return new Date().toLocaleDateString('en-CA');
}

export function toDayNumber(date: string): number {
	const [y, m, d] = date.split('-').map(Number);
	return Math.floor(Date.UTC(y, m - 1, d) / DAY_MS);
}

export function fromDayNumber(day: number): string {
	return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
	return toDayNumber(to) - toDayNumber(from);
}

export function addDays(date: string, days: number): string {
	return fromDayNumber(toDayNumber(date) + days);
}

/** Add calendar months, clamping to the end of shorter months (Jan 31 + 1 → Feb 28). */
export function addMonths(date: string, months: number): string {
	const [y, m, d] = date.split('-').map(Number);
	const total = y * 12 + (m - 1) + months;
	const ny = Math.floor(total / 12);
	const nm = total % 12;
	const lastDay = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
	return fromDayNumber(Math.floor(Date.UTC(ny, nm, Math.min(d, lastDay)) / DAY_MS));
}

export function minDate(a: string | null, b: string | null): string | null {
	if (!a) return b;
	if (!b) return a;
	return a < b ? a : b;
}

export function isValidDate(value: string): boolean {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
	return fromDayNumber(toDayNumber(value)) === value;
}

export function formatDate(date: string | null | undefined): string {
	if (!date) return '—';
	const [y, m, d] = date.split('-').map(Number);
	return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		timeZone: 'UTC'
	});
}

/** "in 3 days", "today", "12 days ago", "in 4 months" */
export function relativeDays(days: number): string {
	if (days === 0) return 'today';
	const abs = Math.abs(days);
	let text: string;
	if (abs < 45) text = `${abs} day${abs === 1 ? '' : 's'}`;
	else if (abs < 365 * 2) text = `${Math.round(abs / 30.4)} months`;
	else text = `${(abs / 365).toFixed(1).replace(/\.0$/, '')} years`;
	return days > 0 ? `in ${text}` : `${text} ago`;
}
