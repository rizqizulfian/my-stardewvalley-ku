import Phaser from 'phaser';
import { FARM } from '../config';
import { hex } from '../art/palette';
import { UI_TEXTURES } from '../art/fx';
import { ITEM_TEXTURES, iconFrame } from '../art/items';
import type { GameState, ItemStack } from '../systems/GameState';
import { itemDef } from '../systems/Inventory';
import { addPanel } from './Panel';
import { PixelText } from './PixelText';

export const SLOT = { size: 20, gap: 1, pad: 5 } as const;

const LAYOUT = {
  marginBottom: 3,
  /** Selected item name shows this long after the selection changes (ms). */
  nameMs: 1600,
} as const;

/** One inventory cell: frame, icon, stack count and (for the can) a water gauge. */
export class SlotView {
  readonly bg: Phaser.GameObjects.Image;
  private readonly icon: Phaser.GameObjects.Image;
  private readonly qty: PixelText;
  private readonly gaugeBg: Phaser.GameObjects.Rectangle;
  private readonly gauge: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene, container: Phaser.GameObjects.Container, x: number, y: number) {
    this.bg = scene.add.image(x, y, UI_TEXTURES.slot).setOrigin(0, 0);
    this.icon = scene.add.image(x + 2, y + 2, ITEM_TEXTURES.icons, 0).setOrigin(0, 0).setVisible(false);
    this.qty = new PixelText(scene, x, y, '', { color: 'cream', outline: 'night' }).setVisible(false);
    this.gaugeBg = scene.add.rectangle(x + 3, y + 16, 14, 2, hex('night')).setOrigin(0, 0).setVisible(false);
    this.gauge = scene.add.rectangle(x + 3, y + 16, 14, 2, hex('sky')).setOrigin(0, 0).setVisible(false);
    container.add([this.bg, this.icon, this.gaugeBg, this.gauge, this.qty]);
  }

  set(stack: ItemStack | null, selected: boolean, water: number): void {
    this.bg.setTexture(selected ? UI_TEXTURES.slotSelected : UI_TEXTURES.slot);
    if (!stack) {
      this.icon.setVisible(false);
      this.qty.setVisible(false);
      this.gaugeBg.setVisible(false);
      this.gauge.setVisible(false);
      return;
    }
    const def = itemDef(stack.id);
    this.icon.setFrame(iconFrame(def.icon)).setVisible(true);
    if (stack.qty > 1) {
      this.qty.setText(String(stack.qty)).setVisible(true);
      this.qty.setPosition(this.bg.x + SLOT.size + 1 - this.qty.width, this.bg.y + SLOT.size - 8);
    } else this.qty.setVisible(false);
    const isCan = def.tool === 'can';
    this.gaugeBg.setVisible(isCan);
    this.gauge.setVisible(isCan && water > 0);
    if (isCan) this.gauge.width = Math.max(1, Math.round((14 * water) / FARM.canCapacity));
  }

  setAlpha(a: number): void {
    this.icon.setAlpha(a);
    this.qty.setAlpha(a);
  }
}

/** Bottom-center hotbar showing the first row of the backpack. */
export class Hotbar {
  readonly container: Phaser.GameObjects.Container;
  private readonly slots: SlotView[] = [];
  private readonly name: PixelText;
  private nameTimer?: Phaser.Time.TimerEvent;
  private lastSelected = -1;
  readonly width = SLOT.pad * 2 + FARM.hotbarSlots * SLOT.size + (FARM.hotbarSlots - 1) * SLOT.gap;
  readonly height = SLOT.pad * 2 + SLOT.size;

  constructor(
    private readonly scene: Phaser.Scene,
    onSelect: (slot: number) => void,
  ) {
    this.container = scene.add.container(0, 0);
    this.container.add(addPanel(scene, 0, 0, this.width, this.height));
    for (let i = 0; i < FARM.hotbarSlots; i++) {
      const sv = new SlotView(scene, this.container, SLOT.pad + i * (SLOT.size + SLOT.gap), SLOT.pad);
      sv.bg.setInteractive({ useHandCursor: false }).on('pointerdown', () => onSelect(i));
      this.slots.push(sv);
    }
    this.name = new PixelText(scene, 0, 0, '', { color: 'cream', outline: 'night' }).setVisible(false);
  }

  layout(w: number, h: number): { x: number; y: number; w: number; h: number } {
    const x = Math.round((w - this.width) / 2);
    const y = h - this.height - LAYOUT.marginBottom;
    this.container.setPosition(x, y);
    this.name.setPosition(Math.round((w - this.name.width) / 2), y - 12);
    return { x, y, w: this.width, h: this.height };
  }

  refresh(s: GameState): void {
    for (let i = 0; i < FARM.hotbarSlots; i++) this.slots[i].set(s.inventory[i], i === s.selected, s.water);
    if (s.selected !== this.lastSelected) {
      const first = this.lastSelected < 0;
      this.lastSelected = s.selected;
      const st = s.inventory[s.selected];
      if (!first && st) this.showName(itemDef(st.id).name);
    }
  }

  private showName(text: string): void {
    this.name.setText(text).setVisible(true).setAlpha(1);
    this.name.x = Math.round((this.scene.scale.width - this.name.width) / 2);
    this.nameTimer?.remove();
    this.scene.tweens.killTweensOf(this.name);
    this.nameTimer = this.scene.time.delayedCall(LAYOUT.nameMs, () =>
      this.scene.tweens.add({ targets: this.name, alpha: 0, duration: 300, onComplete: () => this.name.setVisible(false) }),
    );
  }

  setVisible(v: boolean): void {
    this.container.setVisible(v);
    if (!v) this.name.setVisible(false);
  }
}
