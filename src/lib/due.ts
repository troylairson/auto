// Due-date logic. Pure functions: no database, no clock. Everything they need,
// including "today", is passed in.

import { addDays, addMonths, daysBetween, formatDate, minDate } from './dates';

export const THRESHOLDS = {
	soonDays: 30,
	soonMiles: 1000,
	dueDays: 7,
	dueMiles: 250,
	staleReadingDays: 30,
	oilLifeSoonPct: 15,
	oilLifeDuePct: 5
};

export type Status = 'overdue' | 'due' | 'soon' | 'ok' | 'unknown' | 'snoozed';

export const STATUS_RANK: Record<Status, number> = {
	overdue: 0,
	due: 1,
	unknown: 2,
	soon: 3,
	ok: 4,
	snoozed: 5
};

export const STATUS_LABEL: Record<Status, string> = {
	overdue: 'Overdue',
	due: 'Due',
	soon: 'Due soon',
	ok: 'OK',
	unknown: 'Unknown',
	snoozed: 'Snoozed'
};

export type Reading = {
	date: string;
	mileage: number;
	oilLifePct?: number | null;
	minderCode?: string | null;
};

export type MileageEstimate = {
	mileage: number;
	milesPerDay: number;
	fromHistory: boolean; // false = fell back to the vehicle's miles-per-year setting
	lastReadingDate: string | null;
	lastReadingMileage: number | null;
	daysSinceReading: number | null;
	stale: boolean;
};

/**
 * Estimate today's odometer from recent readings: slope over the last ~12 months
 * (needs 2+ readings spanning 30+ days), otherwise the miles-per-year fallback.
 */
export function estimateMileage(
	readings: Reading[],
	today: string,
	milesPerYear: number
): MileageEstimate {
	const fallbackRate = milesPerYear / 365;
	if (readings.length === 0) {
		return {
			mileage: 0,
			milesPerDay: fallbackRate,
			fromHistory: false,
			lastReadingDate: null,
			lastReadingMileage: null,
			daysSinceReading: null,
			stale: true
		};
	}
	const sorted = [...readings].sort((a, b) =>
		a.date === b.date ? a.mileage - b.mileage : a.date < b.date ? -1 : 1
	);
	const last = sorted[sorted.length - 1];
	const window = sorted.filter((r) => daysBetween(r.date, last.date) <= 365);
	const first = window[0];
	const span = daysBetween(first.date, last.date);

	let milesPerDay = fallbackRate;
	let fromHistory = false;
	if (window.length >= 2 && span >= 30 && last.mileage > first.mileage) {
		milesPerDay = (last.mileage - first.mileage) / span;
		fromHistory = true;
	}
	const daysSince = Math.max(0, daysBetween(last.date, today));
	return {
		mileage: Math.round(last.mileage + milesPerDay * daysSince),
		milesPerDay,
		fromHistory,
		lastReadingDate: last.date,
		lastReadingMileage: last.mileage,
		daysSinceReading: daysSince,
		stale: daysSince > THRESHOLDS.staleReadingDays
	};
}

/** "B13" → ['A','B','1','3'] (B includes the oil change); "A" → ['A']; invalid → null. */
export function parseMinderCode(input: string | null | undefined): string[] | null {
	if (!input) return null;
	const code = input.toUpperCase().replace(/[\s,-]/g, '');
	const m = /^([AB])?([1-7]*)$/.exec(code);
	if (!m || code === '') return null;
	const codes: string[] = [];
	if (m[1] === 'A') codes.push('A');
	if (m[1] === 'B') codes.push('A', 'B');
	for (const digit of new Set(m[2])) codes.push(digit);
	return codes;
}

export type ItemInput = {
	intervalMiles: number | null;
	intervalMonths: number | null;
	firstDueMiles: number | null;
	firstDueMonths: number | null;
	minderCode: string | null;
	baselineDate: string | null;
	baselineMileage: number | null;
	neverDone: boolean;
	snoozedUntil: string | null;
};

export type DoneEvent = { date: string | null; mileage: number | null };

export type DueContext = {
	today: string;
	estimate: MileageEstimate;
	/** Date the vehicle entered service, used as the start for items never done. */
	vehicleStartDate: string;
	/** Minder vehicles only: all odometer readings (with oil life % / codes). */
	minderReadings?: Reading[] | null;
};

export type DueResult = {
	status: Status;
	/** Status ignoring snooze. */
	underlying: Status;
	source: 'interval' | 'estimate' | 'oil_life' | 'minder_code' | 'none';
	lastDone: DoneEvent | null;
	dueDate: string | null;
	dueMileage: number | null;
	/** Earliest of the date limit and the projected date the mileage limit is reached. */
	effectiveDueDate: string | null;
	daysLeft: number | null;
	milesLeft: number | null;
	oilLifePct: number | null;
	note: string | null;
};

function statusFrom(daysLeft: number | null, milesLeft: number | null): Status {
	const T = THRESHOLDS;
	if ((daysLeft !== null && daysLeft < 0) || (milesLeft !== null && milesLeft < 0)) return 'overdue';
	if ((daysLeft !== null && daysLeft <= T.dueDays) || (milesLeft !== null && milesLeft <= T.dueMiles))
		return 'due';
	if ((daysLeft !== null && daysLeft <= T.soonDays) || (milesLeft !== null && milesLeft <= T.soonMiles))
		return 'soon';
	return 'ok';
}

function worse(a: Status, b: Status): Status {
	return STATUS_RANK[a] <= STATUS_RANK[b] ? a : b;
}

export function computeDue(item: ItemInput, lastRecord: DoneEvent | null, ctx: DueContext): DueResult {
	const { today, estimate } = ctx;

	// 1. Where does the clock start?
	let base: DoneEvent | null = lastRecord;
	let firstTime = false;
	if (!base && (item.baselineDate || item.baselineMileage !== null)) {
		base = { date: item.baselineDate, mileage: item.baselineMileage };
	}
	if (!base && item.neverDone) {
		base = { date: ctx.vehicleStartDate, mileage: 0 };
		firstTime = true;
	}

	const miles = firstTime ? (item.firstDueMiles ?? item.intervalMiles) : item.intervalMiles;
	const months = firstTime ? (item.firstDueMonths ?? item.intervalMonths) : item.intervalMonths;

	// 2. Interval-based limits.
	const dueDate = base?.date && months ? addMonths(base.date, months) : null;
	const dueMileage = base && base.mileage !== null && miles ? base.mileage + miles : null;
	const milesLeft = dueMileage !== null ? dueMileage - estimate.mileage : null;
	const mileDate =
		milesLeft !== null && estimate.milesPerDay > 0
			? addDays(today, Math.ceil(milesLeft / estimate.milesPerDay))
			: null;
	let effectiveDueDate = minDate(dueDate, mileDate);
	let daysLeft = dueDate ? daysBetween(today, dueDate) : null;

	let status: Status;
	let source: DueResult['source'];
	let note: string | null = null;
	let oilLifePct: number | null = null;

	if (dueDate === null && dueMileage === null) {
		status = 'unknown';
		source = 'none';
		note = base ? 'Needs the mileage it was last done at' : 'When was this last done?';
	} else {
		status = statusFrom(daysLeft, milesLeft);
		source = ctx.minderReadings && item.minderCode ? 'estimate' : 'interval';
	}

	// 3. Maintenance Minder: oil life % and displayed codes override estimates.
	if (ctx.minderReadings && item.minderCode) {
		const doneDate = lastRecord?.date ?? item.baselineDate ?? null;
		const after = ctx.minderReadings
			.filter((r) => !doneDate || r.date > doneDate)
			.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

		if (item.minderCode === 'A') {
			const oil = after.filter((r) => r.oilLifePct !== null && r.oilLifePct !== undefined);
			const latest = oil[oil.length - 1];
			if (latest) {
				const pct = latest.oilLifePct as number;
				let projected = pct;
				let at5: string | null = null;
				const elapsed = doneDate ? daysBetween(doneDate, latest.date) : 0;
				if (doneDate && elapsed > 0 && pct < 100) {
					const perDay = (100 - pct) / elapsed;
					projected = pct - perDay * daysBetween(latest.date, today);
					at5 = addDays(latest.date, Math.ceil((pct - THRESHOLDS.oilLifeDuePct) / perDay));
				}
				oilLifePct = Math.max(0, Math.round(projected));
				const oilStatus: Status =
					projected <= 0
						? 'overdue'
						: projected <= THRESHOLDS.oilLifeDuePct
							? 'due'
							: projected <= THRESHOLDS.oilLifeSoonPct
								? 'soon'
								: 'ok';
				// The yearly limit still applies even if oil life is high.
				const yearly = dueDate ? statusFrom(daysLeft, null) : 'ok';
				status = worse(oilStatus, yearly);
				effectiveDueDate = minDate(at5, dueDate);
				source = 'oil_life';
				note = `Oil life ${oilLifePct}%${projected !== pct ? ' (projected)' : ''}`;
			}
		}

		const withCode = after.filter((r) => r.minderCode);
		const latestCode = withCode[withCode.length - 1];
		const codes = parseMinderCode(latestCode?.minderCode);
		if (latestCode && codes?.includes(item.minderCode)) {
			const shownFor = daysBetween(latestCode.date, today);
			status = worse(status, shownFor > THRESHOLDS.soonDays ? 'overdue' : 'due');
			source = 'minder_code';
			effectiveDueDate = minDate(effectiveDueDate, latestCode.date);
			daysLeft = daysBetween(today, effectiveDueDate!);
			note = `Minder showing ${latestCode.minderCode!.toUpperCase()} since ${formatDate(latestCode.date)}`;
		}
	}

	const snoozed =
		item.snoozedUntil !== null && item.snoozedUntil > today && status !== 'ok' && status !== 'unknown';

	return {
		status: snoozed ? 'snoozed' : status,
		underlying: status,
		source,
		lastDone: lastRecord ?? (base && !firstTime ? base : null),
		dueDate,
		dueMileage,
		effectiveDueDate,
		daysLeft: effectiveDueDate ? daysBetween(today, effectiveDueDate) : daysLeft,
		milesLeft,
		oilLifePct,
		note
	};
}

/** Sort comparator: worst status first, then soonest due. */
export function compareDue(a: DueResult, b: DueResult): number {
	const rank = STATUS_RANK[a.status] - STATUS_RANK[b.status];
	if (rank !== 0) return rank;
	const ad = a.effectiveDueDate ?? '9999-12-31';
	const bd = b.effectiveDueDate ?? '9999-12-31';
	return ad < bd ? -1 : ad > bd ? 1 : 0;
}
