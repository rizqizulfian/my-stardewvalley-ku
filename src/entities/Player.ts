import Phaser from 'phaser';
import { DEPTH, PLAYER } from '../config';
import { CHAR_FRAMES, charFrame, type Facing } from '../art/characters';
import { TOOL_BEHIND, TOOL_FRAME, TOOL_VIEWS, toolTexture, type ToolView } from '../art/items';
import { PROP_TEXTURES } from '../art/props';
import type { ToolKind } from '../data/items';
import type { Surface } from '../data/terrain';
import { worldDepth } from '../systems/MapRenderer';
import type { WorldMap } from '../systems/WorldMap';

export interface MoveInput {
  dx: number;
  dy: number;
}

/** A timed action such as a tool swing. Movement is locked until it ends. */
export interface ActionSpec {
  /** Tool drawn in the hands, or null for a plain gesture (planting, picking). */
  tool: ToolKind | null;
  /** Milliseconds per frame. */
  frames: readonly number[];
  /** Frame index at which onImpact fires. */
  impact: number;
  onImpact?: () => void;
}

interface RunningAction extends ActionSpec {
  frame: number;
  t: number;
  fired: boolean;
}

function toolView(f: Facing): ToolView {
  return f === 'down' ? 'down' : f === 'up' ? 'up' : 'side';
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
  private action: RunningAction | null = null;
  private readonly tool: Phaser.GameObjects.Sprite;

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
    this.shadow = scene.add.image(x, y, PROP_TEXTURES.shadowS).setAlpha(0.4);
    this.sprite = scene.add.sprite(x, y, texture, charFrame('down', 0)).setOrigin(0.5, 1);
    this.tool = scene.add
      .sprite(x, y, toolTexture('hoe'), 0)
      .setOrigin(TOOL_FRAME.feetX / TOOL_FRAME.w, TOOL_FRAME.feetY / TOOL_FRAME.h)
      .setVisible(false);
    this.sync();
  }

  get busy(): boolean {
    return this.action !== null;
  }

  /** Starts a tool swing or gesture. Ignored while another action runs. */
  act(spec: ActionSpec): boolean {
    if (this.action) return false;
    this.action = { ...spec, frame: 0, t: 0, fired: false };
    this.moving = false;
    this.showActionFrame();
    if (spec.impact === 0) this.fireImpact();
    return true;
  }

  private fireImpact(): void {
    const a = this.action;
    if (!a || a.fired) return;
    a.fired = true;
    a.onImpact?.();
  }

  private showActionFrame(): void {
    const a = this.action!;
    const pose = a.tool ? (a.frame === 0 ? CHAR_FRAMES.use[0] : CHAR_FRAMES.use[1]) : CHAR_FRAMES.idle[0];
    this.sprite.setFrame(charFrame(this.facing, pose));
    if (!a.tool) {
      this.tool.setVisible(false);
      return;
    }
    const view = toolView(this.facing);
    const f = Math.min(a.frame, TOOL_FRAME.perView - 1);
    this.tool
      .setTexture(toolTexture(a.tool), TOOL_VIEWS.indexOf(view) * TOOL_FRAME.perView + f)
      .setFlipX(this.facing === 'left')
      .setVisible(true);
    this.toolBehind = TOOL_BEHIND[a.tool][view][f];
  }

  private toolBehind = false;

  private updateAction(deltaMs: number): void {
    const a = this.action!;
    a.t += deltaMs;
    while (this.action && a.t >= a.frames[a.frame]) {
      a.t -= a.frames[a.frame];
      a.frame++;
      if (a.frame >= a.frames.length) {
        this.fireImpact();
        this.action = null;
        this.tool.setVisible(false);
        this.resetAnim();
        return;
      }
      if (a.frame === a.impact) this.fireImpact();
      this.showActionFrame();
    }
  }

  /** Turn to face a world point (used when aiming with the mouse). */
  face(tx: number, ty: number): void {
    const dx = tx - this.x;
    const dy = ty - (this.y - PLAYER.feetHeight / 2);
    if (Math.abs(dx) > Math.abs(dy)) this.facing = dx > 0 ? 'right' : 'left';
    else this.facing = dy > 0 ? 'down' : 'up';
  }

  private feet(x: number, y: number) {
    return { x: x - PLAYER.feetWidth / 2, y: y - PLAYER.feetHeight, w: PLAYER.feetWidth, h: PLAYER.feetHeight };
  }

  update(deltaMs: number, input: MoveInput): void {
    if (this.action) {
      this.updateAction(deltaMs);
      this.sync();
      return;
    }
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
    if (this.tool.visible) {
      this.tool.setPosition(Math.round(this.x), Math.round(this.y));
      this.tool.setDepth(this.sprite.depth + (this.toolBehind ? -0.05 : 0.05));
    }
  }

  setVisible(v: boolean): void {
    this.sprite.setVisible(v);
    this.shadow.setVisible(v);
    if (!v) this.tool.setVisible(false);
  }
}
