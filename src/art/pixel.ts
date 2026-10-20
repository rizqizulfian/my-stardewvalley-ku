// Pixel-art toolkit.
// Sprites are palette-indexed grids. Helpers shade, outline, dither and
// transform them, then a TextureSink turns them into textures.
// Nothing here knows about Phaser except PhaserTextureSink at the bottom.

import Phaser from 'phaser';
import { COLOR_INDEX, COLOR_NAMES, OUTLINE_OF, PALETTE_RGB, darker, type ColorName, type Ramp } from './palette';

export const EMPTY = -1;

/** Maps grid characters to palette colours. '.' and ' ' are always transparent. */
export type Legend = Record<string, ColorName | null>;

export class PixelGrid {
  readonly data: Int16Array;

  constructor(
    readonly w: number,
    readonly h: number,
    data?: Int16Array,
  ) {
    this.data = data ?? new Int16Array(w * h).fill(EMPTY);
  }

  /** Parse rows of characters. Every row must be exactly `w` wide. */
  static fromRows(rows: readonly string[], legend: Legend, name = 'grid'): PixelGrid {
    const h = rows.length;
    const w = rows[0]?.length ?? 0;
    const g = new PixelGrid(w, h);
    rows.forEach((row, y) => {
      if (row.length !== w) {
        throw new Error(`[pixel] ${name}: row ${y} is ${row.length} wide, expected ${w}: "${row}"`);
      }
      for (let x = 0; x < w; x++) {
        const ch = row[x];
        if (ch === '.' || ch === ' ') continue;
        const c = legend[ch];
        if (c === undefined) throw new Error(`[pixel] ${name}: no legend entry for '${ch}'`);
        if (c !== null) g.data[y * w + x] = COLOR_INDEX[c];
      }
    });
    return g;
  }

  clone(): PixelGrid {
    return new PixelGrid(this.w, this.h, new Int16Array(this.data));
  }

  inside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  get(x: number, y: number): number {
    return this.inside(x, y) ? this.data[y * this.w + x] : EMPTY;
  }

  filled(x: number, y: number): boolean {
    return this.get(x, y) !== EMPTY;
  }

  set(x: number, y: number, c: ColorName | number | null): this {
    x = Math.round(x);
    y = Math.round(y);
    if (!this.inside(x, y)) return this;
    this.data[y * this.w + x] = c === null ? EMPTY : typeof c === 'number' ? c : COLOR_INDEX[c];
    return this;
  }

  colorAt(x: number, y: number): ColorName | null {
    const v = this.get(x, y);
    return v === EMPTY ? null : COLOR_NAMES[v];
  }

  fillRect(x: number, y: number, w: number, h: number, c: ColorName | null): this {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, c);
    return this;
  }

  /** Filled ellipse inside the box (x, y, w, h). */
  fillEllipse(x: number, y: number, w: number, h: number, c: ColorName | null): this {
    const cx = x + w / 2 - 0.5;
    const cy = y + h / 2 - 0.5;
    const rx = w / 2;
    const ry = h / 2;
    for (let j = y; j < y + h; j++) {
      for (let i = x; i < x + w; i++) {
        const dx = (i - cx) / rx;
        const dy = (j - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(i, j, c);
      }
    }
    return this;
  }

  /** Bresenham line. */
  line(x0: number, y0: number, x1: number, y1: number, c: ColorName | null): this {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
    return this;
  }

  /** Draw `src` on top of this grid; transparent source pixels are skipped. */
  stamp(src: PixelGrid, ox = 0, oy = 0): this {
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        const v = src.data[y * src.w + x];
        if (v !== EMPTY) this.set(ox + x, oy + y, v);
      }
    }
    return this;
  }

  /** Only paint where this grid is already filled (clip to silhouette). */
  stampClipped(src: PixelGrid, ox = 0, oy = 0): this {
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        const v = src.data[y * src.w + x];
        if (v !== EMPTY && this.filled(ox + x, oy + y)) this.set(ox + x, oy + y, v);
      }
    }
    return this;
  }

  flipX(): PixelGrid {
    const g = new PixelGrid(this.w, this.h);
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) g.data[y * this.w + (this.w - 1 - x)] = this.data[y * this.w + x];
    return g;
  }

  /** Copy into a new canvas size, offset by (dx, dy). */
  resized(w: number, h: number, dx = 0, dy = 0): PixelGrid {
    return new PixelGrid(w, h).stamp(this, dx, dy);
  }

  shift(dx: number, dy: number): PixelGrid {
    return new PixelGrid(this.w, this.h).stamp(this, dx, dy);
  }

  /** Copy a sub-rectangle. */
  crop(x: number, y: number, w: number, h: number): PixelGrid {
    const g = new PixelGrid(w, h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) g.data[j * w + i] = this.get(x + i, y + j);
    return g;
  }

  /**
   * Horizontal shear for sway animation: rows above `pivotY` slide by up to
   * `amount` pixels, more at the top. Whole-pixel offsets only.
   */
  sway(amount: number, pivotY = this.h): PixelGrid {
    const g = new PixelGrid(this.w, this.h);
    for (let y = 0; y < this.h; y++) {
      const t = pivotY <= 0 ? 0 : Math.max(0, (pivotY - y) / pivotY);
      const off = Math.round(amount * t);
      for (let x = 0; x < this.w; x++) {
        const v = this.data[y * this.w + x];
        if (v !== EMPTY) g.set(x + off, y, v);
      }
    }
    return g;
  }

  /** Swap colours by name. */
  recolor(map: Partial<Record<ColorName, ColorName>>): PixelGrid {
    const g = this.clone();
    const lut = new Map<number, number>();
    for (const [from, to] of Object.entries(map)) lut.set(COLOR_INDEX[from as ColorName], COLOR_INDEX[to as ColorName]);
    for (let i = 0; i < g.data.length; i++) {
      const r = lut.get(g.data[i]);
      if (r !== undefined) g.data[i] = r;
    }
    return g;
  }

  forEachFilled(fn: (x: number, y: number, c: ColorName) => void): void {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const v = this.data[y * this.w + x];
        if (v !== EMPTY) fn(x, y, COLOR_NAMES[v]);
      }
  }

  bounds(): { x0: number; y0: number; x1: number; y1: number } | null {
    let x0 = Infinity,
      y0 = Infinity,
      x1 = -Infinity,
      y1 = -Infinity;
    this.forEachFilled((x, y) => {
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    });
    return x0 === Infinity ? null : { x0, y0, x1, y1 };
  }
}

// ---------------------------------------------------------------------------
// Randomness and noise (deterministic, so art is identical every boot)

export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer hash to 0..1, stable for any (x, y, seed). */
export function hash2(x: number, y: number, seed = 0): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/**
 * Smooth value noise. With `period` set, the noise tiles seamlessly every
 * `period` units, which keeps procedurally drawn tiles seamless.
 */
export function valueNoise(x: number, y: number, seed = 0, period = 0): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const wrap = (v: number) => (period > 0 ? ((v % period) + period) % period : v);
  const v = (i: number, j: number) => hash2(wrap(i), wrap(j), seed);
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = v(xi, yi) + (v(xi + 1, yi) - v(xi, yi)) * sx;
  const b = v(xi, yi + 1) + (v(xi + 1, yi + 1) - v(xi, yi + 1)) * sx;
  return a + (b - a) * sy;
}

// ---------------------------------------------------------------------------
// Dithering

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** Ordered-dither threshold in [0, 1) for pixel (x, y). */
export function bayer(x: number, y: number): number {
  return (BAYER4[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
}

/** True when the pixel should take the "B" colour for a mix amount t (0..1). */
export function ditherPick(x: number, y: number, t: number): boolean {
  return t > bayer(x, y);
}

/** Pick a tone from a ramp for a continuous value v (0..1), dithering between tones. */
export function rampDither(ramp: Ramp, v: number, x: number, y: number, strength = 1): ColorName {
  const n = ramp.length;
  const f = Math.min(Math.max(v, 0), 0.9999) * (n - 1);
  const i = Math.floor(f);
  const frac = f - i;
  // strength 0 = hard banding at the midpoint, 1 = full ordered dither.
  const threshold = 0.5 + (bayer(x, y) - 0.5) * Math.min(Math.max(strength, 0), 1);
  return ramp[Math.min(n - 1, frac > threshold ? i + 1 : i)];
}

/** Fill a rect by dithering two colours. */
export function ditherRect(
  g: PixelGrid,
  x: number,
  y: number,
  w: number,
  h: number,
  a: ColorName,
  b: ColorName,
  t: number,
): void {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) g.set(i, j, ditherPick(i, j, t) ? b : a);
}

// ---------------------------------------------------------------------------
// Shading and outlines

export interface ShadeOptions {
  /** How much the top-left / bottom-right rims brighten or darken (0..1). */
  rim?: number;
  /** How much the overall top-left to bottom-right gradient matters (0..1). */
  gradient?: number;
  /** Shift the whole result lighter (+) or darker (-). */
  bias?: number;
  /** Dither between tones instead of hard banding. */
  dither?: number;
  /** Optional per-pixel noise amount for texture (0..1). */
  noise?: number;
  seed?: number;
}

/**
 * Shade a silhouette with a ramp, lit from the top-left.
 * The mask is any grid; filled pixels are shaded, colours are replaced.
 */
export function shade(mask: PixelGrid, ramp: Ramp, opts: ShadeOptions = {}): PixelGrid {
  const rim = opts.rim ?? 0.28;
  const gradient = opts.gradient ?? 0.7;
  const bias = opts.bias ?? 0;
  const dither = opts.dither ?? 0;
  const noise = opts.noise ?? 0;
  const seed = opts.seed ?? 1;
  const b = mask.bounds();
  const out = new PixelGrid(mask.w, mask.h);
  if (!b) return out;
  const bw = Math.max(1, b.x1 - b.x0);
  const bh = Math.max(1, b.y1 - b.y0);
  mask.forEachFilled((x, y) => {
    const u = (x - b.x0) / bw;
    const v = (y - b.y0) / bh;
    // Light from the top-left: 1 at top-left, 0 at bottom-right.
    let l = 1 - (u * 0.4 + v * 0.6);
    l = 0.5 + (l - 0.5) * gradient * 2;
    if (!mask.filled(x - 1, y) || !mask.filled(x, y - 1)) l += rim;
    if (!mask.filled(x + 1, y) || !mask.filled(x, y + 1)) l -= rim;
    if (noise > 0) l += (hash2(x, y, seed) - 0.5) * noise;
    l += bias;
    out.set(x, y, dither > 0 ? rampDither(ramp, l, x, y, dither) : ramp[clampIndex(Math.floor(l * ramp.length), ramp.length)]);
  });
  return out;
}

function clampIndex(i: number, n: number): number {
  return Math.min(n - 1, Math.max(0, i));
}

export interface OutlineOptions {
  /** How many palette steps darker than the neighbouring fill. Default: the fill's material outline. */
  steps?: number;
  /** Include diagonal neighbours for a thicker, rounder outline. */
  diagonal?: boolean;
  /** Force a specific colour instead of the fill-derived shade. */
  color?: ColorName;
}

/**
 * Outer outline: every empty pixel touching the sprite becomes a darker,
 * hue-shifted shade of the fill it touches. Grid size is unchanged, so leave
 * a 1px margin around the art.
 */
export function outline(g: PixelGrid, opts: OutlineOptions = {}): PixelGrid {
  const steps = opts.steps;
  const out = g.clone();
  const dirs = opts.diagonal
    ? [
        [0, 1],
        [1, 0],
        [-1, 0],
        [0, -1],
        [1, 1],
        [-1, 1],
        [1, -1],
        [-1, -1],
      ]
    : [
        [0, 1],
        [1, 0],
        [-1, 0],
        [0, -1],
      ];
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      if (g.filled(x, y)) continue;
      for (const [dx, dy] of dirs) {
        const c = g.colorAt(x + dx, y + dy);
        if (c) {
          out.set(x, y, opts.color ?? (steps === undefined ? OUTLINE_OF[c] : darker(c, steps)));
          break;
        }
      }
    }
  }
  return out;
}

/**
 * Selective inner darkening along the bottom/right edge of a silhouette,
 * which reads as an outline in shadow and keeps the lit side soft.
 */
export function innerShadow(g: PixelGrid, steps = 1): PixelGrid {
  const out = g.clone();
  g.forEachFilled((x, y, c) => {
    if (!g.filled(x + 1, y) || !g.filled(x, y + 1)) out.set(x, y, darker(c, steps));
  });
  return out;
}

/** Turn a mask (any filled pixel) into a single colour silhouette. */
export function silhouette(g: PixelGrid, c: ColorName): PixelGrid {
  const out = new PixelGrid(g.w, g.h);
  g.forEachFilled((x, y) => out.set(x, y, c));
  return out;
}

/** Build a mask from a boolean function. */
export function maskFrom(w: number, h: number, fn: (x: number, y: number) => boolean): PixelGrid {
  const g = new PixelGrid(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (fn(x, y)) g.set(x, y, 0);
  return g;
}

/** Union of filled ellipses, a quick way to build organic blobs (bushes, canopies). */
export function blobMask(w: number, h: number, circles: ReadonlyArray<[number, number, number, number?]>): PixelGrid {
  const g = new PixelGrid(w, h);
  for (const [cx, cy, rx, ryIn] of circles) {
    const ry = ryIn ?? rx;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) g.set(x, y, 0);
      }
  }
  return g;
}

// ---------------------------------------------------------------------------
// Volume shading without dither

/** Light direction: from the top-left and slightly toward the viewer. */
const LIGHT = (() => {
  const v = [-0.6, -0.75, 0.3];
  const l = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / l, v[1] / l, v[2] / l] as const;
})();

export interface BallOptions {
  /** Shift the result lighter (+) or darker (-), in ramp fractions. */
  bias?: number;
  /** Amplitude of the clustered texture (0..1). Clusters are 2-3px, never single-pixel noise. */
  cluster?: number;
  seed?: number;
}

/**
 * Shade the filled pixels of `mask` as if they were the visible part of an
 * ellipsoid centred at (cx, cy) with radii (rx, ry), lit from the top-left.
 * Tones are hard bands from the ramp; texture comes from small clusters.
 */
export function shadeBall(mask: PixelGrid, ramp: Ramp, cx: number, cy: number, rx: number, ry: number, opts: BallOptions = {}): PixelGrid {
  const out = new PixelGrid(mask.w, mask.h);
  const seed = opts.seed ?? 1;
  const cluster = opts.cluster ?? 0;
  const bias = opts.bias ?? 0;
  mask.forEachFilled((x, y) => {
    const nx = Math.max(-1, Math.min(1, (x + 0.5 - cx) / rx));
    const ny = Math.max(-1, Math.min(1, (y + 0.5 - cy) / ry));
    const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
    const l = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2];
    let t = 0.5 + l * 0.5 + bias;
    if (cluster > 0) {
      // Staggered 2x2 cells so the texture never lines up on a grid.
      const cxl = Math.floor((x + (Math.floor(y / 2) % 2)) / 2);
      const cyl = Math.floor(y / 2);
      t += (hash2(cxl, cyl, seed) - 0.5) * cluster;
    }
    out.set(x, y, ramp[clampIndex(Math.floor(t * ramp.length), ramp.length)]);
  });
  return out;
}

/** Recolour pixels of one colour that sit on the lower or right rim of the silhouette. */
export function rimDarken(g: PixelGrid, from: ColorName | null, to: ColorName): PixelGrid {
  const out = g.clone();
  g.forEachFilled((x, y, c) => {
    if (from && c !== from) return;
    if (!g.filled(x, y + 1) || !g.filled(x + 1, y)) out.set(x, y, to);
  });
  return out;
}

// ---------------------------------------------------------------------------
// Canvas output

export function toCanvas(g: PixelGrid): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = g.w;
  canvas.height = g.h;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(g.w, g.h);
  for (let i = 0; i < g.data.length; i++) {
    const v = g.data[i];
    if (v === EMPTY) continue;
    const [r, gg, b] = PALETTE_RGB[v];
    img.data[i * 4] = r;
    img.data[i * 4 + 1] = gg;
    img.data[i * 4 + 2] = b;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** Lay frames out left-to-right, wrapping after `columns`. */
export function packFrames(frames: readonly PixelGrid[], fw: number, fh: number, columns = frames.length): PixelGrid {
  const cols = Math.max(1, Math.min(columns, frames.length));
  const rows = Math.ceil(frames.length / cols);
  const sheet = new PixelGrid(fw * cols, fh * rows);
  frames.forEach((f, i) => sheet.stamp(f, (i % cols) * fw, Math.floor(i / cols) * fh));
  return sheet;
}

// ---------------------------------------------------------------------------
// Texture sinks: where generated art goes. Swap PhaserTextureSink for an
// atlas-backed loader later; the rest of the game only uses texture keys and
// frame indices.

export interface TextureSink {
  /** Single-frame texture. */
  image(key: string, g: PixelGrid): void;
  /** Uniform spritesheet; frames are addressable as 0..n-1. */
  sheet(key: string, frames: readonly PixelGrid[], fw: number, fh: number, columns?: number): void;
  /** A texture drawn straight onto a canvas (for gradients used by lights). */
  canvas(key: string, c: HTMLCanvasElement): void;
  has(key: string): boolean;
}

export class PhaserTextureSink implements TextureSink {
  constructor(private readonly textures: Phaser.Textures.TextureManager) {}

  has(key: string): boolean {
    return this.textures.exists(key);
  }

  image(key: string, g: PixelGrid): void {
    this.replace(key);
    this.textures.addCanvas(key, toCanvas(g));
  }

  sheet(key: string, frames: readonly PixelGrid[], fw: number, fh: number, columns = frames.length): void {
    this.replace(key);
    const cols = Math.max(1, Math.min(columns, frames.length));
    const tex = this.textures.addCanvas(key, toCanvas(packFrames(frames, fw, fh, cols)));
    if (!tex) return;
    frames.forEach((_, i) => tex.add(i, 0, (i % cols) * fw, Math.floor(i / cols) * fh, fw, fh));
  }

  canvas(key: string, c: HTMLCanvasElement): void {
    this.replace(key);
    this.textures.addCanvas(key, c);
  }

  private replace(key: string): void {
    if (this.textures.exists(key)) this.textures.remove(key);
  }
}
