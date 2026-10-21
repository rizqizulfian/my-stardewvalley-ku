// Phase 6 farm art: farm animals (chicken, duck, cat, sheep, cow), beehives,
// the long hay barn, the animal barn (kandang) and its fittings, the windmill
// and a water trough.

import { textGrid } from './font';
import { PixelGrid, blobMask, hash2, outline, shade, type ShadeOptions, type TextureSink } from './pixel';
import { RAMPS, type ColorName, type Ramp } from './palette';

export const FARM_TEXTURES = {
  hive: 'farm-hive',
  hiveEmpty: 'farm-hive-empty',
  hayBarn: 'farm-hay-barn',
  windmill: 'farm-windmill',
  trough: 'farm-trough',
  hayBale: 'farm-hay-bale',
  animalBarn: 'farm-animal-barn',
  animalBarnLit: 'farm-animal-barn-lit',
  nestBox: 'farm-nest-box',
  manger: 'farm-manger',
} as const;

export const animalTexture = (kind: AnimalKind) => `animal-${kind}`;

export type AnimalKind = 'chicken' | 'duck' | 'cat' | 'sheep' | 'cow';

/** Animal sheets: idle, idle (head down / blink), walk x2. Drawn facing right. */
export const ANIMAL_FRAMES = { idle: [0, 1], walk: [2, 3], count: 4 } as const;
export const ANIMAL_SIZE: Record<AnimalKind, { w: number; h: number }> = {
  chicken: { w: 14, h: 14 },
  duck: { w: 16, h: 14 },
  cat: { w: 16, h: 14 },
  sheep: { w: 22, h: 18 },
  cow: { w: 30, h: 24 },
};

export const WINDMILL = { w: 64, h: 104, frames: 4 } as const;
export const HIVE = { w: 16, h: 22, frames: 3 } as const;

function block(g: PixelGrid, x: number, y: number, w: number, h: number, ramp: Ramp, o: ShadeOptions = {}): void {
  g.stamp(shade(new PixelGrid(g.w, g.h).fillRect(x, y, w, h, 'ink'), ramp, { rim: 0.3, gradient: 0.5, ...o }));
}

function blob(g: PixelGrid, circles: ReadonlyArray<[number, number, number, number?]>, ramp: Ramp, o: ShadeOptions = {}): void {
  g.stamp(shade(blobMask(g.w, g.h, circles), ramp, { rim: 0.3, gradient: 0.6, ...o }));
}

// ---------------------------------------------------------------------------
// Animals. Each takes the frame (0 idle, 1 idle alt, 2-3 walk) and draws a
// side view facing right; legs swap on the walk frames.

function legs(g: PixelGrid, xs: number[], top: number, len: number, f: number, c: ColorName): void {
  xs.forEach((x, i) => {
    const step = f >= 2 ? ((i + f) % 2 === 0 ? 1 : -1) : 0;
    g.line(x, top, x + step, top + len - 1, c);
  });
}

function chicken(f: number): PixelGrid {
  const { w: W, h: H } = ANIMAL_SIZE.chicken;
  const g = new PixelGrid(W, H);
  const peck = f === 1 ? 2 : 0;
  legs(g, [6, 8], 10, 3, f, 'amber');
  blob(g, [[6.5, 8, 4.5, 3.4], [3, 6.5, 2, 2.5]], ['haze', 'mist', 'cream', 'cream']);
  // Tail feathers, wing.
  g.set(2, 4, 'mist').set(1, 5, 'haze').line(4, 8, 7, 9, 'haze');
  // Head: up, or down pecking.
  blob(g, [[10.5, 4 + peck, 2.4, 2.4]], ['haze', 'mist', 'cream', 'cream']);
  g.set(10, 1 + peck, 'brick').set(11, 1 + peck, 'brick').set(11, 2 + peck, 'coral');
  g.set(13, 4 + peck, 'amber').set(12, 5 + peck, 'brick');
  g.set(11, 3 + peck, 'ink');
  return outline(g, { steps: 2 });
}

function duck(f: number): PixelGrid {
  const { w: W, h: H } = ANIMAL_SIZE.duck;
  const g = new PixelGrid(W, H);
  const dip = f === 1 ? 1 : 0;
  legs(g, [7, 9], 11, 2, f, 'coral');
  blob(g, [[7.5, 8.5, 5.5, 3.2], [3, 7.5, 2.2, 2]], ['haze', 'mist', 'cream', 'cream']);
  g.set(1, 6, 'mist').line(5, 8, 9, 9, 'haze');
  g.fillRect(10, 4 + dip, 2, 4, 'mist');
  blob(g, [[11.5, 3.5 + dip, 2.3, 2.2]], ['haze', 'mist', 'cream', 'cream']);
  g.fillRect(13, 3 + dip, 2, 2, 'coral').set(14, 4 + dip, 'amber');
  g.set(12, 2 + dip, 'ink');
  return outline(g, { steps: 2 });
}

function cat(f: number): PixelGrid {
  const { w: W, h: H } = ANIMAL_SIZE.cat;
  const g = new PixelGrid(W, H);
  const ginger: Ramp = ['umber', 'clay', 'tan', 'sand'];
  if (f < 2) {
    // Sitting, tail curled round; frame 1 blinks and flicks the tail.
    blob(g, [[7, 9.5, 4, 3.5], [8, 6.5, 3, 3]], ginger);
    g.line(3, 12, 1, 9 - f, 'clay').set(1, 8 - f, 'tan');
    blob(g, [[10, 4, 3, 2.8]], ginger);
    g.set(8, 1, 'clay').set(9, 1, 'clay').set(11, 1, 'clay').set(12, 1, 'clay').set(8, 0, 'umber').set(12, 0, 'umber');
    if (f === 0) g.set(9, 4, 'ink').set(11, 4, 'ink');
    else g.set(9, 4, 'umber').set(11, 4, 'umber');
    g.set(10, 5, 'rose');
    g.line(6, 7, 8, 7, 'clay').line(6, 9, 8, 9, 'clay');
  } else {
    legs(g, [4, 6, 9, 11], 9, 3, f, 'clay');
    blob(g, [[7.5, 8, 5, 2.6]], ginger);
    g.line(2, 7, 0, 4 + (f - 2), 'clay');
    blob(g, [[12, 5, 2.6, 2.5]], ginger);
    g.set(11, 2, 'clay').set(13, 2, 'clay').set(13, 5, 'ink').set(14, 6, 'rose');
    g.line(5, 7, 5, 9, 'clay').line(8, 7, 8, 9, 'clay');
  }
  return outline(g, { steps: 2 });
}

function sheep(f: number): PixelGrid {
  const { w: W, h: H } = ANIMAL_SIZE.sheep;
  const g = new PixelGrid(W, H);
  const graze = f === 1 ? 2 : 0;
  legs(g, [6, 8, 13, 15], 12, 5, f, 'night');
  // Fluffy wool: lots of little puffs.
  const puffs: Array<[number, number, number, number?]> = [];
  for (let i = 0; i < 7; i++) puffs.push([5 + i * 1.8, 7 + (i % 2), 3, 3]);
  puffs.push([10, 10, 6, 3]);
  blob(g, puffs, ['haze', 'mist', 'cream', 'cream'], { noise: 0.3, seed: 14 });
  for (let i = 0; i < 6; i++) g.set(5 + Math.floor(hash2(i, 1, 3) * 11), 6 + Math.floor(hash2(i, 2, 3) * 5), 'mist');
  // Dark face and ears.
  blob(g, [[17.5, 6 + graze, 2.6, 3]], ['ink', 'night', 'plum', 'mauve']);
  g.set(15, 4 + graze, 'night').set(14, 5 + graze, 'night');
  g.set(18, 5 + graze, 'cream');
  return outline(g, { steps: 2 });
}

function cow(f: number): PixelGrid {
  const { w: W, h: H } = ANIMAL_SIZE.cow;
  const g = new PixelGrid(W, H);
  const graze = f === 1 ? 3 : 0;
  legs(g, [6, 9, 18, 21], 16, 7, f, 'mist');
  for (const x of [6, 9, 18, 21]) g.set(x + (f >= 2 && x % 2 ? 1 : 0), 22, 'night');
  // Body: white with dark patches.
  block(g, 3, 7, 21, 10, ['haze', 'mist', 'cream', 'cream'], { rim: 0.35 });
  const spots: Array<[number, number, number, number]> = [
    [7, 9, 4, 3],
    [14, 12, 5, 3],
    [19, 8, 3, 2],
  ];
  for (const [x, y, w, h] of spots) g.fillEllipse(x, y, w, h, 'night').set(x + 1, y, 'plum');
  // Udder, tail.
  g.fillRect(15, 17, 3, 1, 'rose');
  g.line(3, 8, 1, 14, 'mist').set(1, 15, 'night');
  // Head with a pink muzzle and little horns.
  block(g, 23, 4 + graze, 6, 7, ['haze', 'mist', 'cream', 'cream'], { rim: 0.3 });
  g.fillRect(25, 9 + graze, 4, 3, 'peach').set(26, 10 + graze, 'skinShade').set(28, 10 + graze, 'skinShade');
  g.set(25, 6 + graze, 'ink');
  g.set(24, 3 + graze, 'sand').set(23, 2 + graze, 'cream').set(22, 5 + graze, 'night').set(21, 5 + graze, 'night');
  return outline(g, { steps: 2 });
}

const ANIMAL_DRAW: Record<AnimalKind, (f: number) => PixelGrid> = { chicken, duck, cat, sheep, cow };

// ---------------------------------------------------------------------------
// Beehive: a white wooden box hive on legs; bees drift around it. The full
// hive has honey oozing at the entrance.

function hive(full: boolean, f: number): PixelGrid {
  const { w: W, h: H } = HIVE;
  const g = new PixelGrid(W, H);
  g.line(3, 18, 3, 21, 'umber').line(12, 18, 12, 21, 'umber');
  block(g, 2, 10, 12, 8, ['mauve', 'haze', 'mist', 'cream'], { rim: 0.25 });
  block(g, 2, 6, 12, 4, ['mauve', 'haze', 'mist', 'cream'], { rim: 0.25, bias: 0.1 });
  g.fillRect(1, 4, 14, 2, 'clay').fillRect(1, 4, 14, 1, 'tan');
  g.line(2, 10, 13, 10, 'haze');
  g.fillRect(6, 15, 4, 1, 'night');
  if (full) g.fillRect(6, 16, 3, 1, 'amber').set(7, 17, 'gold').set(5, 15, 'gold');
  // Bees: tiny gold-and-ink dots that move between frames.
  const out = outline(g, { steps: 2 });
  for (let i = 0; i < 3; i++) {
    const a = f * 2.1 + i * 2.1;
    const x = Math.round(8 + Math.cos(a) * 6);
    const y = Math.round(3 + Math.sin(a) * 2 + i);
    if (x >= 0 && x < W - 1 && y >= 0) out.set(x, y, 'gold').set(x + 1, y, 'ink');
  }
  return out;
}

// ---------------------------------------------------------------------------
// Long hay barn: an open-fronted shed with a deep thatched roof on posts,
// hay bales stacked inside.

function hayBarn(): PixelGrid {
  const W = 112;
  const H = 70;
  const g = new PixelGrid(W, H);
  const eave = 30;
  // Back wall in shadow, floor of loose straw.
  block(g, 6, eave - 4, W - 12, H - eave - 2, ['bark', 'umber', 'clay'], { gradient: 0.3, dither: 0.4 });
  for (let x = 8; x < W - 8; x += 5) g.line(x, eave - 2, x, H - 9, 'bark');
  block(g, 4, H - 8, W - 8, 6, RAMPS.straw, { rim: 0.2, dither: 0.6, noise: 0.4, seed: 61 });
  // Hay bales.
  for (const [bx, by] of [
    [12, H - 20],
    [26, H - 20],
    [19, H - 30],
    [78, H - 20],
    [92, H - 20],
  ]) {
    block(g, bx, by, 13, 11, RAMPS.straw, { rim: 0.3, dither: 0.5, noise: 0.35, seed: bx });
    g.line(bx + 4, by, bx + 4, by + 10, 'clay').line(bx + 9, by, bx + 9, by + 10, 'clay');
  }
  // Posts.
  for (const px of [3, 36, 73, W - 7]) block(g, px, eave, 4, H - eave - 2, RAMPS.wood);
  // Thatched roof: long, deep and ragged at the eave.
  const roof = new PixelGrid(W, H);
  for (let y = 4; y < eave + 2; y++) {
    const inset = Math.max(0, Math.round((eave - y) * 0.35)) - 2;
    roof.fillRect(Math.max(0, inset), y, W - Math.max(0, inset) * 2, 1, 'ink');
  }
  for (let x = 0; x < W; x++) if (hash2(x, 7, 62) < 0.5) roof.set(x, eave + 2, 'ink');
  g.stamp(shade(roof, RAMPS.straw, { rim: 0.2, gradient: 0.5, dither: 0.3, noise: 0.2, seed: 63 }));
  for (let y = 8; y < eave; y += 5) for (let x = 0; x < W; x++) if (g.colorAt(x, y) && hash2(x, y, 64) < 0.6 && y < eave) g.set(x, y, 'clay');
  g.fillRect(14, 3, W - 28, 2, 'umber').fillRect(14, 3, W - 28, 1, 'clay');
  return outline(g, { steps: 2 });
}

// ---------------------------------------------------------------------------
// Windmill: a white tapered tower with a red cap and four turning sails.

function windmill(): PixelGrid[] {
  const { w: W, h: H, frames } = WINDMILL;
  const base = new PixelGrid(W, H);
  const cx = W / 2;
  const tower = new PixelGrid(W, H);
  for (let y = 34; y < H - 2; y++) {
    const half = Math.round(8 + (y - 34) * 0.16);
    tower.fillRect(cx - half, y, half * 2, 1, 'ink');
  }
  base.stamp(shade(tower, RAMPS.plaster, { rim: 0.2, gradient: 0.45, bias: 0.15, dither: 0.5, noise: 0.1, seed: 71 }));
  base.fillRect(cx - 4, H - 16, 8, 14, 'bark');
  block(base, cx - 3, H - 15, 6, 13, RAMPS.wood, { gradient: 0.6 });
  base.fillRect(cx - 3, 54, 6, 6, 'deep').fillRect(cx - 2, 55, 4, 4, 'sky').set(cx, 55, 'foam');
  // Cap.
  const cap = new PixelGrid(W, H);
  for (let y = 0; y < 10; y++) cap.fillRect(cx - (4 + y), 25 + y, (4 + y) * 2, 1, 'ink');
  base.stamp(shade(cap, RAMPS.roof, { rim: 0.3, gradient: 0.5 }));
  return Array.from({ length: frames }, (_, f) => {
    const g = base.clone();
    const hubY = 31;
    const angle0 = (f / frames) * (Math.PI / 2);
    for (let k = 0; k < 4; k++) {
      const a = angle0 + (k * Math.PI) / 2;
      const ux = Math.cos(a);
      const uy = Math.sin(a);
      for (let i = 2; i < 27; i++) {
        const x = Math.round(cx + ux * i);
        const y = Math.round(hubY + uy * i);
        g.set(x, y, 'umber');
        // Lattice sail on one side of each arm.
        if (i > 6)
          for (let j = 1; j <= 5; j++) {
            const sx = Math.round(cx + ux * i - uy * j);
            const sy = Math.round(hubY + uy * i + ux * j);
            g.set(sx, sy, (i + j) % 3 === 0 ? 'clay' : 'cream');
          }
      }
    }
    g.fillEllipse(cx - 2, hubY - 2, 5, 5, 'umber').set(cx, hubY, 'tan');
    return outline(g, { steps: 2 });
  });
}

function trough(): PixelGrid {
  const g = new PixelGrid(32, 16);
  block(g, 2, 6, 28, 8, RAMPS.wood, { rim: 0.35 });
  g.fillRect(4, 6, 24, 3, 'sea').fillRect(5, 6, 22, 1, 'sky').set(9, 7, 'foam').set(20, 7, 'foam');
  g.line(3, 14, 3, 15, 'bark').line(28, 14, 28, 15, 'bark');
  return outline(g, { steps: 2 });
}

function hayBale(): PixelGrid {
  const g = new PixelGrid(16, 14);
  block(g, 1, 2, 14, 11, RAMPS.straw, { rim: 0.3, dither: 0.5, noise: 0.35, seed: 81 });
  g.line(5, 2, 5, 12, 'clay').line(10, 2, 10, 12, 'clay');
  return outline(g, { steps: 2 });
}

// ---------------------------------------------------------------------------
// The animal barn: a red gambrel barn with white trim, big cross-braced doors,
// a hay loft and a little rooster vane. The lit version glows at night.

function animalBarn(lit: boolean): PixelGrid {
  const W = 112;
  const H = 92;
  const g = new PixelGrid(W, H);
  const cx = W / 2;
  // Half-width of the gambrel front at a given row.
  const half = (y: number) => (y < 8 ? -1 : y < 20 ? Math.round((32 * (y - 8)) / 12) : y < 46 ? Math.round(32 + (18 * (y - 20)) / 26) : 50);
  if (!lit) {
    // Slate roof edge peeking over the gable.
    const roof = new PixelGrid(W, H);
    for (let y = 4; y < 50; y++) {
      const h = half(y + 4) + 4;
      if (h > 3) roof.fillRect(cx - h, y, h * 2, 1, 'ink');
    }
    g.stamp(shade(roof, ['night', 'plum', 'mauve'], { rim: 0.3, gradient: 0.5 }));
    // Red plank front.
    const front = new PixelGrid(W, H);
    for (let y = 8; y < H - 6; y++) {
      const h = half(y);
      if (h > 0) front.fillRect(cx - h, y, h * 2, 1, 'ink');
    }
    const red = shade(front, ['wine', 'brick', 'coral'], { rim: 0.2, gradient: 0.4, dither: 0.3 });
    red.forEachFilled((x, y) => {
      if ((x - 6) % 6 === 0) red.set(x, y, 'wine');
    });
    g.stamp(red);
    // White trim along the gable and down the corners.
    for (let y = 8; y < 46; y++) {
      const h = half(y);
      if (h <= 0) continue;
      g.fillRect(cx - h, y, 2, 1, 'cream').fillRect(cx + h - 2, y, 2, 1, 'cream');
    }
    g.fillRect(cx - 50, 46, 3, H - 52, 'cream').fillRect(cx + 47, 46, 3, H - 52, 'cream');
    g.fillRect(cx - 50, 46, 100, 2, 'cream');
    // Stone footing.
    block(g, 5, H - 7, W - 10, 6, RAMPS.stone, { noise: 0.3, seed: 91 });
    for (let x = 9; x < W - 8; x += 9) g.set(x, H - 5, 'plum').set(x + 4, H - 3, 'plum');
    // Name board.
    g.fillRect(cx - 22, 40, 44, 9, 'umber').fillRect(cx - 22, 40, 44, 1, 'clay');
    g.stamp(textGrid('KANDANG', 'cream'), cx - 19, 41);
    // Big double doors, cross-braced.
    g.fillRect(cx - 19, 52, 38, H - 59, 'cream');
    for (const dx of [cx - 17, cx + 1]) {
      block(g, dx, 54, 16, H - 61, ['wine', 'brick', 'coral'], { gradient: 0.4 });
      g.line(dx, 54, dx + 15, H - 8, 'cream').line(dx + 15, 54, dx, H - 8, 'cream');
      g.fillRect(dx, 54, 16, 1, 'cream').fillRect(dx, H - 8, 16, 1, 'cream');
    }
    g.fillRect(cx - 1, 54, 2, H - 61, 'cream');
    g.fillRect(cx - 4, 70, 2, 3, 'night').fillRect(cx + 2, 70, 2, 3, 'night');
    // Rooster vane on the ridge.
    g.fillRect(cx, 0, 1, 8, 'night');
    g.fillRect(cx - 3, 1, 6, 2, 'night').set(cx + 3, 0, 'night').set(cx - 4, 0, 'night');
  }
  // Loft door with hay, and two small side windows.
  const glass: ColorName = lit ? 'gold' : 'deep';
  const glint: ColorName = lit ? 'cream' : 'sky';
  if (!lit) g.fillRect(cx - 9, 20, 18, 16, 'cream');
  g.fillRect(cx - 7, 22, 14, 13, lit ? 'amber' : 'night');
  for (let x = cx - 7; x < cx + 7; x++) if (hash2(x, 3, 92) < 0.7) g.line(x, 34, x + (x % 2 ? 1 : -1), 31 - Math.floor(hash2(x, 4, 92) * 3), lit ? 'gold' : 'amber');
  for (const wx of [14, W - 26]) {
    if (!lit) g.fillRect(wx - 1, 55, 14, 13, 'cream');
    g.fillRect(wx + 1, 57, 10, 9, glass).fillRect(wx + 6, 57, 1, 9, lit ? 'amber' : 'cream').fillRect(wx + 1, 61, 10, 1, lit ? 'amber' : 'cream');
    g.set(wx + 2, 58, glint).set(wx + 3, 58, glint);
  }
  return lit ? g : outline(g, { steps: 2 });
}

/** A wooden nesting box full of straw, with a hen-sized hollow. */
function nestBox(): PixelGrid {
  const g = new PixelGrid(16, 16);
  block(g, 1, 5, 14, 10, RAMPS.wood, { gradient: 0.5 });
  block(g, 2, 3, 12, 5, RAMPS.straw, { dither: 0.5, noise: 0.4, seed: 93 });
  g.fillEllipse(5, 4, 6, 3, 'amber');
  g.line(2, 9, 13, 9, 'umber');
  return outline(g, { steps: 2 });
}

/** A long wooden manger heaped with hay. */
function manger(): PixelGrid {
  const g = new PixelGrid(32, 16);
  block(g, 1, 6, 30, 9, RAMPS.wood, { gradient: 0.5 });
  for (let x = 3; x < 30; x++) {
    const top = 2 + Math.round(Math.sin(x * 0.7) * 1.2 + hash2(x, 1, 94) * 2);
    g.line(x, top, x, 7, hash2(x, 2, 94) < 0.3 ? 'gold' : 'amber');
  }
  g.fillRect(1, 9, 30, 1, 'umber');
  for (const px of [2, 15, 28]) g.fillRect(px, 6, 2, 9, 'umber');
  return outline(g, { steps: 2 });
}

// ---------------------------------------------------------------------------

export function registerFarmArt(sink: TextureSink): void {
  for (const kind of Object.keys(ANIMAL_DRAW) as AnimalKind[]) {
    const { w, h } = ANIMAL_SIZE[kind];
    sink.sheet(animalTexture(kind), [0, 1, 2, 3].map((f) => ANIMAL_DRAW[kind](f)), w, h);
  }
  sink.sheet(FARM_TEXTURES.hive, [0, 1, 2].map((f) => hive(true, f)), HIVE.w, HIVE.h);
  sink.sheet(FARM_TEXTURES.hiveEmpty, [0, 1, 2].map((f) => hive(false, f)), HIVE.w, HIVE.h);
  sink.image(FARM_TEXTURES.hayBarn, hayBarn());
  sink.sheet(FARM_TEXTURES.windmill, windmill(), WINDMILL.w, WINDMILL.h);
  sink.image(FARM_TEXTURES.trough, trough());
  sink.image(FARM_TEXTURES.hayBale, hayBale());
  sink.image(FARM_TEXTURES.animalBarn, animalBarn(false));
  sink.image(FARM_TEXTURES.animalBarnLit, animalBarn(true));
  sink.image(FARM_TEXTURES.nestBox, nestBox());
  sink.image(FARM_TEXTURES.manger, manger());
}
