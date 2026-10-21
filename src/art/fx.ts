// Particles, lights, vignette and UI pieces.

import { RENDER } from '../config';
import { PixelGrid, ditherPick, outline, shade, type TextureSink } from './pixel';
import { PALETTE, RAMPS, type ColorName } from './palette';

export const FX_TEXTURES = {
  leaf: 'fx-leaf',
  firefly: 'fx-firefly',
  dust: 'fx-dust',
  sparkle: 'fx-sparkle',
  lightWarm: 'light-warm',
  lightWindow: 'light-window',
  vignette: 'fx-vignette',
  pixel: 'fx-pixel',
  bobber: 'fx-bobber',
  ripple: 'fx-ripple',
  emote: 'fx-emote',
  rain: 'fx-rain',
  splash: 'fx-splash',
  note: 'fx-note',
} as const;

/** Frames in the fx-emote sheet: speech bubbles over a character's head. */
export const EMOTE = { alert: 0, question: 1, heart: 2, dots: 3, note: 4, angry: 5 } as const;

export const UI_TEXTURES = {
  panel: 'ui-panel',
  panelDark: 'ui-panel-dark',
  slot: 'ui-slot',
  slotSelected: 'ui-slot-selected',
  icons: 'ui-icons',
} as const;

/** Frame indices in the ui-icons sheet. */
export const UI_ICON = {
  sun: 0,
  moon: 1,
  spring: 2,
  summer: 3,
  fall: 4,
  winter: 5,
  coin: 6,
  rain: 7,
  energy: 8,
  hunger: 9,
  thirst: 10,
  sleep: 11,
} as const;

export const PANEL_SLICE = 8;
export const LEAF_COLORS = 3;

// ---------------------------------------------------------------------------

function leafFrames(): PixelGrid[] {
  const colors: Array<[ColorName, ColorName]> = [
    ['grass', 'leaf'],
    ['lime', 'grass'],
    ['amber', 'clay'],
  ];
  const frames: PixelGrid[] = [];
  for (const [a, b] of colors) {
    frames.push(new PixelGrid(5, 5).set(1, 1, a).set(2, 1, a).set(2, 2, a).set(3, 2, b).set(3, 3, b));
    frames.push(new PixelGrid(5, 5).set(2, 1, a).set(2, 2, a).set(2, 3, b).set(1, 2, a));
  }
  return frames;
}

function dustFrames(): PixelGrid[] {
  return [3, 5, 7].map((r, i) => {
    const g = new PixelGrid(10, 10);
    const mask = new PixelGrid(10, 10).fillEllipse(5 - r / 2, 5 - r / 2 + 1, r, r - 1, 'ink');
    g.stamp(shade(mask, RAMPS.sand.slice(0, 3), { rim: 0.4 }));
    if (i === 2) g.forEachFilled((x, y) => ditherPick(x, y, 0.5) && g.set(x, y, null));
    return g;
  });
}

function sparkleFrames(): PixelGrid[] {
  const a = new PixelGrid(7, 7).set(3, 3, 'cream');
  const b = new PixelGrid(7, 7).set(3, 2, 'gold').set(3, 4, 'gold').set(2, 3, 'gold').set(4, 3, 'gold').set(3, 3, 'cream');
  const c = new PixelGrid(7, 7)
    .line(3, 0, 3, 6, 'gold')
    .line(0, 3, 6, 3, 'gold')
    .set(3, 3, 'cream')
    .set(3, 2, 'cream')
    .set(2, 3, 'cream');
  return [a, b, c, b];
}

/** Soft additive light with stepped falloff (no smooth gradients). */
function lightCanvas(size: number, color: ColorName, steps: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const rgb = parseInt(PALETTE[color].slice(1), 16);
  const r = (rgb >> 16) & 0xff;
  const g = (rgb >> 8) & 0xff;
  const b = rgb & 0xff;
  const half = size / 2;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - half, (y + 0.5 - half) * 1.15) / half;
      if (d >= 1) continue;
      const a = Math.ceil((1 - d) * (1 - d) * steps) / steps;
      const i = (y * size + x) * 4;
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = Math.round(a * 255);
    }
  ctx.putImageData(img, 0, 0);
  return c;
}

function vignetteCanvas(): HTMLCanvasElement {
  const w = RENDER.width;
  const h = RENDER.height;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  const rgb = parseInt(PALETTE.ink.slice(1), 16);
  const levels = 10;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const nx = (x + 0.5) / w - 0.5;
      const ny = (y + 0.5) / h - 0.5;
      const d = Math.hypot(nx * 1.1, ny * 1.25) * 2;
      const t = Math.max(0, (d - 0.62) / 0.6);
      const a = Math.min(1, Math.round(t * t * levels) / levels);
      const i = (y * w + x) * 4;
      img.data[i] = (rgb >> 16) & 0xff;
      img.data[i + 1] = (rgb >> 8) & 0xff;
      img.data[i + 2] = rgb & 0xff;
      img.data[i + 3] = Math.round(a * 255);
    }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Red and white float: riding the water, then pulled under by a bite. */
function bobberFrames(): PixelGrid[] {
  const up = new PixelGrid(7, 9);
  up.fillRect(3, 0, 1, 2, 'night');
  up.fillEllipse(1, 2, 5, 3, 'brick').set(2, 2, 'coral');
  up.fillEllipse(1, 4, 5, 3, 'cream').set(4, 5, 'mist');
  up.fillRect(0, 7, 7, 1, 'foam').set(0, 7, null).set(6, 7, null);
  const down = new PixelGrid(7, 9);
  down.fillRect(3, 3, 1, 2, 'night');
  down.fillEllipse(1, 5, 5, 3, 'brick').set(2, 5, 'coral');
  down.fillRect(0, 7, 7, 1, 'foam').fillRect(1, 8, 5, 1, 'foam');
  return [outline(up, { color: 'deep' }), outline(down, { color: 'deep' })];
}

function rippleFrames(): PixelGrid[] {
  return [4, 8, 12].map((w, i) => {
    const g = new PixelGrid(14, 6);
    const x = 7 - w / 2;
    g.fillEllipse(x, 3 - (i + 2) / 2, w, i + 2, 'foam').fillEllipse(x + 1, 3 - i / 2, w - 2, Math.max(1, i), null);
    if (i === 2) g.forEachFilled((px, py) => ditherPick(px, py, 0.5) && g.set(px, py, null));
    return g;
  });
}

function bubble(draw: (g: PixelGrid) => void): PixelGrid {
  const g = new PixelGrid(13, 14);
  g.fillRect(1, 0, 11, 11, 'cream').fillRect(0, 1, 13, 9, 'cream');
  g.fillRect(5, 11, 3, 1, 'cream').set(6, 12, 'cream');
  draw(g);
  return outline(g.resized(15, 16, 1, 1), { color: 'night' });
}

function emoteFrames(): PixelGrid[] {
  const alert = bubble((g) => g.fillRect(5, 2, 3, 5, 'brick').fillRect(5, 8, 3, 2, 'brick').set(5, 2, 'coral'));
  const question = bubble((g) => g.fillRect(4, 2, 5, 1, 'sea').fillRect(8, 3, 1, 2, 'sea').fillRect(6, 5, 2, 1, 'sea').fillRect(6, 6, 1, 1, 'sea').fillRect(6, 8, 1, 2, 'sea'));
  const heart = bubble((g) => g.fillRect(3, 3, 3, 2, 'brick').fillRect(7, 3, 3, 2, 'brick').fillRect(3, 5, 7, 1, 'brick').fillRect(4, 6, 5, 1, 'brick').fillRect(5, 7, 3, 1, 'brick').set(6, 8, 'brick').set(4, 3, 'rose'));
  const dots = bubble((g) => g.fillRect(2, 5, 2, 2, 'mauve').fillRect(6, 5, 2, 2, 'mauve').fillRect(10, 5, 2, 2, 'mauve'));
  const note = bubble((g) => g.fillRect(8, 2, 1, 6, 'violet').fillRect(9, 2, 2, 1, 'violet').set(10, 3, 'violet').fillRect(5, 7, 4, 2, 'violet').set(5, 7, 'lilac'));
  const angry = bubble((g) => g.line(3, 3, 5, 5, 'brick').line(9, 3, 7, 5, 'brick').line(4, 8, 8, 8, 'brick').line(8, 8, 9, 7, 'brick'));
  return [alert, question, heart, dots, note, angry];
}

/** A rain streak, slanted with the wind, and the splash it makes. */
function rainFrames(): PixelGrid[] {
  const a = new PixelGrid(4, 9).line(3, 0, 1, 8, 'foam').set(3, 0, 'sky');
  const b = new PixelGrid(4, 9).line(3, 2, 1, 8, 'sky').set(1, 8, 'foam');
  return [a, b];
}

function splashFrames(): PixelGrid[] {
  return [
    new PixelGrid(7, 4).set(3, 2, 'foam').set(2, 3, 'sky').set(4, 3, 'sky'),
    new PixelGrid(7, 4).set(1, 1, 'foam').set(5, 1, 'foam').set(0, 3, 'sky').set(6, 3, 'sky'),
  ];
}

function noteFrames(): PixelGrid[] {
  const a = new PixelGrid(6, 8).fillRect(3, 0, 1, 6, 'violet').fillRect(4, 0, 2, 1, 'violet').fillRect(0, 5, 4, 2, 'violet').set(0, 5, 'lilac');
  const b = new PixelGrid(8, 8).fillRect(2, 1, 1, 5, 'rose').fillRect(6, 0, 1, 5, 'rose').line(2, 1, 6, 0, 'rose').fillRect(0, 5, 3, 2, 'rose').fillRect(4, 4, 3, 2, 'rose');
  return [outline(a.resized(8, 10, 1, 1), { color: 'night' }), outline(b.resized(8, 10, 0, 1), { color: 'night' })];
}

// ---------------------------------------------------------------------------
// UI pieces

/** Wooden frame with a parchment interior, sliced 8/8/8. */
function panel(dark: boolean): PixelGrid {
  const S = PANEL_SLICE * 3;
  const g = new PixelGrid(S, S);
  // Outer rounded wood frame.
  g.fillRect(1, 0, S - 2, S, 'bark').fillRect(0, 1, S, S - 2, 'bark');
  g.fillRect(1, 1, S - 2, S - 2, 'clay');
  g.fillRect(1, 1, S - 2, 1, 'sand').fillRect(1, 1, 1, S - 2, 'tan');
  g.fillRect(1, S - 2, S - 2, 1, 'umber').fillRect(S - 2, 1, 1, S - 2, 'umber');
  g.fillRect(2, 2, S - 4, S - 4, 'tan');
  g.fillRect(3, 3, S - 6, S - 6, 'umber');
  // Interior.
  g.fillRect(4, 4, S - 8, S - 8, dark ? 'night' : 'cream');
  g.fillRect(4, 4, S - 8, 1, dark ? 'plum' : 'mist');
  // Brass rivets in the corners.
  for (const [x, y] of [
    [2, 2],
    [S - 3, 2],
    [2, S - 3],
    [S - 3, S - 3],
  ])
    g.set(x, y, 'gold');
  return g;
}

function slot(selected: boolean): PixelGrid {
  const g = new PixelGrid(20, 20);
  g.fillRect(1, 0, 18, 20, selected ? 'gold' : 'umber').fillRect(0, 1, 20, 18, selected ? 'gold' : 'umber');
  g.fillRect(1, 1, 18, 18, selected ? 'amber' : 'clay');
  g.fillRect(2, 2, 16, 16, 'sand');
  g.fillRect(2, 2, 16, 1, 'tan').fillRect(2, 2, 1, 16, 'tan');
  if (selected) g.set(0, 1, 'cream').set(1, 0, 'cream');
  return g;
}

function icons(): PixelGrid[] {
  const sun = new PixelGrid(9, 9).fillEllipse(2, 2, 5, 5, 'gold');
  sun.set(4, 0, 'amber').set(4, 8, 'amber').set(0, 4, 'amber').set(8, 4, 'amber');
  sun.set(1, 1, 'amber').set(7, 1, 'amber').set(1, 7, 'amber').set(7, 7, 'amber');
  sun.set(3, 3, 'cream');
  const moon = new PixelGrid(9, 9).fillEllipse(1, 1, 7, 7, 'mist').fillEllipse(3, 0, 6, 6, null);
  moon.set(2, 4, 'cream').set(2, 3, 'cream');
  const spring = new PixelGrid(9, 9);
  for (const [x, y] of [
    [4, 1],
    [1, 4],
    [7, 4],
    [2, 7],
    [6, 7],
  ])
    spring.fillEllipse(x - 1, y - 1, 3, 3, 'rose');
  spring.set(4, 4, 'gold');
  const summer = sun.recolor({ gold: 'amber', amber: 'coral' });
  const fall = new PixelGrid(9, 9);
  fall.fillEllipse(1, 1, 7, 6, 'coral').line(1, 7, 6, 2, 'brick').set(2, 2, 'peach').set(0, 8, 'clay');
  const winter = new PixelGrid(9, 9).line(4, 0, 4, 8, 'foam').line(0, 4, 8, 4, 'foam').line(1, 1, 7, 7, 'sky').line(7, 1, 1, 7, 'sky');
  winter.set(4, 4, 'cream');
  const coin = new PixelGrid(9, 9).fillEllipse(1, 1, 7, 7, 'amber').fillEllipse(2, 2, 5, 5, 'gold');
  coin.set(3, 3, 'cream').line(4, 3, 4, 5, 'amber');
  const rain = new PixelGrid(9, 9).fillEllipse(0, 0, 9, 5, 'haze').fillEllipse(1, 0, 6, 3, 'mist');
  rain.set(2, 6, 'sky').set(5, 7, 'sky').set(3, 8, 'sky').set(6, 5, 'sky');
  // Needs: lightning bolt, rice bowl, water drop, sleepy moon with a "z".
  const energy = new PixelGrid(9, 9).line(5, 0, 2, 4, 'gold').line(6, 0, 3, 4, 'gold').fillRect(2, 4, 5, 1, 'gold').line(6, 4, 3, 8, 'amber').line(5, 5, 3, 7, 'gold');
  energy.set(5, 1, 'cream');
  const hunger = new PixelGrid(9, 9).fillEllipse(0, 2, 9, 4, 'cream').fillEllipse(1, 1, 7, 3, 'mist').fillRect(1, 4, 7, 2, 'brick').fillRect(2, 6, 5, 2, 'brick').fillRect(3, 8, 3, 1, 'wine');
  hunger.set(2, 4, 'coral').set(3, 1, 'cream');
  const thirst = new PixelGrid(9, 9).fillEllipse(1, 3, 7, 6, 'sky').line(4, 0, 2, 4, 'sky').line(4, 0, 6, 4, 'sky').fillRect(3, 2, 3, 3, 'sky');
  thirst.set(3, 5, 'foam').set(3, 4, 'foam').set(6, 7, 'sea').set(5, 8, 'sea');
  const sleep = new PixelGrid(9, 9).fillEllipse(0, 2, 7, 7, 'lilac').fillEllipse(2, 1, 6, 6, null);
  sleep.set(1, 5, 'mist').fillRect(5, 0, 4, 1, 'mist').set(7, 1, 'mist').set(6, 2, 'mist').fillRect(5, 3, 4, 1, 'mist');
  return [sun, moon, spring, summer, fall, winter, coin, rain, energy, hunger, thirst, sleep].map((g) => outline(g, { steps: 2 }));
}

// ---------------------------------------------------------------------------

export function registerFx(sink: TextureSink): void {
  sink.sheet(FX_TEXTURES.leaf, leafFrames(), 5, 5);
  sink.image(FX_TEXTURES.firefly, new PixelGrid(3, 3).set(1, 1, 'cream').set(0, 1, 'gold').set(2, 1, 'gold').set(1, 0, 'gold').set(1, 2, 'gold'));
  sink.sheet(FX_TEXTURES.dust, dustFrames(), 10, 10);
  sink.sheet(FX_TEXTURES.sparkle, sparkleFrames(), 7, 7);
  sink.canvas(FX_TEXTURES.lightWarm, lightCanvas(64, 'coral', 6));
  sink.canvas(FX_TEXTURES.lightWindow, lightCanvas(48, 'peach', 5));
  sink.canvas(FX_TEXTURES.vignette, vignetteCanvas());
  sink.image(FX_TEXTURES.pixel, new PixelGrid(1, 1).set(0, 0, 'cream'));
  sink.sheet(FX_TEXTURES.bobber, bobberFrames(), 7, 9);
  sink.sheet(FX_TEXTURES.ripple, rippleFrames(), 14, 6);
  sink.sheet(FX_TEXTURES.emote, emoteFrames(), 15, 16);
  sink.sheet(FX_TEXTURES.rain, rainFrames(), 4, 9);
  sink.sheet(FX_TEXTURES.splash, splashFrames(), 7, 4);
  sink.sheet(FX_TEXTURES.note, noteFrames(), 8, 10);

  sink.image(UI_TEXTURES.panel, panel(false));
  sink.image(UI_TEXTURES.panelDark, panel(true));
  sink.image(UI_TEXTURES.slot, slot(false));
  sink.image(UI_TEXTURES.slotSelected, slot(true));
  sink.sheet(UI_TEXTURES.icons, icons(), 9, 9);
}
