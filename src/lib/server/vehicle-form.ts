import { FormReader, formValues } from './forms';
import type { VehicleInput } from './vehicles';

const FUEL = ['gas', 'diesel', 'hybrid', 'ev'] as const;
const USAGE = ['normal', 'severe'] as const;
const DRIVE = ['', '2wd', '4wd', 'awd'] as const;

export function readVehicleForm(data: FormData) {
	const f = new FormReader(data);
	const thisYear = new Date().getFullYear();
	const drivetrain = f.oneOf('drivetrain', DRIVE, '');
	const value: VehicleInput = {
		nickname: f.str('nickname', { required: true, label: 'Nickname' }) ?? '',
		year: f.int('year', { required: true, label: 'Year', min: 1950, max: thisYear + 1 }) ?? 0,
		make: f.str('make', { required: true, label: 'Make' }) ?? '',
		model: f.str('model', { required: true, label: 'Model' }) ?? '',
		trim: f.str('trim'),
		vin: f.str('vin')?.toUpperCase() ?? null,
		licensePlate: f.str('licensePlate')?.toUpperCase() ?? null,
		fuelType: f.oneOf('fuelType', FUEL, 'gas'),
		usageProfile: f.oneOf('usageProfile', USAGE, 'normal'),
		drivetrain: drivetrain === '' ? null : drivetrain,
		transmission: f.str('transmission'),
		inServiceDate: f.date('inServiceDate', { label: 'In-service date' }),
		milesPerYear: f.int('milesPerYear', { label: 'Miles per year', min: 0, max: 100000 }) ?? 12000,
		primaryDriverId: f.int('primaryDriverId'),
		notes: f.str('notes')
	};
	return { f, value, values: formValues(data) };
}
