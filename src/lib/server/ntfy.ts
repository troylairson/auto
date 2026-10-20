export type PushMessage = {
	title: string;
	message: string;
	click?: string;
	tags?: string[];
	priority?: 1 | 2 | 3 | 4 | 5;
};

export function appUrl(path: string): string | undefined {
	const base = process.env.ORIGIN ?? process.env.PUBLIC_URL;
	return base ? new URL(path, base).toString() : undefined;
}

/** Publish to ntfy using the JSON API (avoids non-ASCII header problems). */
export async function sendPush(topic: string, msg: PushMessage): Promise<void> {
	const server = process.env.NTFY_URL ?? 'https://ntfy.sh';
	const headers: Record<string, string> = { 'Content-Type': 'application/json' };
	if (process.env.NTFY_TOKEN) headers.Authorization = `Bearer ${process.env.NTFY_TOKEN}`;
	const res = await fetch(server, {
		method: 'POST',
		headers,
		body: JSON.stringify({ topic, ...msg })
	});
	if (!res.ok) throw new Error(`ntfy responded ${res.status}: ${await res.text()}`);
}
