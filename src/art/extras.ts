// Phase 6 art: the dancing doodle dog and its little house, the art museum
// (facade, paintings, sculptures), the park's big fountain.

import { PixelGrid, blobMask, hash2, outline, shade, type ShadeOptions, type TextureSink } from './pixel';
import { RAMPS, type ColorName, type Ramp } from './palette';
import { textGrid } from './font';
import { VAN_GOGH, VAN_GOGH_CELL, vanGoghBanner, vanGoghPainting } from './vangogh';

export const EXTRA_TEXTURES = {
  dog: 'extra-dog',
  phone: 'extra-phone',
  dogHouse: 'extra-dog-house',
  dogHouseLit: 'extra-dog-house-lit',
  warnSign: 'extra-warn-sign',
  museum: 'extra-museum',
  museumLit: 'extra-museum-lit',
  bigFountain: 'extra-big-fountain',
  painting: 'extra-painting',
  vanGogh: 'extra-van-gogh',
  vanGoghBanner: 'extra-van-gogh-banner',
  sculpture: 'extra-sculpture',
  ropePost: 'extra-rope-post',
  hedge: 'extra-hedge',
  parkLamp: 'extra-park-lamp',
} as const;

/** Dancing dog sheet: frame size and the dance (frame per beat). */
export const DOG = {
  w: 30,
  h: 32,
  /** Front, sway left, front, sway right, arms up, squash, back, back sway. */
  frames: 8,
  dance: [0, 1, 0, 3, 0, 1, 0, 3, 4, 5, 4, 5, 6, 7, 6, 7, 0, 1, 0, 3, 4, 4, 5, 5],
} as const;

export const PAINTINGS = ['terraces', 'grandma', 'fruit', 'circles', 'harbour', 'night', 'buffalo', 'lotus'] as const;
export const SCULPTURES = ['swirl', 'bust', 'farmer', 'egg'] as const;
export const BIG_FOUNTAIN = { w: 84, h: 74, frames: 4 } as const;

function block(g: PixelGrid, x: number, y: number, w: number, h: number, ramp: Ramp, o: ShadeOptions = {}): void {
  g.stamp(shade(new PixelGrid(g.w, g.h).fillRect(x, y, w, h, 'ink'), ramp, { rim: 0.3, gradient: 0.5, ...o }));
}

function oval(g: PixelGrid, x: number, y: number, w: number, h: number, ramp: Ramp, o: ShadeOptions = {}): void {
  g.stamp(shade(new PixelGrid(g.w, g.h).fillEllipse(x, y, w, h, 'ink'), ramp, { rim: 0.3, gradient: 0.6, ...o }));
}

// ---------------------------------------------------------------------------
// The doodle dog: a white blob with floppy black ears, dot eyes and a dot
// nose, drawn with a pen-black line.

export interface DogPose {
  dx: number;
  head: number;
  back?: boolean;
  /** 'point' is the disco finger, straight up and out; 'low' points down across the hip. */
  armL: 'down' | 'up' | 'out' | 'point' | 'low';
  armR: 'down' | 'up' | 'out' | 'point' | 'low';
  squash?: boolean;
}

const DOG_POSES: DogPose[] = [
  { dx: 0, head: 0, armL: 'down', armR: 'down' },
  { dx: -1, head: -2, armL: 'down', armR: 'out' },
  { dx: 0, head: 0, armL: 'down', armR: 'down' },
  { dx: 1, head: 2, armL: 'out', armR: 'down' },
  { dx: 0, head: 0, armL: 'up', armR: 'up' },
  { dx: 0, head: 0, armL: 'up', armR: 'up', squash: true },
  { dx: 0, head: 0, back: true, armL: 'down', armR: 'down' },
  { dx: 1, head: 1, back: true, armL: 'out', armR: 'out' },
];

export function dogFrame(p: DogPose): PixelGrid {
  const { w: W, h: H } = DOG;
  const cx = 15;
  const s = p.squash ? 1 : 0;
  const body = new PixelGrid(W, H);
  // Sack-shaped body, a little wider at the bottom, and two stubby feet.
  body.stamp(blobMask(W, H, [[cx + p.dx, 23 + s, 6.5, 5.5], [cx + p.dx, 26, 7, 3.5]]).recolor({ ink: 'cream' }));
  const bodyMask = new PixelGrid(W, H);
  blobMask(W, H, [[cx + p.dx, 23 + s, 6.5, 5.5], [cx + p.dx, 26, 7, 3.5]]).forEachFilled((x, y) => bodyMask.set(x, y, 'cream'));
  const hx = cx + p.dx + p.head;
  const hy = 11 + s;
  const head = blobMask(W, H, [[hx, hy, 8.5, 7]]);
  const g = new PixelGrid(W, H);
  bodyMask.forEachFilled((x, y) => g.set(x, y, 'cream'));
  head.forEachFilled((x, y) => g.set(x, y, 'cream'));
  // Pen outline round the whole figure, then the inner neck line.
  const out = outline(g, { color: 'ink' });
  for (let x = hx - 5; x <= hx + 5; x++) if (out.colorAt(x, hy + 7) === 'cream' && hash2(x, 3, 5) < 0.9) out.set(x, hy + 7, 'ink');
  // Feet: a notch between the two.
  out.set(cx + p.dx, 29, 'ink').set(cx + p.dx, 28, 'ink');
  // Floppy ears hanging from the top of the head.
  for (const side of [-1, 1]) {
    const ex = hx + side * 7;
    const ear = blobMask(W, H, [[ex, hy - 1, 2.6, 4.2], [ex + side * 0.5, hy + 2, 2.2, 3]]);
    ear.forEachFilled((x, y) => out.set(x, y, 'ink'));
  }
  if (!p.back) {
    // Dot eyes and a dot nose, all in one row.
    out.set(hx - 3, hy + 1, 'ink').set(hx + 3, hy + 1, 'ink');
    out.set(hx, hy + 2, 'ink');
  } else {
    // From behind: a tiny tail.
    out.set(cx + p.dx + 4, 25, 'ink').set(cx + p.dx + 5, 24, 'ink');
  }
  // Arms: pen strokes from the shoulders.
  const arm = (side: number, a: DogPose['armL']) => {
    const sx = cx + p.dx + side * 6;
    const sy = 20 + s;
    if (a === 'down') out.line(sx, sy, sx + side * 1, sy + 5, 'ink');
    else if (a === 'out') out.line(sx, sy, sx + side * 4, sy - 2, 'ink').set(sx + side * 5, sy - 3, 'ink');
    else if (a === 'point') out.line(sx, sy, sx + side * 5, sy - 9, 'ink').set(sx + side * 5, sy - 10, 'ink');
    else if (a === 'low') out.line(sx, sy, sx - side * 3, sy + 5, 'ink').set(sx - side * 4, sy + 6, 'ink');
    else out.line(sx, sy, sx + side * 2, sy - 5, 'ink').line(sx + side * 2, sy - 5, sx + side * 1, sy - 8, 'ink');
  };
  arm(-1, p.armL);
  arm(1, p.armR);
  return out;
}

/** A Nokia-style brick phone lying on the floor: dark body, green screen, keypad. */
function phone(): PixelGrid {
  const g = new PixelGrid(16, 10);
  g.fillRect(1, 2, 14, 6, 'night').fillRect(2, 1, 12, 1, 'night').fillRect(2, 8, 12, 1, 'night');
  g.fillRect(2, 2, 12, 1, 'plum');
  // Screen at one end, keypad dots at the other.
  g.fillRect(9, 3, 4, 4, 'leaf').fillRect(10, 4, 2, 2, 'lime');
  for (let x = 3; x <= 7; x += 2) for (let y = 3; y <= 6; y += 2) g.set(x, y, 'haze');
  g.set(8, 4, 'mauve');
  return outline(g, { color: 'ink' });
}

// ---------------------------------------------------------------------------
// The dog's little house in town: white walls, a sky-blue roof, a round
// window and a bone sign over the door.

function dogHouse(): [PixelGrid, PixelGrid] {
  const W = 48;
  const H = 52;
  const g = new PixelGrid(W, H);
  const wallTop = 22;
  const foot = H - 5;
  block(g, 5, wallTop, W - 10, foot - wallTop, RAMPS.plaster, { rim: 0.1, gradient: 0.35, bias: 0.2, dither: 0.5, noise: 0.1, seed: 21 });
  block(g, 3, foot, W - 6, 4, RAMPS.stone.slice(1), { dither: 0.5, noise: 0.3, seed: 22 });
  // Gable roof.
  const roof = new PixelGrid(W, H);
  for (let y = 0; y < 18; y++) {
    const half = 6 + y * 1.25;
    roof.fillRect(Math.round(W / 2 - half), y + 5, Math.round(half * 2), 1, 'ink');
  }
  g.stamp(shade(roof, ['deep', 'sea', 'sky', 'foam'], { rim: 0.25, gradient: 0.5 }));
  for (let y = 8; y < 23; y += 3) for (let x = 0; x < W; x++) if (g.colorAt(x, y) && g.colorAt(x, y) !== 'cream' && y < wallTop) g.set(x, y, 'deep');
  for (let x = 4; x < W - 4; x++) g.set(x, wallTop, 'plum').set(x, wallTop + 1, 'mauve');
  // Door with a bone sign above it.
  g.fillRect(19, 30, 10, foot - 30, 'bark');
  block(g, 20, 31, 8, foot - 31, RAMPS.wood, { gradient: 0.6 });
  g.set(26, 39, 'gold');
  g.fillRect(17, 25, 14, 4, 'cream').fillRect(16, 25, 2, 2, 'cream').fillRect(16, 27, 2, 2, 'cream').fillRect(30, 25, 2, 2, 'cream').fillRect(30, 27, 2, 2, 'cream');
  g.fillRect(20, 26, 8, 1, 'mauve');
  // Round window.
  const lit = new PixelGrid(W, H);
  for (const wx of [8, 32]) {
    g.fillEllipse(wx, 29, 8, 8, 'bark');
    g.fillEllipse(wx + 1, 30, 6, 6, 'sea');
    g.set(wx + 2, 31, 'foam').set(wx + 3, 32, 'sky');
    lit.fillEllipse(wx + 1, 30, 6, 6, 'gold').set(wx + 3, 32, 'cream');
  }
  // Paw prints on the step.
  for (const [px, py] of [
    [13, 48],
    [36, 49],
  ])
    g.set(px, py, 'mauve').set(px - 1, py - 1, 'mauve').set(px + 1, py - 1, 'mauve');
  return [outline(g, { steps: 2 }), lit];
}

/** A crooked red "DILARANG MASUK SINI!" board on a post by the dog's door. It only makes people curious. */
function warnSign(): PixelGrid {
  const W = 58;
  const H = 40;
  const g = new PixelGrid(W, H);
  block(g, 27, 20, 3, 19, RAMPS.wood);
  const b = new PixelGrid(W, H);
  block(b, 1, 2, 54, 21, ['wine', 'brick', 'coral'], { rim: 0.3, gradient: 0.4 });
  b.stamp(textGrid('DILARANG', 'cream'), 9, 5);
  b.stamp(textGrid('MASUK SINI!', 'cream'), 4, 14);
  b.set(3, 3, 'mist').set(52, 3, 'mist');
  // Hung crooked: the right side sags a little.
  b.forEachFilled((x, y, c) => g.set(x, y + Math.floor(x / 15), c));
  // A crack across the lower corner.
  g.line(46, 24, 53, 26, 'wine');
  return outline(g, { steps: 2 });
}

// ---------------------------------------------------------------------------
// The art museum: a small classical front with columns, a pediment, steps and
// banners.

function museum(): [PixelGrid, PixelGrid] {
  const W = 112;
  const H = 96;
  const g = new PixelGrid(W, H);
  const stone = RAMPS.plaster;
  const baseY = H - 12;
  // Back wall.
  block(g, 6, 34, W - 12, baseY - 34, stone, { rim: 0.1, gradient: 0.3, bias: 0.1, dither: 0.5, noise: 0.1, seed: 31 });
  for (let y = 38; y < baseY; y += 5) for (let x = 7; x < W - 7; x++) if (g.colorAt(x, y) && x % 11 !== 0) g.set(x, y, 'haze');
  // Steps.
  for (let i = 0; i < 3; i++) block(g, 4 + i * 4, baseY + i * 4, W - 8 - i * 8, 4, RAMPS.stone.slice(1), { rim: 0.4, gradient: 0.3 });
  // Doorway, warm inside.
  const lit = new PixelGrid(W, H);
  g.fillRect(46, 50, 20, baseY - 50, 'gold');
  g.fillRect(48, 52, 16, baseY - 52, 'night');
  g.fillEllipse(46, 44, 20, 14, 'gold').fillEllipse(48, 46, 16, 12, 'night');
  lit.fillRect(48, 52, 16, baseY - 52, 'amber').fillEllipse(48, 46, 16, 12, 'amber').fillRect(52, 56, 8, baseY - 56, 'gold');
  // Windows between the columns.
  for (const wx of [20, 82]) {
    g.fillRect(wx - 1, 48, 12, 22, 'plum');
    g.fillRect(wx, 49, 10, 20, 'deep');
    g.line(wx, 69, wx + 9, 49, 'sea').line(wx + 2, 69, wx + 9, 52, 'sky');
    g.fillRect(wx + 4, 49, 1, 20, 'plum');
    lit.fillRect(wx, 49, 10, 20, 'gold').fillRect(wx + 4, 49, 1, 20, 'amber');
  }
  // Columns with capitals and bases.
  for (const cx of [10, 34, 70, 94]) {
    block(g, cx, 40, 8, baseY - 40, ['haze', 'mist', 'cream', 'cream'], { rim: 0.35, gradient: 0.2 });
    for (let x = cx + 2; x < cx + 7; x += 2) g.line(x, 41, x, baseY - 2, 'haze');
    block(g, cx - 2, 37, 12, 3, stone, { rim: 0.4 });
    block(g, cx - 2, baseY - 3, 12, 3, stone, { rim: 0.4 });
  }
  // Entablature with the name.
  block(g, 2, 26, W - 4, 11, stone, { rim: 0.3, gradient: 0.3, bias: 0.15 });
  g.fillRect(2, 36, W - 4, 1, 'mauve');
  const name = textGrid('MUSEUM SENI', 'plum');
  g.stamp(name, Math.round((W - name.w) / 2), 28);
  // Pediment.
  const ped = new PixelGrid(W, H);
  for (let y = 0; y < 20; y++) {
    const half = 8 + y * 2.6;
    ped.fillRect(Math.round(W / 2 - half), y + 6, Math.round(half * 2), 1, 'ink');
  }
  g.stamp(shade(ped, stone, { rim: 0.3, gradient: 0.4, bias: 0.1 }));
  // A sun medallion in the gable.
  g.fillEllipse(50, 14, 12, 10, 'amber').fillEllipse(52, 15, 8, 7, 'gold').set(55, 17, 'cream');
  // Banners on the outer columns.
  for (const [bx, c1, c2] of [
    [11, 'rose', 'wine'],
    [95, 'violet', 'night'],
  ] as Array<[number, ColorName, ColorName]>) {
    g.fillRect(bx, 42, 6, 18, c1).fillRect(bx + 5, 42, 1, 18, c2);
    g.set(bx + 1, 60, c1).set(bx + 3, 61, c1).set(bx + 5, 60, c2);
    g.fillRect(bx + 1, 46, 4, 4, 'gold').set(bx + 2, 47, 'cream');
  }
  return [outline(g, { steps: 2 }), lit];
}

// ---------------------------------------------------------------------------
// Paintings: original little pictures in gold frames, 30x22.

function frame(pic: PixelGrid): PixelGrid {
  const g = new PixelGrid(pic.w + 6, pic.h + 6);
  g.fillRect(0, 0, g.w, g.h, 'amber');
  g.fillRect(0, 0, g.w, 1, 'gold').fillRect(0, 0, 1, g.h, 'gold');
  g.fillRect(0, g.h - 1, g.w, 1, 'clay').fillRect(g.w - 1, 0, 1, g.h, 'clay');
  g.fillRect(2, 2, g.w - 4, g.h - 4, 'clay');
  for (let x = 2; x < g.w - 2; x += 3) g.set(x, 1, 'cream');
  g.stamp(pic, 3, 3);
  return g;
}

function painting(kind: (typeof PAINTINGS)[number]): PixelGrid {
  const W = 24;
  const H = 16;
  const p = new PixelGrid(W, H);
  switch (kind) {
    case 'terraces': {
      // Rice terraces at sunset.
      for (let y = 0; y < H; y++) p.fillRect(0, y, W, 1, y < 3 ? 'coral' : y < 5 ? 'peach' : 'sand');
      p.fillEllipse(15, 2, 5, 5, 'gold');
      for (let i = 0; i < 5; i++) {
        const y = 6 + i * 2;
        for (let x = 0; x < W; x++) {
          const yy = y + Math.round(Math.sin(x * 0.35 + i) * 1);
          p.fillRect(x, yy, 1, H - yy, i % 2 ? 'leaf' : 'grass');
          p.set(x, yy, 'lime');
        }
      }
      break;
    }
    case 'grandma': {
      // Portrait of an old woman in a lilac scarf, smiling.
      p.fillRect(0, 0, W, H, 'pine');
      p.fillRect(0, 0, W, 6, 'moss');
      p.fillEllipse(6, 10, 12, 8, 'violet');
      p.fillEllipse(8, 2, 8, 10, 'lilac');
      p.fillEllipse(9, 4, 6, 7, 'skin');
      p.set(10, 7, 'bark').set(13, 7, 'bark').line(10, 9, 13, 9, 'skinShade').set(11, 10, 'brick').set(12, 10, 'brick');
      p.fillRect(9, 3, 6, 1, 'mist');
      break;
    }
    case 'fruit': {
      // Still life: a bowl of mangosteen, banana and rambutan.
      p.fillRect(0, 0, W, H, 'tan');
      p.fillRect(0, 11, W, 5, 'umber');
      p.fillEllipse(4, 9, 16, 6, 'mist').fillRect(4, 9, 16, 2, 'tan');
      p.fillEllipse(6, 6, 5, 5, 'wine').set(7, 6, 'moss');
      p.fillEllipse(11, 5, 5, 5, 'brick').set(12, 6, 'coral');
      p.line(14, 8, 19, 5, 'gold').line(14, 9, 19, 6, 'amber');
      break;
    }
    case 'circles': {
      // Bright abstract: overlapping circles and lines.
      p.fillRect(0, 0, W, H, 'cream');
      p.fillEllipse(2, 2, 10, 10, 'sky').fillEllipse(10, 5, 9, 9, 'rose').fillEllipse(15, 1, 6, 6, 'gold');
      p.fillEllipse(5, 9, 6, 6, 'violet');
      p.line(0, 14, 23, 3, 'ink').line(3, 0, 20, 15, 'night');
      p.fillRect(18, 10, 4, 4, 'brick');
      break;
    }
    case 'harbour': {
      // Fishing boats at the harbour.
      p.fillRect(0, 0, W, 8, 'foam');
      p.fillRect(0, 8, W, 8, 'sea');
      for (let x = 0; x < W; x += 3) p.set(x, 10 + (x % 2), 'sky');
      p.fillRect(3, 7, 8, 2, 'brick').fillRect(4, 9, 6, 1, 'wine').line(7, 1, 7, 6, 'umber').fillRect(8, 2, 3, 4, 'cream');
      p.fillRect(14, 8, 7, 2, 'gold').line(17, 3, 17, 7, 'umber').fillRect(15, 4, 2, 3, 'coral');
      break;
    }
    case 'night': {
      // A full moon over the valley.
      p.fillRect(0, 0, W, H, 'night');
      p.fillEllipse(16, 2, 5, 5, 'cream');
      for (let i = 0; i < 8; i++) p.set(Math.floor(hash2(i, 1, 9) * W), Math.floor(hash2(i, 2, 9) * 8), 'gold');
      for (let x = 0; x < W; x++) {
        const y = 10 + Math.round(Math.sin(x * 0.3) * 2);
        p.fillRect(x, y, 1, H - y, 'pine');
      }
      p.fillRect(5, 11, 3, 2, 'amber');
      break;
    }
    case 'buffalo': {
      // A water buffalo resting in a paddy.
      p.fillRect(0, 0, W, 6, 'foam');
      p.fillRect(0, 6, W, 10, 'grass');
      p.fillRect(0, 12, W, 4, 'sky');
      p.fillEllipse(6, 7, 12, 6, 'plum').fillEllipse(15, 6, 5, 4, 'mauve');
      p.line(14, 6, 13, 4, 'mist').line(19, 6, 20, 4, 'mist');
      p.set(17, 7, 'ink');
      break;
    }
    case 'lotus': {
      // Lotus flowers on a dark pond.
      p.fillRect(0, 0, W, H, 'deep');
      for (const [x, y] of [
        [4, 10],
        [14, 6],
        [18, 12],
      ]) {
        p.fillEllipse(x - 2, y + 1, 7, 3, 'moss');
        p.fillEllipse(x, y - 2, 3, 4, 'rose').set(x - 1, y, 'rose').set(x + 3, y, 'rose').set(x + 1, y - 1, 'cream');
      }
      break;
    }
  }
  return frame(p);
}

// ---------------------------------------------------------------------------
// Sculptures on plinths, 18x34.

function sculpture(kind: (typeof SCULPTURES)[number]): PixelGrid {
  const W = 18;
  const H = 34;
  const g = new PixelGrid(W, H);
  block(g, 3, 22, 12, 11, RAMPS.plaster, { rim: 0.3, gradient: 0.3, bias: 0.1 });
  g.fillRect(3, 22, 12, 1, 'cream');
  switch (kind) {
    case 'swirl':
      for (let i = 0; i < 40; i++) {
        const t = i / 40;
        const x = Math.round(9 + Math.sin(t * 12) * (5 - t * 3));
        const y = Math.round(21 - t * 18);
        g.set(x, y, 'amber').set(x + 1, y, 'clay');
      }
      break;
    case 'bust':
      oval(g, 4, 14, 10, 8, RAMPS.stone.slice(2));
      oval(g, 5, 4, 8, 10, RAMPS.stone.slice(2));
      g.set(7, 8, 'mauve').set(10, 8, 'mauve').set(9, 10, 'mauve');
      break;
    case 'farmer':
      // A bronze farmer with a caping hat.
      block(g, 7, 9, 4, 13, ['umber', 'clay', 'tan']);
      oval(g, 7, 5, 4, 4, ['umber', 'clay', 'tan']);
      for (let i = 0; i < 4; i++) g.fillRect(9 - i * 2, 3 + i, i * 4 + 1, 1, i === 3 ? 'umber' : 'clay');
      g.line(11, 12, 15, 17, 'umber').line(12, 12, 15, 9, 'clay');
      break;
    case 'egg':
      oval(g, 4, 6, 10, 15, ['sea', 'sky', 'foam', 'cream'], { gradient: 0.8 });
      break;
  }
  return outline(g, { steps: 2 });
}

/** Brass post with a red rope (for keeping visitors back from the art). */
function ropePost(): PixelGrid {
  const g = new PixelGrid(16, 18);
  for (const x of [1, 13]) {
    block(g, x, 6, 2, 10, ['clay', 'amber', 'gold']);
    g.fillEllipse(x - 1, 4, 4, 3, 'gold');
    g.fillRect(x - 1, 15, 4, 2, 'amber');
  }
  for (let x = 3; x < 13; x++) g.set(x, 8 + Math.round(Math.sin(((x - 3) / 10) * Math.PI) * 2), 'brick');
  return outline(g, { steps: 2 });
}

// ---------------------------------------------------------------------------
// Park: the big tiered fountain, clipped hedges, iron lamps.

function bigFountain(): PixelGrid[] {
  const { w: W, h: H, frames } = BIG_FOUNTAIN;
  const base = new PixelGrid(W, H);
  const stone = RAMPS.stone.slice(1);
  // Outer basin: wall, rim and water.
  block(base, 4, 46, W - 8, 22, stone, { dither: 0.5, noise: 0.2, seed: 41 });
  for (let x = 8; x < W - 6; x += 7) base.line(x, 48, x, 67, 'plum');
  oval(base, 1, 34, W - 2, 26, ['mauve', 'haze', 'mist'], { gradient: 0.3 });
  base.fillEllipse(6, 37, W - 12, 20, 'sea');
  base.fillEllipse(10, 39, W - 20, 15, 'sky');
  // Middle tier.
  block(base, 37, 24, 10, 24, stone);
  oval(base, 24, 22, 36, 10, ['mauve', 'haze', 'mist'], { gradient: 0.3 });
  base.fillEllipse(28, 23, 28, 6, 'sky');
  // Top tier and finial.
  block(base, 40, 10, 4, 14, stone);
  oval(base, 32, 8, 20, 6, ['mauve', 'haze', 'mist'], { gradient: 0.3 });
  base.fillEllipse(35, 9, 14, 3, 'sky');
  base.fillEllipse(39, 2, 6, 6, 'gold').set(41, 3, 'cream');
  return Array.from({ length: frames }, (_, f) => {
    const g = base.clone();
    // Spray from the top, water curtains falling from each tier, ripples.
    for (let i = 0; i < 6; i++) g.set(42 + ((i + f) % 3) - 1, 1 - i + 6 - ((i + f) % 2), (i + f) % 3 ? 'foam' : 'cream');
    for (const side of [-1, 1]) {
      for (let i = 0; i < 12; i++) {
        const x = 42 + side * (9 + Math.round(i * 0.5));
        const y = 11 + i;
        if ((i + f) % 4 !== 0) g.set(x, y, i % 2 ? 'foam' : 'sky');
      }
      for (let i = 0; i < 16; i++) {
        const x = 42 + side * (17 + Math.round(i * 0.9));
        const y = 27 + i;
        if ((i + f) % 4 !== 1) g.set(x, y, i % 3 ? 'foam' : 'cream');
      }
    }
    for (let i = 0; i < 8; i++) {
      const x = 12 + ((i * 11 + f * 5) % (W - 26));
      const y = 42 + ((i * 3 + f) % 10);
      g.set(x, y, 'foam').set(x + 1, y, 'cream');
    }
    return outline(g, { steps: 2 });
  });
}

function hedge(): PixelGrid {
  const g = new PixelGrid(16, 18);
  g.stamp(shade(blobMask(16, 18, [[8, 9, 7.5, 6], [4, 11, 4, 5], [12, 11, 4, 5]]).fillRect(1, 9, 14, 7, 'ink'), RAMPS.foliage.slice(0, 4), { rim: 0.3, gradient: 0.6, noise: 0.25, seed: 51 }));
  return outline(g, { color: 'pine' });
}

function parkLamp(): PixelGrid {
  const g = new PixelGrid(12, 34);
  block(g, 5, 10, 2, 22, ['ink', 'night', 'plum']);
  g.fillRect(3, 31, 6, 2, 'night');
  g.fillRect(2, 2, 8, 8, 'night').fillRect(3, 3, 6, 6, 'gold').fillRect(4, 4, 2, 4, 'cream');
  g.fillRect(1, 1, 10, 2, 'ink').set(6, 0, 'ink');
  return outline(g, { steps: 1 });
}

// ---------------------------------------------------------------------------

export function registerExtras(sink: TextureSink): void {
  sink.sheet(EXTRA_TEXTURES.dog, DOG_POSES.map(dogFrame), DOG.w, DOG.h);
  sink.image(EXTRA_TEXTURES.phone, phone());
  const [dh, dhLit] = dogHouse();
  sink.image(EXTRA_TEXTURES.dogHouse, dh);
  sink.image(EXTRA_TEXTURES.dogHouseLit, dhLit);
  sink.image(EXTRA_TEXTURES.warnSign, warnSign());
  const [mu, muLit] = museum();
  sink.image(EXTRA_TEXTURES.museum, mu);
  sink.image(EXTRA_TEXTURES.museumLit, muLit);
  sink.sheet(EXTRA_TEXTURES.painting, PAINTINGS.map(painting), 30, 22);
  sink.sheet(EXTRA_TEXTURES.vanGogh, VAN_GOGH.map(vanGoghPainting), VAN_GOGH_CELL.w, VAN_GOGH_CELL.h);
  sink.image(EXTRA_TEXTURES.vanGoghBanner, vanGoghBanner());
  sink.sheet(EXTRA_TEXTURES.sculpture, SCULPTURES.map(sculpture), 18, 34);
  sink.image(EXTRA_TEXTURES.ropePost, ropePost());
  sink.sheet(EXTRA_TEXTURES.bigFountain, bigFountain(), BIG_FOUNTAIN.w, BIG_FOUNTAIN.h);
  sink.image(EXTRA_TEXTURES.hedge, hedge());
  sink.image(EXTRA_TEXTURES.parkLamp, parkLamp());
}
