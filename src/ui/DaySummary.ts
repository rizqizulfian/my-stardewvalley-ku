import Phaser from 'phaser';
import { SEASONS } from '../config';
import { hex } from '../art/palette';
import { UI_ICON, UI_TEXTURES } from '../art/fx';
import { ITEM_TEXTURES, iconFrame } from '../art/items';
import { audio } from '../audio/AudioManager';
import type { DaySummary } from '../systems/day';
import { itemDef } from '../systems/Inventory';
import { addPanel } from './Panel';
import { PixelText } from './PixelText';

const LAYOUT = {
  width: 220,
  pad: 10,
  rowH: 17,
  maxRows: 6,
} as const;

/** Overnight screen: what the shipping box earned, then "press any key". */
export class DaySummaryView {
  private root: Phaser.GameObjects.Container | null = null;
  private readonly shade: Phaser.GameObjects.Rectangle;
  private onDone: (() => void) | null = null;
  private readyAt = 0;
  private blink?: Phaser.Time.TimerEvent;

  constructor(private readonly scene: Phaser.Scene) {
    this.shade = scene.add.rectangle(0, 0, 10, 10, hex('ink'), 1).setOrigin(0, 0).setVisible(false).setDepth(80).setInteractive();
    this.shade.on('pointerdown', () => this.finish());
  }

  get isOpen(): boolean {
    return this.root !== null;
  }

  layout(w: number, h: number): void {
    this.shade.setSize(w, h);
    if (this.root) this.root.setPosition(Math.round((w - LAYOUT.width) / 2), Math.round((h - this.height) / 2));
  }

  private height = 0;

  show(s: DaySummary, onDone: () => void): void {
    this.onDone = onDone;
    this.readyAt = this.scene.time.now + 600;
    const sc = this.scene;
    const lines: Phaser.GameObjects.GameObject[] = [];
    const rows = s.sales.slice(0, LAYOUT.maxRows);
    const extra = s.sales.length - rows.length;
    let y = LAYOUT.pad;
    const head = new PixelText(sc, 0, y, s.passedOut ? 'You passed out...' : `${SEASONS[s.season]} ${s.day} is over`, { color: 'brick', shadow: 'sand' });
    head.x = Math.round((LAYOUT.width - head.width) / 2);
    lines.push(head);
    y += 14;
    if (s.passedOut) {
      lines.push(new PixelText(sc, LAYOUT.pad, y, 'Someone carried you home. Go to bed before 2:00 am!', { color: 'umber', shadow: 'mist', wrapWidth: LAYOUT.width - LAYOUT.pad * 2 }));
      y += 22;
    }
    lines.push(sc.add.rectangle(LAYOUT.pad, y, LAYOUT.width - LAYOUT.pad * 2, 1, hex('mist')).setOrigin(0, 0));
    y += 5;
    if (rows.length === 0) {
      lines.push(new PixelText(sc, LAYOUT.pad, y + 3, 'Nothing was shipped today.', { color: 'umber', shadow: 'mist' }));
      y += LAYOUT.rowH;
    }
    for (const l of rows) {
      const d = itemDef(l.id);
      lines.push(sc.add.image(LAYOUT.pad, y, ITEM_TEXTURES.icons, iconFrame(d.icon)).setOrigin(0, 0));
      lines.push(new PixelText(sc, LAYOUT.pad + 20, y + 5, `${d.name} x${l.qty}`, { color: 'night', shadow: 'mist' }));
      const g = new PixelText(sc, 0, y + 5, `${l.gold}g`, { color: 'umber', shadow: 'mist' });
      g.x = LAYOUT.width - LAYOUT.pad - g.width;
      lines.push(g);
      y += LAYOUT.rowH;
    }
    if (extra > 0) {
      lines.push(new PixelText(sc, LAYOUT.pad + 20, y + 2, `...and ${extra} more`, { color: 'umber', shadow: 'mist' }));
      y += 12;
    }
    lines.push(sc.add.rectangle(LAYOUT.pad, y + 2, LAYOUT.width - LAYOUT.pad * 2, 1, hex('mist')).setOrigin(0, 0));
    y += 7;
    const total = new PixelText(sc, 0, y, `Earned ${s.total}g`, { color: 'night', shadow: 'mist' });
    total.x = LAYOUT.width - LAYOUT.pad - total.width;
    lines.push(total, sc.add.image(total.x - 11, y - 1, UI_TEXTURES.icons, UI_ICON.coin).setOrigin(0, 0));
    y += 13;
    if (s.newSeason) {
      const next = SEASONS[(s.season + 1) % SEASONS.length];
      const msg = s.withered > 0 ? `${next} begins! ${s.withered} out-of-season crops withered.` : `${next} begins! New seeds at Toko Tani.`;
      lines.push(new PixelText(sc, LAYOUT.pad, y, msg, { color: 'leaf', shadow: 'mist', wrapWidth: LAYOUT.width - LAYOUT.pad * 2 }));
      y += 20;
    }
    const press = new PixelText(sc, 0, y + 2, 'Press any key', { color: 'clay', shadow: 'mist' });
    press.x = Math.round((LAYOUT.width - press.width) / 2);
    lines.push(press);
    y += 14;
    this.height = y + LAYOUT.pad - 4;
    const root = sc.add.container(0, 0).setDepth(81);
    root.add(addPanel(sc, 0, 0, LAYOUT.width, this.height));
    root.add(lines);
    this.root = root;
    this.shade.setVisible(true).setAlpha(1);
    root.setAlpha(0);
    sc.tweens.add({ targets: root, alpha: 1, duration: 300 });
    this.blink = sc.time.addEvent({ delay: 500, loop: true, callback: () => press.setVisible(!press.visible) });
    this.layout(sc.scale.width, sc.scale.height);
    if (s.total > 0) audio.playSfx('coin', 0.9);
  }

  /** Any key or click once the screen has settled. */
  finish(): void {
    if (!this.root || this.scene.time.now < this.readyAt) return;
    const root = this.root;
    this.root = null;
    this.blink?.remove();
    this.scene.tweens.add({ targets: root, alpha: 0, duration: 250, onComplete: () => root.destroy() });
    this.scene.tweens.add({ targets: this.shade, alpha: 0, duration: 400, onComplete: () => this.shade.setVisible(false) });
    const done = this.onDone;
    this.onDone = null;
    done?.();
  }
}
