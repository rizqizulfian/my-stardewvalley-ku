import Phaser from 'phaser';
import { FARM } from '../config';
import { hex } from '../art/palette';
import { ITEM_TEXTURES, iconFrame } from '../art/items';
import { audio } from '../audio/AudioManager';
import type { GameState } from '../systems/GameState';
import { itemDef, moveSlot } from '../systems/Inventory';
import { SLOT, SlotView } from './Hotbar';
import { addPanel } from './Panel';
import { PixelText } from './PixelText';

const COLS = FARM.hotbarSlots;
const ROWS = FARM.inventorySlots / COLS;
const LAYOUT = {
  titleH: 16,
  infoH: 24,
} as const;

const KIND_LABEL: Record<string, string> = { tool: 'Tool', seed: 'Seeds', produce: 'Crop', resource: 'Material' };

/** The backpack: all slots, click one then another to move or swap. */
export class InventoryMenu {
  private readonly root: Phaser.GameObjects.Container;
  private readonly shade: Phaser.GameObjects.Rectangle;
  private readonly slots: SlotView[] = [];
  private readonly info: PixelText;
  private readonly infoSub: PixelText;
  private readonly held: Phaser.GameObjects.Image;
  private heldSlot = -1;
  private hover = -1;
  readonly width = SLOT.pad * 2 + COLS * SLOT.size + (COLS - 1) * SLOT.gap;
  readonly height = LAYOUT.titleH + SLOT.pad * 2 + ROWS * SLOT.size + (ROWS - 1) * SLOT.gap + LAYOUT.infoH;
  isOpen = false;

  constructor(
    scene: Phaser.Scene,
    private readonly state: GameState,
  ) {
    this.shade = scene.add.rectangle(0, 0, 10, 10, hex('ink'), 0.45).setOrigin(0, 0).setVisible(false).setInteractive();
    this.root = scene.add.container(0, 0).setVisible(false);
    this.root.add(addPanel(scene, 0, 0, this.width, this.height));
    const title = new PixelText(scene, 0, 6, 'Backpack', { color: 'brick', shadow: 'sand' });
    title.x = Math.round((this.width - title.width) / 2);
    this.root.add(title);
    for (let i = 0; i < FARM.inventorySlots; i++) {
      const c = i % COLS;
      const r = Math.floor(i / COLS);
      // A small gap separates the hotbar row from the rest.
      const y = LAYOUT.titleH + SLOT.pad + r * (SLOT.size + SLOT.gap) + (r > 0 ? 2 : 0);
      const sv = new SlotView(scene, this.root, SLOT.pad + c * (SLOT.size + SLOT.gap), y);
      sv.bg
        .setInteractive()
        .on('pointerdown', () => this.click(i))
        .on('pointerover', () => {
          this.hover = i;
          this.showInfo();
        })
        .on('pointerout', () => {
          if (this.hover === i) this.hover = -1;
          this.showInfo();
        });
      this.slots.push(sv);
    }
    const infoY = this.height - LAYOUT.infoH + 1;
    this.root.add(scene.add.rectangle(6, infoY - 2, this.width - 12, 1, hex('mist')).setOrigin(0, 0));
    this.info = new PixelText(scene, 8, infoY + 2, '', { color: 'night', shadow: 'mist' });
    this.infoSub = new PixelText(scene, 8, infoY + 11, '', { color: 'umber', shadow: 'mist' });
    this.root.add([this.info, this.infoSub]);
    this.held = scene.add.image(0, 0, ITEM_TEXTURES.icons, 0).setOrigin(0.5, 0.5).setVisible(false);
    scene.input.on('pointermove', (p: Phaser.Input.Pointer) => this.held.setPosition(Math.round(p.x), Math.round(p.y)));
  }

  layout(w: number, h: number): void {
    this.shade.setSize(w, h);
    this.root.setPosition(Math.round((w - this.width) / 2), Math.round((h - this.height) / 2) - 8);
  }

  open(): void {
    this.isOpen = true;
    this.heldSlot = -1;
    this.shade.setVisible(true);
    this.root.setVisible(true);
    this.refresh();
    audio.playSfx('menuOpen', 0.8);
  }

  close(): void {
    this.isOpen = false;
    this.heldSlot = -1;
    this.held.setVisible(false);
    this.shade.setVisible(false);
    this.root.setVisible(false);
    audio.playSfx('menuClose', 0.8);
  }

  refresh(): void {
    if (!this.isOpen) return;
    this.state.inventory.forEach((st, i) => {
      this.slots[i].set(st, i === this.heldSlot || (this.heldSlot < 0 && i === this.state.selected), this.state.water);
      this.slots[i].setAlpha(i === this.heldSlot ? 0.35 : 1);
    });
    const hs = this.heldSlot >= 0 ? this.state.inventory[this.heldSlot] : null;
    if (hs) this.held.setFrame(iconFrame(itemDef(hs.id).icon)).setVisible(true).setDepth(10);
    else this.held.setVisible(false);
    this.showInfo();
  }

  private click(i: number): void {
    if (this.heldSlot < 0) {
      if (!this.state.inventory[i]) return;
      this.heldSlot = i;
      audio.playSfx('uiClick', 0.7);
    } else {
      moveSlot(this.state, this.heldSlot, i);
      this.heldSlot = -1;
      audio.playSfx('select', 0.8);
    }
    this.refresh();
  }

  private showInfo(): void {
    const i = this.hover >= 0 ? this.hover : this.heldSlot;
    const st = i >= 0 ? this.state.inventory[i] : null;
    if (!st) {
      this.info.setText('Click an item, then a slot to move it.');
      this.infoSub.setText('E or Esc to close');
      return;
    }
    const d = itemDef(st.id);
    this.info.setText(st.qty > 1 ? `${d.name}  x${st.qty}` : d.name);
    let sub = KIND_LABEL[d.kind] ?? '';
    if (d.tool === 'can') sub += `   Water ${this.state.water}/${FARM.canCapacity}`;
    if (d.price > 0) sub += `   Sells for ${d.price}g`;
    this.infoSub.setText(sub);
  }
}
