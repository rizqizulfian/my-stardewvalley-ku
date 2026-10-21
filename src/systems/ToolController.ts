// Turns "use the selected item" into world changes: picks the target cell
// (mouse within reach, otherwise the cell the player faces), shows the tile
// cursor, plays the swing and applies its effect at the moment of impact.

import Phaser from 'phaser';
import { DEPTH, FARM, PLAYER, RENDER, TOOL_TIMING } from '../config';
import { ITEM_TEXTURES } from '../art/items';
import { audio } from '../audio/AudioManager';
import { SEASONS } from '../config';
import { CROPS, inSeason } from '../data/crops';
import type { ToolKind } from '../data/items';
import { TERRAIN, isWaterTerrain } from '../data/terrain';
import type { ActionSpec, Player } from '../entities/Player';
import type { Effects } from './Effects';
import { EV, bus } from './events';
import { harvest, isRipe, plant, soilOf, till, water } from './farming';
import type { FarmView } from './FarmView';
import type { GameState } from './GameState';
import { itemDef, selectedStack, takeFromSlot } from './Inventory';
import { consume, spendToolEnergy } from './needs';
import type { RenderedMap } from './MapRenderer';
import type { PlacedProp, WorldMap } from './WorldMap';

const T = RENDER.tileSize;

interface Target {
  cx: number;
  cy: number;
}

export class ToolController {
  private readonly cursor: Phaser.GameObjects.Image;
  private readonly hp = new Map<PlacedProp, number>();
  private target: Target = { cx: 0, cy: 0 };
  private mouseAim = false;
  enabled = true;
  /** The action button on a usable prop (bed, bench, shop...). Returns true if handled. */
  onUseProp: (p: PlacedProp) => boolean = () => false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly state: GameState,
    private readonly map: WorldMap,
    private readonly rendered: RenderedMap,
    private readonly farm: FarmView,
    private readonly player: Player,
    private readonly fx: Effects,
  ) {
    this.cursor = scene.add.image(0, 0, ITEM_TEXTURES.cursor, 0).setOrigin(0, 0).setDepth(DEPTH.groundDecor + 0.8).setVisible(false);
  }

  private get mapId(): string {
    return this.map.def.id;
  }

  private playerCell(): Target {
    return { cx: Math.floor(this.player.x / T), cy: Math.floor((this.player.y - PLAYER.feetHeight / 2) / T) };
  }

  private facingCell(): Target {
    const r = FARM.facingReach;
    const f = this.player.facing;
    const px = this.player.x + (f === 'right' ? r : f === 'left' ? -r : 0);
    const py = this.player.y - PLAYER.feetHeight / 2 + (f === 'down' ? r : f === 'up' ? -r : 0);
    return { cx: Math.floor(px / T), cy: Math.floor(py / T) };
  }

  /** Recomputes the target from the pointer (if over the world and in reach) or the facing direction. */
  aim(pointer: Phaser.Input.Pointer | null): void {
    const pc = this.playerCell();
    this.mouseAim = false;
    if (pointer) {
      const wp = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const mc = { cx: Math.floor(wp.x / T), cy: Math.floor(wp.y / T) };
      if (Math.max(Math.abs(mc.cx - pc.cx), Math.abs(mc.cy - pc.cy)) <= FARM.reach && (mc.cx !== pc.cx || mc.cy !== pc.cy)) {
        this.target = mc;
        this.mouseAim = true;
        return;
      }
    }
    this.target = this.facingCell();
  }

  /** Cursor visibility and colour for the current target. */
  updateCursor(): void {
    const { cx, cy } = this.target;
    const st = selectedStack(this.state);
    const def = st ? itemDef(st.id) : null;
    const ripe = this.ripeAt(cx, cy);
    const show = this.enabled && this.map.inBounds(cx, cy) && (ripe || def?.kind === 'tool' || def?.kind === 'seed');
    this.cursor.setVisible(!!show);
    if (!show) return;
    this.cursor.setPosition(cx * T - 1, cy * T - 1);
    this.cursor.setFrame(ripe || this.wouldWork(def?.tool, def?.crop) ? 0 : 1);
  }

  private soilAt(cx: number, cy: number) {
    return this.map.inBounds(cx, cy) ? soilOf(this.state, this.mapId)[this.map.index(cx, cy)] : undefined;
  }

  private ripeAt(cx: number, cy: number): boolean {
    const t = this.soilAt(cx, cy);
    return !!t?.crop && isRipe(t.crop);
  }

  private isWater(cx: number, cy: number): boolean {
    return this.map.inBounds(cx, cy) && isWaterTerrain(TERRAIN[this.map.kindAt(cx, cy)]);
  }

  private wouldWork(tool: ToolKind | undefined, crop: string | undefined): boolean {
    const { cx, cy } = this.target;
    const prop = this.map.propAt(cx, cy);
    const soil = this.soilAt(cx, cy);
    if (crop) return !!soil && !soil.crop;
    switch (tool) {
      case 'hoe':
        return (this.map.canTill(cx, cy) && !soil) || !!prop?.def.breakable?.tools.includes('hoe');
      case 'can':
        return this.isWater(cx, cy) || prop?.def.use === 'well' || (!!soil && !soil.wet && this.state.water > 0);
      case 'axe':
        return !!prop && (!!prop.def.breakable?.tools.includes('axe') || !!prop.def.shakes);
      case 'pickaxe':
        return (!!prop && !!prop.def.breakable?.tools.includes('pickaxe')) || (!!soil && !soil.crop);
      case 'scythe':
        return !!prop?.def.breakable?.tools.includes('scythe');
      default:
        return false;
    }
  }

  /** Use the selected item on the target. Returns true if something started. */
  use(): boolean {
    if (!this.enabled || this.player.busy) return false;
    const { cx, cy } = this.target;
    if (this.mouseAim) this.player.face(cx * T + T / 2, cy * T + T / 2);
    if (this.ripeAt(cx, cy) && selectedStack(this.state)?.id !== 'scythe') return this.harvestAt(cx, cy);

    const st = selectedStack(this.state);
    if (!st) return false;
    const def = itemDef(st.id);
    if (def.kind === 'seed' && def.crop) return this.plantAt(cx, cy, def.crop);
    if (def.food) return this.eat();
    if (def.kind !== 'tool' || !def.tool) return false;
    return this.swing(def.tool, cx, cy);
  }

  /** The action button: pick a ripe crop, or use the prop in front (bed, bench, shop...). */
  interact(): boolean {
    if (!this.enabled || this.player.busy) return false;
    const { cx, cy } = this.target;
    if (this.ripeAt(cx, cy)) {
      if (this.mouseAim) this.player.face(cx * T + T / 2, cy * T + T / 2);
      return this.harvestAt(cx, cy);
    }
    const p = this.usablePropAt(cx, cy) ?? this.usablePropAt(this.facingCell().cx, this.facingCell().cy);
    if (p) return this.onUseProp(p);
    // Holding food: the action button eats it too.
    if (selectedStack(this.state) && itemDef(selectedStack(this.state)!.id).food) return this.eat();
    return false;
  }

  private usablePropAt(cx: number, cy: number): PlacedProp | null {
    if (!this.map.inBounds(cx, cy)) return null;
    const p = this.map.propAt(cx, cy);
    return p?.def.use ? p : null;
  }

  /** Eat or drink one of the selected item. */
  private eat(): boolean {
    const st = selectedStack(this.state);
    const food = st ? itemDef(st.id).food : undefined;
    if (!st || !food) return false;
    const slot = this.state.selected;
    return this.player.act({
      tool: null,
      frames: [140, 260],
      impact: 0,
      onImpact: () => {
        if (takeFromSlot(this.state, slot, 1) < 1) return;
        consume(this.state, food);
        audio.playSfx(food.drink ? 'drink' : 'eat', 0.9);
        this.fx.burst('spark', this.player.x, this.player.y - 18, { count: 3, spread: 8, up: 20, z: 4, gravity: 0, life: 600 });
      },
    });
  }

  get targetCell(): Target {
    return this.target;
  }

  // -------------------------------------------------------------------------

  private center(cx: number, cy: number): [number, number] {
    return [cx * T + T / 2, cy * T + T / 2];
  }

  private harvestAt(cx: number, cy: number): boolean {
    return this.player.act({
      tool: null,
      frames: [80, 160],
      impact: 0,
      onImpact: () => {
        const got = harvest(this.state, this.mapId, this.map.index(cx, cy));
        if (!got) return;
        const [x, y] = this.center(cx, cy);
        audio.playSfx('harvest', 0.9);
        this.fx.burst('leaf', x, y + 2, { count: 5, spread: 30, up: 50 });
        this.fx.drop(got.item, got.qty, x, y + 4);
        this.farm.refreshCell(cx, cy);
        this.farm.bounce(cx, cy);
      },
    });
  }

  private plantAt(cx: number, cy: number, crop: string): boolean {
    const soil = this.soilAt(cx, cy);
    if (!soil || soil.crop || !CROPS[crop]) {
      audio.playSfx('bonk', 0.5);
      return false;
    }
    if (!inSeason(CROPS[crop], this.state.season)) {
      audio.playSfx('bonk', 0.5);
      bus.emit(EV.notice, `${CROPS[crop].name} won't grow in ${SEASONS[this.state.season]}.`);
      return false;
    }
    return this.player.act({
      tool: null,
      frames: [60, 120],
      impact: 0,
      onImpact: () => {
        if (!plant(this.state, this.mapId, this.map.index(cx, cy), crop)) return;
        takeFromSlot(this.state, this.state.selected, 1);
        const [x, y] = this.center(cx, cy);
        audio.playSfx('plant', 0.9);
        this.fx.burst('clod', x, y + 3, { count: 4, spread: 18, up: 35 });
        this.farm.refreshCell(cx, cy);
        this.farm.bounce(cx, cy);
      },
    });
  }

  private swing(tool: ToolKind, cx: number, cy: number): boolean {
    const timing = tool === 'can' ? TOOL_TIMING.can : tool === 'scythe' ? TOOL_TIMING.scythe : TOOL_TIMING.swing;
    const spec: ActionSpec = {
      tool,
      frames: timing.frames,
      impact: timing.impact,
      onImpact: () => this.impact(tool, cx, cy),
    };
    if (this.player.busy) return false;
    if (!spendToolEnergy(this.state, tool)) {
      audio.playSfx('bonk', 0.4);
      return false;
    }
    this.player.act(spec);
    if (tool === 'scythe') audio.playSfx('swish', 0.8);
    else if (tool !== 'can') audio.playSfx('swing', 0.6);
    return true;
  }

  private impact(tool: ToolKind, cx: number, cy: number): void {
    const [x, y] = this.center(cx, cy);
    if (tool === 'scythe') {
      // The scythe sweeps an arc: the target and the cells either side of it.
      const f = this.player.facing;
      const side = f === 'up' || f === 'down' ? [[-1, 0], [1, 0]] : [[0, -1], [0, 1]];
      for (const [dx, dy] of [[0, 0], ...side]) this.scythe(cx + dx, cy + dy);
      return;
    }
    const prop = this.map.propAt(cx, cy);
    if (prop && (prop.def.breakable?.tools.includes(tool) || (tool === 'axe' && prop.def.shakes))) {
      this.hitProp(prop, tool);
      return;
    }
    switch (tool) {
      case 'hoe': {
        if (!this.map.canTill(cx, cy) || this.soilAt(cx, cy)) {
          audio.playSfx('bonk', 0.4);
          return;
        }
        till(this.state, this.mapId, this.map.index(cx, cy));
        this.rendered.clearDecor(cx, cy);
        this.farm.refreshCell(cx, cy);
        audio.playSfx('hoe', 0.9);
        this.fx.burst('clod', x, y + 2, { count: 7, spread: 34, up: 60 });
        return;
      }
      case 'can': {
        if (this.isWater(cx, cy) || this.map.propAt(cx, cy)?.def.use === 'well') {
          this.state.water = FARM.canCapacity;
          bus.emit(EV.inventoryChanged);
          audio.playSfx('refill', 0.9);
          this.fx.burst('drop', x, y, { count: 6, spread: 25, up: 55 });
          bus.emit(EV.notice, 'Watering can filled');
          return;
        }
        if (this.state.water <= 0) {
          audio.playSfx('canEmpty', 0.8);
          bus.emit(EV.notice, 'The watering can is empty');
          return;
        }
        this.state.water--;
        bus.emit(EV.inventoryChanged);
        audio.playSfx('water', 0.9);
        this.fx.burst('drop', x, y + 2, { count: 9, spread: 16, up: 10, z: 10, gravity: 320 });
        if (water(this.state, this.mapId, this.map.index(cx, cy))) {
          this.farm.refreshCell(cx, cy);
          this.farm.bounce(cx, cy);
        }
        return;
      }
      case 'pickaxe': {
        const soil = this.soilAt(cx, cy);
        if (soil && !soil.crop) {
          // Fill tilled soil back in.
          delete soilOf(this.state, this.mapId)[this.map.index(cx, cy)];
          this.farm.refreshCell(cx, cy);
          audio.playSfx('hoe', 0.6);
          this.fx.burst('clod', x, y + 2, { count: 5, spread: 25, up: 40 });
          return;
        }
        audio.playSfx('bonk', 0.4);
        return;
      }
      default:
        return;
    }
  }

  private scythe(cx: number, cy: number): void {
    if (!this.map.inBounds(cx, cy)) return;
    const prop = this.map.propAt(cx, cy);
    if (prop?.def.breakable?.tools.includes('scythe')) this.hitProp(prop, 'scythe');
    else if (this.ripeAt(cx, cy)) {
      const got = harvest(this.state, this.mapId, this.map.index(cx, cy));
      if (!got) return;
      const [x, y] = this.center(cx, cy);
      audio.playSfx('harvest', 0.7);
      this.fx.drop(got.item, got.qty, x, y + 4);
      this.farm.refreshCell(cx, cy);
    }
  }

  private propCenter(p: PlacedProp): [number, number] {
    const d = p.def;
    return [p.cx * T + (d.footprint.w * T) / 2, (p.cy + 1) * T - Math.min(d.footprint.h * T, T) / 2];
  }

  private hitProp(p: PlacedProp, tool: ToolKind): void {
    const [x, y] = this.propCenter(p);
    const b = p.def.breakable;
    if (!b) {
      // Trees: a shake and a flurry of leaves.
      this.rendered.shakeProp(p, 1);
      audio.playSfx('chop', 0.8);
      audio.playSfx('leaves', 0.6);
      this.fx.burst('leaf', x, y + 4, { count: 6, spread: 26, up: 20, z: 22, gravity: 60, life: 1300 });
      return;
    }
    const left = (this.hp.get(p) ?? b.hits) - 1;
    this.fx.burst(b.bit, x, y + 3, { count: 5, spread: 30, up: 55 });
    if (left > 0) {
      this.hp.set(p, left);
      this.rendered.shakeProp(p, tool === 'scythe' ? 1 : 2);
      audio.playSfx(b.hitSfx, 0.9);
      return;
    }
    this.hp.delete(p);
    audio.playSfx(b.breakSfx, 0.9);
    this.fx.burst(b.bit, x, y + 3, { count: 10, spread: 45, up: 70 });
    (this.state.removed[this.mapId] ??= []).push(this.map.index(p.cx, p.cy));
    this.map.removeProp(p);
    this.rendered.removeProp(p);
    for (const [id, lo, hi] of b.drops) {
      const qty = lo + Math.floor(Math.random() * (hi - lo + 1));
      if (qty > 0) this.fx.drop(id, qty, x, y + 3);
    }
  }

  destroy(): void {
    this.cursor.destroy();
  }
}
