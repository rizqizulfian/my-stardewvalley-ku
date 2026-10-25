// The disco crowd: party-goers filling the dance floor, each with their own
// dance. They keep to their spot, move on the song's beat, and shout
// something when you talk to them.

import Phaser from 'phaser';
import { DEPTH, RENDER } from '../config';
import { CHAR_FRAMES, charFrame, type Facing } from '../art/characters';
import { CROWD_SIZE, DISCO_BEAT_MS, crowdTexture } from '../art/disco';
import { PROP_TEXTURES } from '../art/props';
import type { Box } from '../data/props';
import { worldDepth } from '../systems/MapRenderer';

const T = RENDER.tileSize;
const BODY = { w: 10, h: 5 } as const;

/**
 * Dance styles:
 * - wave: arms up, selendang flying (the dance poses)
 * - bounce: hops on every beat, facing front
 * - spin: turns a quarter on every beat
 * - sway: steps side to side, looking where it goes
 * - robot: stiff, jerky arm pumps on the half beat
 * - jump: crouches, then a big jump with arms up every other beat
 * - shuffle: quick feet, sliding left and right
 * - headbang: bobs hard and fast, facing the DJ
 */
export type DanceStyle = 'wave' | 'bounce' | 'spin' | 'sway' | 'robot' | 'jump' | 'shuffle' | 'headbang';
const STYLES: DanceStyle[] = ['wave', 'bounce', 'spin', 'sway', 'robot', 'jump', 'shuffle', 'headbang'];

/** Spots on the floor (cells) round the puppy, leaving a lane up from the door. */
const SPOTS: Array<[number, number]> = [
  [6, 5],
  [8, 5],
  [12, 5],
  [14, 5],
  [5, 7],
  [7, 7],
  [13, 7],
  [15, 7],
  [6, 9],
  [8, 9],
  [12, 9],
  [14, 9],
  [3, 5],
  [17, 5],
  [3, 8],
  [17, 8],
  [5, 3],
  [15, 4],
];

const SHOUTS = [
  'Wooo! Lagunya enak banget!',
  'Ayo joget! Jangan cuma berdiri!',
  'Anak anjing itu jago banget jogetnya...',
  'Aku ke sini tiap malam. Eh, tiap pagi juga.',
  'Siapa sangka gudang di kebun ternyata diskotik?',
  'Gerakan ini namanya... rahasia!',
  'Kakiku pegal, tapi lagunya belum selesai!',
  'DJ-nya siapa sih? Kok nggak kelihatan?',
  'Lantainya nyala! Keren!',
];

interface Dancer {
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
  x: number;
  y: number;
  style: DanceStyle;
  /** Beat offset so neighbours with the same style are not in lockstep. */
  offset: number;
  shout: string;
}

export class DiscoCrowd {
  private readonly dancers: Dancer[] = [];
  private t = 0;

  constructor(scene: Phaser.Scene) {
    SPOTS.slice(0, CROWD_SIZE).forEach(([cx, cy], i) => {
      const x = cx * T + T / 2;
      const y = (cy + 1) * T - 2;
      const shadow = scene.add.image(x, y - 1, PROP_TEXTURES.shadowS).setAlpha(0.3).setDepth(DEPTH.groundDecor + 0.5);
      const sprite = scene.add.sprite(x, y, crowdTexture(i), 0).setOrigin(0.5, 1).setDepth(worldDepth(y));
      this.dancers.push({ sprite, shadow, x, y, style: STYLES[i % STYLES.length], offset: (i * 3) % 4, shout: SHOUTS[i % SHOUTS.length] });
    });
  }

  blocks(b: Box): boolean {
    return this.dancers.some((d) => {
      const x0 = d.x - BODY.w / 2;
      const y0 = d.y - BODY.h;
      return b.x < x0 + BODY.w && b.x + b.w > x0 && b.y < y0 + BODY.h && b.y + b.h > y0;
    });
  }

  /** What the nearest dancer within reach shouts, or null. */
  shoutNear(px: number, py: number): { x: number; y: number; text: string } | null {
    let best: Dancer | null = null;
    let bestD = 22;
    for (const d of this.dancers) {
      const dist = Math.hypot(px - d.x, py - (d.y - 6));
      if (dist < bestD) {
        bestD = dist;
        best = d;
      }
    }
    return best ? { x: best.x, y: best.y, text: best.shout } : null;
  }

  update(deltaMs: number): void {
    this.t += deltaMs;
    const beatF = this.t / DISCO_BEAT_MS;
    for (const d of this.dancers) {
      const b = Math.floor(beatF) + d.offset;
      const inBeat = beatF % 1;
      let facing: Facing = 'down';
      let frame: number = CHAR_FRAMES.idle[0];
      let dx = 0;
      let dy = 0;
      let flip = false;
      switch (d.style) {
        case 'wave':
          frame = CHAR_FRAMES.dance[b % 4];
          dy = inBeat < 0.25 ? -1 : 0;
          break;
        case 'bounce':
          frame = CHAR_FRAMES.idle[b % 2];
          dy = -Math.round(Math.sin(inBeat * Math.PI) * 3);
          break;
        case 'spin': {
          const order: Facing[] = ['down', 'right', 'up', 'left'];
          facing = order[b % 4];
          frame = CHAR_FRAMES.idle[0];
          dy = inBeat < 0.3 ? -2 : 0;
          break;
        }
        case 'sway': {
          const right = b % 4 < 2;
          facing = right ? 'right' : 'left';
          frame = CHAR_FRAMES.walk[(Math.floor(beatF * 2) + d.offset) % 4];
          dx = Math.round(Math.sin(beatF * Math.PI * 0.5) * 3);
          break;
        }
        case 'robot': {
          const half = Math.floor(beatF * 2) + d.offset;
          frame = CHAR_FRAMES.use[half % 2];
          facing = half % 4 < 2 ? 'left' : 'right';
          break;
        }
        case 'jump': {
          const up = b % 2 === 1;
          frame = up ? CHAR_FRAMES.dance[(b >> 1) % 4] : CHAR_FRAMES.sit;
          dy = up ? -Math.round(Math.sin(inBeat * Math.PI) * 7) : 1;
          break;
        }
        case 'shuffle':
          frame = CHAR_FRAMES.walk[Math.floor(beatF * 4) % 4];
          facing = 'down';
          dx = (b % 4 < 2 ? 1 : -1) * Math.round(inBeat * 2);
          flip = b % 2 === 0;
          break;
        case 'headbang':
          facing = 'up';
          frame = CHAR_FRAMES.idle[0];
          dy = Math.floor(beatF * 2) % 2 === 0 ? 1 : -1;
          break;
      }
      const f = charFrame(facing, frame);
      if (d.sprite.frame.name !== String(f)) d.sprite.setFrame(f);
      d.sprite.setFlipX(flip);
      d.sprite.setPosition(d.x + dx, d.y + dy);
      d.shadow.setX(d.x + dx);
    }
  }

  destroy(): void {
    for (const d of this.dancers) {
      d.sprite.destroy();
      d.shadow.destroy();
    }
  }
}
