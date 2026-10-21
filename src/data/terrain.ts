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
  /** Drawn on the dual-grid beach sand layer. */
  sand?: boolean;
  /** Drawn on the dual-grid town paving layer. */
  paved?: boolean;
  /** Open sea: animated, with a wet-sand shore instead of a grassy bank. */
  sea?: boolean;
  /** Wooden pier planks over the sea. */
  dock?: boolean;
  /** Indoor tile: floor boards, wall face or the black void around a room. */
  interior?: 'floor' | 'wall' | 'void';
}

export type TerrainKind =
  | 'grass'
  | 'high'
  | 'path'
  | 'highPath'
  | 'water'
  | 'cliff'
  | 'stairs'
  | 'sand'
  | 'paved'
  | 'sea'
  | 'dock'
  | 'floor'
  | 'wall'
  | 'void';

export const TERRAIN: Record<TerrainKind, TerrainDef> = {
  grass: { walkable: true, elevation: 0, surface: 'grass', decor: true },
  high: { walkable: true, elevation: 1, surface: 'grass', decor: true },
  path: { walkable: true, elevation: 0, surface: 'dirt', path: true },
  highPath: { walkable: true, elevation: 1, surface: 'dirt', path: true },
  water: { walkable: false, elevation: 0, surface: 'grass', water: true },
  cliff: { walkable: false, elevation: 0, surface: 'stone', cliff: true },
  stairs: { walkable: true, elevation: 0, surface: 'stone', stairs: true, cliff: true },
  sand: { walkable: true, elevation: 0, surface: 'sand', sand: true },
  paved: { walkable: true, elevation: 0, surface: 'stone', paved: true },
  sea: { walkable: false, elevation: 0, surface: 'sand', sea: true, sand: true },
  dock: { walkable: true, elevation: 0, surface: 'wood', dock: true, sea: true, sand: true },
  floor: { walkable: true, elevation: 0, surface: 'wood', interior: 'floor' },
  wall: { walkable: false, elevation: 0, surface: 'wood', interior: 'wall' },
  void: { walkable: false, elevation: 0, surface: 'wood', interior: 'void' },
};

/** Water the player can fill a can from (and later fish in). */
export function isWaterTerrain(t: TerrainDef): boolean {
  return !!t.water || (!!t.sea && !t.dock);
}

/** Default characters for terrain rows. Maps may extend this. */
export const TERRAIN_LEGEND: Record<string, TerrainKind> = {
  '.': 'grass',
  '^': 'high',
  p: 'path',
  P: 'highPath',
  w: 'water',
  '#': 'cliff',
  '=': 'stairs',
  s: 'sand',
  o: 'paved',
  '~': 'sea',
  D: 'dock',
  _: 'floor',
  W: 'wall',
  x: 'void',
};
