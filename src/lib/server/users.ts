import { eq } from 'drizzle-orm';
import { db } from './db';
import { users } from './db/schema';
import { hashPassword, newNtfyTopic, randomToken, validatePassword } from './auth';
import { FormReader, formValues } from './forms';

type NewUser = { name: string; username: string; password: string };

export function readUserForm(data: FormData):
	| { ok: true; value: NewUser }
	| { ok: false; errors: Record<string, string>; values: Record<string, string> } {
	const f = new FormReader(data);
	const name = f.str('name', { required: true, label: 'Name' });
	const username = f.str('username', { required: true, label: 'Username' })?.toLowerCase() ?? null;
	const password = String(data.get('password') ?? '');
	if (username && !/^[a-z0-9._-]{2,32}$/.test(username))
		f.errors.username = 'Use 2–32 letters, numbers, dots, dashes or underscores.';
	if (username && db.select({ id: users.id }).from(users).where(eq(users.username, username)).get())
		f.errors.username = 'That username is taken.';
	const pwError = validatePassword(password);
	if (pwError) f.errors.password = pwError;
	const values = formValues(data);
	delete values.password;
	if (!f.ok) return { ok: false, errors: f.errors, values };
	return { ok: true, value: { name: name!, username: username!, password } };
}

export async function createUser({ name, username, password }: NewUser) {
	const [user] = db
		.insert(users)
		.values({
			name,
			username,
			passwordHash: await hashPassword(password),
			ntfyTopic: newNtfyTopic(username),
			calendarToken: randomToken()
		})
		.returning()
		.all();
	return user;
}
