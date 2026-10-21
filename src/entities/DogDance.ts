// The dancing dog in the little house: dances on the beat (the song runs at
// about 144 bpm), hops a little on each beat, music notes float up.

import Phaser from 'phaser';
import { DEPTH, RENDER } from '../config';
import { DOG, EXTRA_TEXTURES } from '../art/extras';
import { EMOTE, FX_TEXTURES } from '../art/fx';
import { PROP_TEXTURES } from '../art/props';
import type { Box } from '../data/props';
import { worldDepth } from '../systems/MapRenderer';

const T = RENDER.tileSize;
export const DOG_BEAT_MS = 60000 / 144;
/** Solid area around the dog's feet. */
const BODY = { w: 18, h: 8 } as const;

export class DogDance {
  readonly x: number;
  readonly y: number;
  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly shadow: Phaser.GameObjects.Image;
  private readonly phone: Phaser.GameObjects.Image;
  private readonly emote: Phaser.GameObjects.Image;
  private t = 0;
  private beat = -1;
  private emoteMs = 0;

  constructor(scene: Phaser.Scene, cell: { x: number; y: number }) {
    this.x = cell.x * T;
    this.y = (cell.y + 1) * T;
    this.shadow = scene.add.image(this.x, this.y - 1, PROP_TEXTURES.shadowL).setAlpha(0.18).setDepth(DEPTH.groundDecor + 0.5);
    this.sprite = scene.add.sprite(this.x, this.y + 2, EXTRA_TEXTURES.dog, 0).setOrigin(0.5, 1).setDepth(worldDepth(this.y));
    this.phone = scene.add.image(this.x - 24, this.y - 2, EXTRA_TEXTURES.phone).setOrigin(0.5, 1).setDepth(worldDepth(this.y - 4));
    this.emote = scene.add.image(this.x, this.y - DOG.h - 4, FX_TEXTURES.emote, EMOTE.heart).setDepth(DEPTH.particlesAbove).setVisible(false);
  }

  blocks(b: Box): boolean {
    const x0 = this.x - BODY.w / 2;
    const y0 = this.y - BODY.h;
    return b.x < x0 + BODY.w && b.x + b.w > x0 && b.y < y0 + BODY.h && b.y + b.h > y0;
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
    const beat = Math.floor(this.t / DOG_BEAT_MS);
    if (beat !== this.beat) {
      this.beat = beat;
      this.sprite.setFrame(DOG.dance[beat % DOG.dance.length]);
      if (beat % 4 === 0) onBeat?.(this.x + (beat % 8 === 0 ? -10 : 10), this.y - DOG.h + 4);
    }
    // A small hop at the start of every beat.
    const inBeat = (this.t % DOG_BEAT_MS) / DOG_BEAT_MS;
    this.sprite.setY(this.y + 2 - (inBeat < 0.3 ? 1 : 0));
    if (this.emoteMs > 0) {
      this.emoteMs -= deltaMs;
      this.emote.setY(Math.round(this.y - DOG.h - 4 - (1 - this.emoteMs / 1400) * 4));
      if (this.emoteMs <= 0) this.emote.setVisible(false);
    }
  }

  destroy(): void {
    this.sprite.destroy();
    this.shadow.destroy();
    this.phone.destroy();
    this.emote.destroy();
  }
}
