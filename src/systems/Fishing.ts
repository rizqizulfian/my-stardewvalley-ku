// Fishing with the rod: cast at water in front of the player, wait for a
// bite, hook it in time, then land the fish with a timing meter (press while
// the marker is in the green zone; enough hits land it, too many misses and it
// escapes). Everything is drawn in world space above the player.

import Phaser from 'phaser';
import { DEPTH, PLAYER, RENDER, TOOL_TIMING } from '../config';
import { EMOTE, FX_TEXTURES } from '../art/fx';
import { ITEM_TEXTURES, iconFrame } from '../art/items';
import { hex } from '../art/palette';
import { audio } from '../audio/AudioManager';
import { FISHING, rollFish, type FishDef, type WaterKind } from '../data/fish';
import { TERRAIN, isWaterTerrain } from '../data/terrain';
import type { Player } from '../entities/Player';
import { PixelText } from '../ui/PixelText';
import type { Effects } from './Effects';
import { EV, bus } from './events';
import type { GameState } from './GameState';
import { addItem, itemDef } from './Inventory';
import { spendToolEnergy } from './needs';
import type { WorldMap } from './WorldMap';

const T = RENDER.tileSize;
const FLIGHT_MS = 360;
const LAND_HOLD_MS = 900;
const METER_H = 7;

type Phase = 'idle' | 'casting' | 'waiting' | 'bite' | 'reeling' | 'landing';

export class Fishing {
  private phase: Phase = 'idle';
  private readonly bobber: Phaser.GameObjects.Sprite;
  private readonly ripple: Phaser.GameObjects.Sprite;
  private readonly line: Phaser.GameObjects.Graphics;
  private readonly meter: Phaser.GameObjects.Graphics;
  private readonly hint: PixelText;
  private readonly emote: Phaser.GameObjects.Image;
  private readonly prize: Phaser.GameObjects.Image;
  private bx = 0;
  private by = 0;
  private water: WaterKind = 'pond';
  private t = 0;
  private biteAt = 0;
  private bobT = 0;
  private fish: FishDef | { item: string; junk: true } | null = null;
  private marker = 0;
  private dir = 1;
  private speed = 0;
  private zoneX = 0;
  private zoneW = 0;
  private hits = 0;
  private misses = 0;
  private flight: { t: number; x0: number; y0: number } | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly state: GameState,
    private readonly map: WorldMap,
    private readonly player: Player,
    private readonly fx: Effects,
  ) {
    const top = DEPTH.particlesAbove;
    this.line = scene.add.graphics().setDepth(top - 0.3);
    this.bobber = scene.add.sprite(0, 0, FX_TEXTURES.bobber, 0).setOrigin(0.5, 1).setVisible(false).setDepth(top - 0.2);
    this.ripple = scene.add.sprite(0, 0, FX_TEXTURES.ripple, 0).setOrigin(0.5, 0.5).setVisible(false).setDepth(DEPTH.water + 0.5);
    this.meter = scene.add.graphics().setDepth(top + 0.1);
    this.hint = new PixelText(scene, 0, 0, 'SPACE in the green!', { color: 'cream', outline: 'night' }).setDepth(top + 0.1).setVisible(false);
    this.emote = scene.add.image(0, 0, FX_TEXTURES.emote, EMOTE.alert).setOrigin(0.5, 1).setDepth(top + 0.2).setVisible(false);
    this.prize = scene.add.image(0, 0, ITEM_TEXTURES.icons, 0).setOrigin(0.5, 1).setDepth(top + 0.2).setVisible(false);
  }

  get active(): boolean {
    return this.phase !== 'idle';
  }

  /** The water cell to cast at: up to castCells ahead, a little past the bank. */
  private findWater(): { cx: number; cy: number; sea: boolean } | null {
    const f = this.player.facing;
    const [dx, dy] = f === 'up' ? [0, -1] : f === 'down' ? [0, 1] : f === 'left' ? [-1, 0] : [1, 0];
    const px = Math.floor(this.player.x / T);
    const py = Math.floor((this.player.y - PLAYER.feetHeight / 2) / T);
    const wet = (x: number, y: number) => this.map.inBounds(x, y) && isWaterTerrain(TERRAIN[this.map.kindAt(x, y)]);
    for (let d = 1; d <= FISHING.castCells; d++) {
      const x = px + dx * d;
      const y = py + dy * d;
      if (!wet(x, y)) continue;
      const far = Math.min(FISHING.castCells, d + 1);
      const [cx, cy] = wet(px + dx * far, py + dy * far) ? [px + dx * far, py + dy * far] : [x, y];
      return { cx, cy, sea: !!TERRAIN[this.map.kindAt(cx, cy)].sea };
    }
    return null;
  }

  /** Use the rod. Returns true if a cast started (or the attempt was answered with a message). */
  cast(): boolean {
    if (this.active || this.player.busy) return false;
    const spot = this.findWater();
    if (!spot) {
      audio.playSfx('bonk', 0.4);
      bus.emit(EV.notice, 'Face the water to cast your line.');
      return true;
    }
    if (!spendToolEnergy(this.state, 'rod')) {
      audio.playSfx('bonk', 0.4);
      return false;
    }
    this.water = spot.sea ? 'sea' : 'pond';
    this.bx = spot.cx * T + T / 2;
    this.by = spot.cy * T + T / 2 + 3;
    this.phase = 'casting';
    const timing = TOOL_TIMING.rod;
    this.player.act({
      tool: 'rod',
      frames: timing.frames,
      impact: timing.impact,
      onImpact: () => {
        audio.playSfx('cast', 0.8);
        const [x0, y0] = this.player.rodTip();
        this.flight = { t: 0, x0, y0 };
        this.bobber.setFrame(0).setVisible(true).setPosition(x0, y0);
      },
      onEnd: () => this.player.hold('rod', 2),
    });
    return true;
  }

  /** The use button while the line is out. */
  press(): void {
    switch (this.phase) {
      case 'waiting':
        // Too early: reel the line back in.
        this.reelIn();
        return;
      case 'bite':
        this.startReeling();
        return;
      case 'reeling':
        this.strike();
        return;
      default:
        return;
    }
  }

  /** Walking away (or a menu) reels the line in. */
  cancel(): void {
    if (this.phase === 'waiting' || this.phase === 'bite') this.reelIn();
  }

  private land(): void {
    this.flight = null;
    this.bobber.setPosition(this.bx, this.by);
    this.ripple.setPosition(this.bx, this.by - 1).setVisible(true).setFrame(0);
    audio.playSfx('plop', 0.8);
    this.fx.burst('drop', this.bx, this.by - 2, { count: 4, spread: 18, up: 30 });
    this.phase = 'waiting';
    this.t = 0;
    const rain = this.state.weather === 'rain' ? 0.75 : 1;
    this.biteAt = (FISHING.biteMinMs + Math.random() * (FISHING.biteMaxMs - FISHING.biteMinMs)) * rain;
  }

  private bite(): void {
    this.phase = 'bite';
    this.t = 0;
    audio.playSfx('bite', 0.9);
    this.bobber.setFrame(1);
    this.fx.burst('drop', this.bx, this.by - 2, { count: 6, spread: 24, up: 45 });
    this.emote.setFrame(EMOTE.alert).setVisible(true);
  }

  private startReeling(): void {
    const raining = this.state.weather === 'rain';
    this.fish = rollFish(this.water, this.state.season, this.state.minute, raining);
    const diff = 'junk' in this.fish ? 0 : this.fish.difficulty;
    this.zoneW = Math.round(FISHING.zoneMax - (FISHING.zoneMax - FISHING.zoneMin) * diff);
    this.speed = FISHING.speedMin + (FISHING.speedMax - FISHING.speedMin) * diff;
    this.hits = 0;
    this.misses = 0;
    this.marker = 0;
    this.dir = 1;
    this.moveZone();
    this.phase = 'reeling';
    this.emote.setVisible(false);
    this.hint.setVisible(true);
    audio.playSfx('reelHit', 0.5);
  }

  private moveZone(): void {
    const w = FISHING.meterWidth;
    let x = 0;
    // Keep the zone away from where the marker is now, so each hit is a new aim.
    for (let i = 0; i < 6; i++) {
      x = Math.floor(Math.random() * (w - this.zoneW));
      if (Math.abs(x + this.zoneW / 2 - this.marker) > w / 4) break;
    }
    this.zoneX = x;
  }

  private strike(): void {
    const inZone = this.marker >= this.zoneX - 1 && this.marker <= this.zoneX + this.zoneW + 1;
    if (inZone) {
      this.hits++;
      audio.playSfx('reelHit', 0.8);
      this.fx.burst('drop', this.bx, this.by - 2, { count: 3, spread: 14, up: 30 });
      this.bobber.setFrame(this.hits % 2);
      if (this.hits >= FISHING.hitsToLand) {
        this.catchFish();
        return;
      }
      this.speed *= FISHING.speedPerHit;
      this.moveZone();
    } else {
      this.misses++;
      audio.playSfx('reelMiss', 0.8);
      this.scene.cameras.main.shake(80, 0.002);
      if (this.misses >= FISHING.missesToLose) this.escape('It got away...');
    }
  }

  private catchFish(): void {
    const id = this.fish!.item;
    this.phase = 'landing';
    this.hint.setVisible(false);
    this.meter.clear();
    this.line.clear();
    this.bobber.setVisible(false);
    this.ripple.setVisible(false);
    this.player.release();
    audio.playSfx('catch', 0.9);
    this.fx.burst('drop', this.bx, this.by - 2, { count: 8, spread: 30, up: 60 });
    // The catch leaps out of the water and is held up over the player's head.
    this.prize.setFrame(iconFrame(itemDef(id).icon)).setVisible(true).setPosition(this.bx, this.by);
    const hx = Math.round(this.player.x);
    const hy = Math.round(this.player.y) - 26;
    const from = { x: this.bx, y: this.by };
    this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 420,
      onUpdate: (tw) => {
        const k = tw.getValue() ?? 0;
        const arc = Math.sin(k * Math.PI) * 26;
        this.prize.setPosition(Math.round(from.x + (hx - from.x) * k), Math.round(from.y + (hy - from.y) * k - arc));
      },
      onComplete: () => {
        const name = itemDef(id).name;
        const junk = 'junk' in this.fish!;
        if (!junk) this.state.fishCaught++;
        bus.emit(EV.notice, junk ? `Just some ${name.toLowerCase()}.` : `You caught a ${name}!`);
        this.scene.time.delayedCall(LAND_HOLD_MS, () => {
          this.prize.setVisible(false);
          const left = addItem(this.state, id, 1);
          if (left > 0) {
            bus.emit(EV.notice, 'Your backpack is full');
            this.fx.drop(id, left, this.player.x, this.player.y - 2);
          } else audio.playSfx('pickup', 0.7);
          this.phase = 'idle';
          this.fish = null;
        });
      },
    });
  }

  private escape(msg: string): void {
    audio.playSfx('escape', 0.7);
    bus.emit(EV.notice, msg);
    this.reelIn();
  }

  private reelIn(): void {
    this.phase = 'idle';
    this.flight = null;
    this.fish = null;
    this.bobber.setVisible(false);
    this.ripple.setVisible(false);
    this.emote.setVisible(false);
    this.hint.setVisible(false);
    this.line.clear();
    this.meter.clear();
    this.player.release();
  }

  update(deltaMs: number): void {
    if (this.phase === 'idle' || this.phase === 'landing') return;
    this.t += deltaMs;
    this.bobT += deltaMs;
    if (this.flight) {
      const f = this.flight;
      f.t += deltaMs;
      const k = Math.min(1, f.t / FLIGHT_MS);
      const arc = Math.sin(k * Math.PI) * 18;
      this.bobber.setPosition(Math.round(f.x0 + (this.bx - f.x0) * k), Math.round(f.y0 + (this.by - f.y0) * k - arc));
      if (k >= 1) this.land();
    } else if (this.phase !== 'casting') {
      // Bobbing on the surface; tugged under while a fish is on.
      const tug = this.phase === 'bite' || this.phase === 'reeling' ? 2 : 0;
      const bob = Math.round(Math.sin(this.bobT / 260) * 0.6) + (tug && Math.floor(this.bobT / 120) % 2 ? 1 : 0);
      this.bobber.setPosition(this.bx, this.by + bob);
      const rf = Math.floor(this.bobT / 220) % 3;
      this.ripple.setFrame(rf);
    }
    if (this.phase === 'waiting' && this.t >= this.biteAt) this.bite();
    else if (this.phase === 'bite' && this.t >= FISHING.hookWindowMs) this.escape('Too slow, the fish let go.');
    if (this.phase === 'bite') {
      const hop = Math.floor(this.t / 110) % 2;
      this.emote.setPosition(Math.round(this.player.x), Math.round(this.player.y) - 25 - hop);
    }
    if (this.phase === 'reeling') {
      const w = FISHING.meterWidth;
      this.marker += this.dir * this.speed * (deltaMs / 1000);
      if (this.marker >= w - 1) {
        this.marker = w - 1;
        this.dir = -1;
      } else if (this.marker <= 0) {
        this.marker = 0;
        this.dir = 1;
      }
      this.drawMeter();
    }
    this.drawLine();
  }

  private drawLine(): void {
    this.line.clear();
    if (!this.bobber.visible) return;
    const [x0, y0] = this.player.rodTip();
    const x1 = this.bobber.x;
    const y1 = this.bobber.y - 8;
    // A slack line sags; a taut one (fish on) runs straight. Drawn as whole pixels.
    const sag = this.phase === 'reeling' || this.phase === 'bite' ? 1 : Math.min(10, Math.hypot(x1 - x0, y1 - y0) * 0.25);
    const steps = Math.max(4, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
    this.line.fillStyle(hex('mist'), 0.9);
    for (let i = 0; i <= steps; i++) {
      const k = i / steps;
      const x = Math.round(x0 + (x1 - x0) * k);
      const y = Math.round(y0 + (y1 - y0) * k + Math.sin(k * Math.PI) * sag);
      this.line.fillRect(x, y, 1, 1);
    }
  }

  private drawMeter(): void {
    const g = this.meter;
    const w = FISHING.meterWidth;
    const x = Math.round(this.player.x - w / 2);
    const y = Math.round(this.player.y) - 40;
    g.clear();
    g.fillStyle(hex('night')).fillRect(x - 2, y - 2, w + 4, METER_H + 4);
    g.fillStyle(hex('cream')).fillRect(x - 1, y - 1, w + 2, METER_H + 2);
    g.fillStyle(hex('mauve')).fillRect(x, y, w, METER_H);
    g.fillStyle(hex('leaf')).fillRect(x + this.zoneX, y, this.zoneW, METER_H);
    g.fillStyle(hex('lime')).fillRect(x + this.zoneX, y, this.zoneW, 1);
    const mx = x + Math.round(this.marker);
    g.fillStyle(hex('brick')).fillRect(mx - 1, y - 2, 2, METER_H + 4);
    g.fillStyle(hex('peach')).fillRect(mx - 1, y - 2, 1, 1);
    // Hit pips (gold) and miss pips (red) under the bar.
    for (let i = 0; i < FISHING.hitsToLand; i++) {
      g.fillStyle(hex(i < this.hits ? 'gold' : 'plum')).fillRect(x + i * 5, y + METER_H + 4, 4, 3);
    }
    for (let i = 0; i < FISHING.missesToLose; i++) {
      g.fillStyle(hex(i < this.misses ? 'brick' : 'plum')).fillRect(x + w - 4 - i * 5, y + METER_H + 4, 4, 3);
    }
    this.hint.setPosition(Math.round(this.player.x - this.hint.width / 2), y - 12);
  }

  destroy(): void {
    for (const o of [this.bobber, this.ripple, this.line, this.meter, this.hint, this.emote, this.prize]) o.destroy();
  }
}
