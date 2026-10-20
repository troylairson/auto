export function money(cents: number | null | undefined): string {
	if (cents === null || cents === undefined) return '';
	return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export function miles(n: number | null | undefined): string {
	return n === null || n === undefined ? '—' : `${n.toLocaleString()} mi`;
}

export function interval(miles: number | null, months: number | null): string {
	const parts: string[] = [];
	if (miles) parts.push(`${miles.toLocaleString()} mi`);
	if (months) parts.push(months % 12 === 0 ? `${months / 12} yr` : `${months} mo`);
	return parts.length ? `every ${parts.join(' / ')}` : 'no interval';
}
