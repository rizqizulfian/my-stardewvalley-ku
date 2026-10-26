// Turns a WorldMap into Phaser objects: tile layers (ground, grass patches,
// dual-grid paths and water, cliffs), Y-sorted props with shadows, scattered
// decor, emissive night overlays and light sprites. Also animates water and
// wind sway.

import Phaser from 'phaser';
import { ATMOSPHERE, DEPTH, RENDER } from '../config';
import { hiresTileset } from '../art/hires';
import { hash2, valueNoise } from '../art/pixel';
import {
  CLIFF_TILE,
  CORNER,
  DOCK_TILE,
  DUAL_TILE_COUNT,
  FULL_VARIANTS,
  GRASS_VARIANTS,
  INTERIOR_STYLES,
  INTERIOR_TILE,
  WATER_TILES_PER_FRAME,
  TERRAIN_TEXTURES,
  WATER_FRAMES,
} from '../art/terrain';
import { FLOWER_VARIANTS, PEBBLE_VARIANTS, PROP_TEXTURES } from '../art/props';
import { TERRAIN } from '../data/terrain';
import type { PlacedProp, WorldMap } from './WorldMap';

const T = RENDER.tileSize;
const HALF = T / 2;

const GID = {
  grass: 1,
  meadow: 100,
  path: 200,
  water: 300,
  deep: 500,
  cliff: 600,
  sand: 700,
  paved: 800,
  sea: 900,
  interior: 1100,
  dock: 1200,
} as const;

export interface Swayer {
  sprite: Phaser.GameObjects.Sprite;
  x: number;
  /** Trees move more slowly than grass. */
  slow: boolean;
}

export interface NightLight {
  image: Phaser.GameObjects.Image;
  baseScale: number;
  flicker: number;
}

/** The display objects that belong to one placed prop. */
export interface PropView {
  sprite: Phaser.GameObjects.Sprite;
  /** Everything else: shadow, emissive overlay, lights. */
  extras: Phaser.GameObjects.GameObject[];
  baseX: number;
}

export interface RenderedMap {
  swayers: Swayer[];
  emissives: Phaser.GameObjects.Image[];
  lights: NightLight[];
  /** Tree sprites, used to spawn falling leaves. */
  trees: Phaser.GameObjects.Sprite[];
  propViews: Map<PlacedProp, PropView>;
  /** Removes a cleared prop's sprites. */
  removeProp(p: PlacedProp): void;
  /** Removes flowers, tufts and pebbles from a cell (e.g. when it is tilled). */
  clearDecor(cx: number, cy: number): void;
  /** A short sideways shake, for tool hits. */
  shakeProp(p: PlacedProp, strength?: number): void;
  /** Swaps a prop's texture (same frames), e.g. a fruit tree after picking. */
  setPropTexture(p: PlacedProp, texture: string): void;
  update(timeMs: number): void;
  destroy(): void;
}

export function worldDepth(bottomY: number): number {
  return DEPTH.worldBase + bottomY;
}

/** `bare` cells get no scattered decor (tilled soil). */
export function renderMap(scene: Phaser.Scene, map: WorldMap, bare: (cx: number, cy: number) => boolean = () => false): RenderedMap {
  const objects: Phaser.GameObjects.GameObject[] = [];
  const tm = scene.make.tilemap({ tileWidth: T, tileHeight: T, width: map.w + 1, height: map.h + 1 });
  const ts = {
    grass: hiresTileset(tm.addTilesetImage('grass', TERRAIN_TEXTURES.grass, T, T, 0, 0, GID.grass)!),
    meadow: hiresTileset(tm.addTilesetImage('meadow', TERRAIN_TEXTURES.meadow, T, T, 0, 0, GID.meadow)!),
    path: hiresTileset(tm.addTilesetImage('path', TERRAIN_TEXTURES.path, T, T, 0, 0, GID.path)!),
    water: hiresTileset(tm.addTilesetImage('water', TERRAIN_TEXTURES.water, T, T, 0, 0, GID.water)!),
    deep: hiresTileset(tm.addTilesetImage('deep', TERRAIN_TEXTURES.deepWater, T, T, 0, 0, GID.deep)!),
    cliff: hiresTileset(tm.addTilesetImage('cliff', TERRAIN_TEXTURES.cliff, T, T, 0, 0, GID.cliff)!),
    sand: hiresTileset(tm.addTilesetImage('sand', TERRAIN_TEXTURES.sand, T, T, 0, 0, GID.sand)!),
    paved: hiresTileset(tm.addTilesetImage('paved', TERRAIN_TEXTURES.paved, T, T, 0, 0, GID.paved)!),
    sea: hiresTileset(tm.addTilesetImage('sea', TERRAIN_TEXTURES.sea, T, T, 0, 0, GID.sea)!),
    interior: hiresTileset(tm.addTilesetImage('interior', TERRAIN_TEXTURES.interior, T, T, 0, 0, GID.interior)!),
    dock: hiresTileset(tm.addTilesetImage('dock', TERRAIN_TEXTURES.dock, T, T, 0, 0, GID.dock)!),
  };
  const layer = (name: string, tileset: Phaser.Tilemaps.Tileset, dual: boolean, depth: number) => {
    const l = tm.createBlankLayer(name, tileset, dual ? -HALF : 0, dual ? -HALF : 0, map.w + (dual ? 1 : 0), map.h + (dual ? 1 : 0))!;
    l.setDepth(depth);
    return l;
  };
  const ground = layer('ground', ts.grass, false, DEPTH.ground);
  const interior = layer('interior', ts.interior, false, DEPTH.ground + 0.05);
  const meadow = layer('meadow', ts.meadow, true, DEPTH.ground + 0.1);
  const sand = layer('sand', ts.sand, true, DEPTH.ground + 0.15);
  const path = layer('path', ts.path, true, DEPTH.path);
  const paved = layer('paved', ts.paved, true, DEPTH.path + 0.05);
  const water = layer('water', ts.water, true, DEPTH.water);
  const sea = layer('sea', ts.sea, true, DEPTH.water + 0.05);
  const deep = layer('deep', ts.deep, true, DEPTH.water + 0.1);
  const dock = layer('dock', ts.dock, false, DEPTH.water + 0.3);
  const cliffShadow = layer('cliffShadow', ts.cliff, false, DEPTH.cliff - 0.2);
  const edges = layer('edges', ts.cliff, false, DEPTH.cliff - 0.1);
  const edgesN = layer('edgesN', ts.cliff, false, DEPTH.cliff - 0.05);
  const cliff = layer('cliff', ts.cliff, false, DEPTH.cliff);

  const seed = map.def.seed;

  // Interiors: floor boards, wall faces two cells tall, black void around the room.
  const style = Math.max(0, INTERIOR_STYLES.indexOf(map.def.interiorStyle ?? 'home')) * INTERIOR_TILE.altOffset;
  const kindIs = (x: number, y: number, k: 'floor' | 'wall' | 'void') => map.inBounds(x, y) && TERRAIN[map.kindAt(x, y)].interior === k;
  for (let y = 0; y < map.h; y++)
    for (let x = 0; x < map.w; x++) {
      const t = TERRAIN[map.kindAt(x, y)];
      if (t.interior === 'void') interior.putTileAt(GID.interior + style + INTERIOR_TILE.void, x, y);
      else if (t.interior === 'wall') {
        const f = !kindIs(x, y + 1, 'wall') ? INTERIOR_TILE.wallLower : !kindIs(x, y - 1, 'wall') ? INTERIOR_TILE.wallTop : INTERIOR_TILE.wallUpper;
        interior.putTileAt(GID.interior + style + f, x, y);
      } else if (t.interior === 'floor') {
        let f: number = Math.floor(hash2(x, y, seed) * INTERIOR_TILE.floorVariants);
        if (kindIs(x, y - 1, 'wall')) f = INTERIOR_TILE.floorShadowTop;
        else if (kindIs(x - 1, y, 'void') || kindIs(x - 1, y, 'wall')) f = INTERIOR_TILE.floorShadowLeft;
        else if (kindIs(x + 1, y, 'void') || kindIs(x + 1, y, 'wall')) f = INTERIOR_TILE.floorShadowRight;
        interior.putTileAt(GID.interior + style + f, x, y);
      }
    }

  // Ground: grass variants, mostly plain so detail stays readable.
  for (let y = 0; y < map.h; y++)
    for (let x = 0; x < map.w; x++) {
      if (TERRAIN[map.kindAt(x, y)].interior) continue;
      const r = hash2(x, y, seed);
      const v = r < 0.45 ? 0 : 1 + Math.floor(hash2(x, y, seed + 1) * (GRASS_VARIANTS - 1));
      ground.putTileAt(GID.grass + v, x, y);
    }

  // Dual-grid layers: display tile (i, j) has its corners at cells (i-1, j-1) .. (i, j).
  const meadowCell = (x: number, y: number) =>
    !!TERRAIN[map.kindAt(x, y)].decor && valueNoise(x / 4.5, y / 4.5, seed + 9) < map.def.decor.meadow;
  const pathCell = (x: number, y: number) => !!TERRAIN[map.kindAt(x, y)].path;
  const waterCell = (x: number, y: number) => !!TERRAIN[map.kindAt(x, y)].water;
  const sandCell = (x: number, y: number) => !!TERRAIN[map.kindAt(x, y)].sand;
  const pavedCell = (x: number, y: number) => !!TERRAIN[map.kindAt(x, y)].paved;
  const seaCell = (x: number, y: number) => !!TERRAIN[map.kindAt(x, y)].sea;
  const maskAt = (i: number, j: number, test: (x: number, y: number) => boolean) =>
    (test(i - 1, j - 1) ? CORNER.TL : 0) | (test(i, j - 1) ? CORNER.TR : 0) | (test(i - 1, j) ? CORNER.BL : 0) | (test(i, j) ? CORNER.BR : 0);

  // Fully covered tiles pick one of several variants so repeats are not obvious.
  const FULL = 15;
  const fullVariant = (i: number, j: number, salt: number) =>
    hash2(i, j, seed + salt) < 0.4 ? FULL : DUAL_TILE_COUNT + Math.floor(hash2(i, j, seed + salt + 1) * FULL_VARIANTS);
  // Deep water: cells whose whole neighbourhood is water.
  const deepCell = (x: number, y: number) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (!waterCell(x + dx, y + dy)) return false;
    return true;
  };
  const deepSeaCell = (x: number, y: number) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (!seaCell(x + dx, y + dy)) return false;
    return true;
  };
  const waterTiles: Array<{ i: number; j: number; tile: number }> = [];
  const seaTiles: Array<{ i: number; j: number; tile: number }> = [];
  for (let j = 0; j <= map.h; j++)
    for (let i = 0; i <= map.w; i++) {
      const sm = maskAt(i, j, sandCell);
      if (sm) sand.putTileAt(GID.sand + (sm === FULL ? fullVariant(i, j, 41) : sm), i, j);
      const vm = maskAt(i, j, pavedCell);
      if (vm) paved.putTileAt(GID.paved + vm, i, j);
      const om = maskAt(i, j, seaCell);
      if (om) {
        const tile = om === FULL ? fullVariant(i, j, 43) : om;
        sea.putTileAt(GID.sea + tile, i, j);
        seaTiles.push({ i, j, tile });
      }
      const dsm = maskAt(i, j, deepSeaCell);
      if (dsm) deep.putTileAt(GID.deep + dsm, i, j);
      const mm = maskAt(i, j, meadowCell);
      if (mm) meadow.putTileAt(GID.meadow + (mm === FULL ? fullVariant(i, j, 31) : mm), i, j);
      const pm = maskAt(i, j, pathCell);
      if (pm) path.putTileAt(GID.path + pm, i, j);
      const wm = maskAt(i, j, waterCell);
      if (wm) {
        const tile = wm === FULL ? fullVariant(i, j, 37) : wm;
        water.putTileAt(GID.water + tile, i, j);
        waterTiles.push({ i, j, tile });
      }
      const dm = maskAt(i, j, deepCell);
      if (dm) deep.putTileAt(GID.deep + dm, i, j);
    }

  // Cliffs, stairs, plateau edges and the shadow a cliff casts below it.
  for (let y = 0; y < map.h; y++)
    for (let x = 0; x < map.w; x++) {
      const k = map.kindAt(x, y);
      const t = TERRAIN[k];
      if (t.cliff) {
        // Faces are two cells tall: the upper half sits under the plateau edge.
        const half = TERRAIN[map.kindAt(x, y - 1)].cliff && y > 0 ? 1 : 0;
        if (t.stairs) cliff.putTileAt(GID.cliff + CLIFF_TILE.stairs + half, x, y);
        else {
          // A cliff that runs off the map edge has no end cap there.
          const l = x > 0 && !TERRAIN[map.kindAt(x - 1, y)].cliff;
          const r = x < map.w - 1 && !TERRAIN[map.kindAt(x + 1, y)].cliff;
          const frame = l && r ? CLIFF_TILE.faceSingle : l ? CLIFF_TILE.faceLeft : r ? CLIFF_TILE.faceRight : CLIFF_TILE.faceMid;
          cliff.putTileAt(GID.cliff + frame + half, x, y);
        }
        if (y + 1 < map.h && !TERRAIN[map.kindAt(x, y + 1)].cliff && !t.stairs) cliffShadow.putTileAt(GID.cliff + CLIFF_TILE.shadowBelow, x, y + 1);
        continue;
      }
      if (t.elevation > 0) {
        const lower = (dx: number, dy: number) => {
          if (!map.inBounds(x + dx, y + dy)) return false;
          const n = TERRAIN[map.kindAt(x + dx, y + dy)];
          return n.elevation < t.elevation && !n.cliff;
        };
        if (lower(1, 0)) edges.putTileAt(GID.cliff + CLIFF_TILE.edgeEast, x, y);
        else if (lower(-1, 0)) edges.putTileAt(GID.cliff + CLIFF_TILE.edgeWest, x, y);
        if (lower(0, -1)) edgesN.putTileAt(GID.cliff + CLIFF_TILE.edgeNorth, x, y);
      }
    }

  // Pier planks.
  for (let y = 0; y < map.h; y++)
    for (let x = 0; x < map.w; x++) {
      if (!TERRAIN[map.kindAt(x, y)].dock) continue;
      const isDock = (cx: number, cy: number) => map.inBounds(cx, cy) && !!TERRAIN[map.kindAt(cx, cy)].dock;
      const open = (isDock(x - 1, y) ? 0 : DOCK_TILE.left) | (isDock(x + 1, y) ? 0 : DOCK_TILE.right) | (isDock(x, y + 1) ? 0 : DOCK_TILE.end);
      dock.putTileAt(GID.dock + open, x, y);
    }

  // Props.
  const swayers: Swayer[] = [];
  const emissives: Phaser.GameObjects.Image[] = [];
  const lights: NightLight[] = [];
  const trees: Phaser.GameObjects.Sprite[] = [];
  const animated: Array<{ sprite: Phaser.GameObjects.Sprite; frames: number; ms: number; phase: number }> = [];
  const propViews = new Map<PlacedProp, PropView>();
  for (const p of map.props) {
    const d = p.def;
    const jitter = d.jitter ? Math.round((hash2(p.cx, p.cy, seed + 3) - 0.5) * 2 * d.jitter) : 0;
    const x = p.cx * T + (d.footprint.w * T) / 2 + jitter + (d.offsetX ?? 0);
    const y = (p.cy + 1) * T + (d.offsetY ?? 0);
    const frame = d.connects ? p.connections : d.sway ? 1 : (d.frame ?? 0);
    const s = scene.add.sprite(x, y, d.texture, frame).setOrigin(0.5, 1);
    s.setDepth(d.flat ? DEPTH.groundDecor : worldDepth(y));
    objects.push(s);
    const view: PropView = { sprite: s, extras: [], baseX: x };
    propViews.set(p, view);
    if (d.shadow) {
      const sh = scene.add.image(x, y - 1 + (d.shadowOffsetY ?? 0), d.shadow).setOrigin(0.5, 0.5).setAlpha(0.35);
      sh.setDepth(DEPTH.groundDecor + 0.5);
      objects.push(sh);
      view.extras.push(sh);
    }
    if (d.anim) animated.push({ sprite: s, frames: d.anim.frames, ms: d.anim.ms, phase: Math.floor(hash2(p.cx, p.cy, 5) * d.anim.frames) });
    if (d.sway) {
      swayers.push({ sprite: s, x, slow: d.texture.includes('tree') });
      if (d.texture.includes('tree')) trees.push(s);
    }
    if (d.emissive) {
      const e = scene.add.image(x, y, d.emissive).setOrigin(0.5, 1).setDepth(s.depth + 0.01).setVisible(false);
      emissives.push(e);
      objects.push(e);
      view.extras.push(e);
    }
    for (const l of d.lights ?? []) {
      const img = scene.add
        .image(x + l.x, y + l.y, l.texture)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(DEPTH.lights)
        .setAlpha(0)
        .setScale(l.scale ?? 1);
      lights.push({ image: img, baseScale: l.scale ?? 1, flicker: hash2(p.cx, p.cy, 99) * 10 });
      objects.push(img);
      view.extras.push(img);
    }
  }

  // Decor per cell, so tilling can clear it.
  const decorCells = new Map<number, Phaser.GameObjects.GameObject[]>();
  const addDecor = (x: number, y: number, o: Phaser.GameObjects.GameObject) => {
    objects.push(o);
    const k = map.index(x, y);
    const list = decorCells.get(k);
    if (list) list.push(o);
    else decorCells.set(k, [o]);
  };

  // Scattered decor on open grass.
  const dec = map.def.decor;
  const nearWater = (x: number, y: number) =>
    [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ].some(([dx, dy]) => map.inBounds(x + dx, y + dy) && waterCell(x + dx, y + dy));
  for (let y = 0; y < map.h; y++)
    for (let x = 0; x < map.w; x++) {
      const t = TERRAIN[map.kindAt(x, y)];
      if (t.water && deepCell(x, y) && hash2(x, y, seed + 26) < dec.lilies) {
        const lx = x * T + 2 + Math.floor(hash2(x, y, seed + 27) * 6);
        const ly = y * T + 3 + Math.floor(hash2(x, y, seed + 28) * 6);
        objects.push(scene.add.image(lx, ly, PROP_TEXTURES.lily).setDepth(DEPTH.water + 0.2));
        continue;
      }
      if (t.decor && nearWater(x, y) && !map.occupied.has(map.index(x, y)) && hash2(x, y, seed + 29) < dec.reeds) {
        // Reeds lean out over the water's edge, on the side that touches it.
        const wx = waterCell(x + 1, y) ? 6 : waterCell(x - 1, y) ? -6 : 0;
        const wy = waterCell(x, y + 1) ? 7 : waterCell(x, y - 1) ? -3 : 0;
        const rx = x * T + T / 2 + wx;
        const ry = y * T + T - 2 + wy;
        const s = scene.add.sprite(rx, ry, PROP_TEXTURES.reeds, 1).setOrigin(0.5, 1).setDepth(worldDepth(ry));
        swayers.push({ sprite: s, x: rx, slow: false });
        addDecor(x, y, s);
        continue;
      }
      if (!t.decor || map.occupied.has(map.index(x, y)) || bare(x, y)) continue;
      // Keep a little space around cliffs.
      if (TERRAIN[map.kindAt(x, y - 1)].cliff) continue;
      const r = hash2(x, y, seed + 21);
      const px = x * T + 3 + Math.floor(hash2(x, y, seed + 22) * (T - 6));
      const py = y * T + 4 + Math.floor(hash2(x, y, seed + 23) * (T - 6));
      if (r < dec.flowers) {
        const f = Math.floor(hash2(x, y, seed + 24) * FLOWER_VARIANTS);
        addDecor(x, y, scene.add.image(px, py, PROP_TEXTURES.flowers, f).setDepth(DEPTH.groundDecor));
      } else if (r < dec.flowers + dec.tufts) {
        const s = scene.add.sprite(px, py + 4, PROP_TEXTURES.tuft, 1).setOrigin(0.5, 1);
        s.setDepth(worldDepth(py + 1));
        swayers.push({ sprite: s, x: px, slow: false });
        addDecor(x, y, s);
      } else if (r < dec.flowers + dec.tufts + dec.pebbles) {
        const f = Math.floor(hash2(x, y, seed + 25) * PEBBLE_VARIANTS);
        addDecor(x, y, scene.add.image(px, py, PROP_TEXTURES.pebbles, f).setDepth(DEPTH.groundDecor));
      }
    }

  // Animation state.
  let waterFrame = 0;
  let nextWater = 0;
  let nextSway = 0;

  const dropSprite = (o: Phaser.GameObjects.GameObject) => {
    const si = swayers.findIndex((w) => w.sprite === o);
    if (si >= 0) swayers.splice(si, 1);
    const ti = trees.indexOf(o as Phaser.GameObjects.Sprite);
    if (ti >= 0) trees.splice(ti, 1);
    const ei = emissives.indexOf(o as Phaser.GameObjects.Image);
    if (ei >= 0) emissives.splice(ei, 1);
    const li = lights.findIndex((l) => l.image === o);
    if (li >= 0) lights.splice(li, 1);
    const oi = objects.indexOf(o);
    if (oi >= 0) objects.splice(oi, 1);
    o.destroy();
  };

  return {
    swayers,
    emissives,
    lights,
    trees,
    propViews,
    removeProp(p: PlacedProp) {
      const v = propViews.get(p);
      if (!v) return;
      propViews.delete(p);
      scene.tweens.killTweensOf(v.sprite);
      dropSprite(v.sprite);
      v.extras.forEach(dropSprite);
    },
    clearDecor(cx: number, cy: number) {
      const k = map.index(cx, cy);
      decorCells.get(k)?.forEach(dropSprite);
      decorCells.delete(k);
    },
    shakeProp(p: PlacedProp, strength = 1) {
      const v = propViews.get(p);
      if (!v) return;
      scene.tweens.killTweensOf(v.sprite);
      v.sprite.x = v.baseX;
      // Whole-pixel steps keep the art crisp.
      const steps = [strength, -strength, Math.ceil(strength / 2), 0];
      let i = 0;
      scene.time.addEvent({
        delay: 45,
        repeat: steps.length - 1,
        callback: () => {
          if (v.sprite.active) v.sprite.x = v.baseX + steps[i++];
        },
      });
    },
    setPropTexture(p: PlacedProp, texture: string) {
      const v = propViews.get(p);
      if (v && v.sprite.texture.key !== texture) v.sprite.setTexture(texture, v.sprite.frame.name);
    },
    update(timeMs: number) {
      if (timeMs >= nextWater) {
        nextWater = timeMs + ATMOSPHERE.waterFrameMs;
        waterFrame = (waterFrame + 1) % WATER_FRAMES;
        for (const w of waterTiles) water.putTileAt(GID.water + waterFrame * WATER_TILES_PER_FRAME + w.tile, w.i, w.j);
        for (const w of seaTiles) sea.putTileAt(GID.sea + waterFrame * WATER_TILES_PER_FRAME + w.tile, w.i, w.j);
      }
      for (const a of animated) {
        const f = (Math.floor(timeMs / a.ms) + a.phase) % a.frames;
        if (a.sprite.active && a.sprite.frame.name !== String(f)) a.sprite.setFrame(f);
      }
      if (timeMs >= nextSway) {
        nextSway = timeMs + ATMOSPHERE.swayFrameMs / 3;
        // Gusts roll across the map as a travelling wave.
        const gust = 0.35 + 0.65 * Math.max(0, Math.sin(timeMs * 0.00025));
        for (const s of swayers) {
          const speed = s.slow ? 0.0011 : 0.0024;
          const v = Math.sin(timeMs * speed - s.x * 0.035) * gust;
          const f = v > 0.55 ? 2 : v < -0.55 ? 0 : 1;
          if (s.sprite.frame.name !== String(f)) s.sprite.setFrame(f);
        }
      }
    },
    destroy() {
      objects.forEach((o) => o.destroy());
      tm.destroy();
    },
  };
}
