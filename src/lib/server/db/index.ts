import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { and, eq, notInArray } from 'drizzle-orm';
import { building } from '$app/environment';
import * as schema from './schema';
import { templates } from './templates';

export const dataDir = path.resolve(process.env.DATA_DIR ?? 'data');

function open() {
	// SvelteKit imports server modules during `vite build`; don't touch the real DB then.
	if (building) return new Database(':memory:');
	fs.mkdirSync(dataDir, { recursive: true });
	const sqlite = new Database(path.join(dataDir, 'auto.db'));
	sqlite.pragma('journal_mode = WAL');
	sqlite.pragma('foreign_keys = ON');
	return sqlite;
}

export const sqlite = open();
export const db = drizzle(sqlite, { schema });
export type DB = typeof db;

export function initDatabase(database: DB = db) {
	migrate(database, { migrationsFolder: path.resolve(process.env.MIGRATIONS_DIR ?? 'drizzle') });
	seedTemplates(database);
}

/** Insert or update the built-in schedule templates, matching items by name. */
export function seedTemplates(database: DB = db) {
	const { scheduleTemplates, templateItems } = schema;
	database.transaction((tx) => {
		for (const t of templates) {
			const values = {
				key: t.key,
				name: t.name,
				fuelType: t.fuelType,
				maintenanceMinder: t.minder ?? false,
				description: t.description
			};
			const [row] = tx
				.insert(scheduleTemplates)
				.values(values)
				.onConflictDoUpdate({ target: scheduleTemplates.key, set: values })
				.returning()
				.all();

			const existing = tx
				.select()
				.from(templateItems)
				.where(eq(templateItems.templateId, row.id))
				.all();
			const keep: number[] = [];
			t.items.forEach((item, i) => {
				const itemValues = {
					templateId: row.id,
					sortOrder: i,
					name: item.name,
					category: item.category,
					intervalMiles: item.miles ?? null,
					intervalMonths: item.months ?? null,
					severeIntervalMiles: item.severeMiles ?? null,
					severeIntervalMonths: item.severeMonths ?? null,
					firstDueMiles: item.firstMiles ?? null,
					firstDueMonths: item.firstMonths ?? null,
					minderCode: item.minder ?? null,
					drivetrains: item.drivetrains ?? null,
					enabledByDefault: !item.disabled,
					notes: item.notes ?? null
				};
				const match = existing.find((e) => e.name === item.name);
				if (match) {
					tx.update(templateItems).set(itemValues).where(eq(templateItems.id, match.id)).run();
					keep.push(match.id);
				} else {
					const [inserted] = tx.insert(templateItems).values(itemValues).returning().all();
					keep.push(inserted.id);
				}
			});
			tx.delete(templateItems)
				.where(and(eq(templateItems.templateId, row.id), notInArray(templateItems.id, keep)))
				.run();
		}
	});
}
