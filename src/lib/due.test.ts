import { describe, expect, it } from 'vitest';
import { addMonths, daysBetween, isValidDate } from './dates';
import {
	compareDue,
	computeDue,
	estimateMileage,
	parseMinderCode,
	type DueContext,
	type ItemInput
} from './due';

const TODAY = '2026-10-20';

function item(overrides: Partial<ItemInput> = {}): ItemInput {
	return {
		intervalMiles: 5000,
		intervalMonths: 6,
		firstDueMiles: null,
		firstDueMonths: null,
		minderCode: null,
		baselineDate: null,
		baselineMileage: null,
		neverDone: false,
		snoozedUntil: null,
		...overrides
	};
}

function ctx(mileage: number, milesPerDay = 30, overrides: Partial<DueContext> = {}): DueContext {
	return {
		today: TODAY,
		estimate: {
			mileage,
			milesPerDay,
			fromHistory: true,
			lastReadingDate: TODAY,
			lastReadingMileage: mileage,
			daysSinceReading: 0,
			stale: false
		},
		vehicleStartDate: '2021-03-01',
		...overrides
	};
}

describe('dates', () => {
	it('adds months with end-of-month clamping', () => {
		expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
		expect(addMonths('2026-10-20', 6)).toBe('2027-04-20');
		expect(addMonths('2026-11-15', 14)).toBe('2028-01-15');
	});
	it('counts days across DST', () => {
		expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2);
	});
	it('validates dates', () => {
		expect(isValidDate('2026-02-30')).toBe(false);
		expect(isValidDate('2026-02-28')).toBe(true);
	});
});

describe('estimateMileage', () => {
	it('falls back to miles per year with a single reading', () => {
		const e = estimateMileage([{ date: '2026-09-20', mileage: 100000 }], TODAY, 12000);
		expect(e.fromHistory).toBe(false);
		expect(e.mileage).toBe(100000 + Math.round((12000 / 365) * 30));
		expect(e.stale).toBe(false);
	});
	it('uses the slope of recent readings', () => {
		const e = estimateMileage(
			[
				{ date: '2026-01-01', mileage: 10000 },
				{ date: '2026-07-01', mileage: 15430 }, // 181 days, 30 mi/day
				{ date: '2024-01-01', mileage: 1000 } // outside the 12-month window
			],
			'2026-07-11',
			12000
		);
		expect(e.fromHistory).toBe(true);
		expect(e.milesPerDay).toBeCloseTo(30, 5);
		expect(e.mileage).toBe(15730);
	});
	it('flags stale readings', () => {
		const e = estimateMileage([{ date: '2026-08-01', mileage: 5 }], TODAY, 12000);
		expect(e.stale).toBe(true);
	});
	it('handles no readings', () => {
		expect(estimateMileage([], TODAY, 12000).stale).toBe(true);
	});
});

describe('computeDue', () => {
	it('is OK well before both limits', () => {
		const r = computeDue(item(), { date: '2026-09-01', mileage: 50000 }, ctx(51000));
		expect(r.status).toBe('ok');
		expect(r.dueDate).toBe('2027-03-01');
		expect(r.dueMileage).toBe(55000);
		expect(r.milesLeft).toBe(4000);
	});

	it('uses whichever comes first: mileage', () => {
		// 800 miles left → due soon, even though the date is months away
		const r = computeDue(item(), { date: '2026-09-01', mileage: 50000 }, ctx(54200));
		expect(r.status).toBe('soon');
		expect(r.effectiveDueDate).toBe('2026-11-16'); // 800 / 30 = 26.7 → 27 days
	});

	it('uses whichever comes first: time', () => {
		const r = computeDue(item(), { date: '2026-04-25', mileage: 50000 }, ctx(51000));
		expect(r.dueDate).toBe('2026-10-25');
		expect(r.status).toBe('due');
	});

	it('is overdue past either limit', () => {
		expect(computeDue(item(), { date: '2026-01-01', mileage: 50000 }, ctx(51000)).status).toBe(
			'overdue'
		);
		expect(computeDue(item(), { date: '2026-10-01', mileage: 50000 }, ctx(55001)).status).toBe(
			'overdue'
		);
	});

	it('is unknown with no history or baseline', () => {
		const r = computeDue(item(), null, ctx(80000));
		expect(r.status).toBe('unknown');
		expect(r.note).toMatch(/last done/);
	});

	it('uses the baseline when there are no records', () => {
		const r = computeDue(
			item({ baselineDate: '2026-08-01', baselineMileage: 120000 }),
			null,
			ctx(121000)
		);
		expect(r.status).toBe('ok');
		expect(r.dueMileage).toBe(125000);
		expect(r.lastDone).toEqual({ date: '2026-08-01', mileage: 120000 });
	});

	it('works with a date-only baseline for a time-only item', () => {
		const r = computeDue(
			item({ intervalMiles: null, intervalMonths: 36, baselineDate: '2024-01-15' }),
			null,
			ctx(1)
		);
		expect(r.dueDate).toBe('2027-01-15');
		expect(r.status).toBe('ok');
	});

	it('uses first-due intervals for never-done items', () => {
		const coolant = item({
			intervalMiles: 60000,
			intervalMonths: 60,
			firstDueMiles: 120000,
			firstDueMonths: 120,
			neverDone: true
		});
		const r = computeDue(coolant, null, ctx(40000));
		expect(r.dueMileage).toBe(120000);
		expect(r.dueDate).toBe('2031-03-01');
		expect(r.lastDone).toBeNull();
		// After the first service, the regular interval applies.
		const after = computeDue(coolant, { date: '2031-01-01', mileage: 110000 }, ctx(111000));
		expect(after.dueMileage).toBe(170000);
	});

	it('snoozes non-OK items until the snooze date', () => {
		const r = computeDue(
			item({ snoozedUntil: '2026-11-01' }),
			{ date: '2026-01-01', mileage: 50000 },
			ctx(51000)
		);
		expect(r.status).toBe('snoozed');
		expect(r.underlying).toBe('overdue');
		const expired = computeDue(
			item({ snoozedUntil: '2026-10-19' }),
			{ date: '2026-01-01', mileage: 50000 },
			ctx(51000)
		);
		expect(expired.status).toBe('overdue');
	});

	it('sorts worst first, then by date', () => {
		const a = computeDue(item(), { date: '2026-01-01', mileage: 0 }, ctx(1000));
		const b = computeDue(item(), { date: '2026-09-01', mileage: 0 }, ctx(1000));
		const c = computeDue(item(), null, ctx(1000));
		expect([b, c, a].sort(compareDue).map((r) => r.status)).toEqual(['overdue', 'unknown', 'ok']);
	});
});

describe('Maintenance Minder', () => {
	it('parses codes', () => {
		expect(parseMinderCode('B13')).toEqual(['A', 'B', '1', '3']);
		expect(parseMinderCode('a 1')).toEqual(['A', '1']);
		expect(parseMinderCode('12')).toEqual(['1', '2']);
		expect(parseMinderCode('C1')).toBeNull();
		expect(parseMinderCode('')).toBeNull();
	});

	const oil = item({ intervalMiles: 7500, intervalMonths: 12, minderCode: 'A' });
	const done = { date: '2026-07-22', mileage: 30000 };

	it('marks items as estimates when there is no Minder data', () => {
		const r = computeDue(oil, done, ctx(31000, 30, { minderReadings: [] }));
		expect(r.source).toBe('estimate');
	});

	it('projects oil life from readings', () => {
		// 60 days after the change, oil life is 40%: 1%/day, so 5% on day 95.
		const readings = [{ date: '2026-09-20', mileage: 32000, oilLifePct: 40 }];
		const r = computeDue(oil, done, ctx(33000, 30, { minderReadings: readings }));
		expect(r.source).toBe('oil_life');
		expect(r.oilLifePct).toBe(10); // 30 more days at 1%/day
		expect(r.status).toBe('soon');
		expect(r.effectiveDueDate).toBe('2026-10-25');
	});

	it('ignores oil life readings from before the last change', () => {
		const readings = [{ date: '2026-07-01', mileage: 29000, oilLifePct: 5 }];
		const r = computeDue(oil, done, ctx(31000, 30, { minderReadings: readings }));
		expect(r.source).toBe('estimate');
	});

	it('a displayed code makes matching items due', () => {
		const rotation = item({ intervalMiles: 7500, intervalMonths: null, minderCode: '1' });
		const trans = item({ intervalMiles: 30000, intervalMonths: null, minderCode: '3' });
		const coolant = item({ intervalMiles: 60000, intervalMonths: 60, minderCode: '5' });
		const readings = [{ date: '2026-10-18', mileage: 36000, minderCode: 'B13' }];
		const c = ctx(36100, 30, { minderReadings: readings });
		expect(computeDue(rotation, done, c).status).toBe('due');
		expect(computeDue(trans, { date: '2025-01-01', mileage: 10000 }, c).source).toBe('minder_code');
		expect(computeDue(coolant, done, c).status).toBe('ok');
		expect(computeDue(oil, done, c).status).toBe('due'); // B includes A
	});

	it('a code shown before the item was last done is ignored', () => {
		const rotation = item({ intervalMiles: 7500, intervalMonths: null, minderCode: '1' });
		const readings = [{ date: '2026-10-01', mileage: 35000, minderCode: 'A1' }];
		const r = computeDue(
			rotation,
			{ date: '2026-10-05', mileage: 35100 },
			ctx(35500, 30, { minderReadings: readings })
		);
		expect(r.status).toBe('ok');
	});
});
