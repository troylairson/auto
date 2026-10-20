import fs from 'node:fs';
import path from 'node:path';
import cron from 'node-cron';
import { todayLocal } from '$lib/dates';
import { dataDir, sqlite } from './db';

const KEEP = 30;

/** Write a consistent copy of the database to data/backups and prune old copies. */
export async function backupDatabase(): Promise<string> {
	const dir = path.join(dataDir, 'backups');
	fs.mkdirSync(dir, { recursive: true });
	const file = path.join(dir, `auto-${todayLocal()}.db`);
	await sqlite.backup(file);
	const old = fs
		.readdirSync(dir)
		.filter((f) => /^auto-\d{4}-\d{2}-\d{2}\.db$/.test(f))
		.sort()
		.slice(0, -KEEP);
	for (const f of old) fs.unlinkSync(path.join(dir, f));
	return file;
}

export function scheduleBackups() {
	cron.schedule(
		'30 3 * * *',
		async () => {
			try {
				console.log(`[backup] wrote ${await backupDatabase()}`);
			} catch (e) {
				console.error('[backup] failed', e);
			}
		},
		{ timezone: process.env.TZ || 'America/New_York' }
	);
}
