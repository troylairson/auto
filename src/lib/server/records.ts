import { and, eq, inArray } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { db } from './db';
import {
	maintenanceItems,
	odometerReadings,
	serviceRecordItems,
	serviceRecords
} from './db/schema';
import { clearNotifications } from './reminders';

export type RecordInput = {
	vehicleId: number;
	serviceDate: string;
	mileage: number;
	vendor: string | null;
	totalCostCents: number | null;
	minderCode: string | null;
	notes: string | null;
	itemIds: number[];
	other: { description: string; costCents: number | null }[];
	userId: number;
};

export function getRecord(vehicleId: number, recordId: number) {
	const record = db
		.select()
		.from(serviceRecords)
		.where(and(eq(serviceRecords.id, recordId), eq(serviceRecords.vehicleId, vehicleId)))
		.get();
	if (!record) error(404, 'Service record not found');
	const lines = db
		.select({
			id: serviceRecordItems.id,
			maintenanceItemId: serviceRecordItems.maintenanceItemId,
			description: serviceRecordItems.description,
			costCents: serviceRecordItems.costCents,
			itemName: maintenanceItems.name
		})
		.from(serviceRecordItems)
		.leftJoin(maintenanceItems, eq(serviceRecordItems.maintenanceItemId, maintenanceItems.id))
		.where(eq(serviceRecordItems.serviceRecordId, record.id))
		.all();
	return { record, lines };
}

/** Create or replace a service record, its line items and its odometer reading. */
export function saveRecord(input: RecordInput, recordId?: number): number {
	const id = db.transaction((tx) => {
		const values = {
			vehicleId: input.vehicleId,
			serviceDate: input.serviceDate,
			mileage: input.mileage,
			vendor: input.vendor,
			totalCostCents: input.totalCostCents,
			minderCode: input.minderCode,
			notes: input.notes
		};
		let id: number;
		if (recordId) {
			tx.update(serviceRecords).set(values).where(eq(serviceRecords.id, recordId)).run();
			tx.delete(serviceRecordItems).where(eq(serviceRecordItems.serviceRecordId, recordId)).run();
			tx.delete(odometerReadings).where(eq(odometerReadings.serviceRecordId, recordId)).run();
			id = recordId;
		} else {
			id = tx
				.insert(serviceRecords)
				.values({ ...values, createdBy: input.userId })
				.returning({ id: serviceRecords.id })
				.get().id;
		}
		const validItems = input.itemIds.length
			? tx
					.select({ id: maintenanceItems.id })
					.from(maintenanceItems)
					.where(
						and(
							eq(maintenanceItems.vehicleId, input.vehicleId),
							inArray(maintenanceItems.id, input.itemIds)
						)
					)
					.all()
					.map((r) => r.id)
			: [];
		for (const itemId of validItems) {
			tx.insert(serviceRecordItems).values({ serviceRecordId: id, maintenanceItemId: itemId }).run();
		}
		for (const o of input.other) {
			tx.insert(serviceRecordItems)
				.values({ serviceRecordId: id, description: o.description, costCents: o.costCents })
				.run();
		}
		tx.insert(odometerReadings)
			.values({
				vehicleId: input.vehicleId,
				readingDate: input.serviceDate,
				mileage: input.mileage,
				source: 'service',
				serviceRecordId: id,
				createdBy: input.userId
			})
			.run();
		if (validItems.length) {
			tx.update(maintenanceItems)
				.set({ snoozedUntil: null })
				.where(inArray(maintenanceItems.id, validItems))
				.run();
		}
		return { id, validItems };
	});
	clearNotifications(id.validItems);
	return id.id;
}

export function deleteRecord(recordId: number) {
	db.delete(serviceRecords).where(eq(serviceRecords.id, recordId)).run();
}
