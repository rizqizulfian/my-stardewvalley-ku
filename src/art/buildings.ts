// Village, town, beach and indoor props: house colourways, the shop and hall,
// a food stall, well, benches, signs, palms, boats, beach huts and furniture.
// Same method as art/props.ts: masks shaded with a ramp, lit from the top-left,
// then outlined in a darker shade of their own fill.

import { PixelGrid, blobMask, hash2, outline, shade, type ShadeOptions, type TextureSink } from './pixel';
import { RAMPS, type ColorName, type Ramp } from './palette';
import { textGrid } from './font';
import { house, type HouseStyle } from './props';

export const BUILDING_TEXTURES = {
  houseBlue: 'prop-house-blue',
  houseBlueLit: 'prop-house-blue-lit',
  houseGreen: 'prop-house-green',
  houseGreenLit: 'prop-house-green-lit',
  housePurple: 'prop-house-purple',
  housePurpleLit: 'prop-house-purple-lit',
  shop: 'prop-shop',
  shopLit: 'prop-shop-lit',
  hall: 'prop-hall',
  hallLit: 'prop-hall-lit',
  warung: 'prop-warung',
  well: 'prop-well',
  bench: 'prop-bench',
  signpost: 'prop-signpost',
  barrel: 'prop-barrel',
  crate: 'prop-crate',
  palm: 'prop-palm',
  boat: 'prop-boat',
  hut: 'prop-hut',
  umbrella: 'prop-umbrella',
  planter: 'prop-planter',
  board: 'prop-board',
  fountain: 'prop-fountain',
  bed: 'prop-bed',
  table: 'prop-table',
  chair: 'prop-chair',
  stove: 'prop-stove',
  shelf: 'prop-shelf',
  rug: 'prop-rug',
  plantPot: 'prop-plant-pot',
  windowWall: 'prop-window-wall',
  floorLamp: 'prop-floor-lamp',
  floorLampLit: 'prop-floor-lamp-lit',
  doormat: 'prop-doormat',
  banana: 'prop-banana',
  hibiscus: 'prop-hibiscus',
  flowerBed: 'prop-flower-bed',
  fruitStall: 'prop-fruit-stall',
} as const;

const HOUSE_STYLES: Record<string, HouseStyle> = {
  blue: { roof: ['deep', 'sea', 'sky', 'foam'], walls: 'plaster', seed: 5 },
  green: { roof: ['pine', 'moss', 'leaf', 'lime'], walls: 'wood', seed: 6 },
  purple: { roof: ['night', 'violet', 'lilac', 'rose'], walls: 'plaster', seed: 7 },
  shop: { roof: ['wine', 'brick', 'coral', 'peach'], walls: 'plaster', sign: 'TOKO', awning: ['sky', 'cream'], seed: 8 },
  hall: { roof: ['pine', 'moss', 'leaf', 'lime'], walls: 'plaster', sign: 'BALAI DESA', seed: 9 },
};

/** A shaded rectangle stamped onto `g`. */
function block(g: PixelGrid, x: number, y: number, w: number, h: number, ramp: Ramp, o: ShadeOptions = {}): void {
  g.stamp(shade(new PixelGrid(g.w, g.h).fillRect(x, y, w, h, 'ink'), ramp, { rim: 0.3, gradient: 0.5, ...o }));
}

function oval(g: PixelGrid, x: number, y: number, w: number, h: number, ramp: Ramp, o: ShadeOptions = {}): void {
  g.stamp(shade(new PixelGrid(g.w, g.h).fillEllipse(x, y, w, h, 'ink'), ramp, { rim: 0.3, gradient: 0.6, ...o }));
}

function swayFrames(base: PixelGrid, top: PixelGrid, pivotY: number): PixelGrid[] {
  return [-1, 0, 1].map((a) => outline(base.clone().stamp(a === 0 ? top : top.sway(a, pivotY)), { steps: 2 }));
}

// ---------------------------------------------------------------------------
// Village and town

function well(): PixelGrid {
  const W = 28;
  const H = 36;
  const g = new PixelGrid(W, H);
  // Posts and roof.
  block(g, 4, 6, 3, 16, RAMPS.wood);
  block(g, 21, 6, 3, 16, RAMPS.wood);
  for (let y = 0; y < 7; y++) {
    const half = 5 + y * 2;
    for (let x = 14 - half; x < 14 + half; x++) if (x >= 0 && x < W) g.set(x, y + 1, y === 6 ? 'wine' : x < 14 ? (y % 2 ? 'coral' : 'peach') : y % 2 ? 'brick' : 'coral');
  }
  // Crossbar, rope and bucket.
  g.line(6, 10, 22, 10, 'umber').line(6, 9, 22, 9, 'clay');
  g.line(14, 11, 14, 16, 'tan');
  block(g, 12, 15, 5, 4, RAMPS.wood);
  // Stone ring: body, rim and dark water.
  block(g, 3, 22, 22, 11, RAMPS.stone.slice(1), { dither: 0.5, noise: 0.25, seed: 4 });
  for (let x = 5; x < 24; x += 5) g.line(x, 23, x, 32, 'plum');
  g.line(3, 27, 24, 27, 'plum');
  oval(g, 2, 18, 24, 8, ['mauve', 'haze', 'mist'], { gradient: 0.3 });
  g.fillEllipse(6, 20, 16, 4, 'night');
  g.fillEllipse(8, 21, 12, 2, 'deep');
  return outline(g, { steps: 2 });
}

function bench(): PixelGrid {
  const g = new PixelGrid(32, 18);
  block(g, 4, 9, 2, 8, RAMPS.wood);
  block(g, 26, 9, 2, 8, RAMPS.wood);
  block(g, 2, 2, 28, 4, RAMPS.lightWood, { gradient: 0.3 });
  block(g, 1, 8, 30, 3, RAMPS.lightWood, { gradient: 0.3 });
  g.line(2, 4, 29, 4, 'clay').line(1, 9, 30, 9, 'sand');
  block(g, 4, 5, 2, 4, RAMPS.wood);
  block(g, 26, 5, 2, 4, RAMPS.wood);
  return outline(g, { steps: 2 });
}

function signpost(): PixelGrid {
  const g = new PixelGrid(20, 26);
  block(g, 9, 8, 3, 17, RAMPS.wood);
  // Arrow board pointing right, with painted marks.
  const m = new PixelGrid(20, 26).fillRect(1, 3, 14, 8, 'ink');
  for (let i = 0; i < 4; i++) m.fillRect(15 + i, 4 + i, 1, 8 - i * 2, 'ink');
  g.stamp(shade(m, RAMPS.lightWood, { rim: 0.3, gradient: 0.4 }));
  g.line(3, 6, 12, 6, 'umber').line(3, 8, 10, 8, 'umber');
  return outline(g, { steps: 2 });
}

function barrel(): PixelGrid {
  const g = new PixelGrid(16, 18);
  const m = blobMask(16, 18, [
    [8, 10, 6, 7],
    [8, 9, 5.5, 7.5],
  ]);
  g.stamp(shade(m, RAMPS.wood, { rim: 0.3, gradient: 0.6, dither: 0.4 }));
  for (const y of [5, 13]) g.line(2, y, 13, y, 'night');
  oval(g, 3, 1, 10, 5, RAMPS.lightWood, { gradient: 0.2 });
  g.line(5, 3, 10, 3, 'umber');
  return outline(g, { steps: 2 });
}

function crate(): PixelGrid {
  const g = new PixelGrid(16, 16);
  block(g, 1, 3, 14, 12, RAMPS.lightWood, { dither: 0.4 });
  g.fillRect(1, 3, 14, 3, 'sand').fillRect(1, 5, 14, 1, 'clay');
  g.line(2, 7, 13, 14, 'clay').line(13, 7, 2, 14, 'clay');
  g.fillRect(1, 6, 1, 9, 'umber').fillRect(14, 6, 1, 9, 'umber');
  return outline(g, { steps: 2 });
}

function planter(): PixelGrid {
  const g = new PixelGrid(18, 18);
  block(g, 1, 10, 16, 7, RAMPS.wood);
  g.line(1, 10, 16, 10, 'tan');
  for (let x = 2; x < 16; x++) {
    const h = 2 + Math.floor(hash2(x, 3, 17) * 4);
    g.line(x, 9, x, 9 - h, hash2(x, 2, 18) < 0.5 ? 'leaf' : 'grass');
  }
  const blooms: ColorName[] = ['rose', 'gold', 'cream', 'coral', 'lilac'];
  for (let i = 0; i < 6; i++) {
    const x = 2 + i * 2 + (i % 2);
    const y = 3 + Math.floor(hash2(i, 4, 19) * 3);
    g.set(x, y, blooms[i % blooms.length]).set(x + 1, y, blooms[i % blooms.length]).set(x, y + 1, 'gold');
  }
  return outline(g, { steps: 2 });
}

function board(): PixelGrid {
  const W = 32;
  const H = 32;
  const g = new PixelGrid(W, H);
  block(g, 4, 6, 3, 25, RAMPS.wood);
  block(g, 25, 6, 3, 25, RAMPS.wood);
  block(g, 2, 7, 28, 17, RAMPS.wood);
  g.fillRect(4, 9, 24, 13, 'clay');
  for (let i = 0; i < 18; i++) g.set(4 + Math.floor(hash2(i, 1, 23) * 24), 9 + Math.floor(hash2(i, 2, 23) * 13), 'tan');
  // Notes pinned to the cork.
  const notes: Array<[number, number, number, number, ColorName]> = [
    [6, 10, 7, 8, 'cream'],
    [15, 11, 6, 6, 'mist'],
    [22, 10, 5, 9, 'cream'],
    [12, 17, 6, 4, 'peach'],
  ];
  for (const [x, y, w, h, c] of notes) {
    g.fillRect(x, y, w, h, c);
    for (let ly = y + 2; ly < y + h - 1; ly += 2) g.line(x + 1, ly, x + w - 2, ly, 'haze');
    g.set(x + Math.floor(w / 2), y, 'brick');
  }
  // Little roof cap.
  for (let x = 1; x < W - 1; x++) g.set(x, 5, 'brick').set(x, 4, x % 3 === 0 ? 'wine' : 'coral');
  return outline(g, { steps: 2 });
}

function fountainFrames(): PixelGrid[] {
  const W = 48;
  const H = 38;
  const base = new PixelGrid(W, H);
  // Basin wall and rim.
  block(base, 3, 22, 42, 12, RAMPS.stone.slice(1), { dither: 0.5, noise: 0.2, seed: 9 });
  for (let x = 7; x < 44; x += 6) base.line(x, 23, x, 33, 'plum');
  oval(base, 1, 15, 46, 14, ['mauve', 'haze', 'mist'], { gradient: 0.3 });
  base.fillEllipse(5, 17, 38, 9, 'sea');
  base.fillEllipse(8, 18, 32, 6, 'sky');
  // Pillar and upper bowl.
  block(base, 21, 6, 6, 15, RAMPS.stone.slice(1));
  oval(base, 14, 4, 20, 6, ['mauve', 'haze', 'mist'], { gradient: 0.3 });
  base.fillEllipse(17, 5, 14, 3, 'sky');
  return [0, 1, 2].map((f) => {
    const g = base.clone();
    // Falling water arcs and ripples, shifted per frame.
    for (const side of [-1, 1]) {
      for (let i = 0; i < 9; i++) {
        const x = 24 + side * (8 + i);
        const y = 6 + Math.round((i * i) / 6) + 1;
        if ((i + f) % 3 !== 0) g.set(x, y, 'foam');
      }
    }
    for (let i = 0; i < 4; i++) {
      const x = 10 + ((i * 9 + f * 3) % 28);
      g.set(x, 20 + (i % 3), 'cream').set(x + 1, 20 + (i % 3), 'foam');
    }
    g.set(24, 2 + f, 'foam').set(23, 3, 'cream');
    return outline(g, { steps: 2 });
  });
}

function warung(): PixelGrid {
  const W = 50;
  const H = 48;
  const g = new PixelGrid(W, H);
  // Back wall of planks.
  block(g, 4, 14, 42, 16, RAMPS.wood, { dither: 0.4 });
  for (let x = 6; x < 46; x += 4) g.line(x, 14, x, 29, 'bark');
  // Posts.
  block(g, 2, 10, 3, 36, RAMPS.wood);
  block(g, 45, 10, 3, 36, RAMPS.wood);
  // Counter with a cloth front.
  block(g, 3, 30, 44, 4, RAMPS.lightWood, { gradient: 0.3 });
  block(g, 4, 34, 42, 10, RAMPS.wood);
  for (let x = 4; x < 46; x++) if (Math.floor(x / 3) % 2 === 0) g.set(x, 36, 'gold').set(x, 41, 'gold');
  // Jars, a pot and a stack of bowls on the counter.
  for (const [x, c] of [
    [8, 'amber'],
    [14, 'brick'],
    [20, 'leaf'],
  ] as Array<[number, ColorName]>) {
    g.fillRect(x, 24, 5, 6, 'foam').fillRect(x + 1, 26, 3, 4, c).fillRect(x, 23, 5, 1, 'mist').set(x, 25, 'cream');
  }
  oval(g, 30, 22, 10, 8, ['night', 'plum', 'mauve']);
  g.line(33, 19, 32, 15, 'mist').line(36, 18, 37, 14, 'haze');
  g.fillRect(41, 27, 4, 2, 'cream').fillRect(41, 25, 4, 2, 'mist');
  // Striped awning with a scalloped edge.
  for (let y = 4; y < 14; y++)
    for (let x = 0; x < W; x++) {
      const c: ColorName = Math.floor(x / 5) % 2 === 0 ? 'coral' : 'cream';
      g.set(x, y, y === 4 ? (c === 'coral' ? 'brick' : 'mist') : c);
    }
  for (let x = 0; x < W; x++) if (x % 5 !== 4) g.set(x, 14, Math.floor(x / 5) % 2 === 0 ? 'brick' : 'haze');
  // Sign.
  const t = textGrid('WARUNG', 'cream');
  const bw = t.w + 6;
  const bx = Math.round((W - bw) / 2);
  block(g, bx, 0, bw, 9, RAMPS.wood);
  g.fillRect(bx + 1, 1, bw - 2, 7, 'brick');
  g.stampClipped(t, bx + 3, 1);
  return outline(g, { steps: 2 });
}

// ---------------------------------------------------------------------------
// Beach

function palmFrames(): PixelGrid[] {
  const W = 44;
  const H = 60;
  const base = new PixelGrid(W, H);
  // Curved, ringed trunk.
  for (let y = 18; y < H - 1; y++) {
    const t = (y - 18) / (H - 19);
    const cx = Math.round(24 - Math.sin(t * Math.PI * 0.8) * 4 - t * 2);
    const w = 3 + Math.round(t * 2);
    for (let x = cx - Math.floor(w / 2); x < cx - Math.floor(w / 2) + w; x++) {
      const ring = y % 4 === 0;
      base.set(x, y, ring ? 'umber' : x === cx - Math.floor(w / 2) ? 'tan' : x === cx - Math.floor(w / 2) + w - 1 ? 'umber' : 'clay');
    }
  }
  const top = new PixelGrid(W, H);
  const crownX = 24;
  const crownY = 17;
  const fronds: Array<[number, number, number]> = [
    // angle (radians, 0 = right), length, droop
    [0.1, 18, 9],
    [-0.5, 16, 6],
    [-1.2, 11, 3],
    [Math.PI + 0.1, 18, 9],
    [Math.PI + 0.55, 16, 6],
    [-Math.PI / 2 - 0.35, 10, 2],
    [0.7, 13, 8],
    [Math.PI - 0.7, 13, 8],
  ];
  for (const [a, len, droop] of fronds) {
    for (let i = 0; i <= len; i++) {
      const t = i / len;
      const x = Math.round(crownX + Math.cos(a) * len * t);
      const y = Math.round(crownY + Math.sin(a) * len * t * 0.6 + droop * t * t);
      top.set(x, y, 'leaf').set(x, y - 1, 'grass');
      // Leaflets hang off each side.
      if (i > 1 && i < len) {
        const l = Math.max(1, Math.round(3 * (1 - t)) + 1);
        for (let k = 1; k <= l; k++) top.set(x + (i % 2 ? 1 : -1) * (k > 1 ? 1 : 0), y + k, k === l ? 'moss' : 'leaf');
      }
    }
  }
  top.set(crownX, crownY - 1, 'lime').set(crownX - 1, crownY - 2, 'lime');
  // Coconuts.
  for (const [x, y] of [
    [22, 18],
    [25, 19],
    [23, 20],
  ])
    top.fillEllipse(x - 1, y - 1, 3, 3, 'umber').set(x - 1, y - 1, 'clay');
  return swayFrames(base, top, H - 10);
}

function boat(): PixelGrid {
  const W = 52;
  const H = 24;
  const g = new PixelGrid(W, H);
  // Hull: raised bow and stern.
  for (let x = 1; x < W - 1; x++) {
    const u = (x - 1) / (W - 3);
    const lift = Math.round(Math.pow(Math.abs(u - 0.5) * 2, 3) * 7);
    const top = 9 - lift;
    const bottom = 20 - Math.round(Math.pow(Math.abs(u - 0.5) * 2, 2) * 6);
    for (let y = top; y <= bottom; y++) {
      const d = y - top;
      let c: ColorName = d < 2 ? 'cream' : d < 5 ? 'sea' : d < 6 ? 'gold' : 'brick';
      if (y === bottom) c = 'wine';
      g.set(x, y, c);
    }
  }
  // Inside of the boat and a bench.
  for (let x = 9; x < W - 9; x++) g.set(x, 8, 'umber').set(x, 9, 'bark');
  g.fillRect(24, 6, 4, 3, 'tan');
  // Painted eye on the bow.
  g.fillRect(44, 9, 3, 3, 'cream').set(45, 10, 'night');
  return outline(g, { steps: 2 });
}

function hut(): PixelGrid {
  const W = 50;
  const H = 52;
  const g = new PixelGrid(W, H);
  // Stilts and a slatted floor.
  for (const x of [6, 22, 40]) block(g, x, 30, 3, 21, RAMPS.wood);
  block(g, 3, 32, 44, 4, RAMPS.lightWood, { gradient: 0.3 });
  for (let x = 4; x < 47; x += 3) g.set(x, 33, 'umber');
  // Back wall of woven bamboo.
  for (let y = 18; y < 32; y++)
    for (let x = 6; x < 44; x++) g.set(x, y, (Math.floor(x / 2) + Math.floor(y / 2)) % 2 === 0 ? 'tan' : 'sand');
  g.line(6, 31, 43, 31, 'clay');
  // Thatch roof.
  for (let y = 2; y < 20; y++) {
    const t = (y - 2) / 18;
    const half = 10 + t * 16;
    for (let x = Math.round(25 - half); x <= Math.round(25 + half); x++) {
      const u = (x - (25 - half)) / (half * 2);
      let v = 0.85 - u * 0.55 - t * 0.1;
      if (hash2(x, Math.floor(y / 3), 44) < 0.3) v -= 0.25;
      g.set(x, y, RAMPS.straw[Math.max(0, Math.min(3, Math.floor(v * 4)))]);
    }
  }
  for (let x = 0; x < W; x++) if (g.colorAt(x, 19)) g.set(x, 19, 'clay').set(x, 20, 'umber');
  for (let x = 19; x < 31; x++) g.set(x, 2, 'cream');
  return outline(g, { steps: 2 });
}

function umbrella(): PixelGrid {
  const W = 32;
  const H = 34;
  const g = new PixelGrid(W, H);
  g.line(16, 8, 16, 31, 'mist').line(17, 8, 17, 31, 'haze');
  for (let y = 2; y < 13; y++) {
    const t = (y - 2) / 10;
    const half = Math.round(Math.sqrt(t) * 15);
    for (let x = 16 - half; x <= 16 + half; x++) {
      const seg = Math.floor(((x - 16) / Math.max(1, half)) * 3 + 3);
      g.set(x, y, seg % 2 === 0 ? (y < 5 ? 'peach' : 'coral') : y < 5 ? 'cream' : 'mist');
    }
  }
  for (let x = 1; x < 32; x++) if (g.colorAt(x, 12)) g.set(x, 13, x % 4 === 0 ? 'brick' : g.colorAt(x, 12) === 'coral' ? 'brick' : 'haze');
  g.fillEllipse(11, 30, 12, 4, 'tan');
  return outline(g, { steps: 2 });
}

function bananaFrames(): PixelGrid[] {
  const W = 44;
  const H = 54;
  const base = new PixelGrid(W, H);
  // Pseudo-stem: green with dry brown sheaths.
  block(base, 20, 24, 4, H - 25, ['moss', 'leaf', 'grass'], { dither: 0.4 });
  for (let y = 28; y < H - 2; y += 6) base.line(20, y, 21, y + 2, 'clay').set(22, y + 1, 'tan');
  const top = new PixelGrid(W, H);
  // Big paddle leaves: they rise out of the crown, then arch over and droop.
  const leaves: Array<[number, number, number, boolean]> = [
    // direction (-1 left, +1 right), reach, rise, dry
    [-1, 20, 9, false],
    [1, 20, 9, false],
    [-1, 9, 19, false],
    [1, 8, 20, false],
    [1, 6, -14, true],
  ];
  const cx = 22;
  const cy = 24;
  for (const [dir, reach, rise, dry] of leaves) {
    const pt = (t: number): [number, number] => [cx + dir * reach * t, cy - rise * Math.sin(t * Math.PI * 0.7) + (dry ? 0 : t * t * 9)];
    const steps = 60;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const [x, y] = pt(t);
      const [x2, y2] = pt(Math.min(1, t + 0.02));
      const len = Math.hypot(x2 - x, y2 - y) || 1;
      // Normal to the midrib, so the blade keeps its width whatever the angle.
      const nx = -(y2 - y) / len;
      const ny = (x2 - x) / len;
      const w = Math.sin(Math.min(1, t * 1.1) * Math.PI) * (dry ? 2 : 3.6);
      for (let k = -w; k <= w; k += 0.5) {
        const torn = !dry && t > 0.25 && Math.abs(k) > 1 && Math.floor(t * 40) % 5 === 0;
        if (torn) continue;
        const px = Math.round(x + nx * k);
        const py = Math.round(y + ny * k);
        const c: ColorName = dry ? (Math.abs(k) < 0.5 ? 'tan' : 'clay') : Math.abs(k) < 0.5 ? 'lime' : (k < 0) === (dir > 0) ? 'grass' : 'leaf';
        top.set(px, py, c);
      }
    }
  }
  // Bunch of bananas with the purple heart hanging below.
  for (let r = 0; r < 3; r++)
    for (let i = 0; i < 4 - r; i++) {
      const x = 24 + i * 2 - r;
      const y = 27 + r * 3;
      top.set(x, y, 'gold').set(x, y + 1, 'gold').set(x + 1, y + 1, 'amber').set(x, y - 1, 'lime');
    }
  top.line(25, 24, 25, 36, 'moss');
  top.fillEllipse(23, 36, 4, 5, 'wine').set(24, 37, 'violet').set(24, 40, 'night');
  return swayFrames(base, top, H - 12);
}

function hibiscusFrames(): PixelGrid[] {
  const W = 22;
  const H = 20;
  const base = new PixelGrid(W, H);
  const top = new PixelGrid(W, H);
  top.stamp(shade(blobMask(W, H, [[11, 11, 9, 7], [6, 12, 5, 5], [16, 12, 5, 5], [11, 7, 6, 5]]), RAMPS.foliage.slice(1), { rim: 0.3, gradient: 0.6, noise: 0.15, seed: 61 }));
  for (const [x, y, c] of [
    [5, 9, 'brick'],
    [12, 5, 'rose'],
    [16, 11, 'brick'],
    [9, 13, 'coral'],
    [14, 15, 'rose'],
  ] as Array<[number, number, ColorName]>) {
    // Five-petal bloom with a long golden stamen.
    top.fillRect(x - 1, y, 3, 1, c).fillRect(x, y - 1, 1, 3, c).set(x - 1, y - 1, c).set(x + 1, y + 1, c);
    top.set(x, y, 'wine').set(x + 1, y - 1, 'gold').set(x + 2, y - 2, 'cream');
  }
  return swayFrames(base, top, H - 2);
}

function flowerBedFrames(): PixelGrid[] {
  const W = 18;
  const H = 14;
  const base = new PixelGrid(W, H);
  const top = new PixelGrid(W, H);
  const colors: Array<[ColorName, ColorName]> = [
    ['rose', 'cream'],
    ['gold', 'cream'],
    ['lilac', 'rose'],
    ['coral', 'peach'],
    ['cream', 'gold'],
    ['sky', 'foam'],
  ];
  for (let i = 0; i < 9; i++) {
    const x = 2 + ((i * 5) % 14);
    const y = 4 + ((i * 3) % 7);
    top.line(x, y + 1, x, H - 2, i % 2 ? 'leaf' : 'moss');
    top.set(x + 1, y + 4, 'grass');
    const [c, hl] = colors[i % colors.length];
    top.set(x, y, c).set(x - 1, y, c).set(x + 1, y, c).set(x, y - 1, c).set(x, y + 1, c).set(x, y, hl);
  }
  return swayFrames(base, top, H - 1);
}

function fruitStall(): PixelGrid {
  const W = 50;
  const H = 46;
  const g = new PixelGrid(W, H);
  block(g, 2, 10, 3, 34, RAMPS.wood);
  block(g, 45, 10, 3, 34, RAMPS.wood);
  // Slanted display table and crates.
  block(g, 3, 26, 44, 4, RAMPS.lightWood, { gradient: 0.3 });
  block(g, 4, 30, 42, 12, RAMPS.wood, { dither: 0.3 });
  for (let x = 6; x < 45; x += 7) g.line(x, 31, x, 41, 'bark');
  // Fruit piles: bananas, oranges, watermelon, mangosteen, rambutan.
  const pile = (x: number, c: ColorName, hl: ColorName, dk: ColorName) => {
    for (let r = 0; r < 3; r++)
      for (let i = 0; i < 3 - r; i++) {
        const px = x + i * 3 + r * 1.5;
        const py = 23 - r * 2;
        g.fillEllipse(Math.round(px), py, 3, 3, c).set(Math.round(px), py, hl).set(Math.round(px) + 2, py + 2, dk);
      }
  };
  pile(5, 'amber', 'gold', 'clay');
  pile(23, 'wine', 'violet', 'night');
  pile(33, 'brick', 'coral', 'wine');
  for (let i = 0; i < 4; i++) g.line(14 + i * 2, 18, 16 + i * 2, 25, 'gold').set(16 + i * 2, 25, 'amber').set(14 + i * 2, 18, 'leaf');
  oval(g, 39, 17, 8, 8, ['moss', 'leaf', 'grass']);
  g.line(40, 19, 45, 19, 'moss').line(40, 22, 45, 22, 'moss');
  // Awning.
  for (let y = 4; y < 13; y++)
    for (let x = 0; x < W; x++) {
      const c: ColorName = Math.floor(x / 5) % 2 === 0 ? 'leaf' : 'cream';
      g.set(x, y, y === 4 ? (c === 'leaf' ? 'moss' : 'mist') : c);
    }
  for (let x = 0; x < W; x++) if (x % 5 !== 4) g.set(x, 13, Math.floor(x / 5) % 2 === 0 ? 'moss' : 'haze');
  const t = textGrid('BUAH', 'cream');
  const bw = t.w + 6;
  const bx = Math.round((W - bw) / 2);
  block(g, bx, 0, bw, 9, RAMPS.wood);
  g.fillRect(bx + 1, 1, bw - 2, 7, 'leaf');
  g.stampClipped(t, bx + 3, 1);
  return outline(g, { steps: 2 });
}

// ---------------------------------------------------------------------------
// Indoors

function bed(): PixelGrid {
  const W = 32;
  const H = 38;
  const g = new PixelGrid(W, H);
  block(g, 2, 1, 28, 10, RAMPS.wood, { gradient: 0.4 });
  g.fillRect(4, 3, 24, 2, 'tan');
  block(g, 3, 9, 26, 26, ['mist', 'cream', 'cream']);
  oval(g, 6, 10, 20, 7, ['haze', 'mist', 'cream']);
  // Quilt with stitched squares.
  block(g, 3, 17, 26, 18, ['wine', 'brick', 'coral', 'peach'], { gradient: 0.4, dither: 0.3 });
  for (let x = 3; x < 29; x++) for (let y = 17; y < 35; y++) if ((x - 3) % 6 === 0 || (y - 17) % 6 === 0) g.set(x, y, 'peach');
  for (let x = 6; x < 29; x += 6) for (let y = 20; y < 35; y += 6) g.set(x, y, 'gold');
  g.fillRect(3, 17, 26, 2, 'cream');
  block(g, 2, 34, 3, 4, RAMPS.wood);
  block(g, 27, 34, 3, 4, RAMPS.wood);
  return outline(g, { steps: 2 });
}

function table(): PixelGrid {
  const W = 32;
  const H = 26;
  const g = new PixelGrid(W, H);
  block(g, 4, 14, 3, 11, RAMPS.wood);
  block(g, 25, 14, 3, 11, RAMPS.wood);
  block(g, 1, 6, 30, 9, RAMPS.lightWood, { gradient: 0.3 });
  g.fillRect(1, 13, 30, 2, 'clay');
  // Table runner and a vase of flowers.
  g.fillRect(10, 6, 12, 7, 'cream').fillRect(10, 12, 12, 1, 'mist');
  for (let x = 11; x < 22; x += 2) g.set(x, 13, 'cream');
  oval(g, 13, 3, 6, 6, RAMPS.water);
  g.set(14, 1, 'rose').set(16, 0, 'gold').set(18, 1, 'lilac').set(15, 2, 'leaf').set(17, 2, 'leaf');
  return outline(g, { steps: 2 });
}

function chair(): PixelGrid {
  const g = new PixelGrid(14, 20);
  block(g, 2, 1, 10, 9, RAMPS.wood, { gradient: 0.4 });
  g.fillRect(4, 3, 6, 1, 'tan').fillRect(4, 6, 6, 1, 'tan');
  block(g, 1, 10, 12, 4, RAMPS.lightWood, { gradient: 0.3 });
  block(g, 2, 14, 2, 5, RAMPS.wood);
  block(g, 10, 14, 2, 5, RAMPS.wood);
  return outline(g, { steps: 2 });
}

function stove(): PixelGrid {
  const W = 32;
  const H = 30;
  const g = new PixelGrid(W, H);
  block(g, 1, 11, 30, 18, RAMPS.lightWood, { dither: 0.3 });
  g.fillRect(16, 12, 1, 16, 'umber');
  g.fillRect(4, 14, 9, 11, 'clay').fillRect(19, 14, 9, 11, 'clay').set(12, 19, 'gold').set(19, 19, 'gold');
  block(g, 0, 8, 32, 4, ['haze', 'mist', 'cream'], { gradient: 0.3 });
  // Clay stove with a pot and a kettle.
  block(g, 3, 4, 12, 5, ['umber', 'clay', 'tan']);
  oval(g, 4, 0, 10, 6, ['night', 'plum', 'mauve']);
  g.line(5, 2, 12, 2, 'mauve');
  oval(g, 20, 2, 8, 7, ['deep', 'sea', 'sky']);
  g.line(27, 4, 30, 3, 'sea').fillRect(23, 1, 2, 1, 'night');
  return outline(g, { steps: 2 });
}

function shelf(): PixelGrid {
  const W = 30;
  const H = 36;
  const g = new PixelGrid(W, H);
  block(g, 1, 1, 28, 34, RAMPS.wood, { gradient: 0.4 });
  g.fillRect(3, 3, 24, 30, 'bark');
  const books: ColorName[] = ['brick', 'sea', 'leaf', 'gold', 'violet', 'coral', 'sky', 'amber'];
  for (const sy of [4, 14, 24]) {
    let x = 3;
    let i = sy;
    while (x < 26) {
      const w = 2 + Math.floor(hash2(i, sy, 71) * 2);
      const h = 7 + Math.floor(hash2(i, sy, 72) * 3);
      const c = books[Math.floor(hash2(i, sy, 73) * books.length)];
      if (hash2(i, sy, 74) < 0.15) {
        x += 2;
        i++;
        continue;
      }
      g.fillRect(x, sy + 9 - h, w, h, c).set(x, sy + 9 - h, 'cream');
      x += w;
      i++;
    }
    g.fillRect(3, sy + 9, 24, 1, 'tan');
  }
  return outline(g, { steps: 2 });
}

function rug(): PixelGrid {
  const W = 46;
  const H = 30;
  const g = new PixelGrid(W, H);
  g.fillRect(1, 1, W - 2, H - 2, 'brick');
  g.fillRect(3, 3, W - 6, H - 6, 'wine');
  g.fillRect(5, 5, W - 10, H - 10, 'brick');
  // Batik-like motif: dotted diamonds and a border of small triangles.
  for (let y = 7; y < H - 7; y += 6)
    for (let x = 8; x < W - 7; x += 8) {
      const ox = (Math.floor(y / 6) % 2) * 4;
      g.set(x + ox, y, 'gold').set(x + ox - 1, y + 1, 'gold').set(x + ox + 1, y + 1, 'gold').set(x + ox, y + 2, 'gold').set(x + ox, y + 1, 'cream');
    }
  for (let x = 2; x < W - 2; x += 3) g.set(x, 2, 'gold').set(x, H - 3, 'gold');
  for (let y = 2; y < H - 2; y += 3) g.set(2, y, 'gold').set(W - 3, y, 'gold');
  // Fringe.
  for (let y = 2; y < H - 2; y += 2) g.set(0, y, 'cream').set(W - 1, y, 'cream');
  return g;
}

function plantPot(): PixelGrid {
  const g = new PixelGrid(16, 24);
  block(g, 3, 16, 10, 7, ['umber', 'clay', 'tan']);
  g.fillRect(2, 15, 12, 2, 'tan');
  const leaves = blobMask(16, 24, [
    [8, 9, 6, 6],
    [4, 11, 3, 3],
    [12, 10, 3, 4],
    [8, 4, 4, 3],
  ]);
  const s = shade(leaves, RAMPS.foliage, { rim: 0.3, gradient: 0.6, dither: 0.3 });
  for (let i = 0; i < 4; i++) s.line(8, 14, 3 + i * 3, 4 + (i % 2) * 3, null);
  g.stamp(s);
  return outline(g, { steps: 2 });
}

function windowWall(): PixelGrid {
  const W = 26;
  const H = 18;
  const g = new PixelGrid(W, H);
  g.fillRect(3, 1, 20, 15, 'bark');
  g.fillRect(4, 2, 18, 13, 'sky');
  for (let i = 0; i < 12; i++) {
    g.set(5 + i, 13 - i, 'foam');
    if (i < 8) g.set(9 + i, 13 - i, 'foam');
  }
  g.fillRect(4, 2, 18, 2, 'sea');
  g.fillRect(12, 2, 2, 13, 'umber').fillRect(4, 8, 18, 1, 'umber');
  // Curtains and the sill.
  block(g, 0, 0, 5, 16, ['wine', 'rose', 'peach']);
  block(g, 21, 0, 5, 16, ['wine', 'rose', 'peach'], { bias: -0.15 });
  block(g, 2, 15, 22, 2, RAMPS.lightWood);
  return outline(g, { steps: 1 });
}

function floorLamp(lit: boolean): PixelGrid {
  const g = new PixelGrid(14, 32);
  if (lit) {
    g.fillRect(3, 2, 8, 8, 'gold').fillRect(4, 3, 6, 5, 'cream');
    return g;
  }
  g.line(7, 9, 7, 29, 'umber').line(6, 9, 6, 29, 'clay');
  oval(g, 3, 28, 8, 3, RAMPS.wood);
  for (let y = 2; y < 10; y++) {
    const half = 2 + Math.floor((y - 2) / 2);
    for (let x = 7 - half; x < 7 + half; x++) g.set(x, y, x < 7 ? 'cream' : 'sand');
  }
  g.line(2, 10, 11, 10, 'tan');
  return outline(g, { steps: 2 });
}

function doormat(): PixelGrid {
  const g = new PixelGrid(20, 10);
  g.fillRect(1, 1, 18, 8, 'clay');
  for (let x = 2; x < 18; x += 2) g.line(x, 2, x, 7, 'tan');
  g.fillRect(1, 1, 18, 1, 'umber').fillRect(1, 8, 18, 1, 'umber');
  return g;
}

// ---------------------------------------------------------------------------

export function registerBuildings(sink: TextureSink): void {
  const houses: Array<[string, string, HouseStyle]> = [
    [BUILDING_TEXTURES.houseBlue, BUILDING_TEXTURES.houseBlueLit, HOUSE_STYLES.blue],
    [BUILDING_TEXTURES.houseGreen, BUILDING_TEXTURES.houseGreenLit, HOUSE_STYLES.green],
    [BUILDING_TEXTURES.housePurple, BUILDING_TEXTURES.housePurpleLit, HOUSE_STYLES.purple],
    [BUILDING_TEXTURES.shop, BUILDING_TEXTURES.shopLit, HOUSE_STYLES.shop],
    [BUILDING_TEXTURES.hall, BUILDING_TEXTURES.hallLit, HOUSE_STYLES.hall],
  ];
  for (const [key, litKey, style] of houses) {
    const [g, lit] = house(style);
    sink.image(key, g);
    sink.image(litKey, lit);
  }
  sink.image(BUILDING_TEXTURES.warung, warung());
  sink.image(BUILDING_TEXTURES.well, well());
  sink.image(BUILDING_TEXTURES.bench, bench());
  sink.image(BUILDING_TEXTURES.signpost, signpost());
  sink.image(BUILDING_TEXTURES.barrel, barrel());
  sink.image(BUILDING_TEXTURES.crate, crate());
  sink.sheet(BUILDING_TEXTURES.palm, palmFrames(), 44, 60);
  sink.image(BUILDING_TEXTURES.boat, boat());
  sink.image(BUILDING_TEXTURES.hut, hut());
  sink.image(BUILDING_TEXTURES.umbrella, umbrella());
  sink.image(BUILDING_TEXTURES.planter, planter());
  sink.image(BUILDING_TEXTURES.board, board());
  sink.sheet(BUILDING_TEXTURES.fountain, fountainFrames(), 48, 38);
  sink.image(BUILDING_TEXTURES.bed, bed());
  sink.image(BUILDING_TEXTURES.table, table());
  sink.image(BUILDING_TEXTURES.chair, chair());
  sink.image(BUILDING_TEXTURES.stove, stove());
  sink.image(BUILDING_TEXTURES.shelf, shelf());
  sink.image(BUILDING_TEXTURES.rug, rug());
  sink.image(BUILDING_TEXTURES.plantPot, plantPot());
  sink.image(BUILDING_TEXTURES.windowWall, windowWall());
  sink.image(BUILDING_TEXTURES.floorLamp, floorLamp(false));
  sink.image(BUILDING_TEXTURES.floorLampLit, floorLamp(true));
  sink.image(BUILDING_TEXTURES.doormat, doormat());
  sink.sheet(BUILDING_TEXTURES.banana, bananaFrames(), 44, 54);
  sink.sheet(BUILDING_TEXTURES.hibiscus, hibiscusFrames(), 22, 20);
  sink.sheet(BUILDING_TEXTURES.flowerBed, flowerBedFrames(), 18, 14);
  sink.image(BUILDING_TEXTURES.fruitStall, fruitStall());
}
