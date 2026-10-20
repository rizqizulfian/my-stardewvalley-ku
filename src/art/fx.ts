// Particles, lights, vignette and UI pieces.

import { RENDER } from '../config';
import { PixelGrid, ditherPick, outline, shade, type TextureSink } from './pixel';
import { PALETTE, type ColorName } from './palette';

export const FX_TEXTURES = {
  leaf: 'fx-leaf',
  firefly: 'fx-firefly',
  dust: 'fx-dust',
  smoke: 'fx-smoke',
  sparkle: 'fx-sparkle',
  lightWarm: 'light-warm',
  lightWindow: 'light-window',
  vignette: 'fx-vignette',
  pixel: 'fx-pixel',
} as const;

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
} as const;

export const PANEL_SLICE = 8;
export const LEAF_COLORS = 3;

// ---------------------------------------------------------------------------

function leafFrames(): PixelGrid[] {
  const colors: Array<[ColorName, ColorName]> = [
    ['fern', 'leaf'],
    ['lime', 'fern'],
    ['amber', 'dirtShade'],
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
    g.stamp(shade(mask, ['dirtShade', 'dirtLight', 'dirtHi'], { rim: 0.4 }));
    if (i === 2) g.forEachFilled((x, y) => ditherPick(x, y, 0.5) && g.set(x, y, null));
    return g;
  });
}

/** Chimney smoke puffs, small to large. */
function smokeFrames(): PixelGrid[] {
  return [3, 5, 7].map((r) => {
    const o = Math.floor((9 - r) / 2);
    const mask = new PixelGrid(9, 9).fillEllipse(o, o, r, r, 'ink');
    return shade(mask, ['haze', 'mist', 'cream'], { rim: 0.35, gradient: 0.6 });
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
  return [sun, moon, spring, summer, fall, winter, coin, rain].map((g) => outline(g, { steps: 2 }));
}

// ---------------------------------------------------------------------------

export function registerFx(sink: TextureSink): void {
  sink.sheet(FX_TEXTURES.leaf, leafFrames(), 5, 5);
  sink.image(FX_TEXTURES.firefly, new PixelGrid(3, 3).set(1, 1, 'cream').set(0, 1, 'gold').set(2, 1, 'gold').set(1, 0, 'gold').set(1, 2, 'gold'));
  sink.sheet(FX_TEXTURES.dust, dustFrames(), 10, 10);
  sink.sheet(FX_TEXTURES.smoke, smokeFrames(), 9, 9);
  sink.sheet(FX_TEXTURES.sparkle, sparkleFrames(), 7, 7);
  sink.canvas(FX_TEXTURES.lightWarm, lightCanvas(64, 'amber', 6));
  sink.canvas(FX_TEXTURES.lightWindow, lightCanvas(48, 'dirtLight', 5));
  sink.canvas(FX_TEXTURES.vignette, vignetteCanvas());
  sink.image(FX_TEXTURES.pixel, new PixelGrid(1, 1).set(0, 0, 'cream'));

  sink.image(UI_TEXTURES.panel, panel(false));
  sink.image(UI_TEXTURES.panelDark, panel(true));
  sink.image(UI_TEXTURES.slot, slot(false));
  sink.image(UI_TEXTURES.slotSelected, slot(true));
  sink.sheet(UI_TEXTURES.icons, icons(), 9, 9);
}
