// Farming art: item icons, tilled soil tiles, crop growth stages, tool swing
// frames and the tile cursor. Tools are rasterised from a handle plus a head
// shape at any angle, so the icon and every swing frame share one drawing.

import { PixelGrid, blobMask, hash2, outline, rng, shade, type TextureSink } from './pixel';
import { RAMPS, type ColorName } from './palette';
import { CROPS, ripeStage } from '../data/crops';
import type { ToolKind } from '../data/items';

export const ITEM_TEXTURES = {
  icons: 'item-icons',
  soil: 'tiles-soil',
  cursor: 'ui-cursor',
  bits: 'fx-bits',
} as const;

export function toolTexture(kind: ToolKind): string {
  return `tool-${kind}`;
}

export const ICON_NAMES = [
  'hoe',
  'can',
  'axe',
  'pickaxe',
  'scythe',
  'seedPadi',
  'seedJagung',
  'seedCabai',
  'seedTerong',
  'padi',
  'jagung',
  'cabai',
  'terong',
  'wood',
  'stone',
  'fiber',
] as const;

export function iconFrame(name: string): number {
  return Math.max(0, (ICON_NAMES as readonly string[]).indexOf(name));
}

/** Soil connection bits: which neighbours are also tilled. */
export const SOIL = { N: 1, E: 2, S: 4, W: 8 } as const;
/** Frames 0-15 dry soil by mask, 16-31 the watered versions. */
export const SOIL_WET_OFFSET = 16;

/** Frame indices in the fx-bits sheet. */
export const BIT = { clod: 0, drop: 1, chip: 2, pebble: 3, leaf: 4, spark: 5 } as const;

/** Tool swing frames: 3 per view, views in this order. Each frame is 40x48 with the player's feet at (20, 40). */
export const TOOL_FRAME = { w: 40, h: 48, feetX: 20, feetY: 40, perView: 3 } as const;
export const TOOL_VIEWS = ['down', 'up', 'side'] as const;
export type ToolView = (typeof TOOL_VIEWS)[number];

/** Frames drawn behind the player (by view, then frame). */
export const TOOL_BEHIND: Record<ToolKind, Record<ToolView, readonly boolean[]>> = {
  hoe: { down: [true, false, false], up: [false, true, true], side: [false, false, false] },
  axe: { down: [true, false, false], up: [false, true, true], side: [false, false, false] },
  pickaxe: { down: [true, false, false], up: [false, true, true], side: [false, false, false] },
  scythe: { down: [false, false, false], up: [true, true, true], side: [false, false, false] },
  can: { down: [false, false, false], up: [true, true, true], side: [false, false, false] },
};

// ---------------------------------------------------------------------------
// Tool rasteriser

type HeadMode = 'side' | 'front';

interface ToolPose {
  /** Grip position in the frame. */
  gx: number;
  gy: number;
  /** Handle direction in degrees, screen space (0 = right, 90 = down). */
  angle: number;
  /** Handle length from the grip to the head. */
  len: number;
  mode: HeadMode;
}

const METAL: [ColorName, ColorName, ColorName] = ['mauve', 'haze', 'mist'];

/** Colour of a head pixel at local (du along the handle past its end, v across). Null = empty. */
function headPixel(kind: ToolKind, du: number, v: number, mode: HeadMode): ColorName | null {
  const [dark, mid, light] = METAL;
  switch (kind) {
    case 'hoe':
      if (mode === 'front') return du >= -1 && du <= 2 && Math.abs(v) <= 2.6 ? (du > 1 ? light : v < 0 ? mid : dark) : null;
      return du >= -1.5 && du <= 0.6 && v >= -0.5 && v <= 5 ? (v > 4 ? light : du < -0.5 ? dark : mid) : null;
    case 'axe': {
      if (mode === 'front') return du >= -2.5 && du <= 1 && Math.abs(v) <= 1.5 ? (v < 0 ? mid : dark) : null;
      const grow = Math.max(0, v - 1);
      if (v < -1.5 || v > 5) return null;
      if (du < -2 - grow * 0.6 || du > 0.6 + grow * 0.35) return null;
      return v > 4 ? light : du > 0 ? dark : mid;
    }
    case 'pickaxe': {
      const back = Math.abs(v) * (mode === 'front' ? 0.15 : 0.35);
      if (Math.abs(v) > 5.6) return null;
      if (du < -1 - back || du > 0.9 - back) return null;
      return Math.abs(v) > 4.4 ? light : du > 0 - back ? dark : mid;
    }
    case 'scythe': {
      if (v < -0.5 || v > 10) return null;
      const curve = v * 0.45 + v * v * 0.025;
      if (du < -1.4 - curve || du > 0.6 - curve) return null;
      return du > -0.4 - curve ? light : mid;
    }
    case 'can':
      return null;
  }
}

/** Draw a tool (with optional hands) into `g` at the given pose. */
function drawTool(g: PixelGrid, kind: ToolKind, p: ToolPose, hands: boolean): void {
  const a = (p.angle * Math.PI) / 180;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  // perp is the leading edge of a clockwise swing.
  const px = -dy;
  const py = dx;
  // Which side of the handle faces the light (top-left)?
  const litSign = px * -0.7 + py * -0.7 >= 0 ? 1 : -1;
  const tool = new PixelGrid(g.w, g.h);
  for (let y = 0; y < g.h; y++)
    for (let x = 0; x < g.w; x++) {
      const rx = x + 0.5 - p.gx;
      const ry = y + 0.5 - p.gy;
      const u = rx * dx + ry * dy;
      const v = rx * px + ry * py;
      if (kind === 'can') {
        const c = canPixel(u, v, p.mode);
        if (c) tool.set(x, y, c);
        continue;
      }
      const head = headPixel(kind, u - p.len, v, p.mode);
      if (head) {
        tool.set(x, y, head);
        continue;
      }
      if (u >= -2 && u <= p.len && Math.abs(v) <= 0.85) tool.set(x, y, v * litSign > 0 ? 'tan' : 'clay');
    }
  g.stamp(outline(tool, { steps: 2 }));
  if (hands) {
    const hand = new PixelGrid(g.w, g.h);
    const put = (hx: number, hy: number) => {
      const x = Math.round(hx - 1);
      const y = Math.round(hy - 1);
      hand.fillRect(x, y, 2, 2, 'skin').set(x + 1, y + 1, 'skinShade');
    };
    put(p.gx, p.gy);
    if (kind !== 'can' && p.len > 6) put(p.gx + dx * 3, p.gy + dy * 3);
    g.stamp(outline(hand, { color: 'umber' }));
  }
}

/** Watering can in local coords: spout forward along +u, top toward -v. */
function canPixel(u: number, v: number, mode: HeadMode): ColorName | null {
  // Body.
  if (u >= -3 && u <= 4 && v >= -2.5 && v <= 3.5) {
    if (mode === 'front' && Math.abs(u) > 3.2) return null;
    if (v < -1.5) return 'foam';
    if (v > 2.5) return 'deep';
    return u < -1.5 ? 'foam' : u > 2.5 ? 'sea' : 'sky';
  }
  // Rim and handle on top.
  if (v >= -4.5 && v < -2.5 && (u <= -1.5 && u >= -4) && !(v > -3.8 && u > -3.2 && u < -2)) return 'sea';
  // Spout.
  if (u > 4 && u <= 8.5) {
    const sv = -1.5 - (u - 4) * 0.6;
    if (Math.abs(v - sv) <= 0.8) return 'sea';
    if (u > 7.5 && Math.abs(v - sv) <= 1.4) return 'sky';
  }
  return null;
}

// ---------------------------------------------------------------------------
// Swing frames

function pose(gx: number, gy: number, angle: number, len: number, mode: HeadMode = 'side'): ToolPose {
  return { gx, gy, angle, len, mode };
}

/** Poses per view (down, up, side), three frames each: windup, mid, strike. */
const SWING: Record<Exclude<ToolKind, 'can' | 'scythe'>, Record<ToolView, ToolPose[]>> = {
  hoe: {
    down: [pose(20, 17, -90, 8, 'front'), pose(20, 24, -90, 4, 'front'), pose(20, 31, 90, 10, 'front')],
    up: [pose(20, 21, -90, 5, 'front'), pose(20, 21, -90, 8, 'front'), pose(20, 26, -90, 13, 'front')],
    side: [pose(21, 28, -115, 10), pose(22, 28, -50, 11), pose(22, 31, 25, 12)],
  },
  axe: {
    down: [pose(20, 17, -90, 8, 'front'), pose(20, 24, -90, 4, 'front'), pose(20, 31, 90, 10, 'front')],
    up: [pose(20, 21, -90, 5, 'front'), pose(20, 21, -90, 8, 'front'), pose(20, 26, -90, 13, 'front')],
    side: [pose(21, 28, -115, 10), pose(22, 28, -50, 11), pose(22, 31, 25, 12)],
  },
  pickaxe: {
    down: [pose(20, 17, -90, 8, 'front'), pose(20, 24, -90, 4, 'front'), pose(20, 31, 90, 10, 'front')],
    up: [pose(20, 21, -90, 5, 'front'), pose(20, 21, -90, 8, 'front'), pose(20, 26, -90, 13, 'front')],
    side: [pose(21, 28, -115, 10), pose(22, 28, -50, 11), pose(22, 31, 25, 12)],
  },
};

const SCYTHE: Record<ToolView, ToolPose[]> = {
  down: [pose(16, 30, 200, 8), pose(20, 32, 120, 8), pose(24, 30, 30, 8)],
  up: [pose(24, 24, -20, 8), pose(20, 22, -90, 8), pose(16, 24, -160, 8)],
  side: [pose(22, 28, -80, 8), pose(23, 30, -10, 8), pose(22, 32, 50, 8)],
};

const CAN: Record<ToolView, ToolPose[]> = {
  down: [pose(20, 32, 60, 0, 'front'), pose(20, 33, 90, 0, 'front'), pose(20, 33, 95, 0, 'front')],
  up: [pose(20, 24, -60, 0, 'front'), pose(20, 23, -90, 0, 'front'), pose(20, 23, -95, 0, 'front')],
  side: [pose(23, 30, 0, 0), pose(24, 31, 35, 0), pose(24, 31, 45, 0)],
};

function swingFrames(kind: ToolKind): PixelGrid[] {
  const poses = kind === 'can' ? CAN : kind === 'scythe' ? SCYTHE : SWING[kind];
  const frames: PixelGrid[] = [];
  for (const view of TOOL_VIEWS)
    for (const p of poses[view]) {
      const g = new PixelGrid(TOOL_FRAME.w, TOOL_FRAME.h);
      drawTool(g, kind, p, true);
      frames.push(g);
    }
  return frames;
}

// ---------------------------------------------------------------------------
// Icons (16x16)

function toolIcon(kind: ToolKind): PixelGrid {
  const g = new PixelGrid(16, 16);
  if (kind === 'can') drawTool(g, 'can', pose(7, 9, 0, 0), false);
  else if (kind === 'scythe') drawTool(g, 'scythe', pose(4, 13, -70, 10), false);
  else drawTool(g, kind, pose(4, 13, -50, 10), false);
  return g;
}

function seedPacket(art: (g: PixelGrid) => void): PixelGrid {
  const g = new PixelGrid(16, 16);
  g.fillRect(3, 2, 10, 13, 'sand').fillRect(3, 2, 10, 2, 'tan').fillRect(3, 2, 1, 13, 'cream');
  g.fillRect(12, 4, 1, 11, 'tan').fillRect(3, 14, 10, 1, 'tan');
  for (let x = 4; x < 12; x += 2) g.set(x, 2, 'clay');
  art(g);
  return outline(g, { steps: 2 });
}

function riceSheaf(): PixelGrid {
  const g = new PixelGrid(16, 16);
  for (const [x0, x1] of [
    [7, 3],
    [8, 6],
    [8, 10],
    [9, 13],
  ]) {
    g.line(x0, 14, (x0 + x1) / 2, 7, 'amber');
    for (let k = 0; k < 4; k++) g.set(x1 + (x1 < 8 ? k * 0.3 : -k * 0.3), 3 + k * 1.3, k % 2 ? 'gold' : 'cream');
  }
  g.fillRect(6, 10, 4, 2, 'leaf').set(6, 10, 'grass');
  return outline(g, { steps: 2 });
}

function cornCob(): PixelGrid {
  const g = new PixelGrid(16, 16);
  for (let i = 0; i < 9; i++) {
    const cx = 5 + i * 0.8;
    const cy = 11 - i * 0.9;
    g.fillEllipse(Math.round(cx) - 1, Math.round(cy) - 1, 4, 3, i % 2 ? 'gold' : 'amber');
  }
  for (let i = 0; i < 9; i += 2) g.set(Math.round(5 + i * 0.8), Math.round(10 - i * 0.9), 'cream');
  g.line(2, 14, 6, 10, 'leaf').line(3, 14, 8, 12, 'grass').line(2, 13, 5, 9, 'lime');
  return outline(g, { steps: 2 });
}

function chili(): PixelGrid {
  const g = new PixelGrid(16, 16);
  const pts: Array<[number, number]> = [
    [9, 4],
    [9, 5],
    [8, 6],
    [8, 7],
    [7, 8],
    [7, 9],
    [6, 10],
    [5, 11],
    [4, 12],
  ];
  pts.forEach(([x, y], i) => {
    g.set(x, y, i < 6 ? 'brick' : 'coral');
    g.set(x + 1, y, i < 7 ? 'coral' : 'brick');
    if (i < 5) g.set(x + 2, y, 'brick');
  });
  g.set(8, 5, 'peach').set(7, 7, 'peach');
  g.set(10, 3, 'leaf').set(11, 3, 'grass').set(11, 2, 'leaf').set(9, 3, 'leaf');
  return outline(g, { steps: 2 });
}

function eggplant(): PixelGrid {
  const g = new PixelGrid(16, 16);
  const mask = blobMask(16, 16, [
    [7, 10, 4, 4],
    [9, 7, 3, 3],
  ]);
  g.stamp(shade(mask, ['night', 'violet', 'violet', 'lilac'], { rim: 0.3, gradient: 0.7 }));
  g.set(5, 8, 'rose').set(6, 7, 'lilac');
  g.fillRect(9, 3, 4, 2, 'leaf').set(9, 3, 'grass').set(12, 2, 'leaf').set(13, 1, 'grass');
  return outline(g, { steps: 2 });
}

function woodIcon(): PixelGrid {
  const g = new PixelGrid(16, 16);
  for (const [x, y] of [
    [2, 8],
    [8, 8],
    [5, 3],
  ]) {
    g.fillRect(x + 2, y, 5, 6, 'umber').fillRect(x + 2, y, 5, 1, 'clay');
    g.fillEllipse(x, y, 5, 6, 'tan').fillEllipse(x + 1, y + 1, 3, 4, 'sand').set(x + 2, y + 2, 'clay');
  }
  return outline(g, { steps: 2 });
}

function stoneIcon(): PixelGrid {
  const mask = blobMask(16, 16, [
    [8, 9, 6, 5],
    [6, 8, 4, 4],
  ]);
  const g = shade(mask, RAMPS.stone.slice(1), { rim: 0.3, gradient: 0.6 });
  g.set(9, 10, 'plum').set(10, 11, 'plum');
  return outline(g, { steps: 2 });
}

function fiberIcon(): PixelGrid {
  const g = new PixelGrid(16, 16);
  for (const [x0, x1] of [
    [6, 2],
    [7, 5],
    [8, 9],
    [9, 13],
    [8, 7],
  ])
    g.line(x0, 14, x1, 2 + Math.abs(x1 - 7) * 0.4, x1 < 7 ? 'leaf' : 'grass');
  g.set(2, 2, 'lime').set(9, 2, 'lime').set(13, 3, 'lime');
  g.fillRect(6, 9, 4, 2, 'tan').set(6, 9, 'sand');
  return outline(g, { steps: 2 });
}

function icons(): PixelGrid[] {
  const make: Record<(typeof ICON_NAMES)[number], () => PixelGrid> = {
    hoe: () => toolIcon('hoe'),
    can: () => toolIcon('can'),
    axe: () => toolIcon('axe'),
    pickaxe: () => toolIcon('pickaxe'),
    scythe: () => toolIcon('scythe'),
    seedPadi: () =>
      seedPacket((g) => {
        for (const [x, y] of [
          [6, 7],
          [8, 9],
          [9, 6],
          [7, 11],
        ])
          g.set(x, y, 'gold').set(x, y + 1, 'amber');
      }),
    seedJagung: () => seedPacket((g) => g.fillRect(7, 6, 3, 6, 'gold').set(7, 6, 'cream').set(9, 11, 'amber').line(6, 12, 7, 10, 'leaf')),
    seedCabai: () => seedPacket((g) => g.line(9, 6, 6, 11, 'brick').line(10, 6, 7, 11, 'coral').set(9, 5, 'leaf')),
    seedTerong: () => seedPacket((g) => g.fillEllipse(6, 7, 5, 6, 'violet').set(7, 8, 'lilac').set(9, 6, 'leaf').set(8, 6, 'leaf')),
    padi: riceSheaf,
    jagung: cornCob,
    cabai: chili,
    terong: eggplant,
    wood: woodIcon,
    stone: stoneIcon,
    fiber: fiberIcon,
  };
  return ICON_NAMES.map((n) => make[n]());
}

// ---------------------------------------------------------------------------
// Tilled soil, per-cell autotile (16 masks), dry and watered

function soilTile(mask: number, wet: boolean): PixelGrid {
  const T = 16;
  const g = new PixelGrid(T, T);
  const n = mask & SOIL.N;
  const e = mask & SOIL.E;
  const s = mask & SOIL.S;
  const w = mask & SOIL.W;
  const [shadow, base, ridge, lit]: ColorName[] = wet ? ['night', 'bark', 'umber', 'clay'] : ['bark', 'umber', 'clay', 'tan'];
  for (let y = 0; y < T; y++)
    for (let x = 0; x < T; x++) {
      // Furrows: a lit ridge, two rows of soil, a shadowed trough.
      const row = (y + 1) % 4;
      let c: ColorName = row === 0 ? ridge : row === 3 ? shadow : base;
      if (row === 0 && hash2(x >> 1, y, wet ? 7 : 3) < 0.25) c = lit;
      if (row === 3 && hash2(x, y >> 2, 5) < 0.2) c = base;
      g.set(x, y, c);
    }
  // Sunken edges: shadow under the grass lip at the top and left, lit rim bottom and right.
  for (let i = 0; i < T; i++) {
    if (!n) g.set(i, 0, shadow).set(i, 1, base);
    if (!w) g.set(0, i, shadow);
    if (!s) g.set(i, T - 1, lit);
    if (!e) g.set(T - 1, i, ridge);
  }
  // Rounded outer corners.
  if (!n && !w) g.set(0, 0, null).set(1, 0, null).set(0, 1, null);
  if (!n && !e) g.set(T - 1, 0, null).set(T - 2, 0, null).set(T - 1, 1, null);
  if (!s && !w) g.set(0, T - 1, null).set(1, T - 1, null).set(0, T - 2, null);
  if (!s && !e) g.set(T - 1, T - 1, null).set(T - 2, T - 1, null).set(T - 1, T - 2, null);
  // A few clods.
  for (let i = 0; i < 3; i++) {
    const x = 2 + Math.floor(hash2(mask, i, wet ? 91 : 90) * 11);
    const y = 2 + Math.floor(hash2(mask, i, 92) * 11);
    if (g.filled(x, y) && g.filled(x + 1, y + 1)) g.set(x, y, lit).set(x + 1, y + 1, shadow);
  }
  return g;
}

// ---------------------------------------------------------------------------
// Crops: 16x24 frames, the plant's base at (8, 22)

const CW = 16;
const CH = 24;
const BASE_Y = 22;

/** Blade from the base to a tip, coloured dark at the root and light at the tip. */
function blade(g: PixelGrid, x0: number, y0: number, x1: number, y1: number, ramp: readonly ColorName[]): void {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= steps; i++) {
    const t = steps === 0 ? 1 : i / steps;
    // Slight outward bow.
    const bow = Math.sin(t * Math.PI) * 0.6 * Math.sign(x1 - x0);
    const x = Math.round(x0 + (x1 - x0) * t + bow);
    const y = Math.round(y0 + (y1 - y0) * t);
    g.set(x, y, ramp[Math.min(ramp.length - 1, Math.floor(t * ramp.length))]);
  }
}

const GREEN: readonly ColorName[] = ['moss', 'leaf', 'grass', 'lime'];
const RIPE_GREEN: readonly ColorName[] = ['leaf', 'grass', 'lime', 'gold'];

function seeded(color: ColorName): PixelGrid {
  // A small mound of fresh earth with the seeds peeking out, so a just-planted
  // cell reads clearly against the furrows.
  const g = new PixelGrid(CW, CH);
  g.fillEllipse(3, BASE_Y - 4, 10, 5, 'umber');
  g.fillEllipse(4, BASE_Y - 4, 8, 3, 'clay');
  for (const [x, y] of [
    [5, BASE_Y - 3],
    [8, BASE_Y - 4],
    [10, BASE_Y - 2],
  ])
    g.set(x, y, color).set(x + 1, y, 'cream');
  return outline(g, { color: 'bark' });
}

function sprout(): PixelGrid {
  const g = new PixelGrid(CW, CH);
  g.line(8, BASE_Y, 8, BASE_Y - 3, 'leaf');
  g.set(7, BASE_Y - 4, 'grass').set(6, BASE_Y - 4, 'lime').set(9, BASE_Y - 4, 'grass').set(10, BASE_Y - 5, 'lime').set(8, BASE_Y - 4, 'leaf');
  return outline(g, { color: 'pine' });
}

function padiFrames(): PixelGrid[] {
  const stage2 = new PixelGrid(CW, CH);
  for (const [x, y] of [
    [3, 15],
    [5, 13],
    [7, 12],
    [9, 12],
    [11, 13],
    [13, 15],
  ])
    blade(stage2, 8, BASE_Y, x, y, GREEN);
  const tall = (ramp: readonly ColorName[]) => {
    const g = new PixelGrid(CW, CH);
    for (const [x, y] of [
      [2, 12],
      [4, 9],
      [6, 7],
      [8, 6],
      [10, 7],
      [12, 9],
      [14, 12],
      [7, 10],
      [9, 10],
    ])
      blade(g, 8, BASE_Y, x, y, ramp);
    return g;
  };
  const stage3 = tall(GREEN);
  const ripe = tall(RIPE_GREEN);
  // Drooping golden panicles.
  for (const [x0, y0, dir] of [
    [6, 7, -1],
    [10, 7, 1],
    [8, 6, -1],
    [4, 9, -1],
    [12, 9, 1],
  ] as const) {
    for (let k = 0; k < 5; k++) {
      const x = x0 + dir * Math.round(k * 0.6);
      const y = y0 + k;
      ripe.set(x, y, k % 2 ? 'amber' : 'gold');
      if (k === 1) ripe.set(x - dir, y, 'cream');
    }
  }
  return [seeded('sand'), sprout(), outline(stage2, { color: 'pine' }), outline(stage3, { color: 'pine' }), outline(ripe, { color: 'pine' })];
}

function cornLeaf(g: PixelGrid, x: number, y: number, dir: number, len: number): void {
  for (let i = 0; i < len; i++) {
    const t = i / len;
    const lx = x + dir * (i + 1);
    const ly = y - Math.round(Math.sin(t * Math.PI * 0.8) * 2.5) + Math.round(t * t * 3);
    g.set(lx, ly, t < 0.3 ? 'leaf' : t < 0.75 ? 'grass' : 'lime');
    if (t < 0.6) g.set(lx, ly + 1, 'leaf');
  }
}

function jagungFrames(): PixelGrid[] {
  const stalk = (top: number) => {
    const g = new PixelGrid(CW, CH);
    g.fillRect(7, top, 1, BASE_Y - top + 1, 'grass').fillRect(8, top, 1, BASE_Y - top + 1, 'leaf');
    return g;
  };
  const s2 = stalk(14);
  cornLeaf(s2, 7, 19, -1, 5);
  cornLeaf(s2, 8, 17, 1, 5);
  cornLeaf(s2, 7, 15, -1, 4);
  const big = () => {
    const g = stalk(4);
    cornLeaf(g, 7, 19, -1, 6);
    cornLeaf(g, 8, 16, 1, 6);
    cornLeaf(g, 7, 13, -1, 6);
    cornLeaf(g, 8, 10, 1, 5);
    cornLeaf(g, 7, 7, -1, 4);
    return g;
  };
  const s3 = big();
  const ripe = big();
  // Cob in its husk, and the tassel on top.
  ripe.fillRect(9, 11, 3, 6, 'gold').fillRect(9, 11, 1, 6, 'cream').fillRect(11, 12, 1, 5, 'amber');
  ripe.set(10, 10, 'lime').set(9, 17, 'grass').set(10, 17, 'leaf').set(11, 17, 'leaf');
  for (const [x, y] of [
    [6, 2],
    [7, 1],
    [8, 2],
    [9, 1],
    [7, 3],
    [8, 3],
  ])
    ripe.set(x, y, y < 2 ? 'sand' : 'amber');
  return [seeded('gold'), sprout(), outline(s2, { color: 'pine' }), outline(s3, { color: 'pine' }), outline(ripe, { color: 'pine' })];
}

function bushFrames(seed: number, flower: ColorName, fruit: (g: PixelGrid) => void, big: boolean): PixelGrid[] {
  const bush = (w: number, h: number, s: number) => {
    const g = new PixelGrid(CW, CH);
    g.line(8, BASE_Y, 8, BASE_Y - 3, 'leaf');
    const cy = BASE_Y - 3 - h / 2;
    const mask = blobMask(CW, CH, [
      [8, cy, w / 2, h / 2],
      [8 - w / 4, cy + 1, w / 3, h / 3],
      [8 + w / 4, cy + 1, w / 3, h / 3],
    ]);
    g.stamp(shade(mask, RAMPS.foliage.slice(1), { rim: 0.3, gradient: 0.6, noise: 0.15, seed: s }));
    return g;
  };
  const s2 = bush(big ? 9 : 8, big ? 7 : 6, seed);
  const s3 = bush(big ? 13 : 12, big ? 11 : 10, seed + 1);
  const flowering = s3.clone();
  const r = rng(seed + 5);
  for (let i = 0; i < 4; i++) {
    const x = 4 + Math.floor(r() * 8);
    const y = 8 + Math.floor(r() * 7);
    if (flowering.filled(x, y)) flowering.set(x, y, flower).set(x + 1, y, 'cream');
  }
  const ripe = s3.clone();
  fruit(ripe);
  return [seeded('sand'), sprout(), outline(s2, { color: 'pine' }), outline(flowering, { color: 'pine' }), outline(ripe, { color: 'pine' })];
}

function cabaiFrames(): PixelGrid[] {
  return bushFrames(
    1201,
    'cream',
    (g) => {
      for (const [x, y] of [
        [4, 12],
        [7, 15],
        [10, 11],
        [12, 15],
        [6, 9],
      ]) {
        g.set(x, y - 1, 'leaf');
        g.set(x, y, 'coral').set(x, y + 1, 'brick').set(x + 1, y + 2, 'brick').set(x - 1, y, 'peach');
      }
    },
    false,
  );
}

function terongFrames(): PixelGrid[] {
  return bushFrames(
    1301,
    'lilac',
    (g) => {
      for (const [x, y] of [
        [4, 12],
        [10, 14],
        [7, 9],
      ]) {
        g.fillRect(x, y, 3, 4, 'violet').fillRect(x, y, 1, 3, 'lilac').fillRect(x + 1, y + 4, 2, 1, 'night').set(x + 2, y + 3, 'night');
        g.set(x, y - 1, 'leaf').set(x + 1, y - 1, 'grass').set(x + 2, y - 1, 'leaf');
      }
    },
    true,
  );
}

const CROP_ART: Record<string, () => PixelGrid[]> = {
  padi: padiFrames,
  jagung: jagungFrames,
  cabai: cabaiFrames,
  terong: terongFrames,
};

// ---------------------------------------------------------------------------
// Cursor and particles

function cursor(color: ColorName): PixelGrid {
  const g = new PixelGrid(18, 18);
  const L = 4;
  for (const [x, y, sx, sy] of [
    [0, 0, 1, 1],
    [17, 0, -1, 1],
    [0, 17, 1, -1],
    [17, 17, -1, -1],
  ]) {
    for (let i = 0; i < L; i++) {
      g.set(x + sx * i, y, color).set(x, y + sy * i, color);
    }
  }
  return outline(g, { color: 'night' });
}

function bits(): PixelGrid[] {
  const b = (cells: Array<[number, number, ColorName]>) => {
    const g = new PixelGrid(4, 4);
    for (const [x, y, c] of cells) g.set(x, y, c);
    return g;
  };
  return [
    b([
      [1, 1, 'clay'],
      [2, 1, 'umber'],
      [1, 2, 'umber'],
      [2, 2, 'bark'],
    ]),
    b([
      [1, 0, 'foam'],
      [1, 1, 'sky'],
      [1, 2, 'sea'],
    ]),
    b([
      [1, 1, 'sand'],
      [2, 1, 'tan'],
      [2, 2, 'clay'],
    ]),
    b([
      [1, 1, 'mist'],
      [2, 1, 'haze'],
      [1, 2, 'mauve'],
      [2, 2, 'plum'],
    ]),
    b([
      [1, 1, 'lime'],
      [2, 1, 'grass'],
      [2, 2, 'leaf'],
    ]),
    b([
      [1, 0, 'gold'],
      [0, 1, 'gold'],
      [1, 1, 'cream'],
      [2, 1, 'gold'],
      [1, 2, 'gold'],
    ]),
  ];
}

// ---------------------------------------------------------------------------

export function registerItemArt(sink: TextureSink): void {
  sink.sheet(ITEM_TEXTURES.icons, icons(), 16, 16, 8);
  const soil: PixelGrid[] = [];
  for (let m = 0; m < 16; m++) soil.push(soilTile(m, false));
  for (let m = 0; m < 16; m++) soil.push(soilTile(m, true));
  sink.sheet(ITEM_TEXTURES.soil, soil, 16, 16, 16);
  for (const c of Object.values(CROPS)) {
    const frames = CROP_ART[c.id]();
    if (frames.length !== ripeStage(c) + 1) throw new Error(`[art] crop ${c.id} has ${frames.length} frames, expected ${ripeStage(c) + 1}`);
    sink.sheet(c.texture, frames, CW, CH);
  }
  for (const kind of ['hoe', 'can', 'axe', 'pickaxe', 'scythe'] as const) sink.sheet(toolTexture(kind), swingFrames(kind), TOOL_FRAME.w, TOOL_FRAME.h, 3);
  sink.sheet(ITEM_TEXTURES.cursor, [cursor('cream'), cursor('coral')], 18, 18);
  sink.sheet(ITEM_TEXTURES.bits, bits(), 4, 4);
}
