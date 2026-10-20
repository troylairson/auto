import { isValidDate } from '$lib/dates';

/** Small helpers for reading FormData with validation errors collected in one place. */
export class FormReader {
	errors: Record<string, string> = {};
	constructor(private data: FormData) {}

	str(name: string, opts: { required?: boolean; label?: string } = {}): string | null {
		const value = String(this.data.get(name) ?? '').trim();
		if (!value) {
			if (opts.required) this.errors[name] = `${opts.label ?? name} is required.`;
			return null;
		}
		return value;
	}

	int(
		name: string,
		opts: { required?: boolean; label?: string; min?: number; max?: number } = {}
	): number | null {
		const raw = this.str(name, opts);
		if (raw === null) return null;
		const value = Number(raw.replace(/,/g, ''));
		const label = opts.label ?? name;
		if (!Number.isInteger(value)) {
			this.errors[name] = `${label} must be a whole number.`;
			return null;
		}
		if (opts.min !== undefined && value < opts.min) this.errors[name] = `${label} must be at least ${opts.min}.`;
		if (opts.max !== undefined && value > opts.max) this.errors[name] = `${label} must be at most ${opts.max}.`;
		return value;
	}

	/** Dollars ("123.45", "$1,200") → integer cents. */
	cents(name: string, label = name): number | null {
		const raw = this.str(name);
		if (raw === null) return null;
		const value = Number(raw.replace(/[$,\s]/g, ''));
		if (!Number.isFinite(value) || value < 0) {
			this.errors[name] = `${label} must be an amount like 49.99.`;
			return null;
		}
		return Math.round(value * 100);
	}

	date(name: string, opts: { required?: boolean; label?: string } = {}): string | null {
		const raw = this.str(name, opts);
		if (raw === null) return null;
		if (!isValidDate(raw)) {
			this.errors[name] = `${opts.label ?? name} must be a valid date.`;
			return null;
		}
		return raw;
	}

	bool(name: string): boolean {
		const v = this.data.get(name);
		return v === 'on' || v === 'true' || v === '1';
	}

	oneOf<T extends string>(name: string, options: readonly T[], fallback: T): T {
		const v = String(this.data.get(name) ?? '');
		return (options as readonly string[]).includes(v) ? (v as T) : fallback;
	}

	ints(name: string): number[] {
		return this.data
			.getAll(name)
			.map((v) => Number(v))
			.filter((n) => Number.isInteger(n));
	}

	get ok() {
		return Object.keys(this.errors).length === 0;
	}
}

/** Turn FormData into a plain object so a failed form can be re-filled. */
export function formValues(data: FormData): Record<string, string> {
	const out: Record<string, string> = {};
	for (const [k, v] of data) if (typeof v === 'string') out[k] = v;
	return out;
}
