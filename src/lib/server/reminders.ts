import { and, eq, inArray } from 'drizzle-orm';
import cron from 'node-cron';
import { daysBetween, relativeDays, todayLocal } from '$lib/dates';
import { STATUS_LABEL, STATUS_RANK, type Status } from '$lib/due';
import { db } from './db';
import { notificationLog, users, type User } from './db/schema';
import { appUrl, sendPush } from './ntfy';
import { getOverview, listVehicles, type ItemWithDue } from './vehicles';

type Kind = 'due_soon' | 'due' | 'overdue';
const KIND_FOR: Partial<Record<Status, Kind>> = { soon: 'due_soon', due: 'due', overdue: 'overdue' };
const KIND_RANK: Record<Kind, number> = { due_soon: 1, due: 2, overdue: 3 };
const OVERDUE_REPEAT_DAYS = 7;
const STALE_REPEAT_DAYS = 14;

export function describeDue({ item, due }: ItemWithDue): string {
	const parts = [`${item.name}: ${STATUS_LABEL[due.status].toLowerCase()}`];
	if (due.daysLeft !== null) parts.push(relativeDays(due.daysLeft));
	if (due.milesLeft !== null && due.source !== 'oil_life' && due.source !== 'minder_code') {
		parts.push(
			due.milesLeft >= 0
				? `${due.milesLeft.toLocaleString()} mi left`
				: `${(-due.milesLeft).toLocaleString()} mi over`
		);
	}
	if (due.note && (due.source === 'oil_life' || due.source === 'minder_code')) parts.push(due.note);
	return parts.join(', ');
}

/** Forget sent notifications for items that were just serviced or snoozed. */
export function clearNotifications(itemIds: number[]) {
	if (itemIds.length === 0) return;
	db.delete(notificationLog).where(inArray(notificationLog.maintenanceItemId, itemIds)).run();
}

type RunResult = { sent: number; errors: string[] };

export async function runReminders(
	today = todayLocal(),
	opts: { digest?: boolean } = {}
): Promise<RunResult> {
	const result: RunResult = { sent: 0, errors: [] };
	const recipients = db
		.select()
		.from(users)
		.all()
		.filter((u) => u.notifyPush && u.ntfyTopic);
	if (recipients.length === 0) return result;

	const now = new Date().toISOString();
	const digestLines = new Map<number, string[]>();

	const push = async (user: User, msg: Parameters<typeof sendPush>[1]) => {
		try {
			await sendPush(user.ntfyTopic!, msg);
			result.sent++;
			return true;
		} catch (e) {
			result.errors.push(`${user.name}: ${(e as Error).message}`);
			return false;
		}
	};

	for (const vehicle of listVehicles()) {
		const overview = getOverview(vehicle, today);
		const audience = vehicle.primaryDriverId
			? recipients.filter((u) => u.id === vehicle.primaryDriverId)
			: recipients;
		const actionable = overview.items.filter((i) => KIND_FOR[i.due.status]);

		for (const user of audience) {
			if (actionable.length) {
				digestLines.set(user.id, [
					...(digestLines.get(user.id) ?? []),
					...actionable.map((i) => `${vehicle.nickname} · ${describeDue(i)}`)
				]);
			}

			const logs = actionable.length
				? db
						.select()
						.from(notificationLog)
						.where(
							and(
								eq(notificationLog.userId, user.id),
								inArray(
									notificationLog.maintenanceItemId,
									actionable.map((i) => i.item.id)
								)
							)
						)
						.all()
				: [];

			const toSend = actionable.filter(({ item, due }) => {
				const kind = KIND_FOR[due.status]!;
				const mine = logs.filter((l) => l.maintenanceItemId === item.id);
				const alreadyAtLevel = mine.some(
					(l) => l.kind in KIND_RANK && KIND_RANK[l.kind as Kind] >= KIND_RANK[kind]
				);
				if (!alreadyAtLevel) return true;
				if (kind !== 'overdue') return false;
				const lastOverdue = mine
					.filter((l) => l.kind === 'overdue')
					.map((l) => l.sentAt.slice(0, 10))
					.sort()
					.pop();
				return !!lastOverdue && daysBetween(lastOverdue, today) >= OVERDUE_REPEAT_DAYS;
			});

			if (toSend.length) {
				const worst = toSend.reduce((a, b) =>
					STATUS_RANK[a.due.status] <= STATUS_RANK[b.due.status] ? a : b
				).due.status;
				const ok = await push(user, {
					title:
						toSend.length === 1
							? `${vehicle.nickname}: ${toSend[0].item.name}`
							: `${vehicle.nickname}: ${toSend.length} maintenance items`,
					message: toSend.map(describeDue).join('\n'),
					click: appUrl(
						`/vehicles/${vehicle.id}/log?items=${toSend.map((i) => i.item.id).join(',')}`
					),
					tags: [worst === 'overdue' ? 'warning' : 'wrench'],
					priority: worst === 'overdue' ? 4 : 3
				});
				if (ok) {
					for (const { item, due } of toSend) {
						db.insert(notificationLog)
							.values({
								userId: user.id,
								vehicleId: vehicle.id,
								maintenanceItemId: item.id,
								kind: KIND_FOR[due.status]!,
								sentAt: now
							})
							.run();
					}
				}
			}

			if (overview.estimate.stale) {
				const recent = db
					.select()
					.from(notificationLog)
					.where(
						and(
							eq(notificationLog.userId, user.id),
							eq(notificationLog.vehicleId, vehicle.id),
							eq(notificationLog.kind, 'stale_odometer')
						)
					)
					.all()
					.some((l) => daysBetween(l.sentAt.slice(0, 10), today) < STALE_REPEAT_DAYS);
				if (!recent) {
					const ok = await push(user, {
						title: `What's the mileage on the ${vehicle.nickname}?`,
						message: overview.estimate.lastReadingDate
							? `Last reading was ${overview.estimate.daysSinceReading} days ago. Updating it keeps due dates accurate.`
							: 'No odometer reading yet.',
						click: appUrl(`/vehicles/${vehicle.id}/mileage`),
						tags: ['blue_car'],
						priority: 2
					});
					if (ok) {
						db.insert(notificationLog)
							.values({ userId: user.id, vehicleId: vehicle.id, kind: 'stale_odometer', sentAt: now })
							.run();
					}
				}
			}
		}
	}

	if (opts.digest) {
		for (const user of recipients) {
			const lines = digestLines.get(user.id);
			if (!lines?.length) continue;
			const ok = await push(user, {
				title: 'Weekly maintenance summary',
				message: lines.join('\n'),
				click: appUrl('/'),
				tags: ['calendar'],
				priority: 2
			});
			if (ok) db.insert(notificationLog).values({ userId: user.id, kind: 'digest', sentAt: now }).run();
		}
	}
	return result;
}

let started = false;

/** Daily check at 07:00 local time; Sundays include the weekly digest. */
export function startScheduler() {
	if (started) return;
	started = true;
	const timezone = process.env.TZ || 'America/New_York';
	cron.schedule(
		'0 7 * * *',
		async () => {
			const today = todayLocal();
			const sunday = new Date(`${today}T12:00:00Z`).getUTCDay() === 0;
			const r = await runReminders(today, { digest: sunday });
			console.log(`[reminders] ${today}: sent ${r.sent}${r.errors.length ? `, errors: ${r.errors.join('; ')}` : ''}`);
		},
		{ timezone }
	);
	console.log(`[reminders] scheduled daily at 07:00 ${timezone}`);
}
