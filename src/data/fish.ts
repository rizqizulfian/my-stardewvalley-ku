// What bites where. Pond fish live in fresh water (farm and village ponds),
// sea fish off the beach and the dock. Weights are relative chances among the
// fish that can bite right now; difficulty (0..1) narrows the catch zone and
// speeds up the marker in the reeling meter.

export type WaterKind = 'pond' | 'sea';

export interface FishDef {
  item: string;
  water: WaterKind;
  weight: number;
  difficulty: number;
  /** Seasons (0..3) it bites in; all if omitted. */
  seasons?: number[];
  /** Hours [from, to) in minutes since midnight; all day if omitted. */
  hours?: [number, number];
  /** Bites more often in the rain. */
  rain?: boolean;
}

export const FISH: FishDef[] = [
  { item: 'nila', water: 'pond', weight: 10, difficulty: 0.15 },
  { item: 'ikanMas', water: 'pond', weight: 7, difficulty: 0.3, seasons: [0, 1, 2] },
  { item: 'lele', water: 'pond', weight: 5, difficulty: 0.45, hours: [17 * 60, 26 * 60], rain: true },
  { item: 'gurame', water: 'pond', weight: 2, difficulty: 0.65, seasons: [1, 2] },
  { item: 'kakap', water: 'sea', weight: 7, difficulty: 0.35 },
  { item: 'tongkol', water: 'sea', weight: 5, difficulty: 0.55, seasons: [1, 2, 3] },
  { item: 'cumi', water: 'sea', weight: 5, difficulty: 0.4, hours: [18 * 60, 26 * 60] },
  { item: 'kerapu', water: 'sea', weight: 1.5, difficulty: 0.8, rain: true },
];

/** Junk that sometimes comes up instead of a fish. */
export const JUNK: Record<WaterKind, { item: string; chance: number }> = {
  pond: { item: 'fiber', chance: 0.08 },
  sea: { item: 'rumputLaut', chance: 0.12 },
};

export const FISHING = {
  /** Cast reaches up to this many cells ahead of the player. */
  castCells: 3,
  /** Waiting time before a bite, ms. */
  biteMinMs: 1800,
  biteMaxMs: 6500,
  /** Time to react to the bite before the fish lets go, ms. */
  hookWindowMs: 950,
  /** Hits needed to land the fish, and misses before it escapes. */
  hitsToLand: 3,
  missesToLose: 3,
  /** Meter width in px; the catch zone shrinks with difficulty between these widths. */
  meterWidth: 56,
  zoneMax: 22,
  zoneMin: 8,
  /** Marker sweep speed (px/s) at difficulty 0 and 1; each hit speeds it up a little. */
  speedMin: 45,
  speedMax: 120,
  speedPerHit: 1.18,
} as const;

/** Picks what bites, given where, when and the weather. */
export function rollFish(water: WaterKind, season: number, minute: number, raining: boolean, rand: () => number = Math.random): FishDef | { item: string; junk: true } {
  const junk = JUNK[water];
  if (rand() < junk.chance) return { item: junk.item, junk: true };
  const pool = FISH.filter(
    (f) => f.water === water && (!f.seasons || f.seasons.includes(season)) && (!f.hours || (minute >= f.hours[0] && minute < f.hours[1])),
  );
  const weights = pool.map((f) => f.weight * (raining && f.rain ? 2.5 : 1));
  let r = rand() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[0] ?? { item: junk.item, junk: true };
}
