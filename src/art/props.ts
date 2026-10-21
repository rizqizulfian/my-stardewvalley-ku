// World props: trees, bushes, rocks, stumps, fences, lamps, buildings, decor.
// Silhouettes are built from masks, then shaded with a material ramp (lit
// from the top-left) and outlined in a darker shade of their own fill.

import {
  PixelGrid,
  blobMask,
  ditherPick,
  hash2,
  innerShadow,
  outline,
  rng,
  shade,
  type TextureSink,
} from './pixel';
import { textGrid } from './font';
import { RAMPS, darker, type ColorName, type Ramp } from './palette';

export const PROP_TEXTURES = {
  treeRound: 'prop-tree-round',
  treeFruit: 'prop-tree-fruit',
  treeSlender: 'prop-tree-slender',
  bush: 'prop-bush',
  bushBerry: 'prop-bush-berry',
  rock: 'prop-rock',
  boulder: 'prop-boulder',
  stump: 'prop-stump',
  weeds: 'prop-weeds',
  branch: 'prop-branch',
  log: 'prop-log',
  fence: 'prop-fence',
  lamp: 'prop-lamp',
  lampLit: 'prop-lamp-lit',
  shippingBox: 'prop-shipping-box',
  mailbox: 'prop-mailbox',
  house: 'prop-house',
  houseLit: 'prop-house-lit',
  lumbung: 'prop-lumbung',
  lumbungLit: 'prop-lumbung-lit',
  flowers: 'decor-flowers',
  tuft: 'decor-tuft',
  pebbles: 'decor-pebbles',
  reeds: 'decor-reeds',
  lily: 'decor-lily',
  shadowS: 'shadow-s',
  shadowM: 'shadow-m',
  shadowL: 'shadow-l',
  shadowXL: 'shadow-xl',
} as const;

/** Sway animation frames for swaying props: [-1, 0, +1] pixel shear. */
export const SWAY_FRAMES = 3;
export const SWAY_SEQUENCE = [1, 2, 1, 0] as const;
export const FLOWER_VARIANTS = 6;
export const PEBBLE_VARIANTS = 3;

/** Fence connection bits. */
export const FENCE = { N: 1, E: 2, S: 4, W: 8 } as const;

// ---------------------------------------------------------------------------
// Foliage helpers

interface Clump {
  x: number;
  y: number;
  r: number;
  ry?: number;
}

/**
 * Draw a canopy as overlapping leaf clumps. Each clump is shaded on its own,
 * biased by its place in the canopy, and darkened along its lower-right rim
 * so the clumps separate visually.
 */
function canopy(w: number, h: number, clumps: Clump[], ramp: Ramp, seed: number, cx: number, cy: number, spread: number): PixelGrid {
  const g = new PixelGrid(w, h);
  const sorted = [...clumps].sort((a, b) => a.y - b.y);
  for (const c of sorted) {
    const mask = blobMask(w, h, [[c.x, c.y, c.r, c.ry ?? c.r * 0.9]]);
    const bias = ((cx - c.x) / spread) * 0.25 + ((cy - c.y) / spread) * 0.35;
    let s = shade(mask, ramp, { rim: 0.25, gradient: 0.55, bias, dither: 0.25, noise: 0.08, seed: seed + c.x * 7 + c.y });
    s = innerShadow(s, 1);
    g.stamp(s);
  }
  // Sparkles of warm highlight on the lit side.
  const r = rng(seed);
  for (let i = 0; i < Math.floor(w * h * 0.012); i++) {
    const x = Math.floor(r() * w * 0.65);
    const y = Math.floor(r() * h * 0.6);
    const col = g.colorAt(x, y);
    if (col && col !== ramp[0] && g.filled(x - 1, y) && g.filled(x, y - 1)) g.set(x, y, ramp[ramp.length - 1]);
  }
  return g;
}

function trunk(g: PixelGrid, x: number, top: number, bottom: number, width: number): void {
  const mask = new PixelGrid(g.w, g.h);
  for (let y = top; y <= bottom; y++) {
    const flare = y >= bottom - 2 ? (y - (bottom - 3)) : 0;
    mask.fillRect(x - flare, y, width + flare * 2, 1, 'ink');
  }
  const s = shade(mask, RAMPS.wood, { rim: 0.3, gradient: 0.6, dither: 0.5 });
  // Bark grooves.
  s.forEachFilled((px, py) => {
    if ((px - x) % 3 === 1 && hash2(px, py, 81) < 0.5) s.set(px, py, 'umber');
  });
  g.stamp(outline(s, { steps: 2 }));
}

function withSway(base: PixelGrid, swaying: PixelGrid, pivotY: number): PixelGrid[] {
  return [-1, 0, 1].map((a) => base.clone().stamp(a === 0 ? swaying : swaying.sway(a, pivotY)));
}

// ---------------------------------------------------------------------------
// Trees

function roundTree(fruit: boolean): PixelGrid[] {
  const W = 32;
  const H = 46;
  const base = new PixelGrid(W, H);
  trunk(base, 13, 26, H - 2, 6);
  // Canopy shadow falling on the upper trunk.
  for (let y = 26; y < 30; y++) for (let x = 12; x < 20; x++) if (base.filled(x, y)) base.set(x, y, 'bark');

  const clumps: Clump[] = [
    { x: 16, y: 6, r: 7 },
    { x: 9, y: 10, r: 7 },
    { x: 23, y: 10, r: 7 },
    { x: 6, y: 18, r: 6 },
    { x: 26, y: 18, r: 6 },
    { x: 16, y: 15, r: 9 },
    { x: 11, y: 24, r: 6, ry: 5 },
    { x: 21, y: 24, r: 6, ry: 5 },
  ];
  let top = canopy(W, H, clumps, RAMPS.foliage, fruit ? 902 : 901, 16, 15, 12);
  top = outline(top, { color: 'pine' });
  if (fruit) {
    const r = rng(77);
    for (let i = 0; i < 9; i++) {
      const x = 5 + Math.floor(r() * 22);
      const y = 6 + Math.floor(r() * 18);
      if (top.colorAt(x, y) && top.colorAt(x, y) !== 'pine' && top.colorAt(x + 1, y + 1)) {
        top.set(x, y, 'peach').set(x + 1, y, 'coral').set(x, y + 1, 'coral').set(x + 1, y + 1, 'brick');
      }
    }
  }
  return withSway(base, top, 28);
}

function slenderTree(): PixelGrid[] {
  const W = 22;
  const H = 46;
  const base = new PixelGrid(W, H);
  trunk(base, 9, 34, H - 2, 4);
  const top = new PixelGrid(W, H);
  // Stacked tiers, widest at the bottom, each shaded separately.
  const tiers = [
    { y: 2, h: 10, w: 8 },
    { y: 8, h: 11, w: 12 },
    { y: 15, h: 12, w: 16 },
    { y: 23, h: 13, w: 20 },
  ];
  tiers.forEach((t, i) => {
    const mask = new PixelGrid(W, H);
    for (let y = 0; y < t.h; y++) {
      const ww = Math.max(2, Math.round((t.w * (y + 2)) / (t.h + 1)));
      const wobble = hash2(i, y, 91) < 0.3 ? 1 : 0;
      mask.fillRect(Math.round(W / 2 - ww / 2) - wobble, t.y + y, ww + wobble, 1, 'ink');
    }
    const s = innerShadow(shade(mask, RAMPS.foliage.slice(0, 4), { rim: 0.25, gradient: 0.6, bias: 0.1 - i * 0.05, dither: 0.25, noise: 0.06, seed: 300 + i }));
    top.stamp(s);
  });
  return withSway(base, outline(top, { color: 'pine' }), 34);
}

function bush(berries: boolean): PixelGrid[] {
  const W = 20;
  const H = 16;
  const base = new PixelGrid(W, H);
  let top = canopy(
    W,
    H,
    [
      { x: 6, y: 9, r: 5 },
      { x: 13, y: 8, r: 6 },
      { x: 10, y: 6, r: 5 },
      { x: 9, y: 11, r: 5, ry: 4 },
      { x: 15, y: 11, r: 4 },
    ],
    RAMPS.foliage.slice(0, 4),
    berries ? 505 : 504,
    10,
    8,
    7,
  );
  top = outline(top, { color: 'pine' });
  if (berries) {
    for (const [x, y] of [
      [6, 7],
      [12, 5],
      [14, 10],
      [8, 11],
      [16, 8],
    ])
      top.set(x, y, 'rose').set(x + 1, y + 1, 'brick');
  }
  return withSway(base, top, 13);
}

// ---------------------------------------------------------------------------
// Stones and wood debris

function rock(w: number, h: number, circles: Array<[number, number, number, number?]>, seed: number, mossy: boolean): PixelGrid {
  const mask = blobMask(w, h, circles);
  let s = shade(mask, RAMPS.stone.slice(1), { rim: 0.3, gradient: 0.6, dither: 0.25, noise: 0.08, seed });
  // Facet line: a darker crack across the lower right.
  const r = rng(seed);
  const cx = Math.floor(w * (0.45 + r() * 0.15));
  for (let y = Math.floor(h * 0.35); y < h - 2; y++) {
    const x = cx + Math.floor((y - h * 0.35) * 0.5);
    if (s.colorAt(x, y) && s.colorAt(x + 1, y)) s.set(x, y, 'plum');
  }
  if (mossy) {
    s.forEachFilled((x, y) => {
      if (!s.filled(x, y - 1) || (!s.filled(x, y - 2) && hash2(x, y, seed) < 0.5)) {
        if (hash2(x, y, seed + 1) < 0.65) s.set(x, y, hash2(x, y, seed + 2) < 0.5 ? 'grass' : 'leaf');
      }
    });
  }
  s = outline(s, { steps: 2 });
  return s;
}

function stump(): PixelGrid {
  const g = new PixelGrid(16, 16);
  const side = new PixelGrid(16, 16).fillRect(3, 7, 10, 7, 'ink').fillEllipse(3, 11, 10, 4, 'ink');
  // Roots.
  side.fillRect(2, 12, 2, 2, 'ink').fillRect(12, 12, 2, 2, 'ink');
  g.stamp(shade(side, RAMPS.wood, { rim: 0.3, gradient: 0.7, dither: 0.5 }));
  for (let y = 8; y < 14; y++) for (let x = 4; x < 12; x += 3) if (g.filled(x, y) && hash2(x, y, 3) < 0.6) g.set(x, y, 'umber');
  // Cut top with rings.
  g.fillEllipse(3, 4, 10, 6, 'tan');
  g.fillEllipse(5, 5, 6, 4, 'sand');
  g.fillEllipse(7, 6, 2, 2, 'clay');
  g.set(4, 5, 'sand').set(5, 4, 'sand');
  for (let x = 4; x < 12; x++) if (g.colorAt(x, 9) === 'tan') g.set(x, 9, 'clay');
  return outline(g, { steps: 2 });
}

function weeds(): PixelGrid[] {
  const base = new PixelGrid(16, 16);
  const top = new PixelGrid(16, 16);
  const r = rng(615);
  for (let i = 0; i < 9; i++) {
    const bx = 3 + Math.floor(r() * 10);
    const len = 5 + Math.floor(r() * 6);
    const lean = r() < 0.5 ? -1 : 1;
    for (let k = 0; k < len; k++) {
      const x = bx + Math.round((k * k * lean) / (len * 2.2));
      const y = 14 - k;
      const c: ColorName = k < 2 ? 'moss' : k > len - 3 ? 'lime' : 'leaf';
      top.set(x, y, c);
    }
  }
  top.set(5, 6, 'gold').set(11, 5, 'cream');
  return withSway(base, outline(top, { color: 'pine' }), 14);
}

function branch(): PixelGrid {
  const g = new PixelGrid(16, 16);
  g.line(2, 11, 13, 7, 'clay').line(2, 12, 13, 8, 'umber').line(8, 9, 10, 4, 'umber').line(7, 9, 9, 4, 'clay');
  g.set(2, 11, 'tan').set(3, 11, 'tan').set(9, 4, 'tan');
  g.set(10, 3, 'leaf').set(11, 3, 'grass').set(11, 2, 'lime');
  return outline(g, { steps: 2 });
}

function log(): PixelGrid {
  const g = new PixelGrid(32, 16);
  const body = new PixelGrid(32, 16).fillRect(6, 4, 24, 9, 'ink');
  g.stamp(shade(body, RAMPS.wood, { rim: 0.25, gradient: 0.8, dither: 0.6 }));
  for (let x = 8; x < 29; x += 4) g.line(x, 6, x + 2, 6, 'umber');
  g.fillEllipse(2, 4, 8, 9, 'tan').fillEllipse(4, 6, 4, 5, 'sand').set(5, 8, 'clay');
  // Moss along the top.
  for (let x = 10; x < 28; x++) if (hash2(x, 0, 5) < 0.4) g.set(x, 4, 'leaf');
  return outline(g, { steps: 2 });
}

// ---------------------------------------------------------------------------
// Built props

function fence(mask: number): PixelGrid {
  const g = new PixelGrid(16, 16);
  const wood = RAMPS.lightWood;
  const rail = (x0: number, x1: number, y: number) => {
    for (let x = x0; x <= x1; x++) {
      g.set(x, y, wood[2]).set(x, y + 1, wood[1]);
    }
  };
  if (mask & FENCE.W) {
    rail(0, 6, 6);
    rail(0, 6, 10);
  }
  if (mask & FENCE.E) {
    rail(9, 15, 6);
    rail(9, 15, 10);
  }
  if (mask & FENCE.N) g.fillRect(7, 0, 2, 4, wood[1]).fillRect(7, 0, 1, 4, wood[2]);
  if (mask & FENCE.S) g.fillRect(7, 13, 2, 3, wood[1]).fillRect(7, 13, 1, 3, wood[2]);
  // Post.
  const post = new PixelGrid(16, 16).fillRect(6, 3, 4, 11, 'ink');
  g.stamp(shade(post, wood, { rim: 0.35, gradient: 0.5 }));
  g.set(6, 3, 'sand').set(7, 3, 'sand').set(8, 3, 'tan').set(9, 3, 'clay');
  return outline(g, { steps: 2 });
}

function lamp(lit: boolean): PixelGrid {
  const g = new PixelGrid(16, 32);
  // Pole and base.
  const pole = new PixelGrid(16, 32).fillRect(7, 10, 2, 19, 'ink').fillRect(5, 28, 6, 3, 'ink');
  g.stamp(shade(pole, RAMPS.stone.slice(0, 3), { rim: 0.4 }));
  // Lantern housing.
  g.fillRect(4, 2, 8, 1, 'plum').fillRect(5, 1, 6, 1, 'mauve').fillRect(7, 0, 2, 1, 'plum');
  g.fillRect(4, 3, 1, 6, 'plum').fillRect(11, 3, 1, 6, 'night').fillRect(4, 9, 8, 1, 'night');
  g.fillRect(7, 3, 2, 6, 'plum');
  const glassA: ColorName = lit ? 'cream' : 'tan';
  const glassB: ColorName = lit ? 'gold' : 'clay';
  g.fillRect(5, 3, 2, 6, glassA).fillRect(9, 3, 2, 6, glassB);
  if (!lit) g.set(5, 3, 'sand');
  const out = outline(g, { steps: 2 });
  if (!lit) return out;
  // Emissive layer: only the glowing glass.
  const e = new PixelGrid(16, 32);
  e.fillRect(5, 3, 2, 6, 'cream').fillRect(9, 3, 2, 6, 'gold').set(5, 3, 'cream');
  return e;
}

function shippingBox(): PixelGrid {
  const g = new PixelGrid(24, 20);
  const body = new PixelGrid(24, 20).fillRect(2, 7, 20, 11, 'ink');
  g.stamp(shade(body, RAMPS.wood, { rim: 0.3, gradient: 0.6, dither: 0.4 }));
  for (let y = 9; y < 18; y += 3) g.line(3, y, 20, y, 'umber');
  // Lid, slightly lighter and overhanging.
  const lid = new PixelGrid(24, 20).fillRect(1, 3, 22, 5, 'ink');
  g.stamp(shade(lid, RAMPS.lightWood, { rim: 0.35, gradient: 0.6 }));
  // Brass corners and latch.
  g.fillRect(2, 8, 2, 2, 'amber').fillRect(20, 8, 2, 2, 'clay').fillRect(11, 6, 2, 3, 'gold').set(11, 8, 'amber');
  return outline(g, { steps: 2 });
}

function mailbox(): PixelGrid {
  const g = new PixelGrid(16, 24);
  const post = new PixelGrid(16, 24).fillRect(7, 10, 2, 13, 'ink');
  g.stamp(shade(post, RAMPS.wood, { rim: 0.4 }));
  const box = new PixelGrid(16, 24).fillRect(3, 3, 10, 7, 'ink').fillEllipse(3, 1, 10, 5, 'ink');
  g.stamp(shade(box, RAMPS.roof, { rim: 0.3, gradient: 0.6, dither: 0.4 }));
  g.fillRect(12, 2, 1, 4, 'gold').fillRect(13, 2, 2, 2, 'amber');
  g.line(4, 6, 11, 6, 'wine');
  return outline(g, { steps: 2 });
}

/**
 * Player house: a hip roof of clay tiles over a timber house on a stone
 * footing. Returns [day sprite, emissive night overlay].
 */
export interface HouseStyle {
  /** Roof tiles, dark to light (like RAMPS.roof). */
  roof: readonly [ColorName, ColorName, ColorName, ColorName];
  walls: 'wood' | 'plaster';
  /** Painted sign board over the door. */
  sign?: string;
  /** Striped cloth awning over the front: [stripe, base]. */
  awning?: [ColorName, ColorName];
  seed?: number;
}

const DEFAULT_HOUSE: HouseStyle = { roof: ['wine', 'brick', 'coral', 'peach'], walls: 'wood' };

export function house(o: HouseStyle = DEFAULT_HOUSE): [PixelGrid, PixelGrid] {
  const [rDark, rMid, rLight, rHi] = o.roof;
  const W = 80;
  const H = 74;
  const g = new PixelGrid(W, H);
  const eave = 38;
  const wallTop = eave + 2;
  const footTop = H - 7;

  // Walls: vertical planks.
  const wall = new PixelGrid(W, H).fillRect(6, wallTop, W - 12, footTop - wallTop, 'ink');
  if (o.walls === 'wood') {
    g.stamp(shade(wall, RAMPS.lightWood, { rim: 0.15, gradient: 0.45, bias: -0.05, dither: 0.5 }));
    for (let x = 6; x < W - 6; x += 5) for (let y = wallTop; y < footTop; y++) g.set(x, y, 'umber');
    for (let x = 6; x < W - 6; x++) if (hash2(x, 1, 4) < 0.5) g.set(x, wallTop + 12 + (x % 3), 'clay');
  } else {
    // Lime plaster over a wooden frame: a beam along the top and a dado line.
    g.stamp(shade(wall, RAMPS.plaster, { rim: 0.1, gradient: 0.35, bias: 0.15, dither: 0.6, noise: 0.15, seed: o.seed ?? 3 }));
    for (let x = 6; x < W - 6; x++) g.set(x, wallTop + 2, 'clay').set(x, footTop - 6, 'haze');
  }
  // Corner posts.
  g.stamp(shade(new PixelGrid(W, H).fillRect(5, wallTop, 3, footTop - wallTop, 'ink'), RAMPS.wood, { rim: 0.4 }));
  g.stamp(shade(new PixelGrid(W, H).fillRect(W - 8, wallTop, 3, footTop - wallTop, 'ink'), RAMPS.wood, { rim: 0.4, bias: -0.2 }));

  // Stone footing.
  const foot = new PixelGrid(W, H).fillRect(4, footTop, W - 8, 6, 'ink');
  g.stamp(shade(foot, RAMPS.stone.slice(1), { rim: 0.3, gradient: 0.4, dither: 0.6, noise: 0.3, seed: 12 }));
  for (let x = 4; x < W - 4; x += 7) g.line(x + ((footTop / 2) % 3), footTop, x + ((footTop / 2) % 3), footTop + 2, 'plum');
  for (let x = 8; x < W - 4; x += 7) g.line(x, footTop + 3, x, footTop + 5, 'plum');
  g.line(4, footTop + 2, W - 5, footTop + 2, 'plum');

  // Door with frame, panels and a step.
  const dx = 34;
  const dw = 12;
  const dTop = wallTop + 8;
  g.fillRect(dx - 2, dTop - 2, dw + 4, footTop - dTop + 2, 'bark');
  g.stamp(shade(new PixelGrid(W, H).fillRect(dx, dTop, dw, footTop - dTop, 'ink'), RAMPS.wood, { rim: 0.25, gradient: 0.6 }));
  g.line(dx + dw / 2, dTop, dx + dw / 2, footTop - 1, 'umber');
  g.fillRect(dx + 2, dTop + 3, 3, 6, 'umber').fillRect(dx + dw - 5, dTop + 3, 3, 6, 'umber');
  g.fillRect(dx + 2, dTop + 12, 3, 5, 'umber').fillRect(dx + dw - 5, dTop + 12, 3, 5, 'umber');
  g.set(dx + dw / 2 + 2, dTop + 11, 'gold').set(dx + dw / 2 - 3, dTop + 11, 'gold');
  g.stamp(shade(new PixelGrid(W, H).fillRect(dx - 3, footTop, dw + 6, 3, 'ink'), RAMPS.stone.slice(1), { rim: 0.4 }));

  // Windows: frame, glass with a diagonal glint, mullions, flower box.
  const windows = [
    { x: 13, y: wallTop + 7, w: 14, h: 12 },
    { x: W - 27, y: wallTop + 7, w: 14, h: 12 },
  ];
  const lit = new PixelGrid(W, H);
  for (const wnd of windows) {
    g.fillRect(wnd.x - 1, wnd.y - 1, wnd.w + 2, wnd.h + 2, 'bark');
    g.fillRect(wnd.x, wnd.y, wnd.w, wnd.h, 'sea');
    for (let i = 0; i < wnd.h; i++) {
      g.set(wnd.x + i, wnd.y + i, 'sky');
      if (i + 3 < wnd.w) g.set(wnd.x + i + 3, wnd.y + i, 'foam');
    }
    g.fillRect(wnd.x, wnd.y, wnd.w, 2, 'deep');
    g.fillRect(wnd.x + wnd.w / 2, wnd.y, 1, wnd.h, 'umber').fillRect(wnd.x, wnd.y + wnd.h / 2, wnd.w, 1, 'umber');
    // Night glass: warm, brighter in the middle.
    for (let y = 0; y < wnd.h; y++)
      for (let x = 0; x < wnd.w; x++) {
        const d = Math.hypot(x - wnd.w / 2, y - wnd.h / 2) / (wnd.w / 2);
        lit.set(wnd.x + x, wnd.y + y, d < 0.45 ? 'cream' : d < 0.8 ? 'gold' : 'amber');
      }
    lit.fillRect(wnd.x + wnd.w / 2, wnd.y, 1, wnd.h, 'clay').fillRect(wnd.x, wnd.y + wnd.h / 2, wnd.w, 1, 'clay');
    // Shutters.
    g.stamp(shade(new PixelGrid(W, H).fillRect(wnd.x - 4, wnd.y - 1, 3, wnd.h + 2, 'ink'), [rDark, rMid, rLight], { rim: 0.3 }));
    g.stamp(shade(new PixelGrid(W, H).fillRect(wnd.x + wnd.w + 1, wnd.y - 1, 3, wnd.h + 2, 'ink'), [rDark, rMid, rLight], { rim: 0.3, bias: -0.2 }));
    // Flower box.
    const by = wnd.y + wnd.h + 1;
    g.stamp(shade(new PixelGrid(W, H).fillRect(wnd.x - 1, by, wnd.w + 2, 3, 'ink'), RAMPS.wood, { rim: 0.3 }));
    for (let x = wnd.x; x < wnd.x + wnd.w; x++) {
      g.set(x, by - 1, hash2(x, by, 7) < 0.5 ? 'leaf' : 'grass');
      if (x % 3 === 0) g.set(x, by - 2, ['rose', 'gold', 'cream', 'coral'][x % 4] as ColorName);
    }
  }

  // Shadow under the eave.
  for (let x = 4; x < W - 4; x++) {
    g.set(x, wallTop, 'bark').set(x, wallTop + 1, 'umber');
    if (ditherPick(x, wallTop + 2, 0.5) && g.filled(x, wallTop + 2)) g.set(x, wallTop + 2, 'umber');
  }

  // Hip roof: front face plus two side hips, in rows of clay tiles.
  const ridgeY = 4;
  const ridgeL = 24;
  const ridgeR = W - 25;
  const roofL = 0;
  const roofR = W - 1;
  for (let y = ridgeY; y <= eave; y++) {
    const t = (y - ridgeY) / (eave - ridgeY);
    const fl = Math.round(ridgeL + (roofL + 3 - ridgeL) * t);
    const fr = Math.round(ridgeR + (roofR - 3 - ridgeR) * t);
    const hl = Math.round(ridgeL - 6 + (roofL - ridgeL + 6) * t);
    const hr = Math.round(ridgeR + 6 + (roofR - ridgeR - 6) * t);
    for (let x = Math.max(0, hl); x <= Math.min(W - 1, hr); x++) {
      const row = (y - ridgeY) % 4;
      let c: ColorName;
      if (x < fl) c = row === 3 ? rMid : row === 0 ? rHi : rLight; // lit left hip
      else if (x > fr) c = row === 3 ? rDark : row === 0 ? rMid : rDark; // shaded right hip
      else c = row === 3 ? rDark : row === 0 ? rLight : rMid; // front face
      // Staggered tile seams.
      const seam = (Math.floor((y - ridgeY) / 4) % 2) * 3;
      if (row !== 3 && (x + seam) % 6 === 0 && x >= fl && x <= fr) c = rDark;
      g.set(x, y, c);
    }
    // Hip lines.
    g.set(fl, y, rHi).set(fr, y, rDark);
  }
  // Ridge cap with carved end ornaments.
  for (let x = ridgeL - 6; x <= ridgeR + 6; x++) g.set(x, ridgeY - 1, 'gold').set(x, ridgeY, 'amber').set(x, ridgeY + 1, 'clay');
  for (const ox of [ridgeL - 7, ridgeR + 6]) {
    g.fillRect(ox, ridgeY - 4, 2, 4, 'amber').set(ox, ridgeY - 4, 'gold').set(ox + (ox < W / 2 ? -1 : 2), ridgeY - 5, 'gold');
  }
  // Eave fascia.
  for (let x = 0; x < W; x++) g.set(x, eave + 1, 'umber').set(x, eave, x < 3 ? rLight : rMid);
  // Weathering speckles.
  const r = rng(4242);
  for (let i = 0; i < 40; i++) {
    const x = Math.floor(r() * W);
    const y = ridgeY + 2 + Math.floor(r() * (eave - ridgeY - 2));
    if (g.colorAt(x, y) === rMid) g.set(x, y, rLight);
    else if (g.colorAt(x, y) === rLight) g.set(x, y, rHi);
  }
  if (o.awning) {
    // Scalloped stripes over the door and windows.
    const [stripe, base] = o.awning;
    const ay = wallTop + 1;
    for (let x = 8; x < W - 8; x++) {
      const c = Math.floor((x - 8) / 4) % 2 === 0 ? stripe : base;
      for (let y = ay; y < ay + 5; y++) g.set(x, y, c);
      if ((x - 8) % 4 !== 3) g.set(x, ay + 5, c);
      g.set(x, ay, darker(c));
    }
  }
  if (o.sign) {
    // Painted board on the roof face above the door.
    const tg = textGrid(o.sign, 'cream');
    const bw = tg.w + 8;
    const bx = Math.round((W - bw) / 2);
    const by = eave - 13;
    g.stamp(shade(new PixelGrid(W, H).fillRect(bx, by, bw, 11, 'ink'), RAMPS.wood, { rim: 0.3, gradient: 0.4 }));
    g.fillRect(bx + 1, by + 1, bw - 2, 9, 'umber');
    g.stampClipped(tg, bx + 4, by + 2);
    g.line(bx + 3, by + 11, bx + 3, eave, 'bark').line(bx + bw - 4, by + 11, bx + bw - 4, eave, 'bark');
  }
  return [outline(g, { steps: 2 }), lit];
}

/** Lumbung: a raised rice barn on stilts under a golden thatch saddle roof. */
function lumbung(): [PixelGrid, PixelGrid] {
  const W = 48;
  const H = 64;
  const g = new PixelGrid(W, H);
  const bodyTop = 34;
  const bodyBot = 46;
  // Stilts with round stone rat-guards.
  for (const sx of [8, 20, 27, 38]) {
    g.stamp(shade(new PixelGrid(W, H).fillRect(sx, bodyBot, 3, H - bodyBot - 2, 'ink'), RAMPS.wood, { rim: 0.4 }));
    g.stamp(shade(new PixelGrid(W, H).fillEllipse(sx - 2, bodyBot + 2, 7, 3, 'ink'), RAMPS.stone.slice(1), { rim: 0.4 }));
  }
  // Ladder.
  g.line(21, bodyBot, 18, H - 2, 'clay').line(27, bodyBot, 24, H - 2, 'umber');
  for (let y = bodyBot + 3; y < H - 2; y += 3) g.line(21 - Math.round((y - bodyBot) / 6), y, 26 - Math.round((y - bodyBot) / 6), y, 'tan');
  // Body.
  g.stamp(shade(new PixelGrid(W, H).fillRect(7, bodyTop, W - 14, bodyBot - bodyTop, 'ink'), RAMPS.wood, { rim: 0.2, gradient: 0.6, dither: 0.5 }));
  for (let x = 9; x < W - 8; x += 4) g.line(x, bodyTop + 1, x, bodyBot - 1, 'umber');
  g.fillRect(19, bodyTop + 3, 10, 9, 'bark').fillRect(20, bodyTop + 4, 8, 8, 'umber').fillRect(20, bodyTop + 4, 1, 8, 'clay');
  const lit = new PixelGrid(W, H);
  lit.fillRect(21, bodyTop + 5, 6, 6, 'amber').fillRect(22, bodyTop + 6, 4, 4, 'gold');
  g.line(6, bodyBot, W - 7, bodyBot, 'bark');
  // Thatch saddle roof: bulging sides, vertical straw strokes, dark eave.
  for (let y = 2; y < bodyTop + 2; y++) {
    const t = (y - 2) / bodyTop;
    const bulge = Math.sin(t * Math.PI * 0.9) * 6;
    const half = 8 + t * 12 + bulge;
    const x0 = Math.round(W / 2 - half);
    const x1 = Math.round(W / 2 + half - 1);
    for (let x = x0; x <= x1; x++) {
      const u = (x - x0) / Math.max(1, x1 - x0);
      let v = 0.85 - u * 0.6 - t * 0.15;
      if (hash2(x, Math.floor(y / 3), 33) < 0.35) v -= 0.25;
      if (x % 2 === 0) v -= 0.08;
      const ramp = RAMPS.straw;
      g.set(x, y, ramp[Math.max(0, Math.min(3, Math.floor(v * 4)))]);
    }
  }
  for (let x = 0; x < W; x++) if (g.filled(x, bodyTop + 1)) g.set(x, bodyTop + 1, 'umber').set(x, bodyTop, 'clay');
  // Ridge.
  for (let x = W / 2 - 9; x < W / 2 + 9; x++) g.set(x, 2, 'cream').set(x, 3, 'gold');
  return [outline(g, { steps: 2 }), lit];
}

// ---------------------------------------------------------------------------
// Small ground decor

function flowers(variant: number): PixelGrid {
  const g = new PixelGrid(8, 8);
  const petals: Array<[ColorName, ColorName]> = [
    ['rose', 'cream'],
    ['gold', 'amber'],
    ['lilac', 'cream'],
    ['cream', 'gold'],
    ['coral', 'gold'],
    ['foam', 'cream'],
  ];
  const [p, c] = petals[variant % petals.length];
  const r = rng(700 + variant);
  const n = 2 + Math.floor(r() * 2);
  for (let i = 0; i < n; i++) {
    const x = 1 + Math.floor(r() * 5);
    const y = 1 + Math.floor(r() * 4);
    g.set(x, y + 2, 'leaf').set(x, y + 1, 'moss');
    g.set(x - 1, y, p).set(x + 1, y, darker(p)).set(x, y - 1, p).set(x, y + 1, darker(p)).set(x, y, c);
  }
  return g;
}

function tuft(): PixelGrid[] {
  const top = new PixelGrid(8, 8);
  top.line(1, 7, 2, 2, 'leaf').line(3, 7, 3, 1, 'grass').line(5, 7, 6, 3, 'leaf').line(4, 7, 5, 2, 'grass');
  top.set(3, 1, 'lime').set(2, 2, 'lime').set(5, 2, 'lime');
  top.line(1, 7, 6, 7, 'moss');
  return withSway(new PixelGrid(8, 8), top, 7);
}

function reeds(): PixelGrid[] {
  const top = new PixelGrid(10, 14);
  const stems: Array<[number, number, number]> = [
    [2, 6, -1],
    [4, 2, 0],
    [6, 4, 1],
    [8, 7, 1],
  ];
  for (const [x, topY, lean] of stems) {
    top.line(x, 13, x + lean, topY, 'leaf');
    top.set(x + lean, topY, 'lime');
  }
  // Cattail heads.
  top.fillRect(4, 2, 1, 3, 'umber').set(4, 2, 'clay');
  top.fillRect(7, 4, 1, 3, 'umber').set(7, 4, 'clay');
  top.line(1, 13, 8, 13, 'moss');
  return withSway(new PixelGrid(10, 14), outline(top, { color: 'pine' }), 13);
}

function lily(): PixelGrid {
  const g = new PixelGrid(9, 7).fillEllipse(0, 0, 9, 7, 'leaf').fillEllipse(1, 0, 6, 4, 'grass');
  g.line(4, 3, 7, 1, null).set(2, 1, 'lime');
  g.set(6, 4, 'rose').set(5, 4, 'cream').set(6, 3, 'cream');
  return outline(g, { color: 'moss' }).crop(0, 0, 9, 7);
}

function pebbles(variant: number): PixelGrid {
  const g = new PixelGrid(8, 8);
  const r = rng(800 + variant);
  for (let i = 0; i < 2 + variant; i++) {
    const x = 1 + Math.floor(r() * 5);
    const y = 2 + Math.floor(r() * 4);
    g.set(x, y, 'haze').set(x + 1, y, 'mauve').set(x, y + 1, 'plum');
  }
  return g;
}

function shadowEllipse(w: number, h: number): PixelGrid {
  return new PixelGrid(w, h).fillEllipse(0, 0, w, h, 'night');
}

// ---------------------------------------------------------------------------

export function registerProps(sink: TextureSink): void {
  sink.sheet(PROP_TEXTURES.treeRound, roundTree(false), 32, 46);
  sink.sheet(PROP_TEXTURES.treeFruit, roundTree(true), 32, 46);
  sink.sheet(PROP_TEXTURES.treeSlender, slenderTree(), 22, 46);
  sink.sheet(PROP_TEXTURES.bush, bush(false), 20, 16);
  sink.sheet(PROP_TEXTURES.bushBerry, bush(true), 20, 16);
  sink.image(
    PROP_TEXTURES.rock,
    rock(
      16,
      14,
      [
        [8, 8, 6, 5],
        [6, 7, 4, 4],
      ],
      21,
      false,
    ),
  );
  sink.image(
    PROP_TEXTURES.boulder,
    rock(
      32,
      26,
      [
        [15, 15, 12, 9],
        [10, 11, 7, 7],
        [21, 12, 8, 7],
      ],
      22,
      true,
    ),
  );
  sink.image(PROP_TEXTURES.stump, stump());
  sink.sheet(PROP_TEXTURES.weeds, weeds(), 16, 16);
  sink.image(PROP_TEXTURES.branch, branch());
  sink.image(PROP_TEXTURES.log, log());
  sink.sheet(
    PROP_TEXTURES.fence,
    Array.from({ length: 16 }, (_, m) => fence(m)),
    16,
    16,
  );
  sink.image(PROP_TEXTURES.lamp, lamp(false));
  sink.image(PROP_TEXTURES.lampLit, lamp(true));
  sink.image(PROP_TEXTURES.shippingBox, shippingBox());
  sink.image(PROP_TEXTURES.mailbox, mailbox());
  const [h, hl] = house();
  sink.image(PROP_TEXTURES.house, h);
  sink.image(PROP_TEXTURES.houseLit, hl);
  const [l, ll] = lumbung();
  sink.image(PROP_TEXTURES.lumbung, l);
  sink.image(PROP_TEXTURES.lumbungLit, ll);
  sink.sheet(
    PROP_TEXTURES.flowers,
    Array.from({ length: FLOWER_VARIANTS }, (_, i) => flowers(i)),
    8,
    8,
  );
  sink.sheet(PROP_TEXTURES.tuft, tuft(), 8, 8);
  sink.sheet(
    PROP_TEXTURES.pebbles,
    Array.from({ length: PEBBLE_VARIANTS }, (_, i) => pebbles(i)),
    8,
    8,
  );
  sink.sheet(PROP_TEXTURES.reeds, reeds(), 10, 14);
  sink.image(PROP_TEXTURES.lily, lily());
  sink.image(PROP_TEXTURES.shadowS, shadowEllipse(12, 4));
  sink.image(PROP_TEXTURES.shadowM, shadowEllipse(18, 6));
  sink.image(PROP_TEXTURES.shadowL, shadowEllipse(28, 8));
  sink.image(PROP_TEXTURES.shadowXL, shadowEllipse(84, 12));
}
