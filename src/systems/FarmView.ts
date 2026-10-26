// Draws tilled soil (autotiled, wet or dry) and crop sprites for the current
// map from GameState. Call refreshCell after changing one cell, or refresh()
// after overnight growth.

import Phaser from 'phaser';
import { DEPTH, RENDER } from '../config';
import { hiresTileset } from '../art/hires';
import { ITEM_TEXTURES, SOIL, SOIL_WET_OFFSET } from '../art/items';
import { cropDef, soilOf } from './farming';
import type { GameState } from './GameState';
import { worldDepth } from './MapRenderer';
import type { WorldMap } from './WorldMap';

const T = RENDER.tileSize;
/** Crop frames put the plant's base 2px above the bottom; the base sits this far into the cell. */
const CROP_BASE_Y = 13;
const CROP_FRAME_BASE = 2;

export class FarmView {
  private readonly tm: Phaser.Tilemaps.Tilemap;
  private readonly layer: Phaser.Tilemaps.TilemapLayer;
  private readonly crops = new Map<number, Phaser.GameObjects.Sprite>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly map: WorldMap,
    private readonly state: GameState,
  ) {
    this.tm = scene.make.tilemap({ tileWidth: T, tileHeight: T, width: map.w, height: map.h });
    const ts = this.tm.addTilesetImage('soil', ITEM_TEXTURES.soil, T, T, 0, 0, 1)!;
    this.layer = this.tm.createBlankLayer('soil', hiresTileset(ts), 0, 0, map.w, map.h)!;
    this.layer.setDepth(DEPTH.path + 0.2);
    this.refresh();
  }

  private get soil() {
    return soilOf(this.state, this.map.def.id);
  }

  isTilled(cx: number, cy: number): boolean {
    return this.map.inBounds(cx, cy) && !!this.soil[this.map.index(cx, cy)];
  }

  refresh(): void {
    this.layer.fill(-1);
    const live = new Set<number>();
    for (const key of Object.keys(this.soil)) {
      const cell = Number(key);
      live.add(cell);
      this.drawCell(cell);
    }
    for (const [cell, s] of this.crops)
      if (!live.has(cell)) {
        s.destroy();
        this.crops.delete(cell);
      }
  }

  /** Redraw a cell and its neighbours (their edges depend on it). */
  refreshCell(cx: number, cy: number): void {
    for (const [dx, dy] of [
      [0, 0],
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ]) {
      const x = cx + dx;
      const y = cy + dy;
      if (this.map.inBounds(x, y)) this.drawCell(this.map.index(x, y));
    }
  }

  private drawCell(cell: number): void {
    const cx = cell % this.map.w;
    const cy = Math.floor(cell / this.map.w);
    const t = this.soil[cell];
    if (!t) {
      this.layer.removeTileAt(cx, cy);
      this.crops.get(cell)?.destroy();
      this.crops.delete(cell);
      return;
    }
    const mask =
      (this.isTilled(cx, cy - 1) ? SOIL.N : 0) |
      (this.isTilled(cx + 1, cy) ? SOIL.E : 0) |
      (this.isTilled(cx, cy + 1) ? SOIL.S : 0) |
      (this.isTilled(cx - 1, cy) ? SOIL.W : 0);
    this.layer.putTileAt(1 + mask + (t.wet ? SOIL_WET_OFFSET : 0), cx, cy);

    let sprite = this.crops.get(cell);
    if (!t.crop) {
      sprite?.destroy();
      this.crops.delete(cell);
      return;
    }
    const def = cropDef(t.crop);
    const baseY = cy * T + CROP_BASE_Y;
    if (!sprite || sprite.texture.key !== def.texture) {
      sprite?.destroy();
      sprite = this.scene.add.sprite(cx * T + T / 2, baseY + CROP_FRAME_BASE, def.texture, 0).setOrigin(0.5, 1);
      sprite.setDepth(worldDepth(baseY));
      this.crops.set(cell, sprite);
    }
    sprite.setFrame(t.crop.stage);
  }

  /** Brief squash when a crop is planted, watered or picked. */
  bounce(cx: number, cy: number): void {
    const s = this.crops.get(this.map.index(cx, cy));
    if (!s) return;
    this.scene.tweens.killTweensOf(s);
    s.setScale(1, 1);
    this.scene.tweens.add({ targets: s, scaleY: 0.85, scaleX: 1.1, duration: 70, yoyo: true, ease: 'Quad.easeOut' });
  }

  /** Ripe crop cells, for sparkles. */
  ripeCells(): Array<[number, number]> {
    const out: Array<[number, number]> = [];
    for (const [key, t] of Object.entries(this.soil)) {
      if (!t.crop) continue;
      const def = cropDef(t.crop);
      if (t.crop.stage >= def.stageDays.length) {
        const cell = Number(key);
        out.push([cell % this.map.w, Math.floor(cell / this.map.w)]);
      }
    }
    return out;
  }

  destroy(): void {
    this.crops.forEach((s) => s.destroy());
    this.crops.clear();
    this.tm.destroy();
  }
}
