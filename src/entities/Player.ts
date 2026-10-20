import Phaser from 'phaser';
import { DEPTH, PLAYER } from '../config';
import { CHAR_FRAMES, charFrame, type Facing } from '../art/characters';
import { PROP_TEXTURES } from '../art/props';
import type { Surface } from '../data/terrain';
import { worldDepth } from '../systems/MapRenderer';
import type { WorldMap } from '../systems/WorldMap';

export interface MoveInput {
  dx: number;
  dy: number;
}

/**
 * The player: a sprite anchored at the feet, a ground shadow, axis-separated
 * collision against the map, and a frame-stepped walk/idle animation.
 */
export class Player {
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly shadow: Phaser.GameObjects.Image;
  x: number;
  y: number;
  facing: Facing = 'down';
  private elevation: number | null;
  private moving = false;
  private animTime = 0;
  private frameIndex = 0;

  /** Called on each footfall frame with the surface underfoot. */
  onFootstep: (surface: Surface) => void = () => {};

  constructor(
    scene: Phaser.Scene,
    private readonly map: WorldMap,
    texture: string,
    x: number,
    y: number,
  ) {
    this.x = x;
    this.y = y;
    this.elevation = map.elevationAtPx(x, y);
    this.shadow = scene.add.image(x, y, PROP_TEXTURES.shadowS);
    this.sprite = scene.add.sprite(x, y, texture, charFrame('down', 0)).setOrigin(0.5, 1);
    this.sync();
  }

  private feet(x: number, y: number) {
    return { x: x - PLAYER.feetWidth / 2, y: y - PLAYER.feetHeight, w: PLAYER.feetWidth, h: PLAYER.feetHeight };
  }

  update(deltaMs: number, input: MoveInput): void {
    const dt = deltaMs / 1000;
    let { dx, dy } = input;
    const len = Math.hypot(dx, dy);
    this.moving = len > 0;
    if (this.moving) {
      dx /= len;
      dy /= len;
      // Facing follows the dominant axis; horizontal wins ties so diagonals read as side walks.
      if (Math.abs(dx) >= Math.abs(dy)) this.facing = dx > 0 ? 'right' : 'left';
      else this.facing = dy > 0 ? 'down' : 'up';

      const step = PLAYER.walkSpeed * dt;
      const nx = this.x + dx * step;
      if (this.map.canOccupy(this.feet(nx, this.y), this.elevation)) this.x = nx;
      const ny = this.y + dy * step;
      if (this.map.canOccupy(this.feet(this.x, ny), this.elevation)) this.y = ny;
      const e = this.map.elevationAtPx(this.x, this.y - PLAYER.feetHeight / 2);
      this.elevation = e;
    }
    this.animate(deltaMs);
    this.sync();
  }

  private animate(deltaMs: number): void {
    this.animTime += deltaMs;
    const frames = this.moving ? CHAR_FRAMES.walk : CHAR_FRAMES.idle;
    const per = this.moving ? PLAYER.walkFrameMs : PLAYER.idleFrameMs;
    if (this.animTime >= per) {
      this.animTime -= per;
      this.frameIndex = (this.frameIndex + 1) % frames.length;
      // Walk frames 0 and 2 are the contact poses.
      if (this.moving && this.frameIndex % 2 === 0) this.onFootstep(this.map.surfaceAtPx(this.x, this.y - 2));
    }
    if (this.frameIndex >= frames.length) this.frameIndex = 0;
    this.sprite.setFrame(charFrame(this.facing, frames[this.frameIndex]));
  }

  /** Restart the cycle so the first frame after starting to walk is a step. */
  resetAnim(): void {
    this.animTime = 0;
    this.frameIndex = 0;
  }

  get isMoving(): boolean {
    return this.moving;
  }

  private sync(): void {
    this.sprite.setPosition(Math.round(this.x), Math.round(this.y));
    this.shadow.setPosition(Math.round(this.x), Math.round(this.y) - 1);
    this.sprite.setDepth(worldDepth(this.y));
    this.shadow.setDepth(DEPTH.groundDecor + 0.6);
  }
}
