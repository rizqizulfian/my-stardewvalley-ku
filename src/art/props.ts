// World props: trees, bushes, rocks, stumps, fences, lamps, buildings, decor.
// Silhouettes are built from masks, shaded as lit volumes (top-left light,
// hard tone bands, no dither) and outlined with their own material's dark
// outline colour (see docs/style-guide.json).

import { PixelGrid, blobMask, hash2, outline, rimDarken, rng, shadeBall, type TextureSink } from './pixel';
import { PALETTE, RAMPS, type ColorName, type Ramp } from './palette';

export const PROP_TEXTURES = {
  treeRound: 'prop-tree-round',
  treeFruit: 'prop-tree-fruit',
  treeSlender: 'prop-tree-slender',
  treeSmall: 'prop-tree-small',
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
  barrel: 'prop-barrel',
  crate: 'prop-crate',
  hay: 'prop-hay',
  scarecrow: 'prop-scarecrow',
  sign: 'prop-sign',
  woodpile: 'prop-woodpile',
  flowerBed: 'prop-flower-bed',
  flowers: 'decor-flowers',
  mushrooms: 'decor-mushrooms',
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
export const MUSHROOM_VARIANTS = 2;

/** Where chimney smoke leaves the house sprite, relative to its bottom-centre. */
export const HOUSE_CHIMNEY = { x: 22, y: -74 } as const;

/** Fence connection bits. */
export const FENCE = { N: 1, E: 2, S: 4, W: 8 } as const;

// ---------------------------------------------------------------------------
// Helpers

/** Shade an elliptical blob as a lit ball. */
function ball(w: number, h: number, cx: number, cy: number, rx: number, ry: number, ramp: Ramp, bias = 0, seed = 1, cluster = 0.12): PixelGrid {
  return shadeBall(blobMask(w, h, [[cx, cy, rx, ry]]), ramp, cx, cy, rx, ry, { bias, cluster, seed });
}

/** Shade a mask like an upright cylinder spanning x0..x1 (lit on the left). */
function cylinder(mask: PixelGrid, ramp: Ramp, x0: number, x1: number, bias = 0): PixelGrid {
  const cx = (x0 + x1 + 1) / 2;
  const rx = (x1 - x0 + 1) / 2 + 0.5;
  return shadeBall(mask, ramp, cx, mask.h / 2, rx, 1000, { bias });
}

/** A solid rectangle mask. */
function rect(w: number, h: number, x: number, y: number, rw: number, rh: number): PixelGrid {
  return new PixelGrid(w, h).fillRect(x, y, rw, rh, 'ink');
}

/**
 * Leaf texture: small arcs of the next lighter tone on the lit half and of
 * the next darker tone on the shaded half, placed only inside one tone band.
 */
function leafTexture(g: PixelGrid, ramp: Ramp, seed: number, density = 0.05): void {
  const r = rng(seed);
  const b = g.bounds();
  if (!b) return;
  const tries = Math.floor(g.w * g.h * density);
  for (let i = 0; i < tries; i++) {
    const x = b.x0 + Math.floor(r() * (b.x1 - b.x0 - 2));
    const y = b.y0 + Math.floor(r() * (b.y1 - b.y0 - 1));
    const c = g.colorAt(x, y);
    const k = c ? ramp.indexOf(c) : -1;
    if (k < 0) continue;
    const lit = y - b.y0 < (b.y1 - b.y0) * 0.55 && x - b.x0 < (b.x1 - b.x0) * 0.75;
    const to = lit ? ramp[k + 1] : ramp[k - 1];
    if (!to) continue;
    // "u" arc when lit, "n" arc in shadow.
    const pts: Array<[number, number]> = lit
      ? [
          [x, y],
          [x + 1, y + 1],
          [x + 2, y],
        ]
      : [
          [x, y + 1],
          [x + 1, y],
          [x + 2, y + 1],
        ];
    if (pts.every(([px, py]) => g.colorAt(px, py) === c)) for (const [px, py] of pts) g.set(px, py, to);
  }
}

interface Clump {
  x: number;
  y: number;
  r: number;
  ry?: number;
}

/**
 * A canopy built from a few round leaf clumps. Clumps lower down are drawn in
 * front and shaded darker, so the underside reads as shadow.
 */
function canopy(w: number, h: number, clumps: Clump[], ramp: Ramp, seed: number, cy: number, spread: number, bias = -0.16): PixelGrid {
  const g = new PixelGrid(w, h);
  const sorted = [...clumps].sort((a, b) => a.y - b.y);
  sorted.forEach((c, i) => {
    const ry = c.ry ?? c.r * 0.9;
    const under = ((c.y - cy) / spread) * 0.22;
    const s = ball(w, h, c.x, c.y, c.r, ry, ramp, bias - under, seed + i * 17, 0.14);
    // A darker lower rim on each clump separates it from the clump behind.
    const rimmed = s.clone();
    s.forEachFilled((x, y, col) => {
      if (!s.filled(x, y + 1)) rimmed.set(x, y, ramp[Math.max(0, ramp.indexOf(col) - 1)]);
    });
    g.stamp(rimmed);
  });
  leafTexture(g, ramp, seed + 5);
  return g;
}

function trunk(g: PixelGrid, x: number, top: number, bottom: number, width: number): void {
  const mask = new PixelGrid(g.w, g.h);
  for (let y = top; y <= bottom; y++) {
    const flare = y >= bottom - 2 ? y - (bottom - 3) : 0;
    mask.fillRect(x - flare, y, width + flare * 2, 1, 'ink');
  }
  const s = cylinder(mask, RAMPS.wood, x, x + width - 1, -0.18);
  // Bark grooves: short vertical dashes in the shadow tone.
  s.forEachFilled((px, py) => {
    if ((px - x) % 3 === 1 && py < bottom - 2 && hash2(px, py >> 1, 81) < 0.45) s.set(px, py, 'umber');
  });
  // Canopy shadow over the top of the trunk.
  for (let y = top; y < top + 3; y++) for (let px = x; px < x + width; px++) if (s.filled(px, y)) s.set(px, y, y === top ? 'bark' : 'umber');
  g.stamp(outline(s));
}

function withSway(base: PixelGrid, swaying: PixelGrid, pivotY: number): PixelGrid[] {
  return [-1, 0, 1].map((a) => base.clone().stamp(a === 0 ? swaying : swaying.sway(a, pivotY)));
}

// ---------------------------------------------------------------------------
// Trees

function roundTree(fruit: boolean): PixelGrid[] {
  const W = 34;
  const H = 46;
  const base = new PixelGrid(W, H);
  trunk(base, 14, 30, H - 2, 6);
  const clumps: Clump[] = [
    { x: 17, y: 10, r: 9, ry: 8 },
    { x: 9, y: 18, r: 8, ry: 7 },
    { x: 25, y: 17, r: 8, ry: 7 },
    { x: 17, y: 25, r: 10, ry: 8 },
    { x: 7, y: 26, r: 5, ry: 4.5 },
    { x: 27, y: 26, r: 5, ry: 4.5 },
  ];
  let top = canopy(W, H, clumps, RAMPS.foliage, fruit ? 902 : 901, 17, 14);
  if (fruit) {
    const r = rng(77);
    let placed = 0;
    for (let i = 0; i < 40 && placed < 10; i++) {
      const x = 5 + Math.floor(r() * 24);
      const y = 6 + Math.floor(r() * 24);
      if ([0, 1, 2, 3].every((k) => top.filled(x + (k & 1), y + (k >> 1)) && top.filled(x + (k & 1) + 1, y + (k >> 1) + 1))) {
        top.set(x, y, 'peach').set(x + 1, y, 'coral').set(x, y + 1, 'coral').set(x + 1, y + 1, 'maroon');
        placed++;
      }
    }
  }
  top = outline(top, { color: 'pine' });
  return withSway(base, top, 30);
}

function smallTree(): PixelGrid[] {
  const W = 24;
  const H = 36;
  const base = new PixelGrid(W, H);
  trunk(base, 10, 22, H - 2, 4);
  const clumps: Clump[] = [
    { x: 12, y: 8.5, r: 7, ry: 6.5 },
    { x: 7, y: 14, r: 6, ry: 5.5 },
    { x: 17, y: 14, r: 6, ry: 5.5 },
    { x: 12, y: 19, r: 7.5, ry: 5.5 },
  ];
  const top = outline(canopy(W, H, clumps, RAMPS.foliage, 911, 14, 9, -0.1), { color: 'pine' });
  return withSway(base, top, 22);
}

function slenderTree(): PixelGrid[] {
  const W = 24;
  const H = 50;
  const base = new PixelGrid(W, H);
  trunk(base, 10, 38, H - 2, 4);
  const top = new PixelGrid(W, H);
  // Stacked tiers, widest at the bottom, each shaded as its own cone.
  const tiers = [
    { y: 2, h: 11, w: 9 },
    { y: 9, h: 12, w: 14 },
    { y: 17, h: 13, w: 18 },
    { y: 26, h: 14, w: 22 },
  ];
  const ramp: Ramp = ['moss', 'leaf', 'fern', 'lime'];
  tiers.forEach((t, i) => {
    const mask = new PixelGrid(W, H);
    for (let y = 0; y < t.h; y++) {
      const ww = Math.max(2, Math.round((t.w * (y + 2)) / (t.h + 1)));
      mask.fillRect(Math.round(W / 2 - ww / 2), t.y + y, ww, 1, 'ink');
    }
    // Drooping tips along the bottom edge.
    for (let x = 0; x < W; x++) if (mask.filled(x, t.y + t.h - 1) && (x + i) % 3 === 0) mask.set(x, t.y + t.h, 'ink');
    let s = shadeBall(mask, ramp, W / 2 - 1, t.y + t.h * 0.7, t.w / 2 + 1, t.h * 0.8, { bias: -0.12 - i * 0.04, cluster: 0.14, seed: 300 + i });
    s = rimDarken(s, null, 'moss');
    top.stamp(s);
  });
  leafTexture(top, ramp, 333, 0.04);
  return withSway(base, outline(top, { color: 'pine' }), 38);
}

function bush(berries: boolean): PixelGrid[] {
  const W = 20;
  const H = 16;
  const base = new PixelGrid(W, H);
  let top = canopy(
    W,
    H,
    [
      { x: 6.5, y: 9, r: 5 },
      { x: 13.5, y: 8, r: 6 },
      { x: 10, y: 6, r: 5 },
      { x: 10, y: 11, r: 6, ry: 4 },
    ],
    RAMPS.foliage,
    berries ? 505 : 504,
    8,
    5,
    -0.1,
  );
  if (berries) {
    for (const [x, y] of [
      [5, 7],
      [12, 4],
      [14, 9],
      [8, 11],
      [16, 7],
      [10, 8],
    ])
      if (top.filled(x + 1, y + 1)) top.set(x, y, 'rose').set(x + 1, y + 1, 'maroon').set(x + 1, y, 'brick');
  }
  top = outline(top, { color: 'pine' });
  return withSway(base, top, 13);
}

// ---------------------------------------------------------------------------
// Stones and wood debris

function rock(w: number, h: number, circles: Array<[number, number, number, number?]>, seed: number, mossy: boolean): PixelGrid {
  const mask = blobMask(w, h, circles);
  const b = mask.bounds()!;
  const cx = (b.x0 + b.x1 + 1) / 2;
  const cy = (b.y0 + b.y1 + 1) / 2;
  let s = shadeBall(mask, RAMPS.stone, cx, cy, (b.x1 - b.x0 + 1) / 2, (b.y1 - b.y0 + 1) / 2, { bias: 0.02, cluster: 0.12, seed });
  // A flat lit top facet, then a crack down the shaded side.
  s.forEachFilled((x, y) => {
    if (y < b.y0 + (b.y1 - b.y0) * 0.3 && x < cx + 2 && s.filled(x, y - 1)) s.set(x, y, 'stoneLight');
  });
  const r = rng(seed);
  const crackX = Math.floor(cx + r() * 3);
  for (let y = Math.floor(cy - 1); y < b.y1 - 1; y++) {
    const x = crackX + Math.floor((y - cy) * 0.5);
    if (s.filled(x - 1, y) && s.filled(x + 1, y)) s.set(x, y, 'stoneDark');
  }
  if (mossy) {
    s.forEachFilled((x, y) => {
      if (!s.filled(x, y - 1) || (!s.filled(x, y - 2) && hash2(x, y, seed) < 0.6)) {
        if (hash2(x >> 1, y, seed + 1) < 0.75) s.set(x, y, !s.filled(x, y - 1) ? 'grassLight' : 'grass');
      }
    });
  }
  s = outline(s);
  return s;
}

function stump(): PixelGrid {
  const g = new PixelGrid(16, 16);
  const side = rect(16, 16, 3, 7, 10, 6).fillEllipse(3, 9, 10, 5, 'ink');
  side.fillRect(2, 11, 2, 2, 'ink').fillRect(12, 11, 2, 2, 'ink');
  g.stamp(cylinder(side, RAMPS.wood, 3, 12, -0.2));
  for (let y = 8; y < 13; y++) for (let x = 5; x < 12; x += 3) if (g.filled(x, y) && hash2(x, y >> 1, 3) < 0.6) g.set(x, y, 'umber');
  // Cut top with growth rings.
  g.fillEllipse(3, 4, 10, 6, 'tan');
  g.fillEllipse(4, 5, 8, 4, 'dirtLight');
  g.fillEllipse(6, 6, 4, 2, 'tan');
  g.set(7, 6, 'clay');
  for (let x = 4; x < 12; x++) if (g.colorAt(x, 9) === 'tan') g.set(x, 9, 'clay');
  return outline(g);
}

function weeds(): PixelGrid[] {
  const base = new PixelGrid(16, 16);
  const top = new PixelGrid(16, 16);
  const r = rng(615);
  for (let i = 0; i < 8; i++) {
    const bx = 3 + Math.floor(r() * 10);
    const len = 5 + Math.floor(r() * 6);
    const lean = r() < 0.5 ? -1 : 1;
    for (let k = 0; k < len; k++) {
      const x = bx + Math.round((k * k * lean) / (len * 2.2));
      const y = 14 - k;
      const c: ColorName = k < 3 ? 'moss' : k > len - 3 ? 'lime' : bx < 8 ? 'fern' : 'leaf';
      top.set(x, y, c);
      if (k > 1 && k < len - 2) top.set(x + 1, y, c === 'fern' ? 'leaf' : 'moss');
    }
  }
  return withSway(base, outline(top, { color: 'pine' }), 14);
}

function branch(): PixelGrid {
  const g = new PixelGrid(16, 16);
  g.line(2, 11, 13, 7, 'tan').line(2, 12, 13, 8, 'umber').line(8, 9, 10, 4, 'umber').line(7, 9, 9, 4, 'clay');
  g.set(9, 4, 'tan');
  g.set(10, 3, 'leaf').set(11, 3, 'fern').set(11, 2, 'lime');
  return outline(g);
}

function log(): PixelGrid {
  const g = new PixelGrid(32, 16);
  const body = rect(32, 16, 6, 4, 24, 9);
  g.stamp(shadeBall(body, RAMPS.wood, 18, 6, 1000, 6, { bias: 0.05 }));
  for (let x = 9; x < 29; x += 5) g.line(x, 7, x + 2, 7, 'umber').line(x + 2, 10, x + 3, 10, 'umber');
  // Cut end with rings.
  g.fillEllipse(2, 4, 8, 9, 'tan').fillEllipse(3, 5, 6, 7, 'dirtLight').fillEllipse(4, 7, 4, 3, 'tan').set(5, 8, 'clay');
  // Moss along the top.
  for (let x = 10; x < 28; x++) if (hash2(x >> 1, 0, 5) < 0.45) g.set(x, 4, 'fern');
  return outline(g);
}

// ---------------------------------------------------------------------------
// Built props

/** Horizontal plank row: light top edge, base, dark bottom edge. */
function plank(g: PixelGrid, x0: number, x1: number, y: number, h: number, ramp: readonly [ColorName, ColorName, ColorName] = ['tan', 'clay', 'umber']): void {
  for (let x = x0; x <= x1; x++)
    for (let k = 0; k < h; k++) g.set(x, y + k, k === 0 ? ramp[0] : k === h - 1 ? ramp[2] : ramp[1]);
}

function fence(mask: number): PixelGrid {
  const g = new PixelGrid(16, 16);
  if (mask & FENCE.W) {
    plank(g, 0, 6, 5, 3);
    plank(g, 0, 6, 10, 3);
  }
  if (mask & FENCE.E) {
    plank(g, 9, 15, 5, 3);
    plank(g, 9, 15, 10, 3);
  }
  if (mask & FENCE.N) g.fillRect(7, 0, 1, 3, 'tan').fillRect(8, 0, 1, 3, 'clay');
  if (mask & FENCE.S) g.fillRect(7, 13, 1, 3, 'tan').fillRect(8, 13, 1, 3, 'clay');
  // Post: lit left face, grain line, cut top.
  g.fillRect(6, 3, 1, 11, 'tan').fillRect(7, 3, 2, 11, 'clay').fillRect(9, 3, 1, 11, 'umber');
  g.fillRect(6, 2, 4, 1, 'dirtLight').set(9, 2, 'tan');
  g.set(8, 6, 'umber').set(8, 7, 'umber').set(7, 11, 'umber');
  return outline(g);
}

function lamp(lit: boolean): PixelGrid {
  const g = new PixelGrid(16, 32);
  // Wooden post and a stone foot.
  g.fillRect(7, 10, 1, 18, 'tan').fillRect(8, 10, 1, 18, 'umber');
  g.fillRect(5, 27, 6, 1, 'stoneLight').fillRect(5, 28, 6, 2, 'stone').fillRect(10, 27, 1, 3, 'stoneDark');
  // Lantern: metal cap, frame and glass.
  g.fillRect(5, 1, 6, 1, 'stone').fillRect(7, 0, 2, 1, 'stoneDark').fillRect(4, 2, 8, 1, 'stoneDark');
  g.fillRect(4, 3, 1, 6, 'stoneDark').fillRect(11, 3, 1, 6, 'slate').fillRect(4, 9, 8, 1, 'slate');
  g.fillRect(7, 3, 2, 6, 'slate');
  const glassA: ColorName = lit ? 'cream' : 'dirtShade';
  const glassB: ColorName = lit ? 'gold' : 'earth';
  g.fillRect(5, 3, 2, 6, glassA).fillRect(9, 3, 2, 6, glassB);
  if (!lit) g.set(5, 3, 'dirt');
  const out = outline(g);
  if (!lit) return out;
  // Emissive layer: only the glowing glass.
  const e = new PixelGrid(16, 32);
  e.fillRect(5, 3, 2, 6, 'cream').fillRect(9, 3, 2, 6, 'gold');
  return e;
}

function shippingBox(): PixelGrid {
  const g = new PixelGrid(24, 20);
  // Front face: three horizontal planks.
  for (let i = 0; i < 3; i++) plank(g, 2, 21, 8 + i * 3, 3);
  g.fillRect(2, 8, 1, 9, 'tan').fillRect(21, 8, 1, 9, 'umber');
  // Lid: lighter planks seen from above, overhanging.
  plank(g, 1, 22, 3, 3, ['dirtLight', 'tan', 'clay']);
  plank(g, 1, 22, 6, 2, ['tan', 'tan', 'umber']);
  // Metal corners and a brass latch.
  g.fillRect(2, 8, 2, 2, 'stoneLight').fillRect(20, 8, 2, 2, 'stoneDark').fillRect(2, 15, 2, 2, 'stone').fillRect(20, 15, 2, 2, 'slate');
  g.fillRect(11, 6, 2, 3, 'gold').set(12, 8, 'amber');
  return outline(g);
}

function mailbox(): PixelGrid {
  const g = new PixelGrid(16, 24);
  g.fillRect(7, 10, 1, 13, 'tan').fillRect(8, 10, 1, 13, 'umber');
  const box = rect(16, 24, 3, 4, 10, 6).fillEllipse(3, 1, 10, 6, 'ink');
  g.stamp(shadeBall(box, RAMPS.roof, 8, 5, 6, 5, { bias: 0.05 }));
  g.line(4, 7, 12, 7, 'maroon');
  g.fillRect(12, 2, 1, 4, 'gold').fillRect(13, 2, 2, 2, 'amber');
  return outline(g);
}

/**
 * Player house: a hip roof of red shingles over a clapboard house on a stone
 * footing, with a chimney. Returns [day sprite, emissive night overlay].
 */
function house(): [PixelGrid, PixelGrid] {
  const W = 80;
  const H = 76;
  const g = new PixelGrid(W, H);
  const ridgeY = 6;
  const eave = 38;
  const wallTop = eave + 3;
  const footTop = H - 8;

  // Walls: horizontal clapboard, 4px boards with a light top and dark bottom edge.
  for (let y = wallTop; y < footTop; y++) {
    const k = (y - wallTop) % 4;
    for (let x = 6; x < W - 6; x++) g.set(x, y, k === 0 ? 'tan' : k === 3 ? 'umber' : 'clay');
  }
  // Under-eave shadow.
  for (let x = 6; x < W - 6; x++) g.set(x, wallTop, 'bark').set(x, wallTop + 1, 'umber');
  // Corner posts.
  g.fillRect(5, wallTop, 2, footTop - wallTop, 'tan').fillRect(7, wallTop, 1, footTop - wallTop, 'clay');
  g.fillRect(W - 8, wallTop, 1, footTop - wallTop, 'clay').fillRect(W - 7, wallTop, 2, footTop - wallTop, 'umber');

  // Stone footing: blocks with lit tops and mortar seams.
  for (let y = footTop; y < H - 2; y++)
    for (let x = 4; x < W - 4; x++) {
      const row = y - footTop < 3 ? 0 : 1;
      const k = (y - footTop) % 3;
      const seam = (x + row * 4) % 8 === 0;
      g.set(x, y, seam ? 'slate' : k === 0 ? 'stoneLight' : k === 2 ? 'stoneDark' : 'stone');
    }

  // Door: frame, vertical planks, knob, stone step.
  const dx = 34;
  const dw = 12;
  const dTop = wallTop + 6;
  g.fillRect(dx - 2, dTop - 2, dw + 4, footTop - dTop + 2, 'cream');
  g.fillRect(dx + dw, dTop - 1, 2, footTop - dTop + 1, 'mist');
  g.fillRect(dx, dTop, dw, footTop - dTop, 'clay');
  for (let x = dx; x < dx + dw; x += 3) g.fillRect(x, dTop, 1, footTop - dTop, x === dx ? 'tan' : 'umber');
  g.fillRect(dx, dTop, dw, 1, 'umber');
  g.set(dx + dw - 3, dTop + 12, 'gold').set(dx + dw - 3, dTop + 13, 'amber');
  for (let y = footTop; y < H - 1; y++) {
    const k = y - footTop;
    for (let x = dx - 3; x < dx + dw + 3; x++) g.set(x, y, k === 0 || k === 4 ? 'stoneLight' : k === 3 || k === 6 ? 'stoneDark' : 'stone');
  }

  // Windows: light trim, glass with a glint, mullions, green shutters, flower box.
  const windows = [
    { x: 13, y: wallTop + 6, w: 14, h: 12 },
    { x: W - 27, y: wallTop + 6, w: 14, h: 12 },
  ];
  const lit = new PixelGrid(W, H);
  for (const wnd of windows) {
    g.fillRect(wnd.x - 1, wnd.y - 1, wnd.w + 2, wnd.h + 2, 'cream');
    g.fillRect(wnd.x + wnd.w, wnd.y, 1, wnd.h + 1, 'mist').fillRect(wnd.x, wnd.y + wnd.h, wnd.w + 1, 1, 'mist');
    g.fillRect(wnd.x, wnd.y, wnd.w, wnd.h, 'sky');
    g.fillRect(wnd.x, wnd.y, wnd.w, 2, 'sea');
    for (let i = 2; i < wnd.h; i++) {
      if (i + 1 < wnd.w) g.set(wnd.x + i + 1, wnd.y + i, 'foam');
      if (i + 2 < wnd.w) g.set(wnd.x + i + 2, wnd.y + i, 'foam');
    }
    g.fillRect(wnd.x + wnd.w / 2, wnd.y, 1, wnd.h, 'cream').fillRect(wnd.x, wnd.y + wnd.h / 2, wnd.w, 1, 'cream');
    // Night glass: warm, brighter in the middle.
    for (let y = 0; y < wnd.h; y++)
      for (let x = 0; x < wnd.w; x++) {
        const d = Math.hypot(x - wnd.w / 2, y - wnd.h / 2) / (wnd.w / 2);
        lit.set(wnd.x + x, wnd.y + y, d < 0.45 ? 'cream' : d < 0.8 ? 'gold' : 'amber');
      }
    lit.fillRect(wnd.x + wnd.w / 2, wnd.y, 1, wnd.h, 'clay').fillRect(wnd.x, wnd.y + wnd.h / 2, wnd.w, 1, 'clay');
    // Shutters.
    for (const [sx, shade] of [
      [wnd.x - 5, 0],
      [wnd.x + wnd.w + 2, 1],
    ] as const) {
      for (let y = wnd.y - 1; y < wnd.y + wnd.h + 1; y++) {
        const slat = (y - wnd.y) % 3 === 2;
        g.set(sx, y, shade ? 'leaf' : 'fern').set(sx + 1, y, slat ? 'moss' : shade ? 'leaf' : 'fern').set(sx + 2, y, shade ? 'moss' : 'leaf');
      }
    }
    // Flower box.
    const by = wnd.y + wnd.h + 2;
    plank(g, wnd.x - 1, wnd.x + wnd.w, by, 3);
    for (let x = wnd.x; x < wnd.x + wnd.w; x++) {
      g.set(x, by - 1, x % 2 === 0 ? 'fern' : 'leaf');
      if (x % 3 === 1) g.set(x, by - 2, (['rose', 'gold', 'cream', 'lilac'] as const)[x % 4]);
    }
  }

  // Hip roof: front face plus two side hips, in rows of shingles.
  const ridgeL = 22;
  const ridgeR = W - 23;
  for (let y = ridgeY; y <= eave; y++) {
    const t = (y - ridgeY) / (eave - ridgeY);
    const fl = Math.round(ridgeL + (3 - ridgeL) * t);
    const fr = Math.round(ridgeR + (W - 4 - ridgeR) * t);
    const hl = Math.round(ridgeL - 5 + (0 - ridgeL + 5) * t);
    const hr = Math.round(ridgeR + 5 + (W - 1 - ridgeR - 5) * t);
    const row = (y - ridgeY) % 4;
    const course = Math.floor((y - ridgeY) / 4);
    for (let x = Math.max(0, hl); x <= Math.min(W - 1, hr); x++) {
      let c: ColorName;
      if (x < fl) c = row === 0 ? 'peach' : row === 3 ? 'brick' : 'coral'; // lit left hip
      else if (x > fr) c = row === 0 ? 'brick' : row === 3 ? 'wine' : 'maroon'; // shaded right hip
      else {
        c = row === 0 ? 'coral' : row === 3 ? 'maroon' : 'brick';
        // Staggered shingle gaps on the middle rows.
        if (row === 2 && (x + (course % 2) * 3) % 6 === 0) c = 'maroon';
      }
      g.set(x, y, c);
    }
    // Hip lines.
    g.set(fl, y, 'peach').set(fr, y, 'maroon');
  }
  // Bright ridge line.
  for (let x = ridgeL - 5; x <= ridgeR + 5; x++) g.set(x, ridgeY - 1, 'peach').set(x, ridgeY, 'coral');
  // Eave fascia board.
  for (let x = 0; x < W; x++) g.set(x, eave + 1, x < 3 ? 'tan' : 'clay').set(x, eave + 2, 'umber');

  // Stone chimney rising through the roof on the right.
  const chX = W / 2 + HOUSE_CHIMNEY.x - 4;
  const chTop = 0;
  for (let y = chTop + 2; y < 20; y++)
    for (let x = chX; x < chX + 8; x++) {
      const k = (y - chTop) % 3;
      const seam = (x + Math.floor((y - chTop) / 3) * 3) % 5 === 0;
      g.set(x, y, x === chX ? 'stoneLight' : x === chX + 7 ? 'stoneDark' : seam ? 'stoneDark' : k === 0 ? 'stoneLight' : 'stone');
    }
  g.fillRect(chX - 1, chTop, 10, 2, 'stoneLight').fillRect(chX - 1, chTop + 1, 10, 1, 'stone').fillRect(chX + 1, chTop, 6, 1, 'slate');

  return [outline(g), lit];
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
    g.fillRect(sx, bodyBot, 1, H - bodyBot - 2, 'tan').fillRect(sx + 1, bodyBot, 2, H - bodyBot - 2, 'clay').fillRect(sx + 2, bodyBot, 1, H - bodyBot - 2, 'umber');
    g.stamp(ball(W, H, sx + 1.5, bodyBot + 3.5, 3.5, 1.6, RAMPS.stone, 0.05));
  }
  // Ladder.
  g.line(21, bodyBot, 18, H - 2, 'tan').line(27, bodyBot, 24, H - 2, 'umber');
  for (let y = bodyBot + 3; y < H - 2; y += 3) g.line(21 - Math.round((y - bodyBot) / 6), y, 26 - Math.round((y - bodyBot) / 6), y, 'clay');
  // Body: vertical boards.
  for (let x = 7; x < W - 7; x++) for (let y = bodyTop; y < bodyBot; y++) g.set(x, y, (x - 7) % 4 === 0 ? 'tan' : (x - 7) % 4 === 3 ? 'umber' : 'clay');
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
      let v = 0.95 - u * 0.75 - t * 0.12;
      // Straw strokes: vertical runs a few pixels long.
      if (hash2(x, Math.floor(y / 6), 33) < 0.2) v -= 0.22;
      g.set(x, y, RAMPS.straw[Math.max(0, Math.min(3, Math.floor(v * 4)))]);
    }
  }
  for (let x = 0; x < W; x++) if (g.filled(x, bodyTop + 1)) g.set(x, bodyTop + 1, 'dirtShade').set(x, bodyTop, 'dirt');
  // Ridge.
  for (let x = W / 2 - 9; x < W / 2 + 9; x++) g.set(x, 2, 'dirtHi').set(x, 3, 'dirtLight');
  return [outline(g), lit];
}

function barrel(): PixelGrid {
  const W = 14;
  const H = 18;
  const g = new PixelGrid(W, H);
  const body = new PixelGrid(W, H);
  for (let y = 4; y < H - 1; y++) {
    const bulge = y > 6 && y < H - 4 ? 1 : 0;
    body.fillRect(2 - bulge, y, 10 + bulge * 2, 1, 'ink');
  }
  g.stamp(cylinder(body, RAMPS.wood, 1, 12));
  // Staves.
  for (const x of [4, 7, 10]) for (let y = 5; y < H - 1; y++) if (g.filled(x, y)) g.set(x, y, 'umber');
  // Iron hoops.
  for (const y of [6, 13])
    for (let x = 0; x < W; x++) if (g.filled(x, y)) g.set(x, y, x < 4 ? 'stoneLight' : x < 9 ? 'stone' : 'stoneDark');
  // Open top: rim and dark interior.
  g.fillEllipse(2, 1, 10, 5, 'tan');
  g.fillEllipse(3, 2, 8, 3, 'bark');
  g.set(4, 3, 'umber').set(5, 3, 'umber');
  return outline(g);
}

function crate(): PixelGrid {
  const g = new PixelGrid(16, 16);
  // Top face, seen from above.
  plank(g, 2, 13, 2, 2, ['dirtLight', 'tan', 'tan']);
  plank(g, 2, 13, 4, 2, ['tan', 'tan', 'clay']);
  // Front face planks and a frame.
  for (let i = 0; i < 3; i++) plank(g, 2, 13, 6 + i * 3, 3);
  g.fillRect(2, 6, 2, 9, 'tan').fillRect(12, 6, 2, 9, 'umber').fillRect(3, 6, 1, 9, 'clay').fillRect(12, 6, 1, 9, 'clay');
  // Diagonal brace.
  g.line(4, 13, 11, 7, 'tan').line(5, 13, 11, 8, 'umber');
  return outline(g);
}

function hay(): PixelGrid {
  const W = 20;
  const H = 15;
  const g = new PixelGrid(W, H).fillRect(2, 3, 16, 10, 'ink').fillRect(3, 2, 14, 12, 'ink');
  // Lit top face, straw-coloured front, shaded right side and base.
  g.forEachFilled((x, y) => {
    let c: ColorName = y <= 5 ? 'dirtHi' : 'dirtLight';
    if (y > 5 && (x >= 16 || y >= 12)) c = 'dirt';
    if (y === 6) c = 'dirtLight';
    g.set(x, y, c);
  });
  // Straw strokes: short vertical runs, lighter on top, darker on the front.
  for (let x = 3; x < 17; x++) {
    if (hash2(x, 1, 21) < 0.4) g.set(x, 3, 'dirtLight').set(x, 4, 'dirtLight');
    if (hash2(x, 2, 22) < 0.35) g.set(x, 8, 'dirt').set(x, 9, 'dirt');
    if (hash2(x, 3, 23) < 0.25) g.set(x, 11, 'dirtShade');
  }
  // Twine.
  for (const x of [6, 13]) for (let y = 2; y < 14; y++) g.set(x, y, y <= 5 ? 'tan' : y >= 12 ? 'umber' : 'clay');
  // Loose straws poking out.
  g.set(1, 7, 'dirtLight').set(18, 9, 'dirt').set(9, 1, 'dirtHi').set(15, 1, 'dirtLight');
  return outline(g, { color: 'dirtShade' });
}

function scarecrow(): PixelGrid {
  const W = 16;
  const H = 32;
  const g = new PixelGrid(W, H);
  // Pole and crossbar.
  g.fillRect(7, 12, 1, 19, 'tan').fillRect(8, 12, 1, 19, 'umber');
  plank(g, 1, 14, 14, 2, ['tan', 'tan', 'umber']);
  // Patched shirt.
  for (let y = 13; y < 22; y++) {
    const w = y < 15 ? 10 : 8;
    const x0 = 8 - w / 2;
    for (let x = x0; x < x0 + w; x++) g.set(x, y, x < x0 + 2 ? 'lilac' : x > x0 + w - 3 ? 'violet' : 'lilac');
  }
  g.fillRect(9, 17, 2, 2, 'brick').set(9, 17, 'coral');
  g.set(5, 19, 'violet').set(6, 20, 'violet');
  // Straw hands and hem.
  g.set(0, 14, 'dirtLight').set(0, 15, 'dirt').set(15, 14, 'dirt').set(15, 15, 'dirtShade');
  for (const x of [5, 7, 9, 10]) g.set(x, 22, x % 2 ? 'dirtLight' : 'dirt');
  // Sack head with a stitched face.
  g.stamp(ball(W, H, 8, 9, 4, 3.5, ['sand', 'cream', 'cream'], -0.1));
  g.set(6, 9, 'umber').set(10, 9, 'umber').line(6, 11, 10, 11, 'clay');
  // Wide straw hat.
  g.fillRect(3, 5, 10, 1, 'dirtLight').fillRect(2, 6, 12, 1, 'dirt');
  g.fillRect(5, 2, 6, 3, 'dirt').fillRect(5, 2, 3, 1, 'dirtHi').fillRect(5, 4, 6, 1, 'brick');
  return outline(g);
}

function sign(): PixelGrid {
  const g = new PixelGrid(16, 22);
  g.fillRect(7, 9, 1, 12, 'tan').fillRect(8, 9, 1, 12, 'umber');
  plank(g, 1, 14, 2, 4);
  plank(g, 1, 14, 6, 4);
  g.fillRect(1, 2, 1, 8, 'tan').fillRect(14, 2, 1, 8, 'umber');
  // Painted lettering.
  g.line(3, 4, 6, 4, 'bark').line(8, 4, 12, 4, 'bark').line(4, 7, 10, 7, 'bark');
  return outline(g);
}

function woodpile(): PixelGrid {
  const g = new PixelGrid(28, 16);
  // Stacked log ends: rows of round cut faces.
  const ends: Array<[number, number]> = [
    [3, 9],
    [9, 9],
    [15, 9],
    [21, 9],
    [6, 4],
    [12, 4],
    [18, 4],
  ];
  for (const [x, y] of ends) {
    g.fillEllipse(x, y, 6, 6, 'clay');
    g.fillEllipse(x + 1, y + 1, 4, 4, 'tan');
    g.set(x + 2, y + 2, 'dirtLight').set(x + 3, y + 3, 'clay');
    g.set(x + 4, y + 4, 'umber').set(x + 5, y + 3, 'umber');
  }
  return outline(g);
}

function flowerBed(): PixelGrid[] {
  const W = 20;
  const H = 12;
  const top = canopy(
    W,
    H,
    [
      { x: 6, y: 7, r: 5, ry: 4 },
      { x: 14, y: 7, r: 5, ry: 4 },
      { x: 10, y: 5, r: 5, ry: 4 },
    ],
    RAMPS.foliage,
    611,
    6,
    3,
    0.02,
  );
  const petals: ColorName[] = ['rose', 'gold', 'cream', 'lilac'];
  const r = rng(612);
  for (let i = 0; i < 9; i++) {
    const x = 3 + Math.floor(r() * 14);
    const y = 2 + Math.floor(r() * 6);
    if (!top.filled(x, y + 1)) continue;
    const p = petals[i % petals.length];
    top.set(x, y, p).set(x + 1, y, p === 'cream' ? 'mist' : p).set(x, y + 1, 'gold');
  }
  return withSway(new PixelGrid(W, H), outline(top, { color: 'pine' }), 10);
}

// ---------------------------------------------------------------------------
// Small ground decor

function flowers(variant: number): PixelGrid {
  const g = new PixelGrid(10, 10);
  const petals: Array<[ColorName, ColorName, ColorName]> = [
    ['rose', 'maroon', 'gold'],
    ['gold', 'amber', 'cream'],
    ['lilac', 'violet', 'gold'],
    ['cream', 'mist', 'gold'],
    ['rose', 'maroon', 'cream'],
    ['gold', 'amber', 'brick'],
  ];
  const [p, ps, c] = petals[variant % petals.length];
  const r = rng(700 + variant);
  const n = 2 + Math.floor(r() * 2);
  for (let i = 0; i < n; i++) {
    const x = 2 + Math.floor(r() * 5);
    const y = 1 + Math.floor(r() * 4);
    g.set(x, y + 2, 'leaf').set(x, y + 3, 'moss').set(x + 1, y + 3, 'fern');
    g.set(x - 1, y, p).set(x + 1, y, ps).set(x, y - 1, p).set(x, y + 1, ps).set(x, y, c);
  }
  return g;
}

function mushrooms(variant: number): PixelGrid {
  const g = new PixelGrid(10, 9);
  const cap: [ColorName, ColorName, ColorName] = variant === 0 ? ['peach', 'coral', 'brick'] : ['tan', 'clay', 'umber'];
  const shroom = (x: number, y: number, w: number) => {
    g.fillRect(x + 1, y + 2, w - 2, 3, 'cream').fillRect(x + w - 2, y + 2, 1, 3, 'mist');
    g.fillRect(x, y, w, 2, cap[1]).fillRect(x + 1, y - 1, w - 2, 1, cap[0]).fillRect(x, y + 1, w, 1, cap[2]);
    if (variant === 0) g.set(x + 1, y, 'cream').set(x + w - 2, y + 1, 'cream');
  };
  shroom(1, 3, 5);
  shroom(5, 5, 4);
  return outline(g);
}

function tuft(): PixelGrid[] {
  const top = new PixelGrid(8, 8);
  top.line(1, 7, 2, 2, 'grass').line(3, 7, 3, 1, 'grassLight').line(5, 7, 6, 3, 'grass').line(4, 7, 5, 2, 'grassLight');
  top.set(3, 1, 'grassHi').set(2, 2, 'grassHi').set(5, 2, 'grassHi');
  top.line(1, 7, 6, 7, 'turf');
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
  const g = new PixelGrid(9, 7).fillEllipse(0, 0, 9, 7, 'leaf').fillEllipse(1, 0, 6, 4, 'fern');
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
    g.set(x, y, 'stoneLight').set(x + 1, y, 'stone').set(x, y + 1, 'stoneDark').set(x + 1, y + 1, 'slate');
  }
  return g;
}

/**
 * Soft ground shadow: a cool dark blob with a lighter outer ring. Drawn with
 * transparency so it darkens whatever ground it sits on by one or two shades.
 */
function shadowCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  const rgb = parseInt(PALETTE.turfDark.slice(1), 16);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const dx = (x + 0.5 - w / 2) / (w / 2);
      const dy = (y + 0.5 - h / 2) / (h / 2);
      const d = dx * dx + dy * dy;
      if (d > 1) continue;
      const a = d < 0.55 ? 0.5 : 0.28;
      const i = (y * w + x) * 4;
      img.data[i] = (rgb >> 16) & 0xff;
      img.data[i + 1] = (rgb >> 8) & 0xff;
      img.data[i + 2] = rgb & 0xff;
      img.data[i + 3] = Math.round(a * 255);
    }
  ctx.putImageData(img, 0, 0);
  return c;
}

// ---------------------------------------------------------------------------

export function registerProps(sink: TextureSink): void {
  sink.sheet(PROP_TEXTURES.treeRound, roundTree(false), 34, 46);
  sink.sheet(PROP_TEXTURES.treeFruit, roundTree(true), 34, 46);
  sink.sheet(PROP_TEXTURES.treeSlender, slenderTree(), 24, 50);
  sink.sheet(PROP_TEXTURES.treeSmall, smallTree(), 24, 36);
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
  sink.image(PROP_TEXTURES.barrel, barrel());
  sink.image(PROP_TEXTURES.crate, crate());
  sink.image(PROP_TEXTURES.hay, hay());
  sink.image(PROP_TEXTURES.scarecrow, scarecrow());
  sink.image(PROP_TEXTURES.sign, sign());
  sink.image(PROP_TEXTURES.woodpile, woodpile());
  sink.sheet(PROP_TEXTURES.flowerBed, flowerBed(), 20, 12);
  sink.sheet(
    PROP_TEXTURES.flowers,
    Array.from({ length: FLOWER_VARIANTS }, (_, i) => flowers(i)),
    10,
    10,
  );
  sink.sheet(
    PROP_TEXTURES.mushrooms,
    Array.from({ length: MUSHROOM_VARIANTS }, (_, i) => mushrooms(i)),
    10,
    9,
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
  sink.canvas(PROP_TEXTURES.shadowS, shadowCanvas(12, 5));
  sink.canvas(PROP_TEXTURES.shadowM, shadowCanvas(18, 6));
  sink.canvas(PROP_TEXTURES.shadowL, shadowCanvas(28, 8));
  sink.canvas(PROP_TEXTURES.shadowXL, shadowCanvas(86, 12));
}
