// Places the day's forage. Runs once per day, the first time a map is shown
// after waking (and on a new game).

import { TIME } from '../config';
import { ANIMALS, animalPlace } from '../data/animals';
import { FORAGE } from '../data/forage';
import { MAPS } from '../data/maps';
import type { GameState } from './GameState';
import { WorldMap } from './WorldMap';

function pickWeighted<T>(list: Array<[T, number]>, r: number): T | null {
  const total = list.reduce((n, [, w]) => n + w, 0);
  if (total <= 0) return null;
  let x = r * total;
  for (const [v, w] of list) {
    x -= w;
    if (x < 0) return v;
  }
  return list[list.length - 1][0];
}

export function ensureForage(s: GameState, rand: () => number = Math.random): void {
  if (s.forageDay === s.daysPlayed) return;
  s.forageDay = s.daysPlayed;
  s.forage = {};
  for (const [mapId, table] of Object.entries(FORAGE)) {
    const def = MAPS[mapId];
    if (!def) continue;
    const map = new WorldMap(def, new Set(s.removed[mapId] ?? []));
    const soil = s.soil[mapId] ?? {};
    const free: Array<[number, number]> = [];
    for (let y = 1; y < map.h - 1; y++)
      for (let x = 1; x < map.w - 1; x++) {
        const i = map.index(x, y);
        if (!table.terrain.includes(map.kindAt(x, y)) || map.occupied.has(i) || soil[i] || map.canTill(x, y)) continue;
        // Keep exits and the arrival spot clear.
        if (def.warps?.some((w) => x >= w.x - 1 && x <= w.x + (w.w ?? 1) && y >= w.y - 1 && y <= w.y + (w.h ?? 1))) continue;
        free.push([x, y]);
      }
    const items = table.items.filter(([, , seasons]) => !seasons || seasons.includes(s.season)).map(([id, w]) => [id, w] as [string, number]);
    const [lo, hi] = table.count;
    const n = Math.min(free.length, lo + Math.floor(rand() * (hi - lo + 1)));
    const spots = [];
    for (let k = 0; k < n; k++) {
      const [x, y] = free.splice(Math.floor(rand() * free.length), 1)[0];
      const id = pickWeighted(items, rand());
      if (id) spots.push({ x, y, id });
    }
    s.forage[mapId] = spots;
  }
  // Hens and ducks lay one egg each somewhere in their run (in the barn on wet days).
  const maps: Record<string, WorldMap> = {};
  for (const a of ANIMALS) {
    const { map: id, area } = animalPlace(a, TIME.dayStartMinute, s.weather);
    if (!a.lays || !MAPS[id]) continue;
    const map = (maps[id] ??= new WorldMap(MAPS[id], new Set(s.removed[id] ?? [])));
    const spots = (s.forage[id] ??= []);
    for (let tries = 0; tries < 30; tries++) {
      const x = area.x0 + Math.floor(rand() * (area.x1 - area.x0 + 1));
      const y = area.y0 + Math.floor(rand() * (area.y1 - area.y0 + 1));
      if (!map.terrainAt(x, y).walkable || map.occupied.has(map.index(x, y)) || spots.some((p) => p.x === x && p.y === y)) continue;
      spots.push({ x, y, id: a.lays });
      break;
    }
  }
}
