// The museum's Van Gogh room: little pixel copies of six of his paintings
// (all public domain), drawn with short swirling "brush strokes", plus the
// name banner above them. Landscapes are 40x28 inside the frame, portraits
// 24x28; every frame sits bottom-centred in a 46x34 sheet cell.

import { PixelGrid, hash2 } from './pixel';
import type { ColorName } from './palette';
import { textGrid } from './font';

export const VAN_GOGH = ['selfportrait', 'starrynight', 'sunflowers', 'bedroom', 'cafe', 'wheatfield'] as const;
export const VAN_GOGH_CELL = { w: 46, h: 34 } as const;

/**
 * Paint a region stroke by stroke: `flow` gives each pixel a phase, and the
 * phase picks a colour from the cycle. Bands of equal phase read as strokes.
 */
function strokes(
  p: PixelGrid,
  colors: readonly ColorName[],
  flow: (x: number, y: number) => number,
  inside: (x: number, y: number) => boolean = () => true,
  seed = 1,
): void {
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      if (!inside(x, y)) continue;
      const v = flow(x, y) + hash2(x, y, seed) * 0.7;
      p.set(x, y, colors[((Math.floor(v) % colors.length) + colors.length) % colors.length]);
    }
}

/** A flame-shaped cypress, `w` wide at the foot, `top` to `foot`. */
function cypress(p: PixelGrid, cx: number, top: number, foot: number, w: number, seed: number): void {
  for (let y = top; y <= foot; y++) {
    const t = (y - top) / (foot - top);
    const half = Math.max(0.6, Math.sqrt(t) * w * 0.5 + Math.sin(y * 0.9 + seed) * 0.8);
    const sx = Math.sin(y * 0.35 + seed) * 1.2;
    for (let x = Math.round(cx + sx - half); x <= Math.round(cx + sx + half); x++) {
      const v = (x - cx) * 0.6 + y * 0.5 + hash2(x, y, seed) * 0.8;
      p.set(x, y, (['pine', 'moss', 'pine', 'ink'] as const)[Math.floor(v) & 3]);
    }
  }
}

/** A swirl: rings that wind around a centre. */
function swirl(cx: number, cy: number, tight = 1.4) {
  return (x: number, y: number): number => {
    const dx = x - cx;
    const dy = (y - cy) * 1.4;
    return Math.hypot(dx, dy) * 0.7 - (Math.atan2(dy, dx) / Math.PI) * tight;
  };
}

function star(p: PixelGrid, x: number, y: number, big = false): void {
  if (big) p.fillEllipse(x - 2, y - 2, 5, 5, 'amber').fillEllipse(x - 1, y - 1, 3, 3, 'gold');
  else p.set(x - 1, y, 'gold').set(x + 1, y, 'gold').set(x, y - 1, 'gold').set(x, y + 1, 'gold');
  p.set(x, y, 'cream');
}

function starryNight(): PixelGrid {
  const W = 40;
  const H = 28;
  const p = new PixelGrid(W, H);
  // Rolling sky, then the great double swirl across the middle.
  strokes(p, ['deep', 'sea', 'deep', 'sea', 'sky'], (x, y) => y * 0.35 + Math.sin(x * 0.3 + y * 0.45) * 1.3, (_x, y) => y < 22, 2);
  const a = swirl(17, 9);
  const b = swirl(25, 7, -1.4);
  strokes(p, ['sky', 'foam', 'sea', 'foam', 'sky', 'deep'], (x, y) => (x < 21 ? a(x, y) : b(x, y)), (x, y) => Math.hypot((x - 21) / 9, (y - 8) / 3.4) < 1, 3);
  for (const [x, y] of [
    [8, 4],
    [13, 15],
    [29, 13],
    [33, 9],
    [20, 2],
  ])
    star(p, x, y, true);
  star(p, 4, 12);
  star(p, 37, 15);
  star(p, 27, 2);
  // The crescent moon in its halo.
  p.fillEllipse(32, 0, 8, 7, 'amber').fillEllipse(33, 1, 6, 5, 'gold').fillEllipse(35, 1, 4, 4, 'amber').set(34, 3, 'cream');
  // Blue hills, then the sleeping village with its lit windows and spire.
  for (let x = 0; x < W; x++) {
    const hy = 18 + Math.round(Math.sin(x * 0.18 + 1) * 2 + (x > 26 ? (x - 26) * 0.15 : 0));
    for (let y = hy; y < H; y++) p.set(x, y, (x + y * 2) % 7 === 0 ? 'violet' : y < hy + 2 ? 'plum' : 'deep');
  }
  for (const [x, y, w] of [
    [12, 23, 3],
    [16, 22, 4],
    [24, 23, 3],
    [28, 22, 4],
    [33, 23, 3],
    [14, 25, 4],
    [21, 25, 3],
    [27, 25, 4],
  ]) {
    p.fillRect(x, y, w, 2, 'night').fillRect(x, y - 1, w, 1, 'plum');
    p.set(x + 1, y + 1, 'gold');
  }
  p.line(21, 14, 21, 23, 'night').fillRect(20, 20, 3, 4, 'night').set(21, 21, 'amber');
  cypress(p, 6, 1, H - 1, 9, 2);
  return p;
}

function sunflowers(): PixelGrid {
  const W = 24;
  const H = 28;
  const p = new PixelGrid(W, H);
  strokes(p, ['sand', 'gold', 'sand', 'lime'], (x, y) => x * 0.4 + y * 0.25 + Math.sin(y * 0.6) * 0.8, (_x, y) => y < 21, 4);
  strokes(p, ['amber', 'tan', 'amber', 'gold'], (x, y) => x * 0.6 + Math.sin(y + x * 0.3), (_x, y) => y >= 21, 5);
  p.fillRect(0, 21, W, 1, 'clay');
  // Stems, then the heads: full ones with brown seed hearts, two drooping
  // and two gone to seed (green hearts, petals falling).
  for (const [x, y] of [
    [6, 6],
    [14, 3],
    [19, 9],
    [10, 10],
    [4, 14],
    [17, 15],
    [13, 7],
  ])
    p.line(x, y, 12, 17, 'moss');
  const heads: Array<[number, number, number, boolean]> = [
    [6, 6, 3, false],
    [14, 3, 3, false],
    [19, 9, 2, true],
    [10, 10, 3, false],
    [4, 14, 2, true],
    [17, 15, 3, false],
    [13, 7, 2, false],
  ];
  for (const [x, y, r, seedy] of heads) {
    for (let i = 0; i < 12; i++) {
      const t = (i / 12) * Math.PI * 2;
      p.line(x, y, Math.round(x + Math.cos(t) * (r + 1)), Math.round(y + Math.sin(t) * (r + 1)), i % 3 ? 'amber' : 'coral');
    }
    p.fillEllipse(x - r + 1, y - r + 1, r * 2 - 1, r * 2 - 1, seedy ? 'moss' : 'umber');
    p.set(x, y, seedy ? 'leaf' : 'clay').set(x - 1, y - 1, seedy ? 'lime' : 'tan');
  }
  // The vase: pale above, ochre below, with the blue line and his name.
  p.fillEllipse(8, 16, 9, 11, 'sand').fillRect(8, 21, 9, 5, 'amber').fillEllipse(8, 23, 9, 4, 'amber');
  p.fillRect(8, 21, 9, 1, 'sky');
  p.line(10, 23, 14, 23, 'deep');
  p.fillRect(10, 16, 5, 1, 'gold');
  return p;
}

function cafe(): PixelGrid {
  const W = 24;
  const H = 28;
  const p = new PixelGrid(W, H);
  // Starry sky down the street.
  strokes(p, ['deep', 'sea', 'deep', 'night'], (x, y) => y * 0.4 + Math.sin(x * 0.5) * 0.8, () => true, 6);
  for (const [x, y] of [
    [13, 2],
    [17, 5],
    [21, 2],
    [15, 8],
    [20, 9],
    [11, 5],
  ])
    star(p, x, y);
  // Dark houses on the right with a few lit windows, far houses down the street.
  strokes(p, ['night', 'deep', 'night', 'plum'], (x, y) => x * 0.3 + y * 0.6, (x, y) => x >= 17 && y >= 11 - Math.floor((x - 17) * 0.8) && y < 21, 7);
  for (const [x, y] of [
    [18, 13],
    [21, 12],
    [19, 17],
    [22, 16],
  ])
    p.fillRect(x, y, 2, 2, 'amber');
  p.fillRect(12, 14, 5, 7, 'plum').fillRect(13, 16, 1, 1, 'gold').fillRect(15, 15, 1, 1, 'gold');
  // The café: a glowing yellow wall and awning on the left, lamp-lit.
  strokes(p, ['gold', 'amber', 'gold', 'sand'], (x, y) => x * 0.5 + y * 0.3, (x, y) => x < 12 && y < 21, 8);
  for (let x = 0; x < 13; x++) {
    const y0 = 4 + Math.floor(x * 0.35);
    p.fillRect(x, y0, 1, 4, 'gold').set(x, y0 + 4, 'amber').set(x, y0, 'cream');
  }
  p.fillRect(0, 0, 12, 4, 'clay').fillRect(0, 3, 12, 1, 'umber');
  p.fillEllipse(8, 9, 3, 3, 'cream').set(9, 10, 'gold');
  p.fillRect(0, 10, 2, 11, 'amber');
  // Cobbled street: warm near the café, blue further out.
  for (let y = 21; y < H; y++)
    for (let x = 0; x < W; x++) {
      const warm = x < 12 - (y - 21);
      const c: ColorName[] = warm ? ['sand', 'amber', 'gold', 'tan'] : ['mauve', 'sky', 'haze', 'sand'];
      p.set(x, y, c[Math.floor(hash2(x >> 1, y, 9) * 4)]);
    }
  // Terrace tables and a few guests.
  for (const [x, y] of [
    [3, 17],
    [7, 19],
    [2, 22],
    [8, 24],
  ]) {
    p.fillRect(x, y, 3, 1, 'cream').set(x + 1, y + 1, 'umber').set(x + 1, y + 2, 'umber');
  }
  p.fillRect(5, 15, 1, 3, 'night').set(5, 14, 'skinShade');
  p.fillRect(15, 19, 1, 3, 'ink').set(15, 18, 'skinShade');
  p.fillRect(19, 22, 1, 3, 'night').set(19, 21, 'skinShade');
  return p;
}

function bedroom(): PixelGrid {
  const W = 40;
  const H = 28;
  const p = new PixelGrid(W, H);
  // Pale blue walls: the back wall and the two side walls leaning in.
  strokes(p, ['foam', 'sky', 'foam', 'mist'], (x, y) => x * 0.5 + Math.sin(y * 0.7) * 0.5, () => true, 10);
  for (let y = 0; y < 18; y++) {
    const lx = Math.max(0, 6 - Math.floor(y / 3));
    for (let x = 0; x < lx; x++) p.set(x, y, (x + y) % 3 ? 'sky' : 'foam');
  }
  p.fillRect(36, 0, 4, 22, 'sky').fillRect(37, 4, 3, 15, 'sea').fillRect(37, 4, 3, 1, 'deep');
  // Floor boards in green-ochre, running towards the back.
  for (let y = 16; y < H; y++)
    for (let x = 0; x < W; x++) {
      const board = Math.floor((x - 20) / (1.5 + (y - 16) * 0.5));
      p.set(x, y, board % 2 ? 'tan' : hash2(x, y, 11) < 0.3 ? 'lime' : 'sand');
    }
  p.fillRect(0, 16, W, 1, 'clay');
  // The window, half open.
  p.fillRect(15, 2, 7, 9, 'clay').fillRect(16, 3, 2, 3, 'leaf').fillRect(19, 3, 2, 3, 'leaf').fillRect(16, 7, 2, 3, 'moss').fillRect(19, 7, 2, 3, 'moss');
  // Pictures above the bed and a mirror by the window.
  p.fillRect(26, 3, 4, 5, 'umber').fillRect(27, 4, 2, 3, 'peach');
  p.fillRect(31, 3, 4, 5, 'umber').fillRect(32, 4, 2, 3, 'lime');
  p.fillRect(9, 4, 3, 4, 'umber').fillRect(10, 5, 1, 2, 'mist');
  // The big wooden bed with the red blanket and green-white pillows.
  p.fillRect(26, 9, 9, 7, 'amber').fillRect(26, 9, 9, 1, 'gold');
  p.fillRect(23, 15, 14, 9, 'brick').fillRect(23, 15, 14, 1, 'coral');
  for (let x = 24; x < 37; x += 3) p.set(x, 18 + (x % 2), 'wine');
  p.fillRect(27, 12, 3, 3, 'lime').fillRect(31, 12, 3, 3, 'cream');
  p.fillRect(23, 15, 1, 12, 'amber').fillRect(36, 13, 1, 13, 'amber').fillRect(23, 24, 14, 2, 'gold');
  // The little table with jug and basin, and the two rush chairs.
  p.fillRect(9, 13, 6, 2, 'amber').line(10, 15, 10, 19, 'clay').line(14, 15, 14, 19, 'clay');
  p.fillRect(10, 11, 2, 2, 'sea').fillRect(12, 12, 2, 1, 'sky');
  for (const [x, y, s] of [
    [3, 18, 1],
    [19, 14, 0],
  ]) {
    p.fillRect(x, y - 3 - s * 2, 1, 6 + s * 3, 'amber').fillRect(x + 3 + s, y - 3 - s * 2, 1, 6 + s * 3, 'amber');
    p.fillRect(x, y, 4 + s, 2, 'gold').fillRect(x, y + 1, 4 + s, 1, 'amber');
    p.line(x, y + 2, x, y + 4 + s, 'clay').line(x + 3 + s, y + 2, x + 3 + s, y + 4 + s, 'clay');
  }
  return p;
}

function wheatfield(): PixelGrid {
  const W = 40;
  const H = 28;
  const p = new PixelGrid(W, H);
  // Swirling sky and rolling white clouds.
  strokes(p, ['sky', 'foam', 'sky', 'sea'], (x, y) => y * 0.4 + Math.sin(x * 0.25 + y * 0.6) * 1.4, (_x, y) => y < 14, 12);
  for (const [cx, cy, w] of [
    [8, 4, 9],
    [22, 7, 11],
    [32, 3, 7],
  ]) {
    const s = swirl(cx, cy, 2);
    strokes(p, ['cream', 'mist', 'foam', 'cream'], s, (x, y) => Math.hypot((x - cx) / (w / 2), (y - cy) / 2.6) < 1, 13);
  }
  // Violet mountains and dark olive bushes.
  for (let x = 0; x < W; x++) {
    const hy = 12 + Math.round(Math.sin(x * 0.2) * 1.5);
    for (let y = hy; y < 16; y++) p.set(x, y, (x + y) % 4 ? 'lilac' : 'violet');
    const by = 15 + Math.round(Math.sin(x * 0.5 + 2) * 1);
    for (let y = by; y < 18; y++) p.set(x, y, hash2(x, y, 14) < 0.5 ? 'leaf' : 'moss');
  }
  // The wheat in waves, a few red poppies.
  strokes(p, ['gold', 'amber', 'sand', 'gold', 'tan'], (x, y) => x * 0.35 + Math.sin(x * 0.4 - y * 0.8) * 1.5 + y * 0.2, (_x, y) => y >= 18, 15);
  for (const [x, y] of [
    [5, 24],
    [11, 26],
    [17, 22],
    [26, 25],
    [3, 20],
  ])
    p.set(x, y, 'brick');
  // The great cypress on the right with a smaller one beside it.
  cypress(p, 30, 1, 19, 8, 5);
  cypress(p, 35, 9, 18, 4, 9);
  return p;
}

function selfPortrait(): PixelGrid {
  const W = 24;
  const H = 28;
  const p = new PixelGrid(W, H);
  // The famous swirling pale-blue background.
  const a = swirl(4, 6, 2);
  const b = swirl(20, 18, -2);
  strokes(p, ['foam', 'sky', 'foam', 'mist', 'sky'], (x, y) => (x + y < 22 ? a(x, y) : b(x, y)), () => true, 16);
  // Blue jacket on the shoulders.
  for (let y = 19; y < H; y++) {
    const half = 7 + (y - 19);
    strokes(p, ['sea', 'deep', 'sea', 'sky'], (x, yy) => x * 0.5 + yy * 0.7, (x, yy) => yy === y && Math.abs(x - 11) <= half, 17);
  }
  p.line(10, 20, 8, 27, 'deep').line(12, 20, 14, 27, 'deep').fillRect(10, 20, 3, 2, 'mist');
  // Neck, face turned slightly left, ear on the right.
  p.fillRect(9, 16, 5, 4, 'skinShade');
  strokes(p, ['skin', 'peach', 'skin', 'skinShade'], (x, y) => x * 0.6 + y * 0.4, (x, y) => Math.hypot((x - 11) / 4.2, (y - 11) / 6) < 1, 18);
  p.set(16, 10, 'skinShade').set(16, 11, 'skin').set(16, 12, 'skinShade');
  // Red-orange hair and beard.
  strokes(p, ['coral', 'tan', 'clay', 'coral'], (x, y) => x * 0.8 + y * 0.3, (x, y) => Math.hypot((x - 11.5) / 5, (y - 6) / 2.6) < 1 && y < 7, 19);
  strokes(p, ['coral', 'clay', 'tan', 'brick'], (x, y) => x * 0.7 + y * 0.6, (x, y) => y >= 13 && y <= 17 && Math.hypot((x - 11) / 4.4, (y - 12) / 5.4) < 1, 20);
  p.fillRect(9, 14, 4, 1, 'skinShade');
  // Green-grey eyes, nose, brows.
  p.set(9, 10, 'moss').set(13, 10, 'moss').set(8, 9, 'clay').set(9, 9, 'clay').set(13, 9, 'clay').set(14, 9, 'clay');
  p.line(11, 10, 10, 12, 'skinShade');
  return p;
}

/** A heavier gold frame for the Van Gogh room, bottom-centred in a sheet cell. */
function frame(pic: PixelGrid): PixelGrid {
  const g = new PixelGrid(pic.w + 6, pic.h + 6);
  g.fillRect(0, 0, g.w, g.h, 'amber');
  g.fillRect(0, 0, g.w, 1, 'gold').fillRect(0, 0, 1, g.h, 'gold');
  g.fillRect(0, g.h - 1, g.w, 1, 'umber').fillRect(g.w - 1, 0, 1, g.h, 'umber');
  g.fillRect(2, 2, g.w - 4, g.h - 4, 'umber');
  for (let x = 2; x < g.w - 2; x += 3) g.set(x, 1, 'cream').set(x + 1, g.h - 2, 'clay');
  for (const [x, y] of [
    [0, 0],
    [g.w - 2, 0],
    [0, g.h - 2],
    [g.w - 2, g.h - 2],
  ])
    g.fillRect(x, y, 2, 2, 'gold');
  g.stamp(pic, 3, 3);
  return g.resized(VAN_GOGH_CELL.w, VAN_GOGH_CELL.h, Math.floor((VAN_GOGH_CELL.w - g.w) / 2), VAN_GOGH_CELL.h - g.h);
}

export function vanGoghPainting(kind: (typeof VAN_GOGH)[number]): PixelGrid {
  const draw = { selfportrait: selfPortrait, starrynight: starryNight, sunflowers, bedroom, cafe, wheatfield }[kind];
  return frame(draw());
}

/** "VINCENT VAN GOGH" in gold on a wine-red plaque, for the wall above. */
export function vanGoghBanner(): PixelGrid {
  const text = textGrid('VINCENT VAN GOGH', 'gold');
  const g = new PixelGrid(text.w + 10, text.h + 5);
  g.fillRect(0, 0, g.w, g.h, 'amber');
  g.fillRect(1, 1, g.w - 2, g.h - 2, 'wine');
  g.fillRect(1, g.h - 2, g.w - 2, 1, 'bark');
  g.stamp(text, 5, 2);
  return g;
}
