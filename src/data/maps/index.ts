import { BEACH_MAP } from './beach';
import { FARM_MAP } from './farm';
import { HOUSE_MAP } from './house';
import { TOWN_MAP } from './town';
import type { MapDef } from './types';
import { VILLAGE_MAP } from './village';

export const MAPS: Record<string, MapDef> = Object.fromEntries([FARM_MAP, HOUSE_MAP, VILLAGE_MAP, TOWN_MAP, BEACH_MAP].map((m) => [m.id, m]));

export const START_MAP = FARM_MAP.id;
