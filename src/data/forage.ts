// Wild things that turn up each morning: shells on the beach, mushrooms and
// fern shoots in the grass. Spawned overnight (see systems/forage.ts).

import type { TerrainKind } from './terrain';

export interface ForageTable {
  /** How many spots per day, inclusive. */
  count: [number, number];
  /** Terrain they can appear on. */
  terrain: TerrainKind[];
  /** [item id, weight, seasons it appears in (all when left out)]. */
  items: Array<[string, number, number[]?]>;
}

export const FORAGE: Record<string, ForageTable> = {
  beach: {
    count: [3, 5],
    terrain: ['sand'],
    items: [
      ['kerang', 5],
      ['bintangLaut', 3],
      ['rumputLaut', 2],
      ['mutiara', 0.25],
    ],
  },
  village: {
    count: [2, 4],
    terrain: ['grass'],
    items: [
      ['jamur', 3, [0, 2, 3]],
      ['pakis', 3, [0, 1, 2]],
    ],
  },
  farm: {
    count: [1, 2],
    terrain: ['grass', 'high'],
    items: [
      ['jamur', 2, [0, 2, 3]],
      ['pakis', 2, [0, 1, 2]],
    ],
  },
};
