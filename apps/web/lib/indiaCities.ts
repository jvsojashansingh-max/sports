export type IndiaDemoCity = {
  id: string;
  code: 'CHD' | 'DEL' | 'BOM' | 'BLR' | 'PUN';
  name: string;
  stateName: string;
  stateId: string;
  sports: readonly string[];
};

function demoUuid(seed: number): string {
  return `00000000-0000-4000-8000-${seed.toString(16).padStart(12, '0')}`;
}

export const INDIA_DEMO_CITIES: readonly IndiaDemoCity[] = [
  {
    id: demoUuid(1001),
    code: 'CHD',
    name: 'Chandigarh',
    stateName: 'Chandigarh',
    stateId: demoUuid(2001),
    sports: ['BADMINTON', 'PICKLEBALL', 'TABLE_TENNIS'],
  },
  {
    id: demoUuid(1002),
    code: 'DEL',
    name: 'Delhi',
    stateName: 'Delhi',
    stateId: demoUuid(2002),
    sports: ['BADMINTON', 'TENNIS', 'BASKETBALL'],
  },
  {
    id: demoUuid(1003),
    code: 'BOM',
    name: 'Mumbai',
    stateName: 'Maharashtra',
    stateId: demoUuid(2003),
    sports: ['BADMINTON', 'PICKLEBALL', 'BASKETBALL'],
  },
  {
    id: demoUuid(1004),
    code: 'BLR',
    name: 'Bengaluru',
    stateName: 'Karnataka',
    stateId: demoUuid(2004),
    sports: ['BADMINTON', 'TENNIS', 'TABLE_TENNIS'],
  },
  {
    id: demoUuid(1005),
    code: 'PUN',
    name: 'Pune',
    stateName: 'Maharashtra',
    stateId: demoUuid(2003),
    sports: ['BADMINTON', 'PICKLEBALL', 'TENNIS'],
  },
] as const;

export const DEFAULT_CITY_ID = INDIA_DEMO_CITIES[0].id;

const CITY_BY_ID = new Map(INDIA_DEMO_CITIES.map((city) => [city.id, city]));

export function getCityById(cityId: string | null | undefined): IndiaDemoCity | null {
  if (!cityId) {
    return null;
  }
  return CITY_BY_ID.get(cityId) ?? null;
}

export function getCityLabel(cityId: string | null | undefined): string {
  const city = getCityById(cityId);
  return city ? `${city.code} - ${city.name}` : cityId ?? 'Unknown city';
}
