import Phaser from 'phaser';
import { ITEM_TEXTURES, iconFrame } from '../art/items';
import { itemDef } from '../systems/Inventory';
import { addPanel } from './Panel';
import { PixelText } from './PixelText';
import { viewSize } from '../systems/viewZoom';

const TOAST = {
  height: 22,
  gap: 2,
  margin: 4,
  lifeMs: 2600,
  fadeMs: 300,
  /** A pickup of the same item within this window adds to the existing toast. */
  mergeMs: 2000,
} as const;

interface Toast {
  id: string;
  qty: number;
  box: Phaser.GameObjects.Container;
  panel: Phaser.GameObjects.NineSlice;
  text: PixelText;
  born: number;
  timer: Phaser.Time.TimerEvent;
}

/**
 * "+3 Wood" pickups stacked in the bottom-left corner, or, on phones (where
 * the joystick sits there), downward from `top` in the top-left corner.
 */
export class Toasts {
  private list: Toast[] = [];
  private bottom = 0;
  private top: number | null = null;

  constructor(private readonly scene: Phaser.Scene) {}

  layout(h: number, top: number | null = null): void {
    this.bottom = h - TOAST.margin;
    this.top = top;
    this.restack();
  }

  item(id: string, qty: number): void {
    const now = this.scene.time.now;
    const same = this.list.find((t) => t.id === id && now - t.born < TOAST.mergeMs);
    if (same) {
      same.qty += qty;
      this.setLabel(same);
      same.born = now;
      same.timer.remove();
      same.timer = this.expire(same);
      return;
    }
    const box = this.scene.add.container(TOAST.margin, 0);
    const panel = addPanel(this.scene, 0, 0, 40, TOAST.height);
    const icon = this.scene.add.image(4, 3, ITEM_TEXTURES.icons, iconFrame(itemDef(id).icon)).setOrigin(0, 0);
    const text = new PixelText(this.scene, 23, 7, '', { color: 'night', shadow: 'mist' });
    box.add([panel, icon, text]);
    const t: Toast = { id, qty, box, panel, text, born: now, timer: undefined! };
    this.setLabel(t);
    t.timer = this.expire(t);
    this.list.unshift(t);
    box.setAlpha(0);
    this.scene.tweens.add({ targets: box, alpha: 1, duration: 120 });
    this.restack();
  }

  private setLabel(t: Toast): void {
    t.text.setText(`+${t.qty} ${itemDef(t.id).name}`);
    t.panel.width = t.text.width + 29;
  }

  private expire(t: Toast): Phaser.Time.TimerEvent {
    return this.scene.time.delayedCall(TOAST.lifeMs, () => {
      this.scene.tweens.add({
        targets: t.box,
        alpha: 0,
        duration: TOAST.fadeMs,
        onComplete: () => {
          t.box.destroy();
          this.list = this.list.filter((x) => x !== t);
          this.restack();
        },
      });
    });
  }

  private restack(): void {
    const top = this.top;
    this.list.forEach((t, i) => (t.box.y = top === null ? this.bottom - (i + 1) * (TOAST.height + TOAST.gap) : top + i * (TOAST.height + TOAST.gap)));
  }
}

/**
 * A short centred message above the hotbar ("The watering can is empty"), or
 * left-aligned at `x` on phones, where the touch buttons flank the hotbar.
 */
export class Notice {
  private readonly text: PixelText;
  private timer?: Phaser.Time.TimerEvent;
  private y = 0;
  private x: number | null = null;

  constructor(private readonly scene: Phaser.Scene) {
    this.text = new PixelText(scene, 0, 0, '', { color: 'cream', outline: 'night' }).setVisible(false);
  }

  layout(w: number, y: number, x: number | null = null): void {
    this.y = y;
    this.x = x;
    this.text.setPosition(x ?? Math.round((w - this.text.width) / 2), y);
  }

  show(msg: string): void {
    this.scene.tweens.killTweensOf(this.text);
    this.text.setText(msg).setVisible(true).setAlpha(1);
    this.layout(viewSize(this.scene).width, this.y, this.x);
    this.timer?.remove();
    this.timer = this.scene.time.delayedCall(1600 + msg.length * 40, () =>
      this.scene.tweens.add({ targets: this.text, alpha: 0, duration: 350, onComplete: () => this.text.setVisible(false) }),
    );
  }
}
