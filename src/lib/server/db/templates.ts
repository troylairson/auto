// Seed maintenance schedules. Intervals are starting points: every item starts as
// "not verified" on a vehicle until it has been checked against the owner's manual.

export type SeedItem = {
	name: string;
	category: string;
	miles?: number;
	months?: number;
	severeMiles?: number;
	severeMonths?: number;
	firstMiles?: number;
	firstMonths?: number;
	minder?: string;
	drivetrains?: string; // e.g. "4wd,awd"; omitted = applies to all
	disabled?: boolean;
	notes?: string;
};

export type SeedTemplate = {
	key: string;
	name: string;
	fuelType: 'gas' | 'diesel' | 'hybrid' | 'ev' | null;
	minder?: boolean;
	description: string;
	items: SeedItem[];
};

const common = {
	tireCheck: { name: 'Tire pressure & tread check', category: 'Tires', months: 1 },
	wipers: { name: 'Wiper blades', category: 'Body', months: 12 },
	battery: { name: 'Battery test', category: 'Electrical', months: 12 },
	brakeFluid: { name: 'Brake fluid', category: 'Brakes', months: 36, severeMonths: 24 }
} satisfies Record<string, SeedItem>;

const genericGas: SeedItem[] = [
	{ name: 'Engine oil & filter', category: 'Engine', miles: 7500, months: 12, severeMiles: 5000, severeMonths: 6 },
	{ name: 'Tire rotation', category: 'Tires', miles: 7500, severeMiles: 5000 },
	common.tireCheck,
	{ name: 'Engine air filter', category: 'Engine', miles: 30000, months: 36, severeMiles: 15000, severeMonths: 18 },
	{ name: 'Cabin air filter', category: 'Interior', miles: 15000, months: 12, severeMiles: 10000 },
	{ name: 'Brake inspection', category: 'Brakes', miles: 15000, months: 12, severeMiles: 10000 },
	common.brakeFluid,
	common.wipers,
	common.battery,
	{ name: 'Engine coolant', category: 'Cooling', miles: 50000, months: 60, firstMiles: 100000, firstMonths: 120 },
	{ name: 'Spark plugs', category: 'Engine', miles: 100000, severeMiles: 60000 },
	{ name: 'Transmission fluid', category: 'Drivetrain', miles: 60000, severeMiles: 30000 },
	{ name: 'Drive belt inspection', category: 'Engine', miles: 60000, months: 60 },
	{ name: 'Timing belt', category: 'Engine', miles: 90000, months: 84, severeMiles: 60000, severeMonths: 60, disabled: true, notes: 'Only if the engine has a timing belt.' }
];

export const templates: SeedTemplate[] = [
	{
		key: 'generic-gas',
		name: 'Generic gasoline',
		fuelType: 'gas',
		description: 'Common intervals for a modern gasoline vehicle.',
		items: genericGas
	},
	{
		key: 'generic-diesel',
		name: 'Generic diesel',
		fuelType: 'diesel',
		description: 'Gasoline schedule with diesel-specific items.',
		items: [
			...genericGas
				.filter((i) => !['Spark plugs', 'Timing belt'].includes(i.name))
				.map((i) => (i.name === 'Engine oil & filter' ? { ...i, miles: 5000, months: 6 } : i)),
			{ name: 'Fuel filter', category: 'Fuel', miles: 15000, months: 12 },
			{ name: 'DEF top-up', category: 'Fuel', miles: 5000 }
		]
	},
	{
		key: 'generic-hybrid',
		name: 'Generic hybrid',
		fuelType: 'hybrid',
		description: 'Gasoline schedule plus hybrid battery cooling.',
		items: [
			...genericGas,
			{ name: 'Hybrid battery cooling filter', category: 'Hybrid', miles: 30000, months: 24 }
		]
	},
	{
		key: 'generic-ev',
		name: 'Generic EV',
		fuelType: 'ev',
		description: 'No engine items; tires, brakes, cabin filter and battery coolant.',
		items: [
			{ name: 'Tire rotation', category: 'Tires', miles: 7500 },
			common.tireCheck,
			{ name: 'Cabin air filter', category: 'Interior', miles: 15000, months: 24 },
			{ name: 'Brake inspection', category: 'Brakes', miles: 15000, months: 12 },
			common.brakeFluid,
			{ name: 'Battery coolant', category: 'Cooling', miles: 150000, months: 120 },
			common.wipers,
			{ name: '12V battery test', category: 'Electrical', months: 12 }
		]
	},
	{
		key: 'honda-pilot-2021',
		name: '2021 Honda Pilot (3.5L V6, Maintenance Minder)',
		fuelType: 'gas',
		minder: true,
		description:
			'Follows the Maintenance Minder. Intervals are fallback estimates used when no oil life % or Minder code has been entered.',
		items: [
			{ name: 'Engine oil', category: 'Engine', minder: 'A', miles: 7500, months: 12, notes: 'Minder A. Honda: change at least once a year regardless of oil life.' },
			{ name: 'Oil filter + inspection', category: 'Engine', minder: 'B', miles: 15000, months: 12, notes: 'Minder B: oil filter, brakes, parking brake, steering/suspension, boots, hoses, fluid levels, exhaust.' },
			{ name: 'Tire rotation', category: 'Tires', minder: '1', miles: 7500 },
			{ name: 'Engine & cabin air filters, drive belt inspection', category: 'Engine', minder: '2', miles: 15000, months: 12, notes: 'Minder 2. Engine filter often lasts ~30k; cabin ~15k / yearly.' },
			{ name: 'Transmission fluid (9-speed)', category: 'Drivetrain', minder: '3', miles: 30000, notes: 'Minder 3. 9-speed uses Honda ATF Type 3.2 (verify in manual).' },
			{ name: 'Spark plugs, timing belt & water pump inspection, valve clearance', category: 'Engine', minder: '4', miles: 100000, months: 120, notes: 'Minder 4. Belt, tensioner and water pump are usually replaced together. Verify belt vs chain for this engine.' },
			{ name: 'Engine coolant', category: 'Cooling', minder: '5', miles: 60000, months: 60, firstMiles: 120000, firstMonths: 120 },
			{ name: 'Rear differential fluid', category: 'Drivetrain', minder: '6', miles: 30000, drivetrains: 'awd', notes: 'Minder 6, AWD only. See Honda service bulletin for 2016–22 Pilot rear differential.' },
			{ name: 'Brake fluid', category: 'Brakes', minder: '7', months: 36 },
			common.tireCheck,
			common.wipers,
			common.battery
		]
	},
	{
		key: 'toyota-tacoma-2011-v6',
		name: '2011 Toyota Tacoma (4.0L V6)',
		fuelType: 'gas',
		description:
			'Toyota fixed schedule with concrete replace intervals for "inspect" items and age-related checks. 4.0L V6 has a timing chain.',
		items: [
			{ name: 'Engine oil & filter', category: 'Engine', miles: 5000, months: 6, notes: 'New drain plug gasket each time.' },
			{ name: 'Tire rotation', category: 'Tires', miles: 5000, notes: 'Do with each oil change.' },
			common.tireCheck,
			{ name: 'Multi-point inspection', category: 'Inspection', miles: 15000, months: 12, notes: 'Brakes, ball joints, steering linkage, boots, exhaust.' },
			{ name: 'Cabin air filter', category: 'Interior', miles: 15000, months: 12 },
			{ name: 'Engine air filter', category: 'Engine', miles: 30000, months: 36 },
			{ name: 'Rear differential oil', category: 'Drivetrain', miles: 30000, severeMiles: 15000, notes: 'Toyota lists "inspect"; replace every 15k if towing.' },
			{ name: 'Front differential oil', category: 'Drivetrain', miles: 30000, severeMiles: 15000, drivetrains: '4wd' },
			{ name: 'Transfer case oil', category: 'Drivetrain', miles: 30000, severeMiles: 15000, drivetrains: '4wd' },
			{ name: 'Propeller shaft grease', category: 'Drivetrain', miles: 5000, drivetrains: '4wd', disabled: true, notes: 'Toyota calls for this when towing / off-road.' },
			{ name: 'Transmission fluid', category: 'Drivetrain', miles: 60000, severeMiles: 30000, notes: 'Automatic: Toyota WS, drain-and-fill. Manual: gear oil.' },
			common.brakeFluid,
			{ name: 'Engine coolant (Toyota SLLC)', category: 'Cooling', miles: 50000, months: 60, firstMiles: 100000, firstMonths: 120 },
			{ name: 'Spark plugs', category: 'Engine', miles: 120000 },
			{ name: 'Drive belt inspection', category: 'Engine', miles: 60000, months: 60 },
			{ name: 'Frame & underbody corrosion inspection', category: 'Inspection', months: 12, notes: 'This truck generation is known for frame rust.' },
			{ name: 'Battery, hoses & shocks inspection', category: 'Inspection', months: 12 },
			common.wipers
		]
	}
];
