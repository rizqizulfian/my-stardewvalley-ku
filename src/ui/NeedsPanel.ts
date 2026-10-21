import Phaser from 'phaser';
import { NEEDS } from '../config';
import { hex, type ColorName } from '../art/palette';
import { UI_ICON, UI_TEXTURES } from '../art/fx';
import type { GameState, NeedId } from '../systems/GameState';
import { addPanel } from './Panel';

const LAYOUT = {
  width: 74,
  margin: 4,
  /** Top of the panel (just under the clock). */
  top: 50,
  padX: 6,
  padY: 6,
  rowH: 10,
  barX: 18,
  barW: 49,
  barH: 5,
  blinkMs: 400,
} as const;

const ROWS: Array<{ id: NeedId; icon: number; color: ColorName; light: ColorName }> = [
  { id: 'energy', icon: UI_ICON.energy, color: 'leaf', light: 'lime' },
  { id: 'hunger', icon: UI_ICON.hunger, color: 'tan', light: 'sand' },
  { id: 'thirst', icon: UI_ICON.thirst, color: 'sea', light: 'sky' },
  { id: 'sleep', icon: UI_ICON.sleep, color: 'violet', light: 'lilac' },
];

interface Bar {
  id: NeedId;
  fill: Phaser.GameObjects.Rectangle;
  shine: Phaser.GameObjects.Rectangle;
  color: ColorName;
  light: ColorName;
}

/** Four small bars under the clock: energy, hunger, thirst, alertness. Low bars blink red. */
export class NeedsPanel {
  readonly container: Phaser.GameObjects.Container;
  private readonly bars: Bar[] = [];
  readonly height = LAYOUT.padY * 2 + ROWS.length * LAYOUT.rowH - 3;
  private blinkOn = true;

  constructor(scene: Phaser.Scene) {
    this.container = scene.add.container(0, LAYOUT.top);
    this.container.add(addPanel(scene, 0, 0, LAYOUT.width, this.height));
    ROWS.forEach((r, i) => {
      const y = LAYOUT.padY + i * LAYOUT.rowH;
      const icon = scene.add.image(LAYOUT.padX, y - 1, UI_TEXTURES.icons, r.icon).setOrigin(0, 0);
      const frame = scene.add.rectangle(LAYOUT.barX - 1, y, LAYOUT.barW + 2, LAYOUT.barH + 2, hex('umber')).setOrigin(0, 0);
      const back = scene.add.rectangle(LAYOUT.barX, y + 1, LAYOUT.barW, LAYOUT.barH, hex('night')).setOrigin(0, 0);
      const fill = scene.add.rectangle(LAYOUT.barX, y + 1, LAYOUT.barW, LAYOUT.barH, hex(r.color)).setOrigin(0, 0);
      const shine = scene.add.rectangle(LAYOUT.barX, y + 1, LAYOUT.barW, 1, hex(r.light)).setOrigin(0, 0);
      this.container.add([icon, frame, back, fill, shine]);
      this.bars.push({ id: r.id, fill, shine, color: r.color, light: r.light });
    });
    scene.time.addEvent({ delay: LAYOUT.blinkMs, loop: true, callback: () => (this.blinkOn = !this.blinkOn) });
  }

  layout(viewWidth: number): void {
    this.container.x = viewWidth - LAYOUT.width - LAYOUT.margin;
  }

  setVisible(v: boolean): void {
    this.container.setVisible(v);
  }

  update(s: GameState): void {
    for (const b of this.bars) {
      const v = s.needs[b.id];
      const w = v <= 0 ? 0 : Math.max(1, Math.round((LAYOUT.barW * v) / NEEDS.max));
      const low = v < NEEDS.low;
      const color = low ? (this.blinkOn ? 'brick' : 'coral') : b.color;
      b.fill.setSize(w, LAYOUT.barH).setFillStyle(hex(color)).setVisible(w > 0);
      b.shine.setSize(w, 1).setFillStyle(hex(low ? 'peach' : b.light)).setVisible(w > 0);
    }
  }
}
