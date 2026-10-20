// Terrain kinds used by map terrain rows. Engine code reads behaviour from
// here (walkability, elevation, footstep surface, which autotile layer).

export type Surface = 'grass' | 'dirt' | 'sand' | 'wood' | 'stone';

export interface TerrainDef {
  walkable: boolean;
  /** 0 = ground level, 1 = plateau. Stairs connect both levels. */
  elevation: number;
  stairs?: boolean;
  surface: Surface;
  /** Drawn on the dual-grid path layer. */
  path?: boolean;
  /** Drawn on the dual-grid water layer. */
  water?: boolean;
  /** Cliff face cell (drawn on the cliff layer). */
  cliff?: boolean;
  /** Small decor (flowers, tufts) may be scattered here. */
  decor?: boolean;
}

export type TerrainKind = 'grass' | 'high' | 'path' | 'highPath' | 'water' | 'cliff' | 'stairs';

export const TERRAIN: Record<TerrainKind, TerrainDef> = {
  grass: { walkable: true, elevation: 0, surface: 'grass', decor: true },
  high: { walkable: true, elevation: 1, surface: 'grass', decor: true },
  path: { walkable: true, elevation: 0, surface: 'dirt', path: true },
  highPath: { walkable: true, elevation: 1, surface: 'dirt', path: true },
  water: { walkable: false, elevation: 0, surface: 'grass', water: true },
  cliff: { walkable: false, elevation: 0, surface: 'stone', cliff: true },
  stairs: { walkable: true, elevation: 0, surface: 'stone', stairs: true, cliff: true },
};

/** Default characters for terrain rows. Maps may extend this. */
export const TERRAIN_LEGEND: Record<string, TerrainKind> = {
  '.': 'grass',
  '^': 'high',
  p: 'path',
  P: 'highPath',
  w: 'water',
  '#': 'cliff',
  '=': 'stairs',
};
