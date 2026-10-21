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
  sand: 'tiles-sand',
  paved: 'tiles-paved',
  sea: 'tiles-sea',
  interior: 'tiles-interior',
  dock: 'tiles-dock',
} as const;

/** Interior tileset frames (per cell). */
export const INTERIOR_TILE = {
  floor: 0,
  floorVariants: 3,
  floorShadowTop: 3,
  floorShadowLeft: 4,
  floorShadowRight: 5,
  wallUpper: 6,
  wallLower: 7,
  wallTop: 8,
  void: 9,
  /** Tiles per colourway (see INTERIOR_STYLES). */
  altOffset: 10,
} as const;

/** Dock tile index = sum of the open sides: left edge 1, right edge 2, front end 4. */
export const DOCK_TILE = { left: 1, right: 2, end: 4, count: 8 } as const;

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
// Beach sand, town paving and the sea (dual grid)

function speckle(g: PixelGrid, seed: number, n: number, on: ColorName, colors: ColorName[]): void {
  for (let i = 0; i < n; i++) {
    const x = Math.floor(hash2(seed, i, 61) * T);
    const y = Math.floor(hash2(seed, i, 62) * T);
    if (g.colorAt(x, y) === on) g.set(x, y, colors[i % colors.length]);
  }
}

function sandTile(mask: number, variant = 0): PixelGrid {
  const g = dualTile(mask, 53, 0.3, (_x, _y, F) => {
    const f = F(0, 0);
    if (f >= 0.5) {
      // A soft lip where grass gives way to sand.
      if (F(0, -1) < 0.5 || F(-1, 0) < 0.5) return 'tan';
      return 'sand';
    }
    if (f >= 0.44) return 'leaf';
    return null;
  });
  // Wind ripples and grains.
  for (let i = 0; i < 2; i++) {
    const x = 2 + Math.floor(hash2(mask + variant * 17, i, 63) * 9);
    const y = 3 + Math.floor(hash2(mask + variant * 17, i, 64) * 10);
    for (let k = 0; k < 4; k++) if (g.colorAt(x + k, y + (k === 0 || k === 3 ? 0 : -1)) === 'sand') g.set(x + k, y + (k === 0 || k === 3 ? 0 : -1), 'tan');
  }
  speckle(g, mask * 3 + variant * 29, 7, 'sand', ['cream', 'tan', 'cream']);
  return g;
}

function pavedTile(mask: number): PixelGrid {
  return dualTile(mask, 71, 0.1, (x, y, F) => {
    const f = F(0, 0);
    if (f >= 0.5) {
      // Kerb: dark where paving meets grass below or to the right, light on the far side.
      if (F(0, 1) < 0.5 || F(1, 0) < 0.5) return 'plum';
      if (F(0, -1) < 0.5 || F(-1, 0) < 0.5) return 'haze';
      // Pavers in a running bond, 8x8 with a 1px joint.
      const row = Math.floor(y / 8);
      const px = (x + (row % 2) * 4) % 8;
      const py = y % 8;
      if (px === 0 || py === 0) return 'mauve';
      if (px === 7 || py === 7) return 'haze';
      if (px === 1 && py === 1) return 'cream';
      // A few warmer stones for variety.
      const stone = hash2(Math.floor((x + (row % 2) * 4) / 8) + mask * 3, row, 73);
      return stone < 0.18 ? 'sand' : 'mist';
    }
    if (f >= 0.45) return 'leaf';
    return null;
  });
}

function seaTile(mask: number, frame: number, variant = 0): PixelGrid {
  const phase = (frame / WATER_FRAMES) * Math.PI * 2;
  // The shore line breathes in and out with the waves.
  const lap = 0.06 + 0.05 * Math.sin(phase);
  const seed = mask * 7 + variant * 101;
  const g = dualTile(mask, 31, 0.3, (_x, _y, F) => {
    const f = F(0, 0);
    if (f >= 0.5 + lap) {
      if (f < 0.58 + lap) return 'foam';
      if (f < 0.64 + lap) return 'cream';
      return 'sky';
    }
    if (f >= 0.5) return 'foam';
    // Wet sand darkens toward the water.
    if (f >= 0.4) return 'tan';
    return null;
  });
  for (let i = 0; i < 2; i++) {
    if (hash2(i, seed, 50) < 0.35) continue;
    const bx = Math.floor(hash2(i, seed, 51) * 9);
    const y = 4 + Math.floor(hash2(i, seed, 52) * 9);
    const life = (frame + i * 2 + variant) % WATER_FRAMES;
    const x = 2 + ((bx + frame) % 9);
    const len = life === 0 ? 0 : life === 2 ? 3 : 2;
    for (let k = 0; k < len; k++) if (g.colorAt(x + k, y) === 'sky') g.set(x + k, y, k === 1 && life === 2 ? 'cream' : 'foam');
  }
  return g;
}

// ---------------------------------------------------------------------------
// Interiors (per cell)

type FloorStyle = 'wood' | 'paper' | 'marble';

function floorTile(variant: number, shadow: 'none' | 'top' | 'left' | 'right', style: FloorStyle = 'wood'): PixelGrid {
  const g = new PixelGrid(T, T);
  let dark: ColorName = 'umber';
  let darker: ColorName = 'bark';
  if (style === 'wood') {
    // Warm wooden boards, 4px wide, running left to right with staggered ends.
    for (let y = 0; y < T; y++) {
      const board = Math.floor(y / 4);
      const off = (board * 5 + variant * 7) % T;
      for (let x = 0; x < T; x++) {
        let c: ColorName = y % 4 === 3 ? 'umber' : y % 4 === 0 ? 'tan' : 'clay';
        if ((x + off) % T === 0) c = 'umber';
        else if (y % 4 === 1 && hash2(x + variant * 31, board, 83) < 0.08) c = 'tan';
        g.set(x, y, c);
      }
    }
  } else if (style === 'paper') {
    // Blank paper: almost nothing, a few faint specks.
    g.fillRect(0, 0, T, T, 'cream');
    for (let i = 0; i < 2; i++) g.set(Math.floor(hash2(variant, i, 84) * T), Math.floor(hash2(variant, i, 85) * T), 'mist');
    dark = 'mist';
    darker = 'haze';
  } else {
    // Polished stone: big pale slabs with thin grout and a soft sheen.
    for (let y = 0; y < T; y++)
      for (let x = 0; x < T; x++) {
        const grout = x === 0 || y === 0;
        const sheen = (x + y + variant * 3) % 13 === 0;
        g.set(x, y, grout ? 'haze' : sheen ? 'cream' : hash2(x + variant * 17, y, 86) < 0.06 ? 'haze' : 'mist');
      }
    dark = 'haze';
    darker = 'mauve';
  }
  if (shadow === 'top') for (let x = 0; x < T; x++) g.set(x, 0, darker).set(x, 1, dark).set(x, 2, ditherPick(x, 2, 0.5) ? dark : g.colorAt(x, 2)!);
  if (shadow === 'left') for (let y = 0; y < T; y++) g.set(0, y, darker).set(1, y, dark);
  if (shadow === 'right') for (let y = 0; y < T; y++) g.set(T - 1, y, darker).set(T - 2, y, dark);
  return g;
}

function wallTiles(paper: [ColorName, ColorName, ColorName], wains: [ColorName, ColorName, ColorName], beam: [ColorName, ColorName] = ['bark', 'umber']): PixelGrid[] {
  const [pDark, pBase, pLight] = paper;
  const upper = new PixelGrid(T, T).fillRect(0, 0, T, T, pBase);
  // Wallpaper: small diamond motif.
  for (let y = 2; y < T; y += 8)
    for (let x = 3; x < T; x += 8) {
      upper.set(x, y, pLight).set(x - 1, y + 1, pLight).set(x + 1, y + 1, pLight).set(x, y + 2, pLight);
      upper.set(x + 4, y + 5, pDark);
    }
  const lower = upper.clone();
  // Wainscot panelling and skirting board on the lower half.
  const [wDark, wBase, wLight] = wains;
  lower.fillRect(0, 6, T, 1, wLight).fillRect(0, 7, T, 7, wBase).fillRect(0, 14, T, 2, wDark);
  for (let x = 3; x < T; x += 8) lower.fillRect(x, 9, 1, 4, wDark).fillRect(x + 1, 9, 1, 4, wLight);
  lower.fillRect(0, 13, T, 1, wDark);
  const top = upper.clone();
  top.fillRect(0, 0, T, 3, beam[0]).fillRect(0, 3, T, 1, beam[1]).fillRect(0, 4, T, 1, pDark);
  return [upper, lower, top];
}

/** A doodle room: plain white walls with one pen line where wall meets floor. */
function paperWalls(): PixelGrid[] {
  const upper = new PixelGrid(T, T).fillRect(0, 0, T, T, 'cream');
  const lower = upper.clone().fillRect(0, T - 2, T, 1, 'ink').fillRect(0, T - 1, T, 1, 'mist');
  const top = upper.clone();
  return [upper, lower, top];
}

/** Interior colourways, in tileset order (each is INTERIOR_TILE.altOffset tiles). */
export const INTERIOR_STYLES = ['home', 'shop', 'paper', 'gallery'] as const;

function interiorTiles(): PixelGrid[] {
  const v = new PixelGrid(T, T).fillRect(0, 0, T, T, 'ink');
  const floors = (style: FloorStyle) => [
    floorTile(0, 'none', style),
    floorTile(1, 'none', style),
    floorTile(2, 'none', style),
    floorTile(0, 'top', style),
    floorTile(1, 'left', style),
    floorTile(2, 'right', style),
  ];
  return [
    ...floors('wood'),
    ...wallTiles(['tan', 'sand', 'cream'], ['bark', 'umber', 'clay']),
    v,
    // Shops: cool plaster with dark wood.
    ...floors('wood'),
    ...wallTiles(['haze', 'mist', 'cream'], ['bark', 'clay', 'tan']),
    v,
    // Paper: an all-white doodle room floating in black.
    ...floors('paper'),
    ...paperWalls(),
    v,
    // Gallery: deep red walls, dark wood dado, marble floor.
    ...floors('marble'),
    ...wallTiles(['wine', 'brick', 'coral'], ['bark', 'umber', 'gold'], ['night', 'plum']),
    v,
  ];
}

function dockTiles(): PixelGrid[] {
  // Boards run across the walkway, 4px each, with staggered seams.
  const base = new PixelGrid(T, T);
  for (let y = 0; y < T; y++)
    for (let x = 0; x < T; x++) {
      const row = y % 4;
      const board = Math.floor(y / 4);
      let c: ColorName = row === 0 ? 'sand' : row === 3 ? 'umber' : 'tan';
      if (row === 2 && (x * 7 + board * 5) % 11 === 0) c = 'clay';
      if (x === (board * 9 + 5) % T && row !== 3) c = 'umber';
      base.set(x, y, c);
    }
  const tiles: PixelGrid[] = [];
  for (let i = 0; i < DOCK_TILE.count; i++) {
    const g = base.clone();
    const end = i & DOCK_TILE.end;
    const h = end ? 12 : T;
    // Side beam with nails where the dock meets the water.
    if (i & DOCK_TILE.left) {
      g.fillRect(0, 0, 2, h, 'clay').fillRect(0, 0, 1, h, 'bark');
      for (let y = 1; y < h; y += 4) g.set(1, y, 'umber');
    }
    if (i & DOCK_TILE.right) {
      g.fillRect(T - 2, 0, 2, h, 'clay').fillRect(T - 1, 0, 1, h, 'bark');
      for (let y = 1; y < h; y += 4) g.set(T - 2, y, 'umber');
    }
    if (end) {
      // Front edge and posts dropping into the water.
      g.fillRect(0, 12, T, 1, 'umber').fillRect(0, 13, T, 3, 'bark');
      g.fillRect(1, 13, 3, 3, 'clay').fillRect(12, 13, 3, 3, 'clay').fillRect(1, 13, 1, 3, 'tan').fillRect(12, 13, 1, 3, 'tan');
    }
    tiles.push(g);
  }
  return tiles;
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
  sink.sheet(
    TERRAIN_TEXTURES.sand,
    Array.from({ length: MEADOW_TILES }, (_, i) => (i < DUAL_TILE_COUNT ? sandTile(i) : sandTile(15, i))),
    T,
    T,
  );
  sink.sheet(
    TERRAIN_TEXTURES.paved,
    Array.from({ length: DUAL_TILE_COUNT }, (_, m) => pavedTile(m)),
    T,
    T,
  );
  const sea: PixelGrid[] = [];
  for (let f = 0; f < WATER_FRAMES; f++) {
    for (let m = 0; m < DUAL_TILE_COUNT; m++) sea.push(seaTile(m, f));
    for (let v = 0; v < FULL_VARIANTS; v++) sea.push(seaTile(15, f, v + 1));
  }
  sink.sheet(TERRAIN_TEXTURES.sea, sea, T, T, WATER_TILES_PER_FRAME);
  sink.sheet(TERRAIN_TEXTURES.interior, interiorTiles(), T, T);
  sink.sheet(TERRAIN_TEXTURES.dock, dockTiles(), T, T);
}
