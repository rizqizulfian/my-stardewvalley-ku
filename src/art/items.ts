// Farming art: item icons, tilled soil tiles, crop growth stages, tool swing
// frames and the tile cursor. Tools are rasterised from a handle plus a head
// shape at any angle, so the icon and every swing frame share one drawing.

import { PixelGrid, blobMask, hash2, outline, shade, type TextureSink } from './pixel';
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
  'seedMatahari',
  'seedMawar',
  'seedMelati',
  'matahari',
  'mawar',
  'melati',
  'nasiGoreng',
  'soto',
  'esTeh',
  'kopi',
  'pisangGoreng',
  'kelapa',
  'pisang',
  'mangga',
  'jeruk',
  'semangka',
  'rod',
  'jambu',
  'ikanMas',
  'lele',
  'nila',
  'gurame',
  'kakap',
  'tongkol',
  'cumi',
  'kerapu',
  'rumputLaut',
  'kerang',
  'bintangLaut',
  'mutiara',
  'jamur',
  'pakis',
  'telur',
  'telurBebek',
  'susu',
  'wol',
  'madu',
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
  rod: { down: [true, false, false], up: [false, true, true], side: [false, false, false] },
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
    case 'rod':
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
      if (kind === 'rod') {
        const c = rodPixel(u, v * litSign, p.len);
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

/** Fishing rod in local coords: cork grip at the hands, a reel hanging under it, a thin bamboo rod with a red tip. */
function rodPixel(u: number, v: number, len: number): ColorName | null {
  if (u >= 0 && u <= 2.2 && v <= -0.9 && v >= -3) return v < -2.2 ? 'mauve' : 'haze';
  if (u < -3 || u > len) return null;
  if (u < 3) return Math.abs(v) <= 1 ? (v > 0 ? 'clay' : 'umber') : null;
  if (Math.abs(v) > 0.62) return null;
  if (u > len - 1.6) return 'brick';
  return Math.floor(u) % 5 === 0 ? 'clay' : 'sand';
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
const SWING: Record<Exclude<ToolKind, 'can' | 'scythe' | 'rod'>, Record<ToolView, ToolPose[]>> = {
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

/** Fishing: wind-up behind the shoulder, the cast, then holding the line out over the water. */
const ROD: Record<ToolView, ToolPose[]> = {
  down: [pose(20, 25, -80, 16), pose(21, 30, 45, 15), pose(21, 31, 70, 13)],
  up: [pose(20, 28, 95, 10), pose(20, 23, -75, 16), pose(20, 23, -88, 15)],
  side: [pose(20, 28, -125, 16), pose(22, 29, -25, 16), pose(22, 30, -8, 16)],
};

/**
 * Where the rod tip is in a frame, relative to the player's feet (for drawing
 * the fishing line). Left-facing frames are mirrored.
 */
export function rodTip(view: ToolView, frame: number, flipped: boolean): [number, number] {
  const p = ROD[view][frame];
  const a = (p.angle * Math.PI) / 180;
  const x = p.gx + Math.cos(a) * (p.len - 0.5) - TOOL_FRAME.feetX;
  const y = p.gy + Math.sin(a) * (p.len - 0.5) - TOOL_FRAME.feetY;
  return [Math.round(flipped ? -x - 1 : x), Math.round(y)];
}

function swingFrames(kind: ToolKind): PixelGrid[] {
  const poses = kind === 'can' ? CAN : kind === 'scythe' ? SCYTHE : kind === 'rod' ? ROD : SWING[kind];
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
  else if (kind === 'rod') drawTool(g, 'rod', pose(3, 13, -48, 15), false);
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

function sunflowerIcon(): PixelGrid {
  const g = new PixelGrid(16, 16);
  g.line(8, 15, 8, 9, 'leaf');
  leafBlade(g, 8, 13, 12, 11, 1, 'leaf', 'grass');
  for (let a = 0; a < 12; a++) {
    const ang = (a / 12) * Math.PI * 2;
    g.set(Math.round(8 + Math.cos(ang) * 5), Math.round(6 + Math.sin(ang) * 5), a % 2 ? 'gold' : 'amber');
    g.set(Math.round(8 + Math.cos(ang) * 4), Math.round(6 + Math.sin(ang) * 4), 'gold');
  }
  g.fillEllipse(5, 3, 7, 7, 'umber').set(6, 4, 'clay').set(7, 5, 'clay').set(10, 8, 'bark');
  return outline(g, { steps: 2 });
}

function roseIcon(): PixelGrid {
  const g = new PixelGrid(16, 16);
  g.line(8, 15, 8, 8, 'moss').set(7, 12, 'wine');
  leafBlade(g, 8, 12, 4, 10, 1, 'moss', 'leaf');
  const m = blobMask(16, 16, [[8, 6, 4, 4]]);
  g.stamp(shade(m, ['wine', 'brick', 'rose', 'peach'], { rim: 0.3, gradient: 0.6 }));
  g.line(6, 5, 9, 4, 'wine').line(9, 6, 7, 8, 'wine').set(8, 6, 'wine').set(6, 3, 'peach');
  return outline(g, { steps: 2 });
}

function jasmineIcon(): PixelGrid {
  const g = new PixelGrid(16, 16);
  g.line(5, 15, 8, 9, 'leaf').line(11, 15, 9, 10, 'leaf');
  leafBlade(g, 7, 12, 3, 11, 1, 'leaf', 'grass');
  for (const [x, y] of [
    [5, 6],
    [10, 5],
    [8, 9],
  ]) {
    g.fillRect(x - 1, y, 3, 1, 'cream').fillRect(x, y - 1, 1, 3, 'cream');
    g.set(x - 2, y, 'mist').set(x + 2, y, 'mist').set(x, y - 2, 'mist').set(x, y + 2, 'mist').set(x, y, 'gold');
  }
  return outline(g, { steps: 2 });
}

// ---------------------------------------------------------------------------
// Food and drink

function steam(g: PixelGrid, x: number, y: number): void {
  g.set(x, y, 'mist').set(x + 1, y - 1, 'mist').set(x, y - 2, 'mist').set(x + 3, y + 1, 'mist').set(x + 4, y, 'mist').set(x + 3, y - 1, 'mist');
}

function friedRiceIcon(): PixelGrid {
  const g = new PixelGrid(16, 16);
  g.fillEllipse(1, 8, 14, 7, 'haze').fillEllipse(1, 7, 14, 6, 'cream').fillEllipse(3, 8, 10, 4, 'mist');
  const rice = blobMask(16, 16, [
    [8, 8, 5, 3],
    [6, 7, 3, 2],
  ]);
  g.stamp(shade(rice, ['umber', 'clay', 'tan', 'sand'], { rim: 0.3, gradient: 0.6, noise: 0.5, seed: 4 }));
  // Fried egg and cucumber.
  g.fillEllipse(7, 4, 6, 4, 'cream').fillRect(9, 5, 2, 2, 'gold').set(9, 5, 'cream');
  g.set(3, 9, 'leaf').set(4, 10, 'lime').set(4, 9, 'grass');
  g.set(12, 9, 'brick');
  return outline(g, { steps: 2 });
}

function sotoIcon(): PixelGrid {
  const g = new PixelGrid(16, 16);
  // Bowl, seen a little from above.
  g.fillEllipse(1, 6, 14, 9, 'sky').fillRect(1, 9, 14, 2, 'sky');
  g.fillEllipse(2, 10, 12, 5, 'sea');
  g.fillEllipse(2, 6, 12, 5, 'amber').fillEllipse(3, 6, 10, 3, 'gold');
  g.set(5, 7, 'cream').set(6, 7, 'cream').set(9, 8, 'cream').set(10, 7, 'leaf').set(7, 8, 'leaf').set(11, 8, 'umber');
  g.line(2, 11, 13, 11, 'foam');
  steam(g, 5, 3);
  return outline(g, { steps: 2 });
}

function icedTeaIcon(): PixelGrid {
  const g = new PixelGrid(16, 16);
  g.fillRect(4, 3, 8, 12, 'foam').fillRect(5, 3, 6, 11, 'amber');
  g.fillRect(5, 3, 6, 2, 'gold').fillRect(5, 9, 6, 5, 'clay');
  g.fillRect(6, 5, 2, 2, 'cream').fillRect(8, 7, 2, 2, 'foam').set(6, 5, 'foam');
  g.line(10, 0, 9, 6, 'brick').set(10, 0, 'coral');
  g.fillRect(4, 14, 8, 1, 'sky');
  return outline(g, { steps: 2 });
}

function coffeeIcon(): PixelGrid {
  const g = new PixelGrid(16, 16);
  g.fillEllipse(1, 12, 14, 4, 'haze').fillEllipse(2, 12, 12, 3, 'mist');
  g.fillRect(3, 6, 9, 7, 'cream').fillRect(3, 12, 9, 1, 'mist').fillRect(10, 6, 2, 7, 'mist');
  g.fillEllipse(11, 7, 4, 5, 'cream').fillEllipse(12, 8, 2, 3, null);
  g.fillRect(4, 6, 7, 2, 'bark').set(5, 6, 'umber');
  steam(g, 5, 3);
  return outline(g, { steps: 2 });
}

function bananaShape(g: PixelGrid, x: number, y: number, ramp: [ColorName, ColorName, ColorName], len = 8): void {
  // A curved finger: an arc of short vertical strokes.
  for (let i = 0; i < len; i++) {
    const t = i / (len - 1);
    const yy = y + Math.round(Math.sin(t * Math.PI) * -3);
    g.fillRect(x + i, yy, 1, 3, ramp[1]).set(x + i, yy, ramp[2]).set(x + i, yy + 2, ramp[0]);
  }
  g.set(x, y + 1, 'bark').set(x + len - 1, y + 1, 'umber');
}

function friedBananaIcon(): PixelGrid {
  const g = new PixelGrid(16, 16);
  g.fillEllipse(0, 9, 16, 6, 'leaf').fillEllipse(1, 9, 14, 4, 'grass').line(1, 12, 14, 11, 'moss');
  for (const [x, y] of [
    [2, 6],
    [7, 7],
    [4, 3],
  ]) {
    const m = blobMask(16, 16, [[x + 3, y + 2, 3, 2]]);
    g.stamp(shade(m, ['umber', 'clay', 'amber', 'gold'], { rim: 0.3, gradient: 0.6, noise: 0.6, seed: x * 7 + y }));
  }
  return outline(g, { steps: 2 });
}

function coconutIcon(): PixelGrid {
  const m = blobMask(16, 16, [[8, 9, 6, 6]]);
  const g = shade(m, ['pine', 'moss', 'leaf', 'grass'], { rim: 0.3, gradient: 0.65 });
  g.fillEllipse(4, 3, 8, 4, 'cream').fillEllipse(5, 4, 6, 2, 'mist');
  g.line(10, 0, 8, 5, 'coral').set(10, 0, 'peach');
  g.set(5, 8, 'lime');
  return outline(g, { steps: 2 });
}

function bananaIcon(): PixelGrid {
  const g = new PixelGrid(16, 16);
  bananaShape(g, 2, 8, ['amber', 'gold', 'cream'], 11);
  bananaShape(g, 3, 5, ['amber', 'gold', 'cream'], 10);
  bananaShape(g, 4, 2, ['clay', 'amber', 'gold'], 9);
  g.fillRect(1, 7, 2, 4, 'leaf').set(1, 7, 'moss');
  return outline(g, { steps: 2 });
}

function mangoIcon(): PixelGrid {
  const m = blobMask(16, 16, [
    [8, 9, 6, 5],
    [6, 8, 4, 4],
  ]);
  const g = shade(m, ['clay', 'amber', 'gold', 'cream'], { rim: 0.3, gradient: 0.6 });
  g.set(11, 10, 'coral').set(12, 9, 'coral').set(11, 11, 'brick').set(12, 11, 'coral');
  g.line(6, 4, 8, 3, 'umber').fillRect(8, 1, 4, 2, 'leaf').set(11, 1, 'grass').set(9, 1, 'moss');
  return outline(g, { steps: 2 });
}

function orangeIcon(): PixelGrid {
  const m = blobMask(16, 16, [[8, 9, 6, 6]]);
  const g = shade(m, ['brick', 'coral', 'amber', 'gold'], { rim: 0.3, gradient: 0.6, noise: 0.4, seed: 11 });
  g.set(8, 4, 'moss').fillRect(9, 2, 4, 2, 'leaf').set(12, 2, 'grass');
  g.set(6, 7, 'peach');
  return outline(g, { steps: 2 });
}

function watermelonIcon(): PixelGrid {
  const g = new PixelGrid(16, 16);
  // A wedge: rind along the bottom arc, flesh above.
  for (let y = 3; y < 14; y++) {
    const half = Math.round(((y - 3) / 10) * 7);
    g.fillRect(8 - half, y, half * 2, 1, 'rose');
    if (y > 5) g.fillRect(8 - half + 1, y, Math.max(0, half * 2 - 2), 1, 'brick');
  }
  g.fillRect(1, 13, 14, 1, 'cream').fillRect(1, 14, 14, 1, 'leaf').fillRect(2, 15, 12, 1, 'moss');
  for (const [x, y] of [
    [7, 7],
    [9, 9],
    [6, 10],
    [10, 11],
    [8, 11],
  ])
    g.set(x, y, 'night');
  return outline(g, { steps: 2 });
}

function jambuIcon(): PixelGrid {
  // Bell-shaped water apple, glossy pink-red.
  const m = blobMask(16, 16, [
    [8, 10, 5, 5],
    [8, 6, 3.5, 3],
  ]);
  const g = shade(m, ['wine', 'brick', 'rose', 'peach'], { rim: 0.35, gradient: 0.6 });
  g.fillRect(6, 14, 5, 1, 'wine').set(7, 13, 'brick').set(9, 13, 'brick');
  g.set(6, 7, 'cream').set(6, 8, 'peach');
  g.line(8, 3, 9, 1, 'umber').fillRect(10, 1, 3, 2, 'leaf').set(12, 1, 'grass');
  return outline(g, { steps: 2 });
}

interface FishLook {
  ramp: [ColorName, ColorName, ColorName, ColorName];
  fin: ColorName;
  /** Body half-height and half-length. */
  ry?: number;
  rx?: number;
  stripes?: ColorName;
  spots?: ColorName;
  whiskers?: boolean;
  belly?: ColorName;
}

/** A fish swimming left: oval body, forked tail, fins, eye. */
function fishIcon(f: FishLook): PixelGrid {
  const rx = f.rx ?? 5;
  const ry = f.ry ?? 3;
  const cx = 7;
  const cy = 8;
  const m = blobMask(16, 16, [[cx, cy, rx, ry]]);
  // Tail: a wedge that widens behind the body, notched at the end.
  for (let i = 0; i < 4; i++)
    for (let dy = -i - 1; dy <= i + 1; dy++) if (i < 3 || Math.abs(dy) > 1) m.set(cx + rx - 1 + i, cy + dy, 'ink');
  const g = shade(m, f.ramp, { rim: 0.3, gradient: 0.55 });
  if (f.belly) for (let x = cx - rx + 2; x < cx + rx - 1; x++) g.set(x, cy + ry - 1, f.belly);
  if (f.stripes) for (let x = cx - 2; x < cx + rx - 1; x += 2) g.line(x, cy - ry + 1, x, cy + ry - 2, f.stripes);
  if (f.spots) for (const [x, y] of [[cx - 1, cy - 1], [cx + 2, cy + 1], [cx + 1, cy - 2], [cx + 3, cy - 1], [cx - 2, cy + 1]]) g.set(x, y, f.spots);
  // Dorsal and belly fins.
  g.line(cx - 1, cy - ry, cx + 2, cy - ry - 1, f.fin).set(cx + 3, cy - ry, f.fin);
  g.set(cx + 1, cy + ry, f.fin).set(cx + 2, cy + ry + 1, f.fin);
  // Eye and gill.
  const ex = cx - rx + 2;
  g.set(ex, cy - 1, 'cream').set(ex, cy - 1, 'night');
  g.set(ex - 1, cy - 1, 'cream');
  g.line(ex + 2, cy - 1, ex + 2, cy + 1, f.ramp[0]);
  if (f.whiskers) g.line(cx - rx - 1, cy + 1, cx - rx - 3, cy + 3, f.ramp[1]).line(cx - rx, cy + 1, cx - rx - 2, cy + 4, f.ramp[1]);
  return outline(g, { steps: 2 });
}

function squidIcon(): PixelGrid {
  const g = new PixelGrid(16, 16);
  // Mantle pointing up-right, fins at the tip, tentacles trailing down-left.
  const m = blobMask(16, 16, [
    [10, 6, 3, 4.5],
    [8, 9, 2.5, 2.5],
  ]);
  g.stamp(shade(m, ['wine', 'coral', 'peach', 'cream'], { rim: 0.3, gradient: 0.6 }));
  g.fillRect(12, 1, 2, 2, 'coral').fillRect(7, 1, 2, 2, 'coral');
  for (const [x0, len] of [[5, 5], [7, 6], [9, 5], [6, 4]] as Array<[number, number]>)
    for (let i = 0; i < len; i++) g.set(x0 - Math.floor(i / 2), 11 + i, i % 2 ? 'peach' : 'coral');
  g.set(8, 9, 'night').set(10, 9, 'night');
  return outline(g, { steps: 2 });
}

function seaweedIcon(): PixelGrid {
  const g = new PixelGrid(16, 16);
  for (const [x0, h, c] of [[4, 12, 'moss'], [8, 13, 'leaf'], [11, 10, 'moss']] as Array<[number, number, ColorName]>)
    for (let i = 0; i < h; i++) {
      const x = x0 + Math.round(Math.sin(i * 0.9) * 1.2);
      g.set(x, 14 - i, c).set(x + 1, 14 - i, i % 3 === 0 ? 'grass' : c);
    }
  return outline(g, { steps: 2 });
}

function shellIcon(): PixelGrid {
  // Scallop: a ribbed fan with a hinge.
  const g = new PixelGrid(16, 16);
  for (let y = 2; y < 13; y++)
    for (let x = 1; x < 15; x++) {
      const dx = x + 0.5 - 8;
      const dy = y + 0.5 - 13;
      const r = Math.hypot(dx, dy * 1.05);
      if (r > 10.5 || dy > -1) continue;
      const rib = Math.floor((Math.atan2(dy, dx) + Math.PI) * 3.2) % 2;
      g.set(x, y, r > 9.4 ? 'coral' : rib ? 'peach' : 'cream');
    }
  g.fillRect(6, 12, 5, 2, 'coral').fillRect(5, 13, 7, 1, 'brick');
  return outline(g, { steps: 2 });
}

function starfishIcon(): PixelGrid {
  const g = new PixelGrid(16, 16);
  for (let k = 0; k < 5; k++) {
    const a = -Math.PI / 2 + (k * Math.PI * 2) / 5;
    for (let i = 0; i <= 6; i++) {
      const x = Math.round(8 + Math.cos(a) * i);
      const y = Math.round(8.5 + Math.sin(a) * i);
      const w = i < 3 ? 1 : 0;
      g.fillRect(x - w, y - w, 1 + w * 2, 1 + w * 2, i > 4 ? 'coral' : 'amber');
    }
  }
  g.fillEllipse(6, 6, 5, 5, 'amber').set(8, 8, 'gold').set(7, 6, 'gold').set(10, 9, 'peach').set(6, 10, 'peach');
  return outline(g, { steps: 2 });
}

function pearlIcon(): PixelGrid {
  const g = new PixelGrid(16, 16);
  // Open oyster with a pearl.
  g.fillEllipse(1, 8, 14, 7, 'plum').fillEllipse(2, 8, 12, 5, 'haze').fillEllipse(3, 9, 10, 3, 'mist');
  g.fillEllipse(2, 2, 12, 6, 'mauve').fillEllipse(3, 3, 10, 4, 'plum');
  const p = shade(blobMask(16, 16, [[8, 9, 3, 3]]), ['haze', 'mist', 'cream', 'cream'], { rim: 0.4, gradient: 0.7 });
  g.stamp(p).set(7, 7, 'cream').set(9, 10, 'lilac');
  return outline(g, { steps: 2 });
}

function mushroomIcon(): PixelGrid {
  const g = new PixelGrid(16, 16);
  g.fillRect(6, 8, 4, 6, 'mist').fillRect(6, 8, 1, 6, 'cream').fillRect(9, 8, 1, 6, 'haze');
  const cap = blobMask(16, 16, [[8, 7, 6.5, 4]]);
  for (let y = 8; y < 16; y++) for (let x = 0; x < 16; x++) cap.set(x, y, null);
  g.stamp(shade(cap, ['bark', 'umber', 'clay', 'tan'], { rim: 0.35, gradient: 0.6 }));
  g.line(2, 8, 13, 8, 'umber');
  g.set(5, 5, 'sand').set(9, 4, 'sand').set(11, 6, 'sand');
  g.fillRect(4, 14, 8, 1, 'leaf').set(3, 14, 'moss');
  return outline(g, { steps: 2 });
}

function fernIcon(): PixelGrid {
  const g = new PixelGrid(16, 16);
  // A fiddlehead: a stalk curling into a spiral, with two small fronds.
  g.line(7, 15, 8, 8, 'leaf').line(8, 15, 9, 8, 'grass');
  const curl: Array<[number, number]> = [[9, 7], [10, 6], [10, 5], [9, 4], [8, 4], [7, 5], [7, 6], [8, 6], [9, 5]];
  for (const [x, y] of curl) g.set(x, y, 'grass').set(x + 1, y, x > 8 ? 'leaf' : 'lime');
  g.set(8, 5, 'lime');
  for (const [x, y, d] of [[7, 11, -1], [9, 12, 1]] as Array<[number, number, number]>) g.line(x, y, x + d * 4, y - 2, 'leaf').set(x + d * 2, y - 2, 'grass');
  return outline(g, { steps: 2 });
}

function eggIcon(ramp: [ColorName, ColorName, ColorName, ColorName], speckle?: ColorName): PixelGrid {
  const g = new PixelGrid(16, 16);
  // A couple of eggs in a bit of straw.
  g.line(2, 13, 13, 13, 'amber').line(3, 14, 12, 14, 'clay').set(1, 12, 'gold').set(14, 12, 'gold');
  g.stamp(shade(blobMask(16, 16, [[6, 9, 3.4, 4.2]]), ramp, { rim: 0.35, gradient: 0.7 }));
  g.stamp(shade(blobMask(16, 16, [[10.5, 10, 3.2, 3.8]]), ramp, { rim: 0.35, gradient: 0.7 }));
  g.set(5, 7, 'cream').set(10, 8, 'cream');
  if (speckle) g.set(7, 11, speckle).set(11, 12, speckle).set(9, 9, speckle);
  return outline(g, { steps: 2 });
}

function milkIcon(): PixelGrid {
  const g = new PixelGrid(16, 16);
  // Glass bottle of milk with a blue cap.
  g.stamp(shade(new PixelGrid(16, 16).fillRect(5, 6, 6, 9, 'ink').fillRect(6, 4, 4, 2, 'ink'), ['haze', 'mist', 'cream', 'cream'], { rim: 0.35 }));
  g.fillRect(6, 2, 4, 2, 'sea').fillRect(6, 2, 4, 1, 'sky');
  g.fillRect(5, 9, 6, 3, 'foam').fillRect(6, 10, 4, 1, 'sky');
  g.set(6, 7, 'cream').set(6, 13, 'cream');
  return outline(g, { steps: 2 });
}

function woolIcon(): PixelGrid {
  const g = new PixelGrid(16, 16);
  g.stamp(shade(blobMask(16, 16, [[8, 9, 5.5, 5], [5, 7, 3, 3], [11, 7, 3, 3]]), ['haze', 'mist', 'cream', 'cream'], { rim: 0.3, noise: 0.3, seed: 17 }));
  for (const [x, y] of [
    [5, 8],
    [9, 6],
    [11, 10],
    [7, 11],
  ])
    g.set(x, y, 'haze').set(x + 1, y, 'mist');
  return outline(g, { steps: 2 });
}

function honeyIcon(): PixelGrid {
  const g = new PixelGrid(16, 16);
  // A jar of golden honey with a cloth lid and a drip.
  g.stamp(shade(blobMask(16, 16, [[8, 10, 5, 4.6]]).fillRect(4, 6, 8, 4, 'ink'), ['clay', 'amber', 'gold', 'cream'], { rim: 0.35, gradient: 0.6 }));
  g.fillRect(4, 3, 8, 3, 'brick').fillRect(4, 3, 8, 1, 'coral').set(5, 5, 'wine').set(10, 5, 'wine');
  g.line(4, 6, 11, 6, 'umber');
  g.set(6, 8, 'cream').set(6, 9, 'cream');
  g.fillRect(9, 6, 1, 3, 'amber').set(9, 9, 'gold');
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
    seedMatahari: () => seedPacket((g) => sunflowerIcon().crop(3, 1, 10, 10).forEachFilled((x, y, c) => (y < 9 ? g.set(x + 3, y + 4, c) : null))),
    seedMawar: () => seedPacket((g) => g.fillRect(6, 6, 4, 4, 'brick').set(6, 6, 'rose').set(8, 8, 'wine').line(8, 10, 8, 12, 'moss').set(9, 11, 'leaf')),
    seedMelati: () =>
      seedPacket((g) => {
        for (const [x, y] of [
          [6, 7],
          [10, 9],
        ])
          g.fillRect(x - 1, y, 3, 1, 'cream').fillRect(x, y - 1, 1, 3, 'cream').set(x, y, 'gold');
        g.line(7, 12, 9, 10, 'leaf');
      }),
    matahari: sunflowerIcon,
    mawar: roseIcon,
    melati: jasmineIcon,
    nasiGoreng: friedRiceIcon,
    soto: sotoIcon,
    esTeh: icedTeaIcon,
    kopi: coffeeIcon,
    pisangGoreng: friedBananaIcon,
    kelapa: coconutIcon,
    pisang: bananaIcon,
    mangga: mangoIcon,
    jeruk: orangeIcon,
    semangka: watermelonIcon,
    rod: () => toolIcon('rod'),
    jambu: jambuIcon,
    ikanMas: () => fishIcon({ ramp: ['clay', 'amber', 'gold', 'cream'], fin: 'coral', ry: 3.4, belly: 'sand' }),
    lele: () => fishIcon({ ramp: ['night', 'plum', 'mauve', 'haze'], fin: 'night', ry: 2.4, rx: 5.6, whiskers: true }),
    nila: () => fishIcon({ ramp: ['pine', 'moss', 'mauve', 'haze'], fin: 'plum', stripes: 'plum', ry: 3.4 }),
    gurame: () => fishIcon({ ramp: ['plum', 'mauve', 'haze', 'mist'], fin: 'coral', ry: 4, rx: 4.6, spots: 'night' }),
    kakap: () => fishIcon({ ramp: ['wine', 'brick', 'coral', 'peach'], fin: 'brick', ry: 3.2, belly: 'peach' }),
    tongkol: () => fishIcon({ ramp: ['deep', 'sea', 'haze', 'mist'], fin: 'deep', ry: 3, rx: 5.5, stripes: 'deep', belly: 'mist' }),
    cumi: squidIcon,
    kerapu: () => fishIcon({ ramp: ['bark', 'umber', 'clay', 'tan'], fin: 'umber', ry: 3.8, rx: 5, spots: 'coral' }),
    rumputLaut: seaweedIcon,
    kerang: shellIcon,
    bintangLaut: starfishIcon,
    mutiara: pearlIcon,
    jamur: mushroomIcon,
    pakis: fernIcon,
    telur: () => eggIcon(['clay', 'tan', 'sand', 'cream'], 'clay'),
    telurBebek: () => eggIcon(['sea', 'sky', 'foam', 'cream']),
    susu: milkIcon,
    wol: woolIcon,
    madu: honeyIcon,
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
/** Ripe rice turns from green at the root to straw gold at the tips. */
const RICE_GOLD: readonly ColorName[] = ['leaf', 'amber', 'gold', 'sand'];

/**
 * A mound of fresh earth with the seeds peeking out, plus a little marker
 * stake whose flag has the crop's colour, so each bed reads at a glance.
 */
function seeded(seed: ColorName, flag: ColorName, flagDark: ColorName): PixelGrid {
  const g = new PixelGrid(CW, CH);
  g.fillEllipse(2, BASE_Y - 4, 10, 5, 'umber');
  g.fillEllipse(3, BASE_Y - 4, 8, 3, 'clay');
  for (const [x, y] of [
    [4, BASE_Y - 3],
    [7, BASE_Y - 4],
    [9, BASE_Y - 2],
  ])
    g.set(x, y, seed).set(x + 1, y, 'cream');
  g.line(13, BASE_Y - 9, 13, BASE_Y - 1, 'tan');
  g.fillRect(10, BASE_Y - 9, 3, 3, flag).set(10, BASE_Y - 7, flagDark).set(11, BASE_Y - 7, flagDark);
  return outline(g, { color: 'bark' });
}

/** Shaded foliage blob with an organic edge. */
function leafy(circles: ReadonlyArray<[number, number, number, number?]>, ramp: readonly ColorName[], seed: number): PixelGrid {
  return shade(blobMask(CW, CH, circles), ramp, { rim: 0.3, gradient: 0.6, noise: 0.18, seed });
}

/** A leaf as a small filled lens from the stem out to a tip. */
function leafBlade(g: PixelGrid, x0: number, y0: number, x1: number, y1: number, width: number, dark: ColorName, light: ColorName): void {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = Math.round(x0 + (x1 - x0) * t);
    const y = Math.round(y0 + (y1 - y0) * t);
    const w = Math.round(Math.sin(t * Math.PI) * width);
    for (let k = -w; k <= w; k++) g.set(x, y + k, k < 0 ? light : dark);
  }
}

function finish(g: PixelGrid): PixelGrid {
  return outline(g, { color: 'pine' });
}

// Rice: fine upright blades in a fan, turning golden with drooping grain heads.
function padiFrames(): PixelGrid[] {
  const sprout = new PixelGrid(CW, CH);
  for (const [x, y] of [
    [6, 15],
    [8, 13],
    [10, 15],
  ])
    blade(sprout, 8, BASE_Y, x, y, ['leaf', 'grass', 'lime']);
  const fan = (tips: Array<[number, number]>, ramp: readonly ColorName[]) => {
    const g = new PixelGrid(CW, CH);
    for (const [x, y] of tips) blade(g, 8, BASE_Y, x, y, ramp);
    return g;
  };
  const stage2 = fan(
    [
      [3, 14],
      [5, 12],
      [7, 10],
      [9, 10],
      [11, 12],
      [13, 14],
    ],
    GREEN,
  );
  const tallTips: Array<[number, number]> = [
    [1, 11],
    [3, 8],
    [5, 6],
    [7, 4],
    [9, 4],
    [11, 6],
    [13, 8],
    [15, 11],
    [6, 9],
    [10, 9],
  ];
  const stage3 = fan(tallTips, GREEN);
  const ripe = fan(tallTips, RICE_GOLD);
  for (const [x0, y0, dir] of [
    [5, 6, -1],
    [7, 4, -1],
    [9, 4, 1],
    [11, 6, 1],
    [3, 8, -1],
    [13, 8, 1],
  ] as const) {
    for (let k = 0; k < 6; k++) {
      const x = x0 + dir * Math.round(k * 0.5);
      const y = y0 + k;
      ripe.set(x, y, k % 2 ? 'amber' : 'gold');
      if (k % 2 === 0) ripe.set(x + dir, y, 'cream');
    }
  }
  return [seeded('cream', 'lime', 'leaf'), finish(sprout), finish(stage2), finish(stage3), finish(ripe)];
}

function cornLeaf(g: PixelGrid, x: number, y: number, dir: number, len: number): void {
  for (let i = 0; i < len; i++) {
    const t = i / len;
    const lx = x + dir * (i + 1);
    const ly = y - Math.round(Math.sin(t * Math.PI * 0.8) * 2.5) + Math.round(t * t * 3);
    g.set(lx, ly, t < 0.3 ? 'moss' : t < 0.75 ? 'leaf' : 'grass');
    if (t < 0.7) g.set(lx, ly + 1, 'moss');
  }
}

// Corn: one thick stalk with long arching leaves, cobs and a tassel.
function jagungFrames(): PixelGrid[] {
  const stalk = (top: number) => {
    const g = new PixelGrid(CW, CH);
    g.fillRect(7, top, 1, BASE_Y - top + 1, 'leaf').fillRect(8, top, 1, BASE_Y - top + 1, 'moss');
    return g;
  };
  const sprout = stalk(16);
  cornLeaf(sprout, 7, 18, -1, 4);
  cornLeaf(sprout, 8, 17, 1, 4);
  const s2 = stalk(12);
  cornLeaf(s2, 7, 19, -1, 6);
  cornLeaf(s2, 8, 16, 1, 6);
  cornLeaf(s2, 7, 13, -1, 4);
  const big = () => {
    const g = stalk(3);
    cornLeaf(g, 7, 20, -1, 7);
    cornLeaf(g, 8, 17, 1, 7);
    cornLeaf(g, 7, 14, -1, 7);
    cornLeaf(g, 8, 11, 1, 6);
    cornLeaf(g, 7, 8, -1, 5);
    cornLeaf(g, 8, 6, 1, 4);
    return g;
  };
  const s3 = big();
  const ripe = big();
  // Two cobs in their husks and a golden tassel.
  for (const [x, y] of [
    [9, 10],
    [4, 14],
  ]) {
    ripe.fillRect(x, y, 3, 6, 'gold').fillRect(x, y, 1, 6, 'cream').fillRect(x + 2, y + 1, 1, 5, 'amber');
    ripe.set(x + 1, y - 1, 'sand').set(x, y + 6, 'grass').set(x + 1, y + 6, 'leaf').set(x + 2, y + 6, 'leaf');
  }
  for (const [x, y] of [
    [5, 1],
    [6, 0],
    [7, 1],
    [8, 0],
    [9, 1],
    [10, 2],
    [6, 2],
    [8, 2],
  ])
    ripe.set(x, y, y < 1 ? 'sand' : 'amber');
  return [seeded('gold', 'amber', 'clay'), finish(sprout), finish(s2), finish(s3), finish(ripe)];
}

// Chili: an upright, narrow, dark bush on branching stems; white flowers, then
// lots of long red pods hanging down.
function cabaiFrames(): PixelGrid[] {
  const DARK: readonly ColorName[] = ['pine', 'moss', 'leaf', 'grass'];
  const stems = (g: PixelGrid, top: number) => {
    g.line(8, BASE_Y, 8, top, 'moss');
    g.line(8, top + 6, 5, top + 2, 'moss').line(8, top + 4, 11, top, 'moss');
  };
  const sprout = new PixelGrid(CW, CH);
  sprout.line(8, BASE_Y, 8, BASE_Y - 4, 'leaf');
  leafBlade(sprout, 8, BASE_Y - 4, 5, BASE_Y - 6, 1, 'leaf', 'lime');
  leafBlade(sprout, 8, BASE_Y - 4, 11, BASE_Y - 6, 1, 'leaf', 'lime');
  const s2 = new PixelGrid(CW, CH);
  stems(s2, 13);
  s2.stamp(leafy([[8, 13, 3.5, 4], [5, 15, 2.5, 2.5], [11, 14, 2.5, 2.5]], DARK, 1201));
  const bush = () => {
    const g = new PixelGrid(CW, CH);
    stems(g, 6);
    g.stamp(leafy([[8, 9, 4, 6], [5, 12, 3, 4], [11, 11, 3, 4], [8, 4, 3, 3]], DARK, 1202));
    // Pointed leaf tips poking out of the silhouette.
    for (const [x, y] of [
      [3, 11],
      [13, 10],
      [8, 1],
      [4, 15],
      [12, 15],
    ])
      g.set(x, y, 'leaf');
    return g;
  };
  const flowering = bush();
  for (const [x, y] of [
    [6, 7],
    [10, 9],
    [7, 12],
    [11, 5],
  ])
    flowering.set(x, y, 'cream').set(x + 1, y, 'mist').set(x, y + 1, 'gold');
  const ripe = bush();
  for (const [x, y] of [
    [4, 9],
    [6, 13],
    [9, 7],
    [11, 11],
    [12, 6],
    [7, 4],
    [10, 14],
  ]) {
    ripe.set(x, y - 1, 'moss');
    ripe.set(x, y, 'coral').set(x, y + 1, 'brick').set(x, y + 2, 'brick').set(x + 1, y + 3, 'wine').set(x - 1, y, 'peach');
  }
  return [seeded('sand', 'brick', 'wine'), finish(sprout), finish(s2), finish(flowering), finish(ripe)];
}

// Eggplant: low and wide, with big broad leaves on purple stems; lilac flowers,
// then fat glossy purple fruit.
function terongFrames(): PixelGrid[] {
  const BROAD: readonly ColorName[] = ['moss', 'leaf', 'leaf', 'grass'];
  const sprout = new PixelGrid(CW, CH);
  sprout.line(8, BASE_Y, 8, BASE_Y - 3, 'violet');
  leafBlade(sprout, 8, BASE_Y - 3, 4, BASE_Y - 5, 2, 'leaf', 'grass');
  leafBlade(sprout, 8, BASE_Y - 3, 12, BASE_Y - 5, 2, 'leaf', 'grass');
  const wide = (h: number, seed: number) => {
    const g = new PixelGrid(CW, CH);
    const cy = BASE_Y - 2 - h / 2;
    g.stamp(leafy([[4, cy + 1, 4, h / 2], [12, cy + 1, 4, h / 2], [8, cy - 1, 4.5, h / 2]], BROAD, seed));
    // Purple veins and stems.
    g.line(8, BASE_Y, 8, cy, 'violet').line(8, cy + 2, 3, cy, 'violet').line(8, cy + 2, 13, cy, 'violet');
    return g;
  };
  const s2 = wide(6, 1301);
  const s3 = wide(10, 1302);
  const flowering = s3.clone();
  for (const [x, y] of [
    [5, 11],
    [10, 12],
    [12, 9],
  ])
    flowering.set(x, y, 'lilac').set(x + 1, y, 'lilac').set(x, y + 1, 'lilac').set(x + 1, y + 1, 'gold');
  const ripe = s3.clone();
  for (const [x, y] of [
    [3, 14],
    [10, 15],
    [7, 11],
  ]) {
    const fruit = shade(blobMask(CW, CH, [[x + 2, y + 3, 2.2, 3]]), ['night', 'violet', 'violet', 'lilac'], { rim: 0.35, gradient: 0.7 });
    ripe.stamp(fruit);
    ripe.set(x + 1, y + 1, 'rose');
    ripe.fillRect(x + 1, y - 1, 3, 1, 'leaf').set(x + 2, y - 2, 'moss');
  }
  return [seeded('tan', 'violet', 'night'), finish(sprout), finish(s2), finish(flowering), finish(ripe)];
}

// Sunflower: a tall stalk with heart leaves and a big golden head.
function matahariFrames(): PixelGrid[] {
  const stalk = (top: number, leaves: number) => {
    const g = new PixelGrid(CW, CH);
    g.fillRect(7, top, 2, BASE_Y - top + 1, 'leaf').fillRect(8, top, 1, BASE_Y - top + 1, 'moss');
    for (let i = 0; i < leaves; i++) {
      const y = BASE_Y - 4 - i * 4;
      const d = i % 2 ? 1 : -1;
      leafBlade(g, 8, y, 8 + d * 5, y - 1, 2, 'leaf', 'grass');
    }
    return g;
  };
  const sprout = new PixelGrid(CW, CH);
  sprout.line(8, BASE_Y, 8, BASE_Y - 4, 'leaf');
  leafBlade(sprout, 8, BASE_Y - 4, 5, BASE_Y - 5, 1, 'leaf', 'lime');
  leafBlade(sprout, 8, BASE_Y - 4, 11, BASE_Y - 5, 1, 'leaf', 'lime');
  const s2 = stalk(12, 2);
  const bud = stalk(5, 3);
  bud.fillEllipse(6, 2, 5, 5, 'leaf').set(7, 3, 'grass').set(8, 1, 'gold');
  const bloom = stalk(8, 3);
  // Petals around a dark seed disc.
  for (let a = 0; a < 12; a++) {
    const ang = (a / 12) * Math.PI * 2;
    const x = Math.round(8 + Math.cos(ang) * 5);
    const y = Math.round(5 + Math.sin(ang) * 4);
    bloom.set(x, y, a % 2 ? 'gold' : 'amber');
    bloom.set(Math.round(8 + Math.cos(ang) * 4), Math.round(5 + Math.sin(ang) * 3), 'gold');
  }
  bloom.fillEllipse(6, 3, 5, 5, 'umber').set(7, 4, 'clay').set(9, 6, 'bark').set(4, 2, 'cream');
  return [seeded('night', 'gold', 'amber'), finish(sprout), finish(s2), finish(bud), finish(bloom)];
}

// Rose: a dark thorny bush with deep red and pink blooms.
function mawarFrames(): PixelGrid[] {
  const DARK: readonly ColorName[] = ['pine', 'moss', 'leaf', 'leaf'];
  const sprout = new PixelGrid(CW, CH);
  sprout.line(8, BASE_Y, 8, BASE_Y - 5, 'moss').set(7, BASE_Y - 3, 'wine');
  leafBlade(sprout, 8, BASE_Y - 5, 5, BASE_Y - 7, 1, 'moss', 'leaf');
  leafBlade(sprout, 8, BASE_Y - 4, 11, BASE_Y - 6, 1, 'moss', 'leaf');
  const bush = (h: number, seed: number) => {
    const g = new PixelGrid(CW, CH);
    const cy = BASE_Y - 2 - h / 2;
    g.line(8, BASE_Y, 8, cy, 'moss');
    g.stamp(leafy([[8, cy, 5.5, h / 2], [4, cy + 2, 3, 3], [12, cy + 2, 3, 3]], DARK, seed));
    return g;
  };
  const s2 = bush(7, 1401);
  const budding = bush(12, 1402);
  for (const [x, y] of [
    [5, 11],
    [10, 9],
    [8, 13],
  ])
    budding.set(x, y, 'wine').set(x, y - 1, 'brick');
  const bloom = bush(12, 1402);
  for (const [x, y, c] of [
    [4, 10, 'brick'],
    [9, 8, 'rose'],
    [11, 12, 'brick'],
    [6, 14, 'rose'],
    [8, 11, 'brick'],
  ] as Array<[number, number, ColorName]>) {
    // A small spiral bloom: petals, a dark heart and a highlight.
    const hl: ColorName = c === 'rose' ? 'cream' : 'rose';
    const dk: ColorName = c === 'rose' ? 'brick' : 'wine';
    bloom.fillRect(x, y, 3, 3, c).set(x + 1, y + 1, dk).set(x, y, hl).set(x + 2, y + 2, dk);
  }
  return [seeded('umber', 'rose', 'brick'), finish(sprout), finish(s2), finish(budding), finish(bloom)];
}

// Jasmine: a bright, airy bush covered in little white star flowers.
function melatiFrames(): PixelGrid[] {
  const sprout = new PixelGrid(CW, CH);
  sprout.line(8, BASE_Y, 8, BASE_Y - 4, 'leaf');
  leafBlade(sprout, 8, BASE_Y - 4, 6, BASE_Y - 7, 1, 'grass', 'lime');
  leafBlade(sprout, 8, BASE_Y - 3, 11, BASE_Y - 5, 1, 'grass', 'lime');
  const bush = (h: number, seed: number) => {
    const g = new PixelGrid(CW, CH);
    const cy = BASE_Y - 2 - h / 2;
    g.stamp(leafy([[8, cy, 5, h / 2], [4, cy + 1, 3.5, 3], [12, cy + 1, 3.5, 3], [8, cy - h / 3, 3, 2.5]], GREEN, seed));
    return g;
  };
  const s2 = bush(7, 1501);
  const budding = bush(11, 1502);
  for (const [x, y] of [
    [5, 10],
    [9, 9],
    [11, 13],
    [7, 14],
  ])
    budding.set(x, y, 'mist');
  const bloom = bush(11, 1502);
  for (const [x, y] of [
    [4, 11],
    [8, 8],
    [11, 10],
    [6, 14],
    [10, 15],
    [13, 13],
    [7, 11],
  ])
    bloom.set(x, y, 'gold').set(x - 1, y, 'cream').set(x + 1, y, 'cream').set(x, y - 1, 'cream').set(x, y + 1, 'mist');
  return [seeded('mist', 'cream', 'haze'), finish(sprout), finish(s2), finish(budding), finish(bloom)];
}

const CROP_ART: Record<string, () => PixelGrid[]> = {
  padi: padiFrames,
  jagung: jagungFrames,
  cabai: cabaiFrames,
  terong: terongFrames,
  matahari: matahariFrames,
  mawar: mawarFrames,
  melati: melatiFrames,
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
  for (const kind of ['hoe', 'can', 'axe', 'pickaxe', 'scythe', 'rod'] as const) sink.sheet(toolTexture(kind), swingFrames(kind), TOOL_FRAME.w, TOOL_FRAME.h, 3);
  sink.sheet(ITEM_TEXTURES.cursor, [cursor('cream'), cursor('coral')], 18, 18);
  sink.sheet(ITEM_TEXTURES.bits, bits(), 4, 4);
}
