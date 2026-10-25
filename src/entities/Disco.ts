// The disco in the barn: the dance floor lights up in patterns on the beat,
// the mirror ball turns and throws specks of light round the room, two
// coloured spots sweep the floor, and a doodle puppy dances under the ball.
// The song runs at about 165 bpm.

import Phaser from 'phaser';
import { DEPTH, RENDER } from '../config';
import { DISCO_BALL, DISCO_BEAT_MS, DISCO_TEXTURES, NEON, PUPPY } from '../art/disco';
import { EMOTE, FX_TEXTURES } from '../art/fx';
import { hex } from '../art/palette';
import { PROP_TEXTURES } from '../art/props';
import type { MapDef } from '../data/maps/types';
import type { Box } from '../data/props';
import { worldDepth } from '../systems/MapRenderer';
import { DiscoCrowd } from './DiscoCrowd';

const T = RENDER.tileSize;
export { DISCO_BEAT_MS };
/** Solid area around the puppy's feet. */
const BODY = { w: 18, h: 8 } as const;
const SPECKS = 46;
const NEON_HEX = NEON.map(hex);

interface Speck {
  img: Phaser.GameObjects.Image;
  a: number;
  r: number;
  tw: number;
}

export class Disco {
  readonly x: number;
  readonly y: number;
  private readonly floor: Phaser.GameObjects.Graphics;
  private readonly beams: Phaser.GameObjects.Graphics;
  private readonly flash: Phaser.GameObjects.Rectangle;
  private readonly ball: Phaser.GameObjects.Sprite;
  private readonly puppy: Phaser.GameObjects.Sprite;
  private readonly shadow: Phaser.GameObjects.Image;
  private readonly emote: Phaser.GameObjects.Image;
  private readonly specks: Speck[] = [];
  readonly crowd: DiscoCrowd;
  private readonly area: { x0: number; y0: number; x1: number; y1: number };
  private readonly roomW: number;
  private readonly roomH: number;
  private t = 0;
  private beat = -1;
  private emoteMs = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    def: NonNullable<MapDef['disco']>,
    roomW: number,
    roomH: number,
  ) {
    this.area = def.floor;
    this.roomW = roomW;
    this.roomH = roomH;
    this.x = def.puppy.x * T;
    this.y = (def.puppy.y + 1) * T;
    this.floor = scene.add.graphics().setDepth(DEPTH.groundDecor - 0.5);
    this.beams = scene.add.graphics().setDepth(DEPTH.lights).setBlendMode(Phaser.BlendModes.ADD);
    this.flash = scene.add
      .rectangle(0, 0, 1, 1, 0xffffff, 0)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(DEPTH.lights)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.flash.setSize(scene.scale.width, scene.scale.height);
    this.shadow = scene.add.image(this.x, this.y - 1, PROP_TEXTURES.shadowL).setAlpha(0.3).setDepth(DEPTH.groundDecor + 0.5);
    this.puppy = scene.add.sprite(this.x, this.y + 2, DISCO_TEXTURES.puppy, 0).setOrigin(0.5, 1).setDepth(worldDepth(this.y));
    this.emote = scene.add.image(this.x, this.y - PUPPY.h - 4, FX_TEXTURES.emote, EMOTE.heart).setDepth(DEPTH.particlesAbove).setVisible(false);
    // The ball hangs from the ceiling over the puppy's head, above everything.
    this.ball = scene.add.sprite(this.x, this.y - PUPPY.h - 16, DISCO_TEXTURES.ball, 0).setOrigin(0.5, 1).setDepth(DEPTH.particlesAbove);
    this.crowd = new DiscoCrowd(scene);
    for (let i = 0; i < SPECKS; i++) {
      const img = scene.add
        .image(0, 0, DISCO_TEXTURES.speck)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(DEPTH.lights)
        .setTint(i % 3 === 0 ? 0xffffff : NEON_HEX[i % NEON_HEX.length]);
      this.specks.push({ img, a: (i / SPECKS) * Math.PI * 2 * 3.7, r: 0.15 + ((i * 7919) % 100) / 118, tw: i * 1.3 });
    }
  }

  blocks(b: Box): boolean {
    const x0 = this.x - BODY.w / 2;
    const y0 = this.y - BODY.h;
    return (b.x < x0 + BODY.w && b.x + b.w > x0 && b.y < y0 + BODY.h && b.y + b.h > y0) || this.crowd.blocks(b);
  }

  distanceTo(px: number, py: number): number {
    return Math.hypot(px - this.x, py - (this.y - 8));
  }

  /** A heart pops up over its head. */
  love(): void {
    this.emoteMs = 1400;
    this.emote.setVisible(true);
  }

  update(deltaMs: number, onBeat?: (x: number, y: number) => void): void {
    this.t += deltaMs;
    const beat = Math.floor(this.t / DISCO_BEAT_MS);
    const inBeat = (this.t % DISCO_BEAT_MS) / DISCO_BEAT_MS;
    if (beat !== this.beat) {
      this.beat = beat;
      this.puppy.setFrame(PUPPY.dance[beat % PUPPY.dance.length]);
      if (beat % 4 === 0) onBeat?.(this.x + (beat % 8 === 0 ? -10 : 10), this.y - PUPPY.h + 4);
      this.drawFloor(beat);
      this.flash.setFillStyle(NEON_HEX[beat % NEON_HEX.length], 1);
    }
    this.flash.setSize(this.scene.scale.width, this.scene.scale.height);
    // A soft colour wash on each beat, fading quickly.
    this.flash.setAlpha(0.07 * Math.max(0, 1 - inBeat * 2.5));
    this.puppy.setY(this.y + 2 - (inBeat < 0.3 ? 1 : 0));
    this.ball.setFrame(Math.floor(this.t / 140) % DISCO_BALL.frames);
    this.crowd.update(deltaMs);
    this.updateSpecks(deltaMs);
    this.drawBeams();
    if (this.emoteMs > 0) {
      this.emoteMs -= deltaMs;
      this.emote.setY(Math.round(this.y - PUPPY.h - 4 - (1 - this.emoteMs / 1400) * 4));
      if (this.emoteMs <= 0) this.emote.setVisible(false);
    }
  }

  /** Light the floor tiles in one of a few patterns, a new one every bar. */
  private drawFloor(beat: number): void {
    const { x0, y0, x1, y1 } = this.area;
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const pattern = Math.floor(beat / 8) % 4;
    const g = this.floor;
    g.clear();
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        let k: number;
        let on = true;
        if (pattern === 0) {
          // Checkerboard that swaps every beat.
          on = (x + y + beat) % 2 === 0;
          k = beat + (x >> 1);
        } else if (pattern === 1) {
          // Rings rolling out from the puppy.
          const d = Math.round(Math.max(Math.abs(x + 0.5 - cx - 0.5), Math.abs(y - cy)));
          k = d - beat;
          on = (d + beat) % 3 !== 0;
        } else if (pattern === 2) {
          // Diagonal stripes marching across.
          k = x + y - beat;
          on = (x + y + beat) % 3 !== 1;
        } else {
          // Random sparkle tiles.
          on = ((x * 73856093) ^ (y * 19349663) ^ (beat * 83492791)) % 5 < 3;
          k = x * 3 + y * 5 + beat;
        }
        const c = NEON_HEX[((k % NEON_HEX.length) + NEON_HEX.length) % NEON_HEX.length];
        g.fillStyle(c, on ? 0.72 : 0.12);
        g.fillRect(x * T + 1, y * T + 1, T - 2, T - 2);
        if (on) {
          g.fillStyle(0xffffff, 0.18);
          g.fillRect(x * T + 2, y * T + 2, T - 6, 2);
        }
      }
  }

  /** Mirror-ball specks circling the room. */
  private updateSpecks(deltaMs: number): void {
    const w = this.roomW;
    const h = this.roomH;
    const cy = this.y - 12;
    for (const s of this.specks) {
      s.a += deltaMs * 0.00035;
      const x = this.x + Math.cos(s.a) * s.r * w * 0.5;
      const y = cy + Math.sin(s.a) * s.r * h * 0.5;
      s.img.setPosition(Math.round(x), Math.round(y));
      // Only inside the room, never out in the black around it.
      const inside = x > T && x < w - T && y > 4 && y < h - T;
      s.img.setAlpha(inside ? 0.45 + 0.4 * Math.sin(this.t * 0.006 + s.tw) : 0);
    }
  }

  /** Two coloured spotlights from the back corners, sweeping the floor. */
  private drawBeams(): void {
    const g = this.beams;
    g.clear();
    const top = 2 * T;
    const { x0, x1, y0, y1 } = this.area;
    const sources: Array<[number, number, number]> = [
      [T * 1.5, top, 0],
      [this.roomW - T * 1.5, top, 1],
    ];
    for (const [sx, sy, i] of sources) {
      const sweep = Math.sin(this.t * 0.0011 + i * 2.1);
      const tx = ((x0 + x1 + 1) / 2) * T + sweep * ((x1 - x0) / 2) * T;
      const ty = ((y0 + y1 + 1) / 2) * T + Math.cos(this.t * 0.0008 + i) * ((y1 - y0) / 2) * T;
      const spread = 14;
      const c = NEON_HEX[(Math.floor(this.t / (DISCO_BEAT_MS * 4)) + i * 3) % NEON_HEX.length];
      g.fillStyle(c, 0.13);
      g.fillTriangle(sx, sy, tx - spread, ty, tx + spread, ty);
      g.fillStyle(c, 0.22);
      g.fillEllipse(tx, ty, spread * 2.4, spread * 1.3);
    }
  }

  destroy(): void {
    this.floor.destroy();
    this.beams.destroy();
    this.flash.destroy();
    this.ball.destroy();
    this.puppy.destroy();
    this.shadow.destroy();
    this.emote.destroy();
    for (const s of this.specks) s.img.destroy();
    this.crowd.destroy();
  }
}
