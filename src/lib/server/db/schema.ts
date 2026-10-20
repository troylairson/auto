import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text, index } from 'drizzle-orm/sqlite-core';

// Dates are stored as 'YYYY-MM-DD' text in the household's local time zone.
// Timestamps (created_at etc.) are ISO strings.
const createdAt = () =>
	text('created_at')
		.notNull()
		.default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`);

export const users = sqliteTable('users', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
	username: text('username').notNull().unique(),
	passwordHash: text('password_hash').notNull(),
	ntfyTopic: text('ntfy_topic'),
	notifyPush: integer('notify_push', { mode: 'boolean' }).notNull().default(true),
	calendarToken: text('calendar_token').notNull(),
	createdAt: createdAt()
});

export const sessions = sqliteTable('sessions', {
	id: text('id').primaryKey(), // sha256 of the cookie token
	userId: integer('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	expiresAt: integer('expires_at').notNull() // epoch ms
});

export const vehicles = sqliteTable('vehicles', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	nickname: text('nickname').notNull(),
	year: integer('year').notNull(),
	make: text('make').notNull(),
	model: text('model').notNull(),
	trim: text('trim'),
	vin: text('vin'),
	licensePlate: text('license_plate'),
	fuelType: text('fuel_type', { enum: ['gas', 'diesel', 'hybrid', 'ev'] })
		.notNull()
		.default('gas'),
	usageProfile: text('usage_profile', { enum: ['normal', 'severe'] })
		.notNull()
		.default('normal'),
	drivetrain: text('drivetrain', { enum: ['2wd', '4wd', 'awd'] }),
	transmission: text('transmission'),
	maintenanceMinder: integer('maintenance_minder', { mode: 'boolean' }).notNull().default(false),
	inServiceDate: text('in_service_date'),
	milesPerYear: integer('miles_per_year').notNull().default(12000),
	primaryDriverId: integer('primary_driver_id').references(() => users.id, {
		onDelete: 'set null'
	}),
	archivedAt: text('archived_at'),
	notes: text('notes'),
	createdAt: createdAt()
});

export const odometerReadings = sqliteTable(
	'odometer_readings',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		vehicleId: integer('vehicle_id')
			.notNull()
			.references(() => vehicles.id, { onDelete: 'cascade' }),
		readingDate: text('reading_date').notNull(),
		mileage: integer('mileage').notNull(),
		oilLifePct: integer('oil_life_pct'),
		minderCode: text('minder_code'),
		source: text('source', { enum: ['manual', 'service', 'initial'] }).notNull(),
		serviceRecordId: integer('service_record_id').references(() => serviceRecords.id, {
			onDelete: 'cascade'
		}),
		createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
		createdAt: createdAt()
	},
	(t) => [index('odometer_vehicle_idx').on(t.vehicleId, t.readingDate)]
);

export const scheduleTemplates = sqliteTable('schedule_templates', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	key: text('key').notNull().unique(),
	name: text('name').notNull(),
	fuelType: text('fuel_type'),
	maintenanceMinder: integer('maintenance_minder', { mode: 'boolean' }).notNull().default(false),
	description: text('description')
});

export const templateItems = sqliteTable('template_items', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	templateId: integer('template_id')
		.notNull()
		.references(() => scheduleTemplates.id, { onDelete: 'cascade' }),
	sortOrder: integer('sort_order').notNull().default(0),
	name: text('name').notNull(),
	category: text('category').notNull(),
	intervalMiles: integer('interval_miles'),
	intervalMonths: integer('interval_months'),
	severeIntervalMiles: integer('severe_interval_miles'),
	severeIntervalMonths: integer('severe_interval_months'),
	firstDueMiles: integer('first_due_miles'),
	firstDueMonths: integer('first_due_months'),
	minderCode: text('minder_code'),
	drivetrains: text('drivetrains'), // comma list, e.g. "4wd,awd"; null = all
	enabledByDefault: integer('enabled_by_default', { mode: 'boolean' }).notNull().default(true),
	notes: text('notes')
});

export const maintenanceItems = sqliteTable(
	'maintenance_items',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		vehicleId: integer('vehicle_id')
			.notNull()
			.references(() => vehicles.id, { onDelete: 'cascade' }),
		templateItemId: integer('template_item_id').references(() => templateItems.id, {
			onDelete: 'set null'
		}),
		sortOrder: integer('sort_order').notNull().default(0),
		name: text('name').notNull(),
		category: text('category').notNull(),
		intervalMiles: integer('interval_miles'),
		intervalMonths: integer('interval_months'),
		firstDueMiles: integer('first_due_miles'),
		firstDueMonths: integer('first_due_months'),
		minderCode: text('minder_code'),
		enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
		verified: integer('verified', { mode: 'boolean' }).notNull().default(false),
		baselineDate: text('baseline_date'),
		baselineMileage: integer('baseline_mileage'),
		neverDone: integer('never_done', { mode: 'boolean' }).notNull().default(false),
		snoozedUntil: text('snoozed_until'),
		notes: text('notes')
	},
	(t) => [index('items_vehicle_idx').on(t.vehicleId)]
);

export const serviceRecords = sqliteTable(
	'service_records',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		vehicleId: integer('vehicle_id')
			.notNull()
			.references(() => vehicles.id, { onDelete: 'cascade' }),
		serviceDate: text('service_date').notNull(),
		mileage: integer('mileage').notNull(),
		vendor: text('vendor'),
		totalCostCents: integer('total_cost_cents'),
		minderCode: text('minder_code'),
		notes: text('notes'),
		createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
		createdAt: createdAt()
	},
	(t) => [index('records_vehicle_idx').on(t.vehicleId, t.serviceDate)]
);

export const serviceRecordItems = sqliteTable('service_record_items', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	serviceRecordId: integer('service_record_id')
		.notNull()
		.references(() => serviceRecords.id, { onDelete: 'cascade' }),
	maintenanceItemId: integer('maintenance_item_id').references(() => maintenanceItems.id, {
		onDelete: 'set null'
	}),
	description: text('description'),
	costCents: integer('cost_cents')
});

export const notificationLog = sqliteTable(
	'notification_log',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		userId: integer('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		vehicleId: integer('vehicle_id').references(() => vehicles.id, { onDelete: 'cascade' }),
		maintenanceItemId: integer('maintenance_item_id').references(() => maintenanceItems.id, {
			onDelete: 'cascade'
		}),
		kind: text('kind', {
			enum: ['due_soon', 'due', 'overdue', 'digest', 'stale_odometer', 'test']
		}).notNull(),
		sentAt: text('sent_at').notNull()
	},
	(t) => [index('notif_item_idx').on(t.maintenanceItemId, t.userId)]
);

export type User = typeof users.$inferSelect;
export type Vehicle = typeof vehicles.$inferSelect;
export type MaintenanceItem = typeof maintenanceItems.$inferSelect;
export type ServiceRecord = typeof serviceRecords.$inferSelect;
export type OdometerReading = typeof odometerReadings.$inferSelect;
