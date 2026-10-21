// A villager on the current map: walks to their scheduled spot, then stands,
// wanders, sits on a bench, dances or fishes there. Blocks the player like a
// prop, turns to face whoever talks to them, and carries extra layers when
// their data asks for it (Jotaro's Stand and aura).

import Phaser from 'phaser';
import { DEPTH, PLAYER, RENDER } from '../config';
import { CHAR_FRAMES, charFrame, type Facing } from '../art/characters';
import { EMOTE, FX_TEXTURES } from '../art/fx';
import { TOOL_FRAME, TOOL_VIEWS, toolTexture } from '../art/items';
import { AURA, STAND_FRAMES, STAND_TEXTURES, auraTexture, npcTexture } from '../art/npcs';
import { hex } from '../art/palette';
import { PROP_TEXTURES } from '../art/props';
import type { NpcDef, NpcStop } from '../data/npcs';
import type { Box } from '../data/props';
import { worldDepth } from '../systems/MapRenderer';
import type { WorldMap } from '../systems/WorldMap';

const T = RENDER.tileSize;
const WALK_SPEED = 40;
const SEAT_LIFT = 7;
const DANCE_FRAME_MS = 210;
/** Give up walking around an obstacle after this long and step there out of sight. */
const STUCK_MS = 1400;
/** The player within this distance (px) gets a look. */
const NOTICE_PX = 30;

type Mode = 'walk' | 'stand' | 'wander' | 'sit' | 'dance' | 'fish';

export class Npc {
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly shadow: Phaser.GameObjects.Image;
  private readonly emote: Phaser.GameObjects.Image;
  private stand?: Phaser.GameObjects.Sprite;
  private aura?: Phaser.GameObjects.Sprite;
  private rod?: Phaser.GameObjects.Sprite;
  private bobber?: Phaser.GameObjects.Sprite;
  private line?: Phaser.GameObjects.Graphics;
  x: number;
  y: number;
  facing: Facing = 'down';
  stop: NpcStop;
  private mode: Mode = 'stand';
  private target: { x: number; y: number } | null = null;
  private wait = 0;
  private stuck = 0;
  private anim = 0;
  private lookT = 3000 + Math.random() * 4000;
  private emoteT = 0;
  private rushT = 0;
  private noteT = 0;
  /** Frozen while talking. */
  talking = false;
  leaving = false;
  /** Rain stops the dancing. */
  raining = false;
  /** Called when the NPC throws a music note (dancers). */
  onNote: (x: number, y: number) => void = () => {};

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly map: WorldMap,
    readonly def: NpcDef,
    stop: NpcStop,
    /** Spawn right on the spot (map load) instead of walking in. */
    placed: boolean,
  ) {
    this.stop = stop;
    const [sx, sy] = this.spotPx(stop);
    this.x = sx;
    this.y = sy;
    this.shadow = scene.add.image(sx, sy, PROP_TEXTURES.shadowS).setAlpha(0.4).setDepth(DEPTH.groundDecor + 0.6);
    this.sprite = scene.add.sprite(sx, sy, npcTexture(def.id), 0).setOrigin(0.5, 1);
    this.emote = scene.add.image(0, 0, FX_TEXTURES.emote, 0).setOrigin(0.5, 1).setDepth(DEPTH.particlesAbove).setVisible(false);
    if (def.stand) this.stand = scene.add.sprite(sx, sy, STAND_TEXTURES.starPlatinum, 0).setOrigin(0.5, 1).setAlpha(0.92);
    if (def.aura) this.aura = scene.add.sprite(sx, sy, auraTexture(def.id), 0).setOrigin(AURA.padX / AURA.w + 8 / AURA.w, (AURA.padY + PLAYER.frameHeight) / AURA.h).setAlpha(0.7);
    this.arrive(placed);
    if (!placed) {
      this.sprite.setAlpha(0);
      scene.tweens.add({ targets: this.sprite, alpha: 1, duration: 500 });
    }
  }

  /** Feet point for a stop. Benches seat the NPC in the middle of the 2-wide seat. */
  private spotPx(s: NpcStop): [number, number] {
    if (s.do === 'sit') return [s.x * T + T, (s.y + 1) * T + 1];
    return [s.x * T + T / 2, (s.y + 1) * T - 2];
  }

  private arrive(placed: boolean): void {
    const [tx, ty] = this.spotPx(this.stop);
    if (placed || (Math.abs(tx - this.x) < 2 && Math.abs(ty - this.y) < 2)) {
      this.x = tx;
      this.y = ty;
      this.begin();
    } else {
      this.mode = 'walk';
      this.target = { x: tx, y: ty };
      this.stuck = 0;
    }
    this.sync();
  }

  /** Start the stop's activity once on the spot. */
  private begin(): void {
    const s = this.stop;
    this.mode = s.do === 'dance' && this.raining ? 'stand' : s.do;
    this.target = null;
    this.wait = 600 + Math.random() * 1500;
    if (s.face) this.facing = s.face;
    this.shadow.setVisible(this.mode !== 'sit');
    if (this.mode === 'sit') this.facing = 'down';
    if (this.mode === 'fish') this.showRod();
    else this.hideRod();
  }

  /** The schedule moved on: walk to the new spot on this map. */
  moveTo(stop: NpcStop): void {
    this.stop = stop;
    this.hideRod();
    this.shadow.setVisible(true);
    if (this.mode === 'sit') this.y += T - 3;
    this.arrive(false);
  }

  /** Fade away (gone home, or off to another map). */
  leave(onGone: () => void): void {
    this.leaving = true;
    this.scene.tweens.add({
      targets: [this.sprite, this.shadow, this.stand, this.aura, this.rod, this.bobber, this.line].filter(Boolean),
      alpha: 0,
      duration: 450,
      onComplete: onGone,
    });
  }

  feet(x = this.x, y = this.y): Box {
    return { x: x - PLAYER.feetWidth / 2, y: y - PLAYER.feetHeight, w: PLAYER.feetWidth, h: PLAYER.feetHeight };
  }

  /** Does this NPC block a box (the player's feet)? */
  blocks(b: Box): boolean {
    if (this.leaving) return false;
    const f = this.mode === 'sit' ? { x: this.x - 8, y: this.y - 10, w: 16, h: 8 } : this.feet();
    return b.x < f.x + f.w && b.x + b.w > f.x && b.y < f.y + f.h && b.y + b.h > f.y;
  }

  /** Distance (px) from a point to the NPC's body centre. */
  distanceTo(px: number, py: number): number {
    return Math.hypot(px - this.x, py - (this.y - (this.mode === 'sit' ? SEAT_LIFT : 0) - 6));
  }

  faceToward(px: number, py: number): void {
    if (this.mode === 'sit' || this.mode === 'dance') return;
    const dx = px - this.x;
    const dy = py - this.y;
    if (Math.abs(dx) > Math.abs(dy)) this.facing = dx > 0 ? 'right' : 'left';
    else this.facing = dy > 0 ? 'down' : 'up';
  }

  showEmote(frame: number, ms = 1300): void {
    this.emote.setFrame(frame).setVisible(true);
    this.emoteT = ms;
  }

  /** Jotaro: the Stand throws a flurry of punches. */
  rush(ms: number): void {
    this.rushT = ms;
  }

  get isSeated(): boolean {
    return this.mode === 'sit';
  }

  // -------------------------------------------------------------------------

  private showRod(): void {
    if (this.rod) return;
    const view = this.facing === 'down' ? 'down' : this.facing === 'up' ? 'up' : 'side';
    this.rod = this.scene.add
      .sprite(this.x, this.y, toolTexture('rod'), TOOL_VIEWS.indexOf(view) * TOOL_FRAME.perView + 2)
      .setOrigin(TOOL_FRAME.feetX / TOOL_FRAME.w, TOOL_FRAME.feetY / TOOL_FRAME.h)
      .setFlipX(this.facing === 'left');
    const [dx, dy] = this.facing === 'down' ? [0, 1] : this.facing === 'up' ? [0, -1] : this.facing === 'left' ? [-1, 0] : [1, 0];
    this.bobber = this.scene.add.sprite(this.x + dx * T * 2, this.y + dy * T * 2 + 4, FX_TEXTURES.bobber, 0).setOrigin(0.5, 1).setDepth(DEPTH.particlesAbove - 0.2);
    this.line = this.scene.add.graphics().setDepth(DEPTH.particlesAbove - 0.3);
  }

  private hideRod(): void {
    this.rod?.destroy();
    this.bobber?.destroy();
    this.line?.destroy();
    this.rod = this.bobber = undefined;
    this.line = undefined;
  }

  private free(x: number, y: number, playerFeet: Box): boolean {
    const b = this.feet(x, y);
    if (!this.map.canOccupy(b, 0)) return false;
    return !(b.x < playerFeet.x + playerFeet.w && b.x + b.w > playerFeet.x && b.y < playerFeet.y + playerFeet.h && b.y + b.h > playerFeet.y);
  }

  /** One step toward the target. Returns 'arrived', 'moving' or 'blocked'. */
  private step(dt: number, playerFeet: Box): 'arrived' | 'moving' | 'blocked' {
    const t = this.target!;
    const dx = t.x - this.x;
    const dy = t.y - this.y;
    if (Math.abs(dx) < 1.5 && Math.abs(dy) < 1.5) return 'arrived';
    const sp = (this.def.speed ?? WALK_SPEED) * dt;
    let moved = false;
    // Move along the longer axis first so paths look like streets, not diagonals.
    const tryX = () => {
      if (Math.abs(dx) < 1) return;
      const nx = this.x + Math.sign(dx) * Math.min(sp, Math.abs(dx));
      if (this.free(nx, this.y, playerFeet)) {
        this.x = nx;
        moved = true;
      }
    };
    const tryY = () => {
      if (Math.abs(dy) < 1) return;
      const ny = this.y + Math.sign(dy) * Math.min(sp, Math.abs(dy));
      if (this.free(this.x, ny, playerFeet)) {
        this.y = ny;
        moved = true;
      }
    };
    if (Math.abs(dx) > Math.abs(dy)) {
      tryX();
      if (!moved) tryY();
    } else {
      tryY();
      if (!moved) tryX();
    }
    if (moved) {
      const mx = t.x - this.x;
      const my = t.y - this.y;
      if (Math.abs(mx) > Math.abs(my)) this.facing = mx > 0 ? 'right' : 'left';
      else this.facing = my > 0 ? 'down' : 'up';
    }
    return moved ? 'moving' : 'blocked';
  }

  update(deltaMs: number, playerX: number, playerY: number, playerFeet: Box): void {
    const dt = deltaMs / 1000;
    this.anim += deltaMs;
    let walking = false;
    if (this.emoteT > 0) {
      this.emoteT -= deltaMs;
      if (this.emoteT <= 0) this.emote.setVisible(false);
    }
    if (!this.talking && !this.leaving) {
      if (this.mode === 'walk' || (this.mode === 'wander' && this.target)) {
        const r = this.step(dt, playerFeet);
        walking = r === 'moving';
        if (r === 'blocked') this.stuck += deltaMs;
        else this.stuck = 0;
        if (r === 'arrived' || this.stuck > STUCK_MS) {
          if (this.mode === 'walk') {
            if (r !== 'arrived') this.teleport();
            this.begin();
          } else {
            this.target = null;
            this.wait = 1500 + Math.random() * 3500;
          }
          this.stuck = 0;
        }
      } else if (this.mode === 'wander') {
        this.wait -= deltaMs;
        if (this.wait <= 0) this.pickWanderTarget();
      }
      // Idle folk look around now and then, and at the player when near.
      if (this.mode === 'stand' || (this.mode === 'wander' && !this.target)) {
        const near = Math.hypot(playerX - this.x, playerY - this.y) < NOTICE_PX;
        if (near) this.faceToward(playerX, playerY);
        else {
          this.lookT -= deltaMs;
          if (this.lookT <= 0) {
            this.lookT = 3000 + Math.random() * 5000;
            const dirs: Facing[] = ['down', 'left', 'right', 'down'];
            this.facing = this.mode === 'stand' && Math.random() < 0.6 ? (this.stop.face ?? 'down') : dirs[Math.floor(Math.random() * dirs.length)];
          }
        }
      }
    }
    this.pickFrame(walking, deltaMs);
    this.sync();
  }

  private teleport(): void {
    const t = this.target!;
    this.x = t.x;
    this.y = t.y;
    this.sprite.setAlpha(0);
    this.scene.tweens.add({ targets: this.sprite, alpha: 1, duration: 400 });
  }

  private pickWanderTarget(): void {
    const r = (this.stop.radius ?? 2) * T;
    const [hx, hy] = this.spotPx(this.stop);
    for (let i = 0; i < 8; i++) {
      const x = Math.round(hx + (Math.random() * 2 - 1) * r);
      const y = Math.round(hy + (Math.random() * 2 - 1) * r);
      if (this.map.canOccupy(this.feet(x, y), 0)) {
        this.target = { x, y };
        return;
      }
    }
    this.wait = 1000;
  }

  private pickFrame(walking: boolean, deltaMs: number): void {
    let frame: number;
    if (this.mode === 'sit') frame = charFrame('down', CHAR_FRAMES.sit);
    else if (this.mode === 'dance' && !this.talking) {
      const i = Math.floor(this.anim / DANCE_FRAME_MS) % CHAR_FRAMES.dance.length;
      frame = charFrame('down', CHAR_FRAMES.dance[i]);
      this.noteT -= deltaMs;
      if (this.noteT <= 0) {
        this.noteT = 1100 + Math.random() * 900;
        this.onNote(this.x + (Math.random() < 0.5 ? -7 : 7), this.y - 24);
      }
    } else if (this.mode === 'fish') frame = charFrame(this.facing, CHAR_FRAMES.use[1]);
    else if (walking) {
      const i = Math.floor(this.anim / PLAYER.walkFrameMs) % CHAR_FRAMES.walk.length;
      frame = charFrame(this.facing, CHAR_FRAMES.walk[i]);
    } else {
      const i = Math.floor(this.anim / PLAYER.idleFrameMs) % CHAR_FRAMES.idle.length;
      frame = charFrame(this.facing, CHAR_FRAMES.idle[i]);
    }
    if (this.sprite.frame.name !== String(frame)) this.sprite.setFrame(frame);
  }

  private sync(): void {
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    const lift = this.mode === 'sit' ? SEAT_LIFT : 0;
    this.sprite.setPosition(x, y - lift).setDepth(worldDepth(y));
    this.shadow.setPosition(x, y - 1);
    this.emote.setPosition(x, y - lift - 25 - (Math.floor(this.anim / 200) % 2));
    if (this.stand) {
      // The Stand looms behind, bobbing slowly; it rushes forward when called.
      const bob = Math.round(Math.sin(this.anim / 520) * 1.2);
      const rushing = this.rushT > 0;
      if (rushing) this.rushT -= 16;
      const back = this.facing === 'up';
      const f = rushing ? STAND_FRAMES.rush[Math.floor(this.anim / 70) % 2] : (back ? STAND_FRAMES.back : STAND_FRAMES.front)[Math.floor(this.anim / 700) % 2];
      const side = this.facing === 'left' ? 5 : this.facing === 'right' ? -5 : 0;
      this.stand
        .setFrame(f)
        .setFlipX(this.facing === 'left')
        .setPosition(x + side + (rushing ? Math.round(Math.sin(this.anim / 30)) : 0), y - 5 + bob + (rushing ? 4 : 0))
        .setDepth(worldDepth(y) + (rushing ? 0.02 : -0.03));
    }
    if (this.aura) {
      const fi = ['down', 'up', 'right', 'left'].indexOf(this.facing);
      const f = fi * AURA.frames + (Math.floor(this.anim / 150) % AURA.frames);
      this.aura.setFrame(f).setPosition(x, y).setDepth(worldDepth(y) - 0.02);
      this.aura.setAlpha(0.55 + Math.sin(this.anim / 260) * 0.15);
    }
    if (this.rod && this.bobber && this.line) {
      this.rod.setPosition(x, y).setDepth(worldDepth(y) + (this.facing === 'up' ? -0.05 : 0.05));
      const bob = Math.round(Math.sin(this.anim / 300) * 0.6);
      const bx = this.bobber.x;
      const by = this.bobber.y + bob;
      this.bobber.setFrame(0);
      const tipX = x + (this.facing === 'down' ? 1 : this.facing === 'left' ? -15 : 15);
      const tipY = y + (this.facing === 'down' ? 3 : -14);
      this.line.clear().fillStyle(hex('mist'), 0.85);
      const n = Math.max(4, Math.ceil(Math.hypot(bx - tipX, by - 8 - tipY)));
      for (let i = 0; i <= n; i++) {
        const k = i / n;
        this.line.fillRect(Math.round(tipX + (bx - tipX) * k), Math.round(tipY + (by - 8 - tipY) * k + Math.sin(k * Math.PI) * 4), 1, 1);
      }
    }
  }

  /** Show a heart when friendship rises, or another reaction. */
  react(kind: keyof typeof EMOTE): void {
    this.showEmote(EMOTE[kind]);
  }

  destroy(): void {
    for (const o of [this.sprite, this.shadow, this.emote, this.stand, this.aura, this.rod, this.bobber, this.line]) o?.destroy();
  }
}
