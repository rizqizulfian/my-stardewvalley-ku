import Phaser from 'phaser';
import { DEPTH } from '../config';
import { TOOL_FRAME } from '../art/items';
import { PROP_TEXTURES } from '../art/props';
import type { ColorName } from '../art/palette';
import type { Pose } from '../net/coop';
import { worldDepth } from '../systems/MapRenderer';
import { PixelText } from '../ui/PixelText';

/** Name tag colour per player slot (host first). */
const TAG_COLORS: ColorName[] = ['gold', 'foam', 'lime', 'rose'];
/** Further than this (px) between updates is a jump (a door, a bed), not a walk. */
const SNAP_PX = 40;
/** How quickly the drawn position catches up with the last update (per ms). */
const CATCH_UP = 0.012;
/** Px between the head and the name tag. */
const TAG_GAP = 2;

/**
 * Someone else in a co-op room, drawn on this screen exactly as their own
 * screen draws them (same body and tool frames), sliding smoothly between the
 * position updates.
 */
export class RemotePlayer {
  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly shadow: Phaser.GameObjects.Image;
  private readonly tool: Phaser.GameObjects.Sprite;
  private readonly tag: PixelText;
  private x = 0;
  private y = 0;
  private target: Pose | null = null;

  constructor(scene: Phaser.Scene, texture: string, name: string, slot: number) {
    this.shadow = scene.add.image(0, 0, PROP_TEXTURES.shadowS).setAlpha(0.4).setDepth(DEPTH.groundDecor + 0.6);
    this.sprite = scene.add.sprite(0, 0, texture, 0).setOrigin(0.5, 1);
    this.tool = scene.add.sprite(0, 0, texture, 0).setOrigin(TOOL_FRAME.feetX / TOOL_FRAME.w, TOOL_FRAME.feetY / TOOL_FRAME.h).setVisible(false);
    this.tag = new PixelText(scene, 0, 0, name, { color: TAG_COLORS[slot % TAG_COLORS.length], outline: 'night' }).setDepth(DEPTH.particlesAbove);
    this.setVisible(false);
  }

  /** A fresh update from the network. */
  set(p: Pose): void {
    const first = !this.target;
    this.target = p;
    if (first || Math.hypot(p.x - this.x, p.y - this.y) > SNAP_PX) {
      this.x = p.x;
      this.y = p.y;
    }
    if (p.b && p.b !== this.sprite.texture.key && this.sprite.scene.textures.exists(p.b)) this.sprite.setTexture(p.b, p.f);
    else this.sprite.setFrame(p.f);
    this.shadow.setVisible(p.sh);
    if (p.tk && this.sprite.scene.textures.exists(p.tk)) this.tool.setTexture(p.tk, p.tf).setFlipX(p.fl).setVisible(true);
    else this.tool.setVisible(false);
    this.sync();
  }

  setVisible(v: boolean): void {
    this.sprite.setVisible(v);
    this.shadow.setVisible(v && (this.target?.sh ?? true));
    this.tag.setVisible(v);
    if (!v) this.tool.setVisible(false);
  }

  update(deltaMs: number): void {
    const p = this.target;
    if (!p) return;
    const k = Math.min(1, deltaMs * CATCH_UP);
    this.x += (p.x - this.x) * k;
    this.y += (p.y - this.y) * k;
    this.sync();
  }

  private sync(): void {
    const p = this.target;
    if (!p) return;
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    // The feet sit the same distance below the sprite as on the owner's screen.
    const feet = y + (p.fy - p.y);
    this.sprite.setPosition(x, y).setDepth(worldDepth(feet));
    this.shadow.setPosition(x, feet - 1);
    this.tool.setPosition(x, feet).setDepth(this.sprite.depth + (p.tb ? -0.05 : 0.05));
    this.tag.setPosition(Math.round(x - this.tag.width / 2), y - this.sprite.displayHeight - this.tag.height - TAG_GAP);
  }

  destroy(): void {
    this.sprite.destroy();
    this.shadow.destroy();
    this.tool.destroy();
    this.tag.destroy();
  }
}
