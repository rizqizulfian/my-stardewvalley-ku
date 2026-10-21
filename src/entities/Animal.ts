// A farm animal: ambles to a random spot in its run, stands about, then picks
// another. Ducks paddle into the pond (only their top half shows). Big animals
// are solid; hens, ducks and the cat just step out of the way.

import Phaser from 'phaser';
import { DEPTH, RENDER } from '../config';
import { ANIMAL_FRAMES, ANIMAL_SIZE, animalTexture } from '../art/farm';
import { EMOTE, FX_TEXTURES } from '../art/fx';
import { PROP_TEXTURES } from '../art/props';
import { ANIMAL_INFO, type AnimalDef } from '../data/animals';
import type { Box } from '../data/props';
import { isWaterTerrain } from '../data/terrain';
import { worldDepth } from '../systems/MapRenderer';
import type { WorldMap } from '../systems/WorldMap';

const T = RENDER.tileSize;
const IDLE_FRAME_MS = 520;
const WALK_FRAME_MS = 170;
/** Stand still between strolls for this long (ms). */
const PAUSE = { min: 1500, max: 5000, night: 9000 } as const;
const STUCK_MS = 900;
/** How much of a swimming duck sinks below the water line (px). */
const SINK = 5;

export class Animal {
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly shadow: Phaser.GameObjects.Image;
  private readonly emote: Phaser.GameObjects.Image;
  private readonly size: { w: number; h: number };
  private readonly speed: number;
  private readonly swims: boolean;
  private readonly elevation: number | null;
  /** Big animals stop the player. */
  readonly solid: boolean;
  x: number;
  y: number;
  private target: { x: number; y: number } | null = null;
  private pause: number;
  private stuck = 0;
  private anim = Math.random() * 1000;
  private emoteT = 0;
  private hop = 0;
  /** Set by the system: lie low after dark. */
  sleepy = false;

  constructor(
    scene: Phaser.Scene,
    private readonly map: WorldMap,
    readonly def: AnimalDef,
    start: { x: number; y: number },
  ) {
    this.size = ANIMAL_SIZE[def.kind];
    this.speed = ANIMAL_INFO[def.kind].speed;
    this.swims = def.kind === 'duck';
    this.solid = this.size.w >= 20;
    this.x = start.x * T + T / 2;
    this.y = start.y * T + T - 2;
    this.elevation = this.swims ? null : map.elevationAtPx(this.x, this.y);
    this.pause = Math.random() * PAUSE.max;
    this.shadow = scene.add
      .image(0, 0, this.solid ? PROP_TEXTURES.shadowM : PROP_TEXTURES.shadowS)
      .setAlpha(0.2)
      .setDepth(DEPTH.groundDecor + 0.5);
    this.sprite = scene.add.sprite(0, 0, animalTexture(def.kind), ANIMAL_FRAMES.idle[0]).setOrigin(0.5, 1);
    this.sprite.setFlipX(Math.random() < 0.5);
    this.emote = scene.add.image(0, 0, FX_TEXTURES.emote, EMOTE.heart).setOrigin(0.5, 1).setDepth(DEPTH.particlesAbove).setVisible(false);
    this.sync(false);
  }

  /** Solid feet, for the player and the other animals. */
  body(x = this.x, y = this.y): Box {
    const w = Math.max(6, Math.round(this.size.w * 0.6));
    return { x: x - w / 2, y: y - 5, w, h: 5 };
  }

  blocks(b: Box): boolean {
    if (!this.solid) return false;
    const a = this.body();
    return b.x < a.x + a.w && b.x + b.w > a.x && b.y < a.y + a.h && b.y + b.h > a.y;
  }

  distanceTo(px: number, py: number): number {
    return Math.hypot(px - this.x, py - (this.y - this.size.h / 2));
  }

  private get inWater(): boolean {
    return this.swims && isWaterTerrain(this.map.terrainAt(Math.floor(this.x / T), Math.floor((this.y - 2) / T)));
  }

  /** Heart (or a smaller reaction) and a little hop. */
  react(kind: keyof typeof EMOTE, faceX?: number): void {
    this.emote.setFrame(EMOTE[kind]).setVisible(true);
    this.emoteT = 1400;
    this.hop = 1;
    this.target = null;
    this.pause = 2500;
    if (faceX !== undefined) this.sprite.setFlipX(faceX < this.x);
  }

  private pickTarget(): void {
    const a = this.def.area;
    // Ducks would rather be on the pond.
    const wantWater = this.swims && Math.random() < 0.6;
    for (let tries = 0; tries < 16; tries++) {
      const cx = a.x0 + Math.floor(Math.random() * (a.x1 - a.x0 + 1));
      const cy = a.y0 + Math.floor(Math.random() * (a.y1 - a.y0 + 1));
      if (wantWater && !isWaterTerrain(this.map.terrainAt(cx, cy))) continue;
      const x = cx * T + 3 + Math.random() * (T - 6);
      const y = cy * T + T - 2;
      if (Math.hypot(x - this.x, y - this.y) > T * 5) continue;
      if (this.map.canOccupy(this.body(x, y), this.elevation, this.swims)) {
        this.target = { x, y };
        return;
      }
    }
  }

  /** Walks a step towards the target; false when something is in the way. */
  private step(dt: number, blocked: (b: Box, self: Animal) => boolean): boolean | 'arrived' {
    const t = this.target!;
    const dx = t.x - this.x;
    const dy = t.y - this.y;
    const d = Math.hypot(dx, dy);
    const s = this.speed * (this.inWater ? 0.8 : 1) * dt;
    if (d <= s) {
      this.x = t.x;
      this.y = t.y;
      return 'arrived';
    }
    const nx = this.x + (dx / d) * s;
    const ny = this.y + (dy / d) * s;
    const free = (x: number, y: number) => this.map.canOccupy(this.body(x, y), this.elevation, this.swims) && !blocked(this.body(x, y), this);
    if (Math.abs(dx) > 0.5) this.sprite.setFlipX(dx < 0);
    if (free(nx, ny)) {
      this.x = nx;
      this.y = ny;
      return true;
    }
    // Slide along whatever is in the way.
    if (free(nx, this.y)) this.x = nx;
    else if (free(this.x, ny)) this.y = ny;
    else return false;
    return true;
  }

  update(deltaMs: number, blocked: (b: Box, self: Animal) => boolean): void {
    this.anim += deltaMs;
    if (this.emoteT > 0) {
      this.emoteT -= deltaMs;
      if (this.emoteT <= 0) this.emote.setVisible(false);
    }
    if (this.hop > 0) this.hop = Math.max(0, this.hop - deltaMs / 300);
    let walking = false;
    if (this.target) {
      const r = this.step(deltaMs / 1000, blocked);
      walking = r === true;
      this.stuck = r === false ? this.stuck + deltaMs : 0;
      if (r === 'arrived' || this.stuck > STUCK_MS) {
        this.target = null;
        this.pause = this.sleepy ? PAUSE.night : PAUSE.min + Math.random() * (PAUSE.max - PAUSE.min);
      }
    } else {
      this.pause -= deltaMs;
      if (this.pause <= 0) {
        this.pickTarget();
        if (!this.target) this.pause = PAUSE.min;
      }
    }
    const frames = walking ? ANIMAL_FRAMES.walk : ANIMAL_FRAMES.idle;
    const frame = this.sleepy && !walking ? frames[0] : frames[Math.floor(this.anim / (walking ? WALK_FRAME_MS : IDLE_FRAME_MS)) % frames.length];
    if (this.sprite.frame.name !== String(frame)) this.sprite.setFrame(frame);
    this.sync(walking);
  }

  private sync(walking: boolean): void {
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    const swim = this.inWater;
    const lift = Math.round(Math.sin(this.hop * Math.PI) * 4);
    const bob = swim ? Math.round(Math.sin(this.anim / 400)) : 0;
    this.sprite.setPosition(x, y + (swim ? SINK : 0) - lift + bob).setDepth(worldDepth(y));
    // Below the water line nothing shows.
    if (swim) this.sprite.setCrop(0, 0, this.size.w, this.size.h - SINK);
    else this.sprite.setCrop();
    this.shadow.setPosition(x, y - 1).setVisible(!swim);
    this.emote.setPosition(x, y - this.size.h - 3 - lift - (walking ? 0 : Math.floor(this.anim / 200) % 2));
  }

  destroy(): void {
    for (const o of [this.sprite, this.shadow, this.emote]) o.destroy();
  }
}
