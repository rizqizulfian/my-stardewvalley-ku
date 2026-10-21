// Phase 6 art: the picture panels of the opening story (Nek Lastri's porch
// at sunset, the city office at night, her letter, the bus ride through the
// terraces). The arrival on the farm is staged with the game's own sprites.

import { PixelGrid, blobMask, hash2, outline, rampDither, shade, valueNoise, type TextureSink } from './pixel';
import type { ColorName, Ramp } from './palette';
import { textGrid } from './font';

export const INTRO = { w: 320, h: 168 } as const;

export const INTRO_TEXTURES = {
  porch: 'intro-porch',
  cloud: 'intro-cloud',
  bird: 'intro-bird',
  office: 'intro-office',
  rain: 'intro-rain',
  glow: 'intro-glow',
  letter: 'intro-letter',
  lamp: 'intro-lamp',
  sky: 'intro-sky',
  far: 'intro-far',
  mid: 'intro-mid',
  near: 'intro-near',
  bus: 'intro-bus',
} as const;

/** The office window (the rain only falls there) and where the player sits. */
export const OFFICE = { window: { x: 24, y: 12, w: 272, h: 66 }, seat: { x: 188, y: 160 }, monitor: { x: 188, y: 122 } } as const;
export const BUS = { w: 100, h: 52, frames: 2 } as const;
export const BIRD = { w: 7, h: 4, frames: 2 } as const;
export const RAIN_FRAMES = 3;

const W = INTRO.w;
const H = INTRO.h;
const TAU = Math.PI * 2;

/** Vertical gradient through a ramp, ordered-dithered between tones. */
function vgrad(g: PixelGrid, x: number, y: number, w: number, h: number, ramp: Ramp): void {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) g.set(x + i, y + j, rampDither(ramp, j / Math.max(1, h - 1), x + i, y + j));
}

/** Fill everything below a curve. */
function below(g: PixelGrid, top: (x: number) => number, color: (x: number, y: number, top: number) => ColorName | null, bottom = g.h): void {
  for (let x = 0; x < g.w; x++) {
    const t = Math.round(top(x));
    for (let y = Math.max(0, t); y < bottom; y++) {
      const c = color(x, y, t);
      if (c) g.set(x, y, c);
    }
  }
}

function disc(g: PixelGrid, cx: number, cy: number, r: number, c: ColorName): void {
  g.fillEllipse(cx - r, cy - r, r * 2 + 1, r * 2 + 1, c);
}

// ---------------------------------------------------------------------------
// 1. Nek Lastri's porch, twenty years ago

function grandma(): PixelGrid {
  const g = new PixelGrid(30, 50);
  // Batik sarong on the lap and down to the feet.
  g.fillRect(7, 30, 17, 8, 'umber');
  g.fillRect(9, 37, 11, 9, 'umber');
  for (let y = 30; y < 46; y++) for (let x = 7; x < 24; x++) if (g.colorAt(x, y) === 'umber' && (x + y * 2) % 5 === 0) g.set(x, y, 'amber');
  g.fillRect(10, 46, 4, 2, 'bark').fillRect(16, 46, 4, 2, 'bark');
  // Kebaya and the scarf over head and shoulders.
  g.stamp(shade(blobMask(30, 50, [[15, 22, 8, 10]]), ['night', 'violet', 'lilac'], { rim: 0.3 }));
  g.stamp(shade(blobMask(30, 50, [[14, 9, 7, 8], [14, 16, 8, 4]]), ['violet', 'lilac', 'rose'], { rim: 0.3 }));
  // Face, kind eyes, smile, a little grey hair.
  g.fillEllipse(10, 6, 9, 9, 'skin');
  g.fillRect(10, 12, 9, 2, 'skinShade');
  g.fillRect(11, 5, 7, 1, 'mist');
  g.set(12, 9, 'bark').set(16, 9, 'bark');
  g.line(13, 12, 15, 12, 'umber');
  // Arm held out with the letter.
  g.line(20, 25, 26, 25, 'lilac').line(20, 26, 26, 26, 'violet');
  g.fillRect(26, 24, 2, 2, 'skin');
  return outline(g, { color: 'night' });
}

function child(): PixelGrid {
  const g = new PixelGrid(18, 34);
  g.fillRect(6, 24, 2, 7, 'skin').fillRect(10, 24, 2, 7, 'skin');
  g.fillRect(5, 30, 3, 2, 'bark').fillRect(10, 30, 3, 2, 'bark');
  g.fillRect(5, 20, 8, 5, 'sea').fillRect(5, 23, 8, 1, 'deep');
  g.stamp(shade(blobMask(18, 34, [[9, 16, 5, 6]]), ['wine', 'brick', 'coral'], { rim: 0.3 }));
  g.fillEllipse(4, 3, 10, 10, 'skin');
  g.stamp(shade(blobMask(18, 34, [[9, 5, 5.5, 4]]), ['bark', 'umber', 'clay'], { rim: 0.2 }));
  // Turned towards Nek Lastri.
  g.set(6, 8, 'bark');
  g.fillRect(4, 9, 2, 1, 'skinShade');
  // Reaching for the letter.
  g.line(3, 14, 1, 17, 'brick').set(1, 18, 'skin');
  return outline(g, { color: 'night' });
}

function porch(): PixelGrid {
  const g = new PixelGrid(W, H);
  vgrad(g, 0, 0, W, 104, ['violet', 'rose', 'coral', 'peach', 'sand']);
  // Low sun with a soft halo.
  for (let y = 40; y < 104; y++)
    for (let x = 200; x < 276; x++) {
      const d = Math.hypot(x - 238, y - 80);
      if (d < 13) g.set(x, y, 'gold');
      else if (d < 18 && (x + y) % 2 === 0) g.set(x, y, 'sand');
    }
  below(g, (x) => 82 + 7 * Math.sin(x * 0.021 + 1) + 3 * Math.sin(x * 0.07), () => 'mauve');
  below(g, (x) => 94 + 5 * Math.sin(x * 0.033 + 2) + 2 * Math.sin(x * 0.11), () => 'plum');
  // Terraces, flooded ones mirror the sky.
  for (let k = 0; k < 6; k++) {
    const top = (x: number) => 100 + k * 11 + k * k * 0.9 + 3 * Math.sin(x * 0.024 + k * 1.3);
    const flooded = k % 2 === 0;
    below(g, top, (x, y, t) => {
      if (y === t) return 'umber';
      if (y === t + 1) return 'clay';
      if (flooded) {
        if ((x + k * 3) % 6 === 0 && (y - t) % 4 === 3) return 'leaf';
        if (y - t < 3) return 'coral';
        return valueNoise(x / 14, y, 3 + k) > 0.68 ? 'sand' : 'peach';
      }
      const v = valueNoise(x / 6, y / 3, 11);
      return v > 0.72 ? 'lime' : v > 0.4 ? 'grass' : 'leaf';
    });
  }
  // The house: plank wall, lit window, door, roof tiles, posts, deck.
  for (let y = 30; y < 138; y++)
    for (let x = 0; x < 124; x++) {
      const px = x % 7;
      g.set(x, y, px === 0 ? 'umber' : hash2(x >> 3, y >> 2, 7) < 0.15 && px === 3 ? 'tan' : 'clay');
    }
  g.fillRect(14, 54, 34, 38, 'umber');
  vgrad(g, 16, 56, 30, 34, ['gold', 'amber']);
  g.fillRect(30, 56, 2, 34, 'umber').fillRect(16, 72, 30, 2, 'umber');
  g.fillRect(16, 56, 5, 34, 'lilac').fillRect(41, 56, 5, 34, 'lilac');
  g.fillRect(84, 58, 24, 80, 'bark');
  g.fillRect(87, 61, 18, 30, 'umber').fillRect(87, 96, 18, 38, 'umber');
  g.set(102, 100, 'gold');
  for (let y = 12; y < 32; y++)
    for (let x = 0; x < 140; x++) {
      const row = Math.floor((y - 12) / 4);
      const lip = (y - 12) % 4 === 3;
      const seam = (x + row * 4) % 8 === 0;
      g.set(x, y, lip ? 'wine' : seam ? 'wine' : (y - 12) % 4 === 0 ? 'coral' : 'brick');
    }
  g.fillRect(0, 32, 140, 3, 'umber').fillRect(0, 32, 140, 1, 'clay');
  for (const px of [0, 128]) g.fillRect(px, 35, 6, 105, 'umber').fillRect(px + 1, 35, 2, 105, 'clay');
  for (let y = 138; y < 148; y++) for (let x = 0; x < 150; x++) g.set(x, y, (y - 138) % 3 === 0 ? 'clay' : 'tan');
  g.fillRect(0, 148, 150, 3, 'umber');
  g.fillRect(118, 151, 36, 4, 'tan').fillRect(118, 155, 36, 2, 'umber');
  // Lantern by the post.
  g.fillRect(116, 36, 1, 6, 'night').fillRect(113, 42, 7, 9, 'umber').fillRect(114, 43, 5, 7, 'gold');
  // Grass in front of the deck.
  below(g, () => 157, (x, y) => (hash2(x, y, 9) < 0.2 ? 'leaf' : 'moss'));
  for (let x = 0; x < W; x += 3) if (hash2(x, 1, 5) < 0.6) g.line(x, 157, x + 1, 153 - Math.floor(hash2(x, 2, 5) * 4), 'leaf');
  // Bench, Nek Lastri and you.
  g.fillRect(24, 108, 52, 3, 'umber').fillRect(24, 122, 52, 4, 'clay').fillRect(24, 125, 52, 1, 'umber');
  g.fillRect(27, 126, 3, 12, 'umber').fillRect(70, 126, 3, 12, 'umber');
  g.stamp(grandma(), 28, 88);
  // The letter between your hands.
  g.fillRect(55, 109, 9, 6, 'cream').line(55, 109, 59, 112, 'mist').line(63, 109, 59, 112, 'mist');
  g.stamp(child(), 62, 104);
  return g;
}

function cloud(): PixelGrid {
  const m = blobMask(64, 12, [[14, 7, 12, 4], [30, 5, 14, 5], [48, 7, 13, 4]]);
  return shade(m, ['rose', 'peach', 'sand'], { rim: 0.4, gradient: 0.9 });
}

function birdFrames(): PixelGrid[] {
  const up = new PixelGrid(BIRD.w, BIRD.h).line(0, 0, 3, 2, 'night').line(3, 2, 6, 0, 'night');
  const flat = new PixelGrid(BIRD.w, BIRD.h).line(0, 2, 2, 1, 'night').line(2, 1, 4, 1, 'night').line(4, 1, 6, 2, 'night').set(3, 2, 'night');
  return [up, flat];
}

// ---------------------------------------------------------------------------
// 2. The office at night

function desk(g: PixelGrid, x: number, y: number, on: boolean): void {
  // Partition behind, desk top, front panel, monitor facing the room.
  g.fillRect(x - 4, y - 8, 52, 6, 'mauve').fillRect(x - 4, y - 8, 52, 1, 'haze').fillRect(x - 4, y - 3, 52, 1, 'plum');
  g.fillRect(x, y, 44, 9, 'haze').fillRect(x, y, 44, 1, 'mist');
  g.fillRect(x, y + 9, 44, 7, 'mauve').fillRect(x, y + 15, 44, 1, 'plum');
  g.fillRect(x + 2, y + 16, 2, 3, 'plum').fillRect(x + 40, y + 16, 2, 3, 'plum');
  const mx = x + 15;
  g.fillRect(mx, y - 9, 16, 12, 'night');
  if (on) {
    g.fillRect(mx + 1, y - 8, 14, 9, 'foam');
    for (let r = 0; r < 4; r++) g.fillRect(mx + 2, y - 7 + r * 2, r === 0 ? 12 : 4 + ((r * 5) % 8), 1, 'sky');
  } else {
    g.fillRect(mx + 1, y - 8, 14, 9, 'deep');
    g.line(mx + 3, y - 7, mx + 6, y - 4, 'sea');
  }
  g.fillRect(mx + 6, y + 3, 4, 2, 'plum').fillRect(mx + 3, y + 5, 10, 2, 'mist');
}

function office(): PixelGrid {
  const g = new PixelGrid(W, H);
  const win = OFFICE.window;
  // Back wall and ceiling with its tube lights.
  g.fillRect(0, 0, W, 92, 'night');
  g.fillRect(0, 0, W, 8, 'ink');
  for (const lx of [36, 140, 244]) g.fillRect(lx, 3, 40, 3, 'mauve').fillRect(lx + 2, 4, 36, 1, lx === 244 ? 'plum' : 'mist');
  // The city through the window: rain clouds, towers with a few late lights.
  vgrad(g, win.x, win.y, win.w, win.h, ['ink', 'night', 'deep']);
  let bx = win.x;
  let seed = 1;
  while (bx < win.x + win.w) {
    const bw = 12 + Math.floor(hash2(seed, 1, 21) * 20);
    const top = win.y + 14 + Math.floor(hash2(seed, 2, 21) * 34);
    const far = hash2(seed, 3, 21) < 0.5;
    for (let y = top; y < win.y + win.h; y++)
      for (let x = bx; x < Math.min(bx + bw, win.x + win.w); x++) {
        const lit = (x - bx) % 4 === 2 && (y - top) % 5 === 2 && hash2(x, y, seed) < 0.3;
        g.set(x, y, lit ? (hash2(x, y, 5) < 0.7 ? 'gold' : 'foam') : far ? 'plum' : 'ink');
      }
    bx += bw + (far ? 0 : 2);
    seed++;
  }
  for (let x = win.x; x < win.x + win.w; x++) for (let y = win.y; y < win.y + win.h; y++) if ((x - y * 2) % 41 === 0 && hash2(x, y, 2) < 0.6) g.set(x, y, 'sea');
  g.fillRect(win.x - 3, win.y - 3, win.w + 6, 3, 'mauve').fillRect(win.x - 3, win.y + win.h, win.w + 6, 4, 'mauve').fillRect(win.x - 3, win.y + win.h, win.w + 6, 1, 'haze');
  for (let k = 0; k <= 4; k++) g.fillRect(win.x - 3 + Math.round((k * (win.w + 3)) / 4), win.y, 3, win.h, 'mauve');
  // Wall clock: ten to midnight.
  disc(g, 11, 40, 7, 'mauve');
  disc(g, 11, 40, 6, 'mist');
  g.line(11, 40, 11, 35, 'night').line(11, 40, 8, 37, 'night').set(11, 40, 'brick');
  // Carpet.
  for (let y = 92; y < H; y++) for (let x = 0; x < W; x++) g.set(x, y, x % 4 === (y >> 2) % 4 && y % 4 === 0 ? 'plum' : 'night');
  g.fillRect(0, 92, W, 2, 'ink');
  // Rows of desks; only yours is still on.
  for (const x of [20, 96, 172, 248]) desk(g, x, 106, false);
  for (const x of [20, 96, 248]) desk(g, x, 136, false);
  desk(g, OFFICE.monitor.x - 23, 136, true);
  // Paper stacks and a cold coffee on your desk.
  const dx = OFFICE.monitor.x - 23;
  for (let i = 0; i < 4; i++) g.fillRect(dx + 2, 132 - i * 3, 10, 3, i % 2 ? 'mist' : 'cream');
  for (let i = 0; i < 3; i++) g.fillRect(dx + 33, 134 - i * 3, 9, 3, i % 2 ? 'cream' : 'mist');
  g.fillRect(dx + 34, 138, 4, 4, 'mist').fillRect(dx + 35, 138, 2, 1, 'umber');
  g.fillRect(dx + 13, 139, 3, 3, 'gold').fillRect(dx + 30, 140, 3, 3, 'rose');
  // Empty chairs at the other desks.
  for (const [x, y] of [[40, 128], [116, 128], [192, 128], [268, 128], [40, 158], [116, 158], [268, 158]]) {
    g.fillEllipse(x - 5, y, 11, 6, 'plum');
    g.fillRect(x - 4, y - 5, 9, 5, 'ink');
  }
  // Your chair, under you.
  g.fillEllipse(OFFICE.seat.x - 6, OFFICE.seat.y - 3, 13, 6, 'plum');
  return g;
}

function rainFrames(): PixelGrid[] {
  const { w, h } = OFFICE.window;
  return Array.from({ length: RAIN_FRAMES }, (_, f) => {
    const g = new PixelGrid(w, h);
    for (let i = 0; i < 70; i++) {
      const x = Math.floor(hash2(i, 1, 31) * w);
      const y0 = Math.floor(hash2(i, 2, 31) * h + (f * h) / RAIN_FRAMES) % h;
      const len = 3 + Math.floor(hash2(i, 3, 31) * 3);
      for (let k = 0; k < len; k++) {
        const y = (y0 + k) % h;
        g.set(x - Math.floor(k / 3), y, k === len - 1 ? 'foam' : 'sky');
      }
    }
    // Drops sliding down the glass.
    for (let i = 0; i < 14; i++) {
      const x = Math.floor(hash2(i, 4, 32) * w);
      const y = Math.floor(hash2(i, 5, 32) * h + f * 2) % h;
      g.set(x, y, 'foam').set(x, y - 1, 'sky');
    }
    return g;
  });
}

/** Soft cold light of the monitor (drawn additively). */
function glow(): PixelGrid {
  const g = new PixelGrid(80, 48);
  for (let y = 0; y < g.h; y++)
    for (let x = 0; x < g.w; x++) {
      const d = Math.hypot((x - 40) / 40, (y - 24) / 24);
      if (d < 1 && 1 - d > 0.15 + 0.85 * ((((x & 3) * 4 + (y & 3)) % 16) / 16)) g.set(x, y, d < 0.45 ? 'sky' : 'sea');
    }
  return g;
}

// ---------------------------------------------------------------------------
// 3. The letter

function letter(): PixelGrid {
  const g = new PixelGrid(W, H);
  // Old desk under a warm lamp (top right).
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const light = 1 - Math.min(1, Math.hypot(x - 250, y - 10) / 300);
      const grain = valueNoise(x / 40, y / 2.2, 17) * 0.35;
      const seam = y % 30 === 0;
      g.set(x, y, seam ? 'bark' : rampDither(['bark', 'umber', 'clay', 'tan'], light * 0.8 + grain - 0.1, x, y));
    }
  // A cup of tea.
  disc(g, 44, 46, 16, 'mist');
  disc(g, 44, 46, 15, 'cream');
  disc(g, 44, 44, 10, 'mist');
  disc(g, 44, 44, 8, 'clay');
  g.fillEllipse(39, 39, 5, 3, 'tan');
  g.fillRect(57, 42, 6, 4, 'mist');
  // The envelope peeking out from under the letter, with its stamp.
  g.fillRect(40, 100, 80, 54, 'bark');
  g.fillRect(36, 96, 80, 54, 'sand');
  g.line(36, 96, 76, 124, 'tan').line(115, 96, 76, 124, 'tan');
  g.fillRect(44, 104, 14, 16, 'cream').fillRect(46, 106, 10, 12, 'brick').fillRect(48, 109, 6, 6, 'leaf');
  disc(g, 64, 112, 6, 'tan');
  g.stamp(textGrid('Lembah Padi', 'umber'), 44, 136);
  // The letter: shadow, paper, folds.
  g.fillRect(93, 17, 148, 146, 'bark');
  g.fillRect(90, 13, 148, 146, 'cream');
  g.fillRect(90, 13, 148, 1, 'mist').fillRect(90, 13, 1, 146, 'mist');
  g.fillRect(90, 61, 148, 1, 'mist').fillRect(90, 109, 148, 1, 'mist');
  // Handwriting in faded ink.
  for (let line = 0; line < 13; line++) {
    const y = 26 + line * 9 + (line > 4 ? 2 : 0) + (line > 9 ? 2 : 0);
    let x = line === 0 ? 102 : 106;
    const end = line === 0 ? 150 : line === 12 ? 160 : 224 - Math.floor(hash2(line, 1, 41) * 14);
    let wi = 0;
    while (x < end) {
      const wl = 6 + Math.floor(hash2(line, wi, 42) * 18);
      for (let i = 0; i < wl && x + i < end; i++) {
        const yy = y + Math.round(Math.sin((x + i) * 1.4 + wi) * 1.1);
        g.set(x + i, yy, 'plum');
        if (hash2(x + i, line, 43) < 0.12) g.set(x + i, yy - 2, 'plum').set(x + i, yy - 1, 'plum');
      }
      x += wl + 4;
      wi++;
    }
  }
  // Signature and a pressed jasmine flower.
  for (let i = 0; i < 36; i++) g.set(186 + i, 146 + Math.round(Math.sin(i * 0.6) * 2.2), 'violet');
  g.line(170, 150, 186, 154, 'moss').line(178, 152, 182, 148, 'leaf');
  for (const [px, py] of [[0, -3], [3, -1], [2, 3], [-2, 3], [-3, -1]]) disc(g, 168 + px, 148 + py, 2, 'mist');
  for (const [px, py] of [[0, -3], [3, -1], [2, 3], [-2, 3], [-3, -1]]) g.set(168 + px, 148 + py, 'cream');
  g.set(168, 148, 'gold').set(169, 148, 'amber');
  // Fountain pen.
  g.line(252, 118, 300, 146, 'night').line(252, 119, 300, 147, 'night').line(253, 117, 300, 145, 'plum');
  g.line(276, 131, 284, 136, 'gold');
  g.line(248, 116, 252, 118, 'haze');
  return g;
}

/** Warm pool of lamplight (drawn additively, gently pulsing). */
function lamp(): PixelGrid {
  const g = new PixelGrid(220, 160);
  for (let y = 0; y < g.h; y++)
    for (let x = 0; x < g.w; x++) {
      const d = Math.hypot((x - 170) / 170, (y - 10) / 150);
      if (d < 1 && 1 - d > 0.35 + 0.65 * ((((x & 3) * 4 + (y & 3)) % 16) / 16)) g.set(x, y, 'amber');
    }
  return g;
}

// ---------------------------------------------------------------------------
// 4. The bus through the terraces (layers tile across 320 px)

function sky(): PixelGrid {
  const g = new PixelGrid(W, H);
  vgrad(g, 0, 0, W, 100, ['sky', 'foam', 'mist']);
  g.fillRect(0, 100, W, H - 100, 'mist');
  for (let y = 10; y < 50; y++)
    for (let x = 30; x < 90; x++) {
      const d = Math.hypot(x - 60, y - 30);
      if (d < 9) g.set(x, y, 'gold');
      else if (d < 13 && (x + y) % 2 === 0) g.set(x, y, 'cream');
    }
  for (const [cx, cy, s] of [[150, 26, 1], [250, 16, 0.8], [300, 40, 0.6]] as const) {
    const m = blobMask(W, H, [[cx, cy, 16 * s, 5 * s], [cx + 14 * s, cy - 3 * s, 12 * s, 5 * s], [cx - 14 * s, cy + 1, 10 * s, 4 * s]]);
    m.forEachFilled((x, y) => g.set(x, y, y > cy + 2 * s ? 'mist' : 'cream'));
  }
  return g;
}

function far(): PixelGrid {
  const g = new PixelGrid(W, H);
  const hills = (x: number) => 74 + 6 * Math.sin((TAU * x * 2) / W) + 3 * Math.sin((TAU * x * 5) / W + 1);
  // A volcano in the haze, smoking a little.
  const cone = (x: number) => {
    const d = Math.abs(x - 210);
    return d < 5 ? 36 : 36 + (d - 5) * 0.48 + Math.max(0, d - 40) * 0.12;
  };
  // Lit from the left: the right flank of the cone sits in shade.
  below(g, (x) => Math.min(hills(x), cone(x)), (x, y) => (y < hills(x) && x > 210 + (y - 36) * 0.35 + ((x + y) % 2) ? 'mauve' : 'haze'));
  const smoke = blobMask(W, H, [[214, 28, 6, 4], [222, 22, 7, 4], [232, 18, 6, 3]]);
  smoke.forEachFilled((x, y) => g.set(x, y, 'mist'));
  // Morning fog at the foot.
  for (let y = 84; y < 96; y++) for (let x = 0; x < W; x++) if ((y - 84) / 12 > ((x * 7 + y * 3) % 16) / 16) g.set(x, y, 'mist');
  return g;
}

function palm(g: PixelGrid, x: number, base: number, height: number, size = 1, trunk = 3): void {
  for (let i = 0; i < height; i++) {
    const px = x + Math.round(Math.sin(i / height) * 4 * size);
    g.fillRect(px, base - i, trunk, 1, i % 4 === 0 ? 'bark' : 'umber');
  }
  const tx = x + Math.round(Math.sin(1) * 4 * size) + 1;
  const ty = base - height;
  // Fronds droop: each is a short arc.
  for (const [dx, dy] of [[-14, 6], [14, 6], [-10, -4], [10, -4], [-16, 1], [16, 1], [0, -7]]) {
    const n = Math.ceil(Math.hypot(dx, dy) * size);
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      const fx = Math.round(tx + dx * size * k);
      const fy = Math.round(ty + dy * size * k + Math.sin(k * Math.PI) * -2 * size + k * k * 4 * size);
      g.set(fx, fy, 'moss').set(fx, fy - 1, 'leaf');
      if (size > 1 && i % 2 === 0) g.set(fx, fy + 1, 'moss').set(fx + (dx > 0 ? -1 : 1), fy + 2, 'pine');
    }
  }
  g.fillRect(tx - 1, ty, trunk, 2, 'umber');
}

function mid(): PixelGrid {
  const g = new PixelGrid(W, H);
  for (let k = 0; k < 6; k++) {
    const top = (x: number) => 90 + k * 8 + k * k * 0.5 + 2 * Math.sin((TAU * x * (k + 1)) / W + k);
    const flooded = k % 2 === 1;
    below(g, top, (x, y, t) => {
      if (y === t) return 'clay';
      if (flooded) return (x + y * 5) % 9 === 0 && (y - t) % 3 === 1 ? 'leaf' : y - t < 2 ? 'foam' : 'sky';
      const v = valueNoise(x / 8, y / 2, 23 + k, W / 8);
      return v > 0.8 ? 'lime' : v > 0.45 ? 'grass' : 'leaf';
    });
  }
  // A little bamboo hut in the fields.
  g.fillRect(62, 98, 14, 8, 'tan').fillRect(64, 100, 4, 6, 'umber');
  for (let i = 0; i < 6; i++) g.fillRect(60 + i, 92 + (5 - i), 18 - i * 2 + i * 2, 1, 'clay');
  g.fillRect(59, 97, 20, 1, 'umber');
  palm(g, 150, 100, 26);
  palm(g, 268, 98, 20);
  return g;
}

function near(): PixelGrid {
  const g = new PixelGrid(W, H);
  // Verge, road and the dashed line (period 32 px).
  for (let y = 128; y < 140; y++) for (let x = 0; x < W; x++) g.set(x, y, hash2(x % W, y, 51) < 0.25 ? 'grass' : 'leaf');
  for (let x = 0; x < W; x += 2) g.line(x, 128, x + (x % 4 === 0 ? 1 : -1), 124 - Math.floor(hash2(x, 3, 52) * 4), 'leaf');
  g.fillRect(0, 140, W, 2, 'haze');
  for (let y = 142; y < H; y++) for (let x = 0; x < W; x++) g.set(x, y, hash2(x, y, 53) < 0.15 ? 'plum' : 'night');
  for (let x = 0; x < W; x += 32) g.fillRect(x, 155, 16, 2, 'mist');
  // A power pole and its sagging wire to the next one.
  g.fillRect(120, 46, 3, 82, 'umber').fillRect(113, 50, 17, 2, 'umber');
  for (let x = 0; x < W; x++) {
    const t = (((x - 121) % W) + W) % W;
    g.set(x, Math.round(52 + 12 * Math.sin((Math.PI * t) / W)), 'night');
  }
  // A tall coconut palm by the road.
  palm(g, 250, 130, 84, 2, 4);
  return g;
}

function busFrame(f: number): PixelGrid {
  const g = new PixelGrid(BUS.w, BUS.h);
  // Body: cream upper half, sea-blue lower with a gold stripe.
  g.fillRect(3, 12, 92, 30, 'sea').fillRect(5, 10, 88, 2, 'sea');
  g.fillRect(3, 12, 92, 14, 'cream').fillRect(3, 30, 92, 2, 'gold');
  g.fillRect(3, 40, 92, 2, 'deep');
  g.fillRect(94, 18, 3, 22, 'sea').fillRect(95, 32, 3, 3, 'gold');
  // Roof and rack with luggage.
  g.fillRect(5, 9, 88, 2, 'mist');
  g.fillRect(14, 4, 60, 1, 'mauve').fillRect(14, 4, 1, 5, 'mauve').fillRect(73, 4, 1, 5, 'mauve');
  g.fillRect(18, 1, 12, 8, 'tan').fillRect(18, 1, 12, 1, 'sand').fillRect(23, 1, 2, 8, 'clay');
  g.fillRect(34, 3, 10, 6, 'brick').fillRect(34, 3, 10, 1, 'coral');
  g.fillEllipse(48, 2, 14, 7, 'leaf');
  // Windows with passengers; you sit up front in your caping hat.
  for (let i = 0; i < 6; i++) {
    const x = 8 + i * 12;
    g.fillRect(x, 14, 10, 10, 'deep').line(x + 1, 22, x + 7, 15, 'sea').set(x + 8, 15, 'foam');
    if (i === 1 || i === 3) g.fillEllipse(x + 3, 18, 5, 6, 'night');
  }
  g.fillEllipse(70, 18, 6, 6, 'skin');
  g.fillRect(68, 16, 10, 2, 'amber').fillRect(70, 15, 6, 1, 'gold').set(73, 14, 'gold');
  g.fillRect(70, 22, 6, 2, 'brick');
  // Door and windshield.
  g.fillRect(82, 14, 10, 26, 'deep').fillRect(86, 14, 1, 26, 'sea').set(90, 16, 'foam');
  g.fillRect(93, 14, 3, 12, 'deep');
  g.fillRect(96, 30, 2, 3, 'gold');
  g.stamp(textGrid('LEMBAH PADI', 'cream'), 10, 32);
  // Wheels with turning hubs.
  for (const wx of [22, 76]) {
    disc(g, wx, 42, 7, 'night');
    disc(g, wx, 42, 3, 'haze');
    if (f === 0) g.line(wx - 2, 42, wx + 2, 42, 'mauve').line(wx, 40, wx, 44, 'mauve');
    else g.line(wx - 2, 40, wx + 2, 44, 'mauve').line(wx - 2, 44, wx + 2, 40, 'mauve');
  }
  return outline(g, { color: 'ink' });
}

export function registerIntroArt(sink: TextureSink): void {
  sink.image(INTRO_TEXTURES.porch, porch());
  sink.image(INTRO_TEXTURES.cloud, cloud());
  sink.sheet(INTRO_TEXTURES.bird, birdFrames(), BIRD.w, BIRD.h);
  sink.image(INTRO_TEXTURES.office, office());
  sink.sheet(INTRO_TEXTURES.rain, rainFrames(), OFFICE.window.w, OFFICE.window.h);
  sink.image(INTRO_TEXTURES.glow, glow());
  sink.image(INTRO_TEXTURES.letter, letter());
  sink.image(INTRO_TEXTURES.lamp, lamp());
  sink.image(INTRO_TEXTURES.sky, sky());
  sink.image(INTRO_TEXTURES.far, far());
  sink.image(INTRO_TEXTURES.mid, mid());
  sink.image(INTRO_TEXTURES.near, near());
  sink.sheet(INTRO_TEXTURES.bus, [busFrame(0), busFrame(1)], BUS.w, BUS.h);
}
