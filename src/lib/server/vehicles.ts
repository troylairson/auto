import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { db } from './db';
import {
	maintenanceItems,
	odometerReadings,
	scheduleTemplates,
	serviceRecordItems,
	serviceRecords,
	templateItems,
	vehicles,
	type MaintenanceItem,
	type Vehicle
} from './db/schema';
import {
	compareDue,
	computeDue,
	estimateMileage,
	isSurfaced,
	type DoneEvent,
	type DueResult,
	type MileageEstimate
} from '$lib/due';

export type ItemWithDue = { item: MaintenanceItem; due: DueResult };
export type VehicleOverview = {
	vehicle: Vehicle;
	estimate: MileageEstimate;
	items: ItemWithDue[]; // usual items plus others coming due, sorted worst/soonest first
	moreItems: ItemWithDue[]; // enabled non-usual items that aren't coming due yet
	disabledItems: MaintenanceItem[];
	/** Maintenance Minder code currently driving due items (e.g. "B13"), if any. */
	minderCode: string | null;
	/** The item the vehicle's main gauge shows: oil, else the most urgent known item. */
	hero: ItemWithDue | null;
};

export function vehicleStartDate(v: Vehicle) {
	return v.inServiceDate ?? `${v.year}-01-01`;
}

export function getVehicle(id: number): Vehicle {
	const v = db.select().from(vehicles).where(eq(vehicles.id, id)).get();
	if (!v) error(404, 'Vehicle not found');
	return v;
}

export function listVehicles(includeArchived = false): Vehicle[] {
	return db
		.select()
		.from(vehicles)
		.where(includeArchived ? undefined : isNull(vehicles.archivedAt))
		.orderBy(asc(vehicles.nickname))
		.all();
}

export function getReadings(vehicleId: number) {
	return db
		.select()
		.from(odometerReadings)
		.where(eq(odometerReadings.vehicleId, vehicleId))
		.orderBy(desc(odometerReadings.readingDate), desc(odometerReadings.mileage))
		.all();
}

/** Most recent service (date, mileage) per maintenance item. */
export function lastDoneByItem(vehicleId: number): Map<number, DoneEvent> {
	const rows = db
		.select({
			itemId: serviceRecordItems.maintenanceItemId,
			date: serviceRecords.serviceDate,
			mileage: serviceRecords.mileage
		})
		.from(serviceRecordItems)
		.innerJoin(serviceRecords, eq(serviceRecordItems.serviceRecordId, serviceRecords.id))
		.where(eq(serviceRecords.vehicleId, vehicleId))
		.orderBy(asc(serviceRecords.serviceDate), asc(serviceRecords.mileage))
		.all();
	const map = new Map<number, DoneEvent>();
	for (const r of rows) if (r.itemId !== null) map.set(r.itemId, { date: r.date, mileage: r.mileage });
	return map;
}

export function getOverview(vehicle: Vehicle, today: string): VehicleOverview {
	const readings = getReadings(vehicle.id).map((r) => ({
		date: r.readingDate,
		mileage: r.mileage,
		oilLifePct: r.oilLifePct,
		minderCode: r.minderCode
	}));
	const estimate = estimateMileage(readings, today, vehicle.milesPerYear);
	const all = db
		.select()
		.from(maintenanceItems)
		.where(eq(maintenanceItems.vehicleId, vehicle.id))
		.orderBy(asc(maintenanceItems.sortOrder), asc(maintenanceItems.id))
		.all();
	const lastDone = lastDoneByItem(vehicle.id);
	const ctx = {
		today,
		estimate,
		vehicleStartDate: vehicleStartDate(vehicle),
		minderReadings: vehicle.maintenanceMinder ? readings : null
	};
	const enabled = all
		.filter((i) => i.enabled)
		.map((item) => ({ item, due: computeDue(item, lastDone.get(item.id) ?? null, ctx) }))
		.sort((a, b) => compareDue(a.due, b.due));
	const items = enabled.filter((i) => isSurfaced(i.item.core, i.due));
	const codeItem = items.find((i) => i.due.source === 'minder_code');
	const codeReading = codeItem
		? readings.filter((r) => r.minderCode).sort((a, b) => (a.date < b.date ? 1 : -1))[0]
		: null;
	const oil =
		items.find((i) => i.due.oilLifePct !== null) ??
		items.find((i) => i.item.core && /oil/i.test(i.item.name) && i.due.status !== 'unknown');
	return {
		vehicle,
		estimate,
		items,
		moreItems: enabled.filter((i) => !isSurfaced(i.item.core, i.due)),
		disabledItems: all.filter((i) => !i.enabled),
		minderCode: codeReading?.minderCode?.toUpperCase() ?? null,
		hero: oil ?? items.find((i) => i.due.progress !== null) ?? null
	};
}

export function listTemplates() {
	return db.select().from(scheduleTemplates).orderBy(asc(scheduleTemplates.id)).all();
}

export type VehicleInput = Omit<
	typeof vehicles.$inferInsert,
	'id' | 'createdAt' | 'archivedAt' | 'maintenanceMinder'
>;

/** Create a vehicle, copy the template's items onto it, and record the starting odometer. */
export function createVehicle(
	input: VehicleInput,
	templateId: number,
	currentMileage: number,
	today: string,
	userId: number
): number {
	return db.transaction((tx) => {
		const template = tx
			.select()
			.from(scheduleTemplates)
			.where(eq(scheduleTemplates.id, templateId))
			.get();
		if (!template) error(400, 'Unknown template');
		const [v] = tx
			.insert(vehicles)
			.values({ ...input, maintenanceMinder: template.maintenanceMinder })
			.returning()
			.all();

		const tItems = tx
			.select()
			.from(templateItems)
			.where(eq(templateItems.templateId, templateId))
			.orderBy(asc(templateItems.sortOrder))
			.all();
		const severe = v.usageProfile === 'severe';
		for (const t of tItems) {
			if (t.drivetrains && !(v.drivetrain && t.drivetrains.split(',').includes(v.drivetrain)))
				continue;
			tx.insert(maintenanceItems)
				.values({
					vehicleId: v.id,
					templateItemId: t.id,
					sortOrder: t.sortOrder,
					name: t.name,
					category: t.category,
					intervalMiles: (severe ? t.severeIntervalMiles : null) ?? t.intervalMiles,
					intervalMonths: (severe ? t.severeIntervalMonths : null) ?? t.intervalMonths,
					firstDueMiles: t.firstDueMiles,
					firstDueMonths: t.firstDueMonths,
					minderCode: t.minderCode,
					enabled: t.enabledByDefault,
					core: t.core,
					notes: t.notes
				})
				.run();
		}
		tx.insert(odometerReadings)
			.values({
				vehicleId: v.id,
				readingDate: today,
				mileage: currentMileage,
				source: 'initial',
				createdBy: userId
			})
			.run();
		return v.id;
	});
}

/** Reset an item's intervals to its template values (respecting the usage profile). */
export function resetItemToTemplate(item: MaintenanceItem, vehicle: Vehicle) {
	if (!item.templateItemId) return;
	const t = db.select().from(templateItems).where(eq(templateItems.id, item.templateItemId)).get();
	if (!t) return;
	const severe = vehicle.usageProfile === 'severe';
	db.update(maintenanceItems)
		.set({
			name: t.name,
			intervalMiles: (severe ? t.severeIntervalMiles : null) ?? t.intervalMiles,
			intervalMonths: (severe ? t.severeIntervalMonths : null) ?? t.intervalMonths,
			firstDueMiles: t.firstDueMiles,
			firstDueMonths: t.firstDueMonths,
			minderCode: t.minderCode,
			core: t.core,
			notes: t.notes
		})
		.where(eq(maintenanceItems.id, item.id))
		.run();
}

export function getItems(vehicleId: number) {
	return db
		.select()
		.from(maintenanceItems)
		.where(eq(maintenanceItems.vehicleId, vehicleId))
		.orderBy(asc(maintenanceItems.sortOrder), asc(maintenanceItems.id))
		.all();
}

export function getItem(vehicleId: number, itemId: number) {
	const item = db
		.select()
		.from(maintenanceItems)
		.where(and(eq(maintenanceItems.vehicleId, vehicleId), eq(maintenanceItems.id, itemId)))
		.get();
	if (!item) error(404, 'Item not found');
	return item;
}

export function listRecords(vehicleId: number) {
	const records = db
		.select()
		.from(serviceRecords)
		.where(eq(serviceRecords.vehicleId, vehicleId))
		.orderBy(desc(serviceRecords.serviceDate), desc(serviceRecords.mileage))
		.all();
	const lines = db
		.select({
			recordId: serviceRecordItems.serviceRecordId,
			description: sql<string>`coalesce(${maintenanceItems.name}, ${serviceRecordItems.description}, 'Item')`,
			scheduled: sql<boolean>`${serviceRecordItems.maintenanceItemId} is not null`,
			costCents: serviceRecordItems.costCents
		})
		.from(serviceRecordItems)
		.innerJoin(serviceRecords, eq(serviceRecordItems.serviceRecordId, serviceRecords.id))
		.leftJoin(maintenanceItems, eq(serviceRecordItems.maintenanceItemId, maintenanceItems.id))
		.where(eq(serviceRecords.vehicleId, vehicleId))
		.all();
	return records.map((r) => ({ ...r, lines: lines.filter((l) => l.recordId === r.id) }));
}

export function pastVendors(): string[] {
	return db
		.selectDistinct({ vendor: serviceRecords.vendor })
		.from(serviceRecords)
		.where(sql`${serviceRecords.vendor} is not null and ${serviceRecords.vendor} != ''`)
		.orderBy(asc(serviceRecords.vendor))
		.all()
		.map((r) => r.vendor!);
}
