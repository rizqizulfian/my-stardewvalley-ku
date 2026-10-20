// Terrain tilesets, all drawn procedurally.
//
// Paths, water and grass patches use a dual-grid (corner-based) autotile: each
// display tile sits between four map cells and is chosen by which of those
// four corners hold the terrain. That gives 16 tiles per terrain with proper
// inner and outer corners. The field used to draw them is continuous and the
// noise is periodic per tile, so edges always meet seamlessly.

import { RENDER } from '../config';
import { PixelGrid, ditherPick, hash2, valueNoise, shade, outline, type TextureSink } from './pixel';
import { RAMPS, type ColorName } from './palette';

const T = RENDER.tileSize;

export const TERRAIN_TEXTURES = {
  grass: 'tiles-grass',
  meadow: 'tiles-meadow',
  path: 'tiles-path',
  water: 'tiles-water',
  deepWater: 'tiles-deep-water',
  cliff: 'tiles-cliff',
} as const;

export const GRASS_VARIANTS = 6;
export const WATER_FRAMES = 4;
export const DUAL_TILE_COUNT = 16;
/** Extra variants of the fully-covered dual tile (mask 15) to break up repetition. */
export const FULL_VARIANTS = 4;
/** Water tiles per animation frame: 16 masks, then full variants. */
export const WATER_TILES_PER_FRAME = DUAL_TILE_COUNT + FULL_VARIANTS;
export const MEADOW_TILES = DUAL_TILE_COUNT + FULL_VARIANTS;

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

// ---------------------------------------------------------------------------
// Grass (per cell)

function grassTile(variant: number): PixelGrid {
  const g = new PixelGrid(T, T).fillRect(0, 0, T, T, 'grass');
  const r = (i: number) => hash2(variant, i, 77);
  const marks = [5, 3, 6, 2, 4, 7][variant % 6];
  for (let i = 0; i < marks; i++) {
    const x = 2 + Math.floor(r(i * 3) * (T - 5));
    const y = 3 + Math.floor(r(i * 3 + 1) * (T - 5));
    const kind = r(i * 3 + 2);
    if (kind < 0.55) {
      // Small tuft: dark base, lit tip toward the top-left.
      g.set(x, y, 'leaf').set(x + 1, y, 'leaf').set(x, y - 1, 'lime');
      if (kind < 0.25) g.set(x + 1, y - 1, 'grass').set(x + 2, y, 'leaf');
    } else {
      // Small V tuft.
      g.set(x, y, 'leaf').set(x - 1, y - 1, 'leaf').set(x + 1, y - 1, 'leaf').set(x - 1, y - 2, 'lime').set(x + 1, y - 2, 'lime');
    }
  }
  if (variant === 5) {
    // Tiny pebble.
    g.set(9, 9, 'haze').set(10, 9, 'mauve').set(9, 10, 'mauve').set(10, 10, 'plum');
  }
  return g;
}

// ---------------------------------------------------------------------------
// Meadow patches: darker dithered grass areas for large-scale variation.

function meadowTile(mask: number, variant = 0): PixelGrid {
  const g = dualTile(mask, 11, 0.5, (_x, _y, F) => {
    const f = F(0, 0);
    if (f < 0.5) return null;
        // Solid darker grass; the dual-grid wobble already gives an organic edge.
    if (f >= 0.56) return 'leaf';
    return null;
  });
  // Blade marks so the patches read as taller grass, not flat paint.
  for (let i = 0; i < 7; i++) {
    const x = 1 + Math.floor(hash2(i, mask * 5 + variant, 131) * (T - 3));
    const y = 2 + Math.floor(hash2(i, mask * 5 + variant, 132) * (T - 3));
    if (g.colorAt(x, y) === 'leaf' && g.colorAt(x + 1, y) === 'leaf' && g.colorAt(x, y - 1) === 'leaf') {
      g.set(x, y, 'moss').set(x, y - 1, 'grass');
      if (hash2(i, variant, 133) < 0.5) g.set(x + 1, y - 1, 'lime');
    }
  }
  return g;
}

// ---------------------------------------------------------------------------
// Dirt path

function pathTile(mask: number): PixelGrid {
  const g = dualTile(mask, 23, 0.12, (_x, _y, F) => {
    const f = F(0, 0);
    if (f >= 0.5) {
      // Sunken dirt: the grass lip shades the top, the far rim catches light.
      if (F(0, -1) < 0.5) return 'umber';
      if (F(0, -2) < 0.5) return 'clay';
      if (F(-1, 0) < 0.5) return 'clay';
      if (F(0, 1) < 0.5 || F(1, 0) < 0.5) return 'sand';
      // Clean sandy dirt; pebbles are added below.
      return 'tan';
    }
    // Grass side of the edge: overhanging blades above the dirt, dark ring elsewhere.
    // Grass side of the edge: a clean darker ring.
    if (f >= 0.45) return 'leaf';
    return null;
  });
  // Pebbles: lit top-left pixel, shadow under-right, only on open dirt.
  for (let i = 0; i < 4; i++) {
    const x = 2 + Math.floor(hash2(mask, i, 41) * (T - 5));
    const y = 3 + Math.floor(hash2(mask, i, 42) * (T - 6));
    if (g.colorAt(x, y) && g.colorAt(x + 1, y + 1) && g.colorAt(x, y - 2) !== 'leaf' && g.colorAt(x, y) !== 'leaf') {
      const c = g.colorAt(x, y)!;
      if (c === 'clay' || c === 'tan') g.set(x, y, 'sand').set(x + 1, y, 'tan').set(x, y + 1, 'umber').set(x + 1, y + 1, 'umber');
    }
  }
  return g;
}

// ---------------------------------------------------------------------------
// Water, 4 animation frames

function waterTile(mask: number, frame: number, variant = 0): PixelGrid {
  const phase = (frame / WATER_FRAMES) * Math.PI * 2;
  const foamBand = 0.07 + 0.035 * Math.sin(phase);
  const seed = mask * 7 + variant * 101;
  const g = dualTile(mask, 31, 0.36, (_x, _y, F) => {
    const f = F(0, 0);
    if (f >= 0.5) {
      // North bank: earth wall dropping into the water.
      if (F(0, -1) < 0.5) return 'clay';
      if (F(0, -2) < 0.5) return 'umber';
      if (F(0, -3) < 0.5) return 'bark';
      if (F(0, -4) < 0.5 || F(0, -5) < 0.5) return 'sea';
      if (f < 0.5 + foamBand) return 'foam';
      return 'sky';
    }
    // Wet, darker grass on the land side.
    if (f >= 0.45) return 'moss';
    return null;
  });
  // A couple of ripples per tile that drift right and fade over the 4 frames.
  const ripples = 2;
  for (let i = 0; i < ripples; i++) {
    if (hash2(i, seed, 50) < 0.35) continue;
    const bx = Math.floor(hash2(i, seed, 51) * 9);
    const y = 4 + Math.floor(hash2(i, seed, 52) * 9);
    const life = (frame + i * 2 + variant) % WATER_FRAMES;
    const x = 2 + ((bx + frame) % 9);
    const len = life === 0 ? 0 : life === 2 ? 3 : 2;
    for (let k = 0; k < len; k++) {
      const c = g.colorAt(x + k, y);
      if (c === 'sky') g.set(x + k, y, k === 1 && life === 2 ? 'cream' : 'foam');
    }
  }
  return g;
}

/** Deep-water shading: a soft dithered overlay on cells far from the shore. */
function deepWaterTile(mask: number): PixelGrid {
  return dualTile(mask, 47, 0.6, (x, y, F) => {
    const f = F(0, 0);
    if (f < 0.5) return null;
    // Solid darker water with a soft, clumpy edge.
    const t = Math.min(1, (f - 0.5) / 0.3);
    const n = valueNoise((x + T) / 3, (y + T) / 3, 29, T / 3);
    return t > 0.6 || n < t ? 'sea' : null;
  });
}

// ---------------------------------------------------------------------------
// Cliffs (per cell)

/** Cliff faces are two cells tall: drawn as one 16x32 piece, then cut in half. */
const FACE_H = T * 2;

function cliffFace(left: boolean, right: boolean): [PixelGrid, PixelGrid] {
  const g = new PixelGrid(T, FACE_H);
  const lip = 3;
  // Carve rounded ends.
  const inShape = (px: number, py: number) => {
    const v = (py - lip) / (FACE_H - lip);
    const inset = Math.round(3 * (1 - Math.sin(Math.min(1, v * 1.4) * Math.PI * 0.5)) + 1);
    if (left && px < inset) return false;
    if (right && px > T - 1 - inset) return false;
    return py >= 0;
  };
  // Stones in staggered courses. Each stone is drawn three times (x-16, x, x+16)
  // so the mid tile wraps seamlessly when repeated side by side.
  const courses = [
    { y: lip, h: 9 },
    { y: lip + 9, h: 8 },
    { y: lip + 17, h: 7 },
    { y: lip + 24, h: 5 },
  ];
  courses.forEach((c, ci) => {
    let x = ci % 2 === 0 ? -3 : 2;
    let si = 0;
    while (x < T) {
      const w = 5 + Math.floor(hash2(ci, si, 61) * 4);
      const mask = new PixelGrid(T, FACE_H);
      for (const ox of [-T, 0, T]) {
        mask.fillRect(x + ox + 1, c.y, w - 2, c.h - 1, 'ink');
        mask.fillRect(x + ox, c.y + 1, w, c.h - 3, 'ink');
      }
      const bias = 0.08 - ci * 0.06 + (hash2(ci, si, 62) - 0.5) * 0.15;
      g.stamp(shade(mask, RAMPS.stone.slice(0, 4), { rim: 0.32, gradient: 0.5, bias, dither: 0.25, noise: 0.05, seed: ci * 10 + si }));
      x += w;
      si++;
    }
  });
  // Mortar shadows fill the gaps.
  for (let py = lip; py < FACE_H; py++)
    for (let px = 0; px < T; px++) if (!g.filled(px, py)) g.set(px, py, py > FACE_H - 8 ? 'ink' : 'night');
  // Moss and hanging vines.
  for (let px = 0; px < T; px++) {
    const vine = hash2(px, 3, 70);
    if (vine < 0.22) {
      const len = 4 + Math.floor(hash2(px, 4, 71) * 10);
      for (let k = 0; k < len; k++) g.set(px, lip + k, k === len - 1 ? 'grass' : k % 3 === 2 ? 'leaf' : 'moss');
    }
  }
  // Grass lip overhang.
  for (let px = 0; px < T; px++) {
    g.set(px, 0, 'grass').set(px, 1, hash2(px, 1, 68) < 0.35 ? 'lime' : 'grass').set(px, 2, 'leaf');
    const hang = Math.floor(hash2(px, 0, 69) * 3);
    for (let k = 0; k < hang; k++) g.set(px, lip + k, k === hang - 1 ? 'pine' : 'leaf');
  }
  // Damp contact line at the base.
  for (let px = 0; px < T; px++) g.set(px, FACE_H - 1, 'ink');
  // Carve the end caps and outline them with a darker stone shade.
  for (let py = 0; py < FACE_H; py++) for (let px = 0; px < T; px++) if (!inShape(px, py)) g.set(px, py, null);
  if (left || right) {
    const o = outline(g, { steps: 1 });
    for (let py = 0; py < FACE_H; py++)
      for (let px = 0; px < T; px++) if (!g.filled(px, py) && o.filled(px, py)) g.set(px, py, py < lip ? 'moss' : 'night');
  }
  return [g.crop(0, 0, T, T), g.crop(0, T, T, T)];
}

function stairsTile(): [PixelGrid, PixelGrid] {
  const g = new PixelGrid(T, FACE_H);
  // Stone cheek walls.
  g.stamp(shade(new PixelGrid(T, FACE_H).fillRect(0, 2, 3, FACE_H - 2, 'ink'), RAMPS.stone.slice(0, 4), { rim: 0.3, dither: 0.5 }));
  g.stamp(shade(new PixelGrid(T, FACE_H).fillRect(T - 3, 2, 3, FACE_H - 2, 'ink'), RAMPS.stone.slice(0, 4), { rim: 0.3, bias: -0.15, dither: 0.5 }));
  // Steps: lit tread, darker riser, chipped edges.
  const steps = 7;
  const sh = Math.floor((FACE_H - 3) / steps);
  for (let s = 0; s < steps; s++) {
    const y = 3 + s * sh;
    for (let px = 3; px < T - 3; px++) {
      g.set(px, y, px < 6 ? 'mist' : hash2(px, s, 5) < 0.15 ? 'mauve' : 'haze');
      for (let k = 1; k < sh; k++) g.set(px, y + k, k === sh - 1 ? 'plum' : 'mauve');
    }
  }
  for (let px = 0; px < T; px++) g.set(px, 0, 'grass').set(px, 1, 'leaf').set(px, 2, px < 3 || px > T - 4 ? 'moss' : 'plum');
  for (let py = 3 + steps * sh; py < FACE_H; py++) for (let px = 3; px < T - 3; px++) g.set(px, py, 'plum');
  return [g.crop(0, 0, T, T), g.crop(0, T, T, T)];
}

function edgeTile(side: 'east' | 'west' | 'north'): PixelGrid {
  const g = new PixelGrid(T, T);
  for (let i = 0; i < T; i++) {
    const jag = hash2(i, side.length, 71) < 0.35 ? 1 : 0;
    if (side === 'east') {
      g.set(T - 1, i, 'moss').set(T - 2, i, 'leaf');
      if (jag) g.set(T - 3, i, 'leaf');
    } else if (side === 'west') {
      g.set(0, i, 'leaf').set(1, i, 'lime');
      if (jag) g.set(2, i, 'lime');
    } else {
      g.set(i, 0, 'leaf').set(i, 1, 'lime');
      if (jag) g.set(i, 2, 'lime');
    }
  }
  return g;
}

function shadowBelowTile(): PixelGrid {
  const g = new PixelGrid(T, T);
  for (let x = 0; x < T; x++) {
    g.set(x, 0, 'moss');
    if (ditherPick(x, 1, 0.75)) g.set(x, 1, 'moss');
    if (ditherPick(x, 2, 0.4)) g.set(x, 2, 'leaf');
    if (ditherPick(x, 3, 0.15)) g.set(x, 3, 'leaf');
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
    Array.from({ length: DUAL_TILE_COUNT }, (_, m) => pathTile(m)),
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
    ],
    T,
    T,
  );
}
