// Terrain tilesets, all drawn procedurally (see docs/style-guide.json).
//
// Paths, water and grass patches use a dual-grid (corner-based) autotile: each
// display tile sits between four map cells and is chosen by which of those
// four corners hold the terrain. That gives 16 tiles per terrain with proper
// inner and outer corners. The field used to draw them is continuous and the
// noise is periodic per tile, so edges always meet seamlessly.
//
// Terrain has no outlines. Texture comes from small hand-placed clusters
// (blades, pebbles, ripples), never from dither or per-pixel noise.

import { RENDER } from '../config';
import { PixelGrid, hash2, valueNoise, type TextureSink } from './pixel';
import type { ColorName } from './palette';

const T = RENDER.tileSize;

export const TERRAIN_TEXTURES = {
  grass: 'tiles-grass',
  meadow: 'tiles-meadow',
  path: 'tiles-path',
  water: 'tiles-water',
  deepWater: 'tiles-deep-water',
  cliff: 'tiles-cliff',
} as const;

export const GRASS_VARIANTS = 8;
export const WATER_FRAMES = 4;
export const DUAL_TILE_COUNT = 16;
/** Extra variants of the fully-covered dual tile (mask 15) to break up repetition. */
export const FULL_VARIANTS = 4;
/** Water tiles per animation frame: 16 masks, then full variants. */
export const WATER_TILES_PER_FRAME = DUAL_TILE_COUNT + FULL_VARIANTS;
export const MEADOW_TILES = DUAL_TILE_COUNT + FULL_VARIANTS;
export const PATH_TILES = DUAL_TILE_COUNT + FULL_VARIANTS;

/** Corner bits for dual-grid masks. */
export const CORNER = { TL: 1, TR: 2, BL: 4, BR: 8 } as const;

/** Cliff tileset frame indices. */
export const CLIFF_TILE = {
  // Faces come in pairs: +0 upper half, +1 lower half.
  faceMid: 0,
  faceLeft: 2,
  faceRight: 4,
  faceSingle: 6,
  stairs: 8,
  edgeEast: 10,
  edgeWest: 11,
  edgeNorth: 12,
  shadowBelow: 13,
  /** Extra plain-face pairs, chosen at random for long cliff runs. */
  faceMidAlt: [14, 16],
} as const;

// ---------------------------------------------------------------------------
// Corner field

function cornerField(mask: number, x: number, y: number, seed: number, wobble: number): number {
  const u = (x + 0.5) / T;
  const v = (y + 0.5) / T;
  const tl = mask & CORNER.TL ? 1 : 0;
  const tr = mask & CORNER.TR ? 1 : 0;
  const bl = mask & CORNER.BL ? 1 : 0;
  const br = mask & CORNER.BR ? 1 : 0;
  const f = tl * (1 - u) * (1 - v) + tr * u * (1 - v) + bl * (1 - u) * v + br * u * v;
  // Noise period = one tile, so it lines up across neighbouring tiles.
  const n = valueNoise((x + T) / 4, (y + T) / 4, seed, T / 4) - 0.5;
  return f + n * wobble;
}

type Painter = (x: number, y: number, F: (dx: number, dy: number) => number) => ColorName | null;

function dualTile(mask: number, seed: number, wobble: number, paint: Painter): PixelGrid {
  const g = new PixelGrid(T, T);
  for (let y = 0; y < T; y++)
    for (let x = 0; x < T; x++) {
      const F = (dx: number, dy: number) => cornerField(mask, x + dx, y + dy, seed, wobble);
      const c = paint(x, y, F);
      if (c) g.set(x, y, c);
    }
  return g;
}

/** Place a small hand-drawn mark: rows of characters, '.' skipped. */
function mark(g: PixelGrid, x: number, y: number, rows: readonly string[], colors: Record<string, ColorName>, onlyOn?: readonly ColorName[]): boolean {
  for (let j = 0; j < rows.length; j++)
    for (let i = 0; i < rows[j].length; i++) {
      if (rows[j][i] === '.') continue;
      const px = x + i;
      const py = y + j;
      if (px < 0 || py < 0 || px >= g.w || py >= g.h) return false;
      if (onlyOn && !onlyOn.includes(g.colorAt(px, py) as ColorName)) return false;
    }
  for (let j = 0; j < rows.length; j++)
    for (let i = 0; i < rows[j].length; i++) {
      const ch = rows[j][i];
      if (ch !== '.') g.set(x + i, y + j, colors[ch]);
    }
  return true;
}

// ---------------------------------------------------------------------------
// Grass (per cell): base green with lighter blades, darker clumps, rare flowers.

const BLADE_MARKS: ReadonlyArray<readonly string[]> = [
  // Single blade.
  ['L', 'L'],
  // V tuft over a dark root.
  ['L.L', '.D.'],
  // Three-blade tuft.
  ['.H.', 'L.L', 'DLD'],
  // Leaning pair.
  ['L..', '.L.', '.DL'],
  // Darker clump with a lit blade.
  ['.L.', 'D.D', 'DDD'],
  // Short dash.
  ['LL'],
];

function grassTile(variant: number): PixelGrid {
  const g = new PixelGrid(T, T).fillRect(0, 0, T, T, 'grass');
  const colors: Record<string, ColorName> = { L: 'grassLight', H: 'grassHi', D: 'turf' };
  const r = (i: number) => hash2(variant, i, 77);
  const count = [1, 3, 4, 2, 5, 3, 4, 2][variant % GRASS_VARIANTS];
  for (let i = 0; i < count; i++) {
    const m = BLADE_MARKS[Math.floor(r(i * 4) * BLADE_MARKS.length)];
    const x = 1 + Math.floor(r(i * 4 + 1) * (T - 4));
    const y = 1 + Math.floor(r(i * 4 + 2) * (T - 4));
    mark(g, x, y, m, colors, ['grass']);
  }
  // Rare tiny flower.
  if (variant === 6) mark(g, 10, 4, ['.g.', 'gcg', '.D.'], { g: 'gold', c: 'cream', D: 'turf' });
  if (variant === 7) mark(g, 4, 10, ['c', 'D'], { c: 'cream', D: 'turf' });
  return g;
}

// ---------------------------------------------------------------------------
// Meadow patches: sunlit, lighter grass areas for large-scale variation.

function meadowTile(mask: number, variant = 0): PixelGrid {
  const g = dualTile(mask, 11, 0.55, (_x, _y, F) => (F(0, 0) >= 0.52 ? 'grassLight' : null));
  const colors: Record<string, ColorName> = { L: 'grassHi', D: 'grass', H: 'grassHi' };
  for (let i = 0; i < 4; i++) {
    const m = BLADE_MARKS[Math.floor(hash2(i, mask * 5 + variant, 131) * BLADE_MARKS.length)];
    const x = 1 + Math.floor(hash2(i, mask * 5 + variant, 132) * (T - 4));
    const y = 1 + Math.floor(hash2(i, mask * 5 + variant, 133) * (T - 4));
    mark(g, x, y, m, colors, ['grassLight']);
  }
  return g;
}

// ---------------------------------------------------------------------------
// Dirt path: orange-gold with pebbles and lighter speckles, organic edges.

function pathTile(mask: number, variant = 0): PixelGrid {
  const g = dualTile(mask, 23, 0.32, (_x, _y, F) => {
    const f = F(0, 0);
    if (f < 0.5) return null;
    // The grass lip shades the top of the sunken path; the far rim catches light.
    if (F(0, -1) < 0.5) return 'dirtShade';
    if (F(-1, 0) < 0.5) return 'dirtShade';
    if (F(0, 1) < 0.5 || F(1, 0) < 0.5) return 'dirtLight';
    return 'dirt';
  });
  // Grass blades leaning over the top edge.
  for (let x = 0; x < T; x++)
    for (let y = 1; y < T; y++) {
      if (g.colorAt(x, y) === 'dirtShade' && !g.filled(x, y - 1) && hash2(x, y, 300 + variant) < 0.22) {
        g.set(x, y, 'grass');
        break;
      }
    }
  const seed = mask * 13 + variant * 101;
  const colors: Record<string, ColorName> = { s: 'dirtShade', l: 'dirtLight', h: 'dirtHi', d: 'dirtDark' };
  const pebbles: ReadonlyArray<readonly string[]> = [
    ['ls', 'ss'],
    ['hl', 'sd'],
    ['.l.', 'lss', '.s.'],
    ['ls'],
  ];
  const speckles: ReadonlyArray<readonly string[]> = [['ll'], ['l.', '.l'], ['hl', 'l.'], ['l']];
  const n = mask === 15 ? 3 + (variant % 2) : 2;
  for (let i = 0; i < n; i++) {
    const isPebble = hash2(i, seed, 40) < 0.55;
    const set = isPebble ? pebbles : speckles;
    const m = set[Math.floor(hash2(i, seed, 41) * set.length)];
    const x = 1 + Math.floor(hash2(i, seed, 42) * (T - 4));
    const y = 1 + Math.floor(hash2(i, seed, 43) * (T - 4));
    mark(g, x, y, m, colors, ['dirt']);
  }
  return g;
}

// ---------------------------------------------------------------------------
// Water, 4 animation frames

function waterTile(mask: number, frame: number, variant = 0): PixelGrid {
  const seed = mask * 7 + variant * 101;
  const g = dualTile(mask, 31, 0.36, (_x, _y, F) => {
    const f = F(0, 0);
    if (f < 0.5) return null;
    // North bank: the earth face of the land drops into the water (3/4 view).
    if (F(0, -1) < 0.5) return 'grassLight';
    if (F(0, -2) < 0.5) return 'earthLight';
    if (F(0, -3) < 0.5) return 'earth';
    if (F(0, -4) < 0.5) return 'earthDark';
    if (F(0, -5) < 0.5) return 'deep';
    // A darker blue band where the water meets the bank.
    if (F(0, -7) < 0.5 || F(-2, 0) < 0.5 || F(2, 0) < 0.5 || F(0, 2) < 0.5) return 'sea';
    // Lit shore foam on the near (south) edge.
    return 'sky';
  });
  // Short ripple strokes that drift right and grow then fade over 4 frames.
  for (let i = 0; i < 3; i++) {
    if (hash2(i, seed, 50) < 0.3) continue;
    const bx = Math.floor(hash2(i, seed, 51) * 10);
    const y = 2 + Math.floor(hash2(i, seed, 52) * 12);
    const life = (frame + i * 2 + variant) % WATER_FRAMES;
    const x = 1 + ((bx + Math.floor(frame / 2)) % 10);
    const strokes: ReadonlyArray<readonly string[]> = [[], ['ff'], ['fsf'], ['f.f']];
    mark(g, x, y, strokes[life], { f: 'foam', s: 'spray' }, ['sky']);
  }
  return g;
}

/** Deep-water shading: a darker body of water away from the shore. */
function deepWaterTile(mask: number): PixelGrid {
  return dualTile(mask, 47, 0.6, (_x, _y, F) => (F(0, 0) >= 0.62 ? 'sea' : null));
}

// ---------------------------------------------------------------------------
// Cliffs (per cell): bright grass lip, earth face in strata, stones and roots.

/** Cliff faces are two cells tall: drawn as one 16x32 piece, then cut in half. */
const FACE_H = T * 2;
const LIP = 3;

/** Seamless wave across a 16px tile. */
function wave(x: number, k: number, phase: number, amp: number): number {
  return Math.round(Math.sin(((x + phase) / T) * Math.PI * 2 * k) * amp);
}

function cliffFace(left: boolean, right: boolean, variant = 0): [PixelGrid, PixelGrid] {
  const g = new PixelGrid(T, FACE_H);
  // Strata: light upper band, base middle band, dark lower band.
  for (let x = 0; x < T; x++) {
    const b1 = LIP + 8 + wave(x, 1, 3, 1);
    const b2 = LIP + 18 + wave(x, 2, 1, 1);
    for (let y = LIP; y < FACE_H; y++) {
      let c: ColorName = y < b1 ? 'earthLight' : y < b2 ? 'earth' : 'earthDark';
      if (y >= FACE_H - 2) c = 'bark';
      g.set(x, y, c);
    }
    // Shaded seam under each band edge.
    if (b1 < FACE_H) g.set(x, b1, 'earth');
    if (b2 + 1 < FACE_H) g.set(x, b2, 'earthDark');
  }
  // Short strata dashes in a darker tone, light flecks, embedded stones and
  // hanging roots, placed differently per variant.
  const r = (i: number) => hash2(i, variant, 400);
  const bands: Array<[number, number, ColorName]> = [
    [LIP + 2, LIP + 7, 'earth'],
    [LIP + 11, LIP + 17, 'earthDark'],
    [LIP + 20, LIP + 26, 'bark'],
  ];
  bands.forEach(([y0, y1, c], b) => {
    for (let k = 0; k < 2; k++) {
      const x = Math.floor(r(b * 10 + k * 3) * T);
      const y = y0 + Math.floor(r(b * 10 + k * 3 + 1) * (y1 - y0));
      const len = 2 + Math.floor(r(b * 10 + k * 3 + 2) * 3);
      for (let i = 0; i < len; i++) g.set((x + i) % T, y, c);
    }
  });
  for (let k = 0; k < 2; k++) {
    const x = Math.floor(r(40 + k) * (T - 1));
    const y = LIP + 2 + Math.floor(r(45 + k) * 5);
    g.set(x, y, 'tan').set(x + 1, y, 'tan');
  }
  const stone = (x: number, y: number, w: number) => {
    for (let k = 0; k < w; k++) g.set((x + k) % T, y, k === 0 ? 'stoneLight' : 'stone').set((x + k) % T, y + 1, k === w - 1 ? 'slate' : 'stoneDark');
  };
  for (let k = 0; k < 1 + (variant % 2) + 1; k++) stone(Math.floor(r(50 + k) * T), LIP + 8 + Math.floor(r(55 + k) * 14), 2 + Math.floor(r(60 + k) * 2));
  // Roots hanging from the lip.
  for (let k = 0; k < 2; k++) {
    if (r(70 + k) < 0.3) continue;
    const x = 1 + Math.floor(r(72 + k) * (T - 3));
    const len = 3 + Math.floor(r(74 + k) * 4);
    for (let i = 0; i < len; i++) g.set(x + (i > 2 ? 1 : 0), LIP + i, i === len - 1 ? 'umber' : 'bark');
  }
  // Grass lip: bright top edge, base below, blades dripping over the face.
  for (let x = 0; x < T; x++) {
    g.set(x, 0, hash2(x, 0, 66) < 0.3 ? 'grassHi' : 'grassLight').set(x, 1, 'grassLight').set(x, 2, 'grass');
    const hang = Math.floor(hash2(x, variant, 69) * 3);
    for (let k = 0; k < hang; k++) g.set(x, LIP + k, k === hang - 1 ? 'turf' : 'grass');
  }

  // Rounded end caps: the lit (left) end shows a light earth rim, the right end a dark one.
  const inset = (y: number) => {
    const v = (y - LIP) / (FACE_H - LIP);
    return Math.round(3 * (1 - Math.sin(Math.min(1, v * 1.4) * Math.PI * 0.5)) + 1);
  };
  for (let y = 0; y < FACE_H; y++) {
    const i = y < LIP ? 0 : inset(y);
    if (left) {
      for (let x = 0; x < i; x++) g.set(x, y, null);
      if (y >= LIP) g.set(i, y, y > FACE_H - 4 ? 'earthDark' : 'earthLight');
      else g.set(0, y, 'grassHi');
    }
    if (right) {
      for (let x = T - i; x < T; x++) g.set(x, y, null);
      if (y >= LIP) g.set(T - 1 - i, y, 'earthDark');
      else g.set(T - 1, y, 'grass');
    }
  }
  return [g.crop(0, 0, T, T), g.crop(0, T, T, T)];
}

function stairsTile(): [PixelGrid, PixelGrid] {
  const g = new PixelGrid(T, FACE_H);
  // Earth cheek walls, lit on the left and shaded on the right.
  g.fillRect(0, LIP, 3, FACE_H - LIP, 'earthLight').fillRect(T - 3, LIP, 3, FACE_H - LIP, 'earthDark');
  g.fillRect(2, LIP, 1, FACE_H - LIP, 'earth').fillRect(T - 3, LIP, 1, FACE_H - LIP, 'earth');
  // Stone steps: light tread, base riser, dark lip shadow.
  const steps = 7;
  const sh = Math.floor((FACE_H - LIP) / steps);
  for (let s = 0; s < steps; s++) {
    const y = LIP + s * sh;
    for (let x = 3; x < T - 3; x++) {
      g.set(x, y, x === 3 ? 'cream' : 'stoneLight');
      for (let k = 1; k < sh; k++) g.set(x, y + k, k === sh - 1 ? 'stoneDark' : 'stone');
    }
    g.set(T - 4, y, 'stone');
  }
  for (let y = LIP + steps * sh; y < FACE_H; y++) for (let x = 3; x < T - 3; x++) g.set(x, y, 'stoneDark');
  for (let x = 0; x < T; x++) g.set(x, 0, 'grassLight').set(x, 1, 'grassLight').set(x, 2, x < 3 || x > T - 4 ? 'grass' : 'stoneDark');
  return [g.crop(0, 0, T, T), g.crop(0, T, T, T)];
}

/** Plateau edges that drop without a cliff face: a lit or shaded grass rim. */
function edgeTile(side: 'east' | 'west' | 'north'): PixelGrid {
  const g = new PixelGrid(T, T);
  for (let i = 0; i < T; i++) {
    const jag = hash2(i, side.length, 71) < 0.35 ? 1 : 0;
    if (side === 'east') {
      g.set(T - 1, i, 'turf').set(T - 2, i, 'turf');
      if (jag) g.set(T - 3, i, 'turf');
    } else if (side === 'west') {
      g.set(0, i, 'grassHi').set(1, i, 'grassLight');
      if (jag) g.set(2, i, 'grassLight');
    } else {
      g.set(i, 0, 'grassHi').set(i, 1, 'grassLight');
      if (jag) g.set(i, 2, 'grassLight');
    }
  }
  return g;
}

/** The soft contact shadow a cliff casts on the grass below it: no dither, a ragged band. */
function shadowBelowTile(): PixelGrid {
  const g = new PixelGrid(T, T);
  for (let x = 0; x < T; x++) {
    const depth = 2 + (hash2(x >> 1, 0, 90) < 0.5 ? 1 : 0);
    for (let y = 0; y < depth; y++) g.set(x, y, 'turf');
  }
  return g;
}

// ---------------------------------------------------------------------------

export function registerTerrain(sink: TextureSink): void {
  sink.sheet(
    TERRAIN_TEXTURES.grass,
    Array.from({ length: GRASS_VARIANTS }, (_, i) => grassTile(i)),
    T,
    T,
  );
  sink.sheet(
    TERRAIN_TEXTURES.meadow,
    Array.from({ length: MEADOW_TILES }, (_, i) => (i < DUAL_TILE_COUNT ? meadowTile(i) : meadowTile(15, i))),
    T,
    T,
  );
  sink.sheet(
    TERRAIN_TEXTURES.path,
    Array.from({ length: PATH_TILES }, (_, i) => (i < DUAL_TILE_COUNT ? pathTile(i) : pathTile(15, i))),
    T,
    T,
  );
  const water: PixelGrid[] = [];
  for (let f = 0; f < WATER_FRAMES; f++) {
    for (let m = 0; m < DUAL_TILE_COUNT; m++) water.push(waterTile(m, f));
    for (let v = 0; v < FULL_VARIANTS; v++) water.push(waterTile(15, f, v + 1));
  }
  sink.sheet(TERRAIN_TEXTURES.water, water, T, T, WATER_TILES_PER_FRAME);
  sink.sheet(
    TERRAIN_TEXTURES.deepWater,
    Array.from({ length: DUAL_TILE_COUNT }, (_, m) => deepWaterTile(m)),
    T,
    T,
  );
  sink.sheet(
    TERRAIN_TEXTURES.cliff,
    [
      ...cliffFace(false, false),
      ...cliffFace(true, false),
      ...cliffFace(false, true),
      ...cliffFace(true, true),
      ...stairsTile(),
      edgeTile('east'),
      edgeTile('west'),
      edgeTile('north'),
      shadowBelowTile(),
      ...cliffFace(false, false, 1),
      ...cliffFace(false, false, 2),
    ],
    T,
    T,
  );
}
