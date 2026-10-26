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

/**
 * Swaps each generated texture for its hi-res PNG. The texture source reports
 * game-pixel size, so frames (and every sprite using them) keep their old
 * size while the GPU samples the denser image.
 */
export function applyHires(textures: Phaser.Textures.TextureManager): void {
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
    const frames = old
      .getFrameNames()
      .map((name) => ({ name, f: old.get(name) }))
      .map(({ name, f }) => ({ name, x: f.cutX, y: f.cutY, w: f.cutWidth, h: f.cutHeight }));
    textures.remove(key);
    const tex = textures.addImage(key, img)!;
    const source = tex.source[0];
    source.width = w;
    source.height = h;
    source.resolution = HIRES_RES;
    tex.get('__BASE').setSize(w, h);
    for (const f of frames) tex.add(f.name, 0, f.x, f.y, f.w, f.h);
    textures.remove(srcKey(key));
  }
}

/**
 * Tilemap layers size their texture coordinates by the GL texture's real
 * width, so a hi-res tileset gets a view of its GL texture that reports the
 * game-pixel size.
 */
export function hiresTileset(ts: Phaser.Tilemaps.Tileset): Phaser.Tilemaps.Tileset {
  const source = ts.image?.source[0];
  if (!source || source.resolution === 1 || !ts.glTexture) return ts;
  (ts as { glTexture: unknown }).glTexture = Object.create(ts.glTexture, {
    width: { value: source.width },
    height: { value: source.height },
  });
  return ts;
}
