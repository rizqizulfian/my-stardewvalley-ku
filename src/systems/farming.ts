// Farming rules on plain state: tilling, watering, planting, harvesting and
// overnight growth. No rendering here; FarmView draws whatever this leaves.

import { CROPS, ripeStage, type CropDef } from '../data/crops';
import type { CropState, GameState, SoilState } from './GameState';

export function soilOf(s: GameState, mapId: string): Record<number, SoilState> {
  return (s.soil[mapId] ??= {});
}

export function cropDef(c: CropState): CropDef {
  return CROPS[c.id];
}

export function isRipe(c: CropState): boolean {
  return c.stage >= ripeStage(cropDef(c));
}

export function till(s: GameState, mapId: string, cell: number): boolean {
  const soil = soilOf(s, mapId);
  if (soil[cell]) return false;
  soil[cell] = { wet: false };
  return true;
}

export function water(s: GameState, mapId: string, cell: number): boolean {
  const t = soilOf(s, mapId)[cell];
  if (!t || t.wet) return false;
  t.wet = true;
  return true;
}

export function plant(s: GameState, mapId: string, cell: number, cropId: string): boolean {
  const t = soilOf(s, mapId)[cell];
  if (!t || t.crop || !CROPS[cropId]) return false;
  t.crop = { id: cropId, stage: 0, days: 0 };
  return true;
}

/** Picks a ripe crop. Returns what was harvested, or null. */
export function harvest(s: GameState, mapId: string, cell: number, rand: () => number = Math.random): { item: string; qty: number } | null {
  const t = soilOf(s, mapId)[cell];
  if (!t?.crop || !isRipe(t.crop)) return null;
  const def = cropDef(t.crop);
  const [lo, hi] = def.yield;
  const qty = lo + Math.floor(rand() * (hi - lo + 1));
  if (def.regrowDays) t.crop = { id: def.id, stage: ripeStage(def) - 1, days: 0, regrowing: true };
  else delete t.crop;
  return { item: def.produce, qty };
}

/** Days a crop must be watered in its current stage before moving on. */
function daysNeeded(c: CropState): number {
  const def = cropDef(c);
  if (c.regrowing && c.stage === ripeStage(def) - 1) return def.regrowDays ?? 1;
  return def.stageDays[c.stage] ?? Infinity;
}

/** Overnight: crops watered yesterday grow, then soil dries out (or stays wet if it rains today). */
export function advanceFarms(s: GameState, rainToday = false): void {
  for (const soil of Object.values(s.soil)) {
    for (const t of Object.values(soil)) {
      const c = t.crop;
      if (c && t.wet && !isRipe(c)) {
        c.days++;
        if (c.days >= daysNeeded(c)) {
          c.stage++;
          c.days = 0;
        }
      }
      t.wet = rainToday;
    }
  }
}
