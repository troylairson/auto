import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { addDays, todayLocal } from '$lib/dates';
import { STATUS_LABEL } from '$lib/due';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { describeDue } from '$lib/server/reminders';
import { getOverview, listVehicles } from '$lib/server/vehicles';
import type { RequestHandler } from './$types';

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
const icsDate = (d: string) => d.replaceAll('-', '');

export const GET: RequestHandler = ({ params }) => {
	const token = params.token.replace(/\.ics$/, '');
	const user = db.select().from(users).where(eq(users.calendarToken, token)).get();
	if (!user) error(404, 'Not found');

	const today = todayLocal();
	const horizon = addDays(today, 730);
	const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
	const lines = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//auto//maintenance//EN',
		'CALSCALE:GREGORIAN',
		'X-WR-CALNAME:Vehicle maintenance',
		'REFRESH-INTERVAL;VALUE=DURATION:PT12H'
	];
	for (const vehicle of listVehicles()) {
		for (const row of getOverview(vehicle, today).items) {
			const date = row.due.effectiveDueDate;
			if (!date || row.due.status === 'unknown' || date > horizon) continue;
			const start = date < today ? today : date;
			lines.push(
				'BEGIN:VEVENT',
				`UID:item-${row.item.id}@auto`,
				`DTSTAMP:${stamp}`,
				`DTSTART;VALUE=DATE:${icsDate(start)}`,
				`DTEND;VALUE=DATE:${icsDate(addDays(start, 1))}`,
				`SUMMARY:${esc(`${vehicle.nickname}: ${row.item.name}${row.due.status === 'overdue' ? ` (${STATUS_LABEL.overdue})` : ''}`)}`,
				`DESCRIPTION:${esc(describeDue(row))}`,
				'TRANSP:TRANSPARENT',
				'END:VEVENT'
			);
		}
	}
	lines.push('END:VCALENDAR');
	return new Response(lines.join('\r\n') + '\r\n', {
		headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'no-store' }
	});
};
