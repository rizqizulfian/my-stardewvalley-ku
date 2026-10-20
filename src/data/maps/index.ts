import { FARM_MAP } from './farm';
import type { MapDef } from './types';

export const MAPS: Record<string, MapDef> = {
  [FARM_MAP.id]: FARM_MAP,
};

export const START_MAP = FARM_MAP.id;
