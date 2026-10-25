import { BEACH_MAP } from './beach';
import { DOG_ROOM_MAP } from './dogroom';
import { FARM_MAP } from './farm';
import { HOUSE_MAP } from './house';
import { KANDANG_MAP } from './kandang';
import { DISKO_MAP } from './disko';
import { MUSEUM_MAP } from './museum';
import { PARK_MAP } from './park';
import { TOWN_MAP } from './town';
import type { MapDef } from './types';
import { VILLAGE_MAP } from './village';

export const MAPS: Record<string, MapDef> = Object.fromEntries([FARM_MAP, HOUSE_MAP, VILLAGE_MAP, TOWN_MAP, BEACH_MAP, PARK_MAP, MUSEUM_MAP, DOG_ROOM_MAP, KANDANG_MAP, DISKO_MAP].map((m) => [m.id, m]));

export const START_MAP = FARM_MAP.id;
