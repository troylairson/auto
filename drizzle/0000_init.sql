CREATE TABLE `maintenance_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`vehicle_id` integer NOT NULL,
	`template_item_id` integer,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`interval_miles` integer,
	`interval_months` integer,
	`first_due_miles` integer,
	`first_due_months` integer,
	`minder_code` text,
	`enabled` integer DEFAULT true NOT NULL,
	`verified` integer DEFAULT false NOT NULL,
	`baseline_date` text,
	`baseline_mileage` integer,
	`never_done` integer DEFAULT false NOT NULL,
	`snoozed_until` text,
	`notes` text,
	FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`template_item_id`) REFERENCES `template_items`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `items_vehicle_idx` ON `maintenance_items` (`vehicle_id`);--> statement-breakpoint
CREATE TABLE `notification_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`vehicle_id` integer,
	`maintenance_item_id` integer,
	`kind` text NOT NULL,
	`sent_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`maintenance_item_id`) REFERENCES `maintenance_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notif_item_idx` ON `notification_log` (`maintenance_item_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `odometer_readings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`vehicle_id` integer NOT NULL,
	`reading_date` text NOT NULL,
	`mileage` integer NOT NULL,
	`oil_life_pct` integer,
	`minder_code` text,
	`source` text NOT NULL,
	`service_record_id` integer,
	`created_by` integer,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`service_record_id`) REFERENCES `service_records`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `odometer_vehicle_idx` ON `odometer_readings` (`vehicle_id`,`reading_date`);--> statement-breakpoint
CREATE TABLE `schedule_templates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`fuel_type` text,
	`maintenance_minder` integer DEFAULT false NOT NULL,
	`description` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `schedule_templates_key_unique` ON `schedule_templates` (`key`);--> statement-breakpoint
CREATE TABLE `service_record_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`service_record_id` integer NOT NULL,
	`maintenance_item_id` integer,
	`description` text,
	`cost_cents` integer,
	FOREIGN KEY (`service_record_id`) REFERENCES `service_records`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`maintenance_item_id`) REFERENCES `maintenance_items`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `service_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`vehicle_id` integer NOT NULL,
	`service_date` text NOT NULL,
	`mileage` integer NOT NULL,
	`vendor` text,
	`total_cost_cents` integer,
	`minder_code` text,
	`notes` text,
	`created_by` integer,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `records_vehicle_idx` ON `service_records` (`vehicle_id`,`service_date`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `template_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`template_id` integer NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`interval_miles` integer,
	`interval_months` integer,
	`severe_interval_miles` integer,
	`severe_interval_months` integer,
	`first_due_miles` integer,
	`first_due_months` integer,
	`minder_code` text,
	`drivetrains` text,
	`enabled_by_default` integer DEFAULT true NOT NULL,
	`notes` text,
	FOREIGN KEY (`template_id`) REFERENCES `schedule_templates`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`ntfy_topic` text,
	`notify_push` integer DEFAULT true NOT NULL,
	`calendar_token` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE TABLE `vehicles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nickname` text NOT NULL,
	`year` integer NOT NULL,
	`make` text NOT NULL,
	`model` text NOT NULL,
	`trim` text,
	`vin` text,
	`license_plate` text,
	`fuel_type` text DEFAULT 'gas' NOT NULL,
	`usage_profile` text DEFAULT 'normal' NOT NULL,
	`drivetrain` text,
	`transmission` text,
	`maintenance_minder` integer DEFAULT false NOT NULL,
	`in_service_date` text,
	`miles_per_year` integer DEFAULT 12000 NOT NULL,
	`primary_driver_id` integer,
	`archived_at` text,
	`notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`primary_driver_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
