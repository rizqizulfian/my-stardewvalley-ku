// Things to pick up by hand on the current map: the day's forage lying on the
// ground, and fruit on banana trees, palms and rose-apple trees (which grows
// back a few days after picking).

import Phaser from 'phaser';
import { DEPTH, RENDER } from '../config';
import { ITEM_TEXTURES, iconFrame } from '../art/items';
import { PROP_TEXTURES } from '../art/props';
import { audio } from '../audio/AudioManager';
import { itemDef } from './Inventory';
import type { Effects } from './Effects';
import { EV, bus } from './events';
import type { GameState } from './GameState';
import type { RenderedMap } from './MapRenderer';
import { worldDepth } from './MapRenderer';
import type { PlacedProp, WorldMap } from './WorldMap';

const T = RENDER.tileSize;

interface Lying {
  img: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
}

export class Gathering {
  private readonly lying = new Map<number, Lying>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly map: WorldMap,
    private readonly state: GameState,
    private readonly rendered: RenderedMap,
    private readonly fx: Effects,
  ) {
    for (const spot of state.forage[map.def.id] ?? []) {
      const x = spot.x * T + T / 2;
      const y = spot.y * T + T - 2;
      const shadow = scene.add.image(x, y, PROP_TEXTURES.shadowS).setAlpha(0.3).setDepth(DEPTH.groundDecor + 0.6);
      const img = scene.add.image(x, y, ITEM_TEXTURES.icons, iconFrame(itemDef(spot.id).icon)).setOrigin(0.5, 1).setDepth(worldDepth(y));
      this.lying.set(map.index(spot.x, spot.y), { img, shadow });
    }
    for (const p of map.props) if (p.def.pick && !this.hasFruit(p)) rendered.setPropTexture(p, p.def.pick.bare);
  }

  private get picked(): Record<number, number> {
    return (this.state.picked[this.map.def.id] ??= {});
  }

  hasFruit(p: PlacedProp): boolean {
    const when = this.picked[this.map.index(p.cx, p.cy)];
    return when === undefined || this.state.daysPlayed - when >= p.def.pick!.regrowDays;
  }

  /** Picks up forage lying on a cell. */
  pickUp(cx: number, cy: number): boolean {
    if (!this.map.inBounds(cx, cy)) return false;
    const i = this.map.index(cx, cy);
    const l = this.lying.get(i);
    if (!l) return false;
    const spots = this.state.forage[this.map.def.id] ?? [];
    const k = spots.findIndex((s) => s.x === cx && s.y === cy);
    const id = k >= 0 ? spots[k].id : null;
    if (k >= 0) spots.splice(k, 1);
    this.lying.delete(i);
    l.img.destroy();
    l.shadow.destroy();
    if (!id) return false;
    audio.playSfx('forage', 0.9);
    this.fx.drop(id, 1, cx * T + T / 2, cy * T + T - 2);
    return true;
  }

  /** Picks the fruit off a tree, or says when it grows back. */
  pickFruit(p: PlacedProp): boolean {
    const pick = p.def.pick;
    if (!pick) return false;
    if (!this.hasFruit(p)) {
      const left = pick.regrowDays - (this.state.daysPlayed - this.picked[this.map.index(p.cx, p.cy)]);
      bus.emit(EV.notice, `No ${itemDef(pick.item).name.toLowerCase()} left. More in ${left} day${left === 1 ? '' : 's'}.`);
      return true;
    }
    this.picked[this.map.index(p.cx, p.cy)] = this.state.daysPlayed;
    const qty = pick.min + Math.floor(Math.random() * (pick.max - pick.min + 1));
    this.rendered.shakeProp(p, 1);
    this.rendered.setPropTexture(p, pick.bare);
    if (pick.hive) audio.playSfx('buzz', 0.8);
    else {
      audio.playSfx('rustle', 0.8);
      this.fx.burst('leaf', p.cx * T + T / 2, p.cy * T, { count: 4, spread: 14, up: 10, z: 22 });
    }
    this.scene.time.delayedCall(120, () => audio.playSfx('harvest', 0.8));
    this.fx.drop(pick.item, qty, p.cx * T + T / 2, (p.cy + 1) * T);
    return true;
  }

  /** A glint now and then on forage, so it reads as something to take. */
  glint(): [number, number] | null {
    const spots = this.state.forage[this.map.def.id] ?? [];
    if (!spots.length) return null;
    const s = spots[Math.floor(Math.random() * spots.length)];
    return [s.x * T + T / 2, s.y * T + 6];
  }

  destroy(): void {
    for (const l of this.lying.values()) {
      l.img.destroy();
      l.shadow.destroy();
    }
    this.lying.clear();
  }
}
