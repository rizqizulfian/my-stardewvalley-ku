// Detailed world art from Zulfian's sprite sheet (tools/build_world.py writes
// public/sprites/world/<key>.png). Each PNG replaces the generated texture of
// the same key and is drawn HIRES_RES times denser than the game grid, like
// Alvira 2.0: frames keep their game-pixel size and position, only the
// pixels inside them are finer. Keys without a PNG keep the generated art.

import type Phaser from 'phaser';

export const HIRES_RES = 4;

/** Textures with a hi-res PNG; must match the files tools/build_world.py writes. */
export const HIRES_KEYS = [
  'tiles-grass',
  'tiles-meadow',
  'tiles-path',
  'tiles-sand',
  'tiles-paved',
  'tiles-water',
  'tiles-deep-water',
  'tiles-sea',
  'tiles-soil',
  'decor-tuft',
  'decor-reeds',
  'prop-tree-round',
  'prop-tree-fruit',
  'prop-tree-fruit-bare',
  'prop-tree-slender',
  'prop-palm',
  'prop-palm-bare',
  'prop-banana',
  'prop-banana-bare',
  'prop-bush',
  'prop-bush-berry',
  'prop-rock',
  'prop-boulder',
  'prop-stump',
  'prop-fence',
  'prop-lamp',
  'prop-lamp-lit',
  'prop-mailbox',
  'prop-well',
  'prop-bench',
  'prop-crate',
  'prop-house',
  'prop-house-lit',
  'prop-shop',
  'prop-shop-lit',
  'crop-matahari',
  'crop-mawar',
  'farm-hive',
  'farm-hive-empty',
  'farm-hay-bale',
  'farm-windmill',
  'farm-animal-barn',
  'farm-animal-barn-lit',
] as const;

const srcKey = (key: string) => `hires-src:${key}`;

export function preloadHires(load: Phaser.Loader.LoaderPlugin): void {
  for (const key of HIRES_KEYS) load.image(srcKey(key), `sprites/world/${key}.png`);
}

interface HiresTexture {
  img: HTMLImageElement;
  canvas: HTMLCanvasElement;
  source: Phaser.Textures.TextureSource;
  frames: Array<{ x: number; y: number; w: number; h: number }>;
}

const loaded: HiresTexture[] = [];
let density = 0;

/**
 * Swaps each generated texture for its hi-res PNG. The texture source reports
 * game-pixel size, so frames (and every sprite using them) keep their old
 * size while the GPU samples the denser image. The image is redrawn at the
 * canvas's render scale (see setHiresDensity), so each texel lands on one
 * canvas pixel instead of being skipped or doubled.
 */
export function applyHires(textures: Phaser.Textures.TextureManager, renderScale: number): void {
  for (const key of HIRES_KEYS) {
    if (!textures.exists(srcKey(key)) || !textures.exists(key)) continue;
    const old = textures.get(key);
    const w = old.source[0].width;
    const h = old.source[0].height;
    const img = textures.get(srcKey(key)).getSourceImage() as HTMLImageElement;
    if (img.width !== w * HIRES_RES || img.height !== h * HIRES_RES) {
      console.warn(`[hires] ${key}: ${img.width}x${img.height}, expected ${w * HIRES_RES}x${h * HIRES_RES}; keeping the generated art`);
      continue;
    }
    const names = old.getFrameNames();
    const frames = names.map((name) => old.get(name)).map((f) => ({ x: f.cutX, y: f.cutY, w: f.cutWidth, h: f.cutHeight }));
    if (!frames.length) frames.push({ x: 0, y: 0, w, h });
    const canvas = document.createElement('canvas');
    textures.remove(key);
    const tex = textures.addCanvas(key, canvas)!;
    const source = tex.source[0];
    names.forEach((name, i) => tex.add(name, 0, frames[i].x, frames[i].y, frames[i].w, frames[i].h));
    loaded.push({ img, canvas, source, frames });
    textures.remove(srcKey(key));
  }
  setHiresDensity(renderScale);
}

/** Redraws every hi-res texture at `scale` texels per game pixel (1..HIRES_RES). */
export function setHiresDensity(scale: number): void {
  const d = Math.max(1, Math.min(HIRES_RES, Math.round(scale)));
  if (d === density) return;
  density = d;
  for (const t of loaded) {
    const w = t.img.width / HIRES_RES;
    const h = t.img.height / HIRES_RES;
    drawAt(t, d);
    t.source.update();
    t.source.width = w;
    t.source.height = h;
    t.source.resolution = d;
    for (const f of t.source.texture.getFramesFromTextureSource(0, true)) {
      if (f.name === '__BASE') f.setSize(w, h);
      else f.setSize(f.cutWidth, f.cutHeight, f.cutX, f.cutY);
    }
  }
}

/** Shrinks each frame on its own (so tiles don't bleed into their neighbours), with hard alpha. */
function drawAt(t: HiresTexture, d: number): void {
  const { img, canvas, frames } = t;
  canvas.width = (img.width / HIRES_RES) * d;
  canvas.height = (img.height / HIRES_RES) * d;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (d === HIRES_RES) {
    ctx.drawImage(img, 0, 0);
    return;
  }
  for (const f of frames) {
    // Halve while that still fits (a clean 2x2 average), then one smooth step to the size.
    let sw = f.w * HIRES_RES;
    let sh = f.h * HIRES_RES;
    const cell = document.createElement('canvas');
    cell.width = sw;
    cell.height = sh;
    cell.getContext('2d')!.drawImage(img, f.x * HIRES_RES, f.y * HIRES_RES, sw, sh, 0, 0, sw, sh);
    let src: HTMLCanvasElement = cell;
    let sx = 0;
    let sy = 0;
    while (sw / 2 >= f.w * d && sw % 2 === 0 && sh % 2 === 0) {
      const half = document.createElement('canvas');
      half.width = sw / 2;
      half.height = sh / 2;
      const hc = half.getContext('2d')!;
      hc.imageSmoothingEnabled = true;
      hc.imageSmoothingQuality = 'high';
      hc.drawImage(src, sx, sy, sw, sh, 0, 0, half.width, half.height);
      src = half;
      sx = sy = 0;
      sw = half.width;
      sh = half.height;
    }
    ctx.imageSmoothingEnabled = sw !== f.w * d;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, sx, sy, sw, sh, f.x * d, f.y * d, f.w * d, f.h * d);
  }
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = data.data;
  for (let i = 3; i < px.length; i += 4) px[i] = px[i] >= 128 ? 255 : 0;
  ctx.putImageData(data, 0, 0);
}

/**
 * Tilemap layers size their texture coordinates by the GL texture's real
 * width, so a hi-res tileset gets a view of its GL texture that reports the
 * game-pixel size.
 */
export function hiresTileset(ts: Phaser.Tilemaps.Tileset): Phaser.Tilemaps.Tileset {
  const source = ts.image?.source[0];
  if (!source || !ts.glTexture || !loaded.some((t) => t.source === source)) return ts;
  (ts as { glTexture: unknown }).glTexture = Object.create(ts.glTexture, {
    width: { value: source.width },
    height: { value: source.height },
  });
  return ts;
}
