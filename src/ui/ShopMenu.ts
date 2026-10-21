import Phaser from 'phaser';
import { SHOPS as SHOP_CFG } from '../config';
import { hex } from '../art/palette';
import { UI_ICON, UI_TEXTURES } from '../art/fx';
import { ITEM_TEXTURES, iconFrame } from '../art/items';
import { audio } from '../audio/AudioManager';
import { CROPS, inSeason } from '../data/crops';
import type { FoodEffect } from '../data/items';
import { SHOPS, type ShopDef } from '../data/shops';
import { EV, bus } from '../systems/events';
import type { GameState } from '../systems/GameState';
import { addItem, itemDef, roomFor, takeFromSlot } from '../systems/Inventory';
import { SLOT, SlotView } from './Hotbar';
import { addPanel } from './Panel';
import { PixelText } from './PixelText';

const LAYOUT = {
  listW: 150,
  rowH: 18,
  rows: 7,
  titleH: 18,
  infoH: 27,
  pad: 7,
  packCols: 6,
  packRows: 5,
} as const;

const W = LAYOUT.pad * 3 + LAYOUT.listW + LAYOUT.packCols * SLOT.size + (LAYOUT.packCols - 1) * SLOT.gap;
const H = LAYOUT.titleH + LAYOUT.pad + Math.max(LAYOUT.rows * LAYOUT.rowH, LAYOUT.packRows * (SLOT.size + SLOT.gap)) + LAYOUT.infoH;

export function foodLine(f: FoodEffect): string {
  const parts: string[] = [];
  if (f.hunger) parts.push(`Hunger +${f.hunger}`);
  if (f.thirst) parts.push(`Thirst +${f.thirst}`);
  if (f.energy) parts.push(`Energy +${f.energy}`);
  if (f.sleep) parts.push(`Alert +${f.sleep}`);
  return parts.join('  ');
}

interface Row {
  bg: Phaser.GameObjects.Rectangle;
  icon: Phaser.GameObjects.Image;
  name: PixelText;
  price: PixelText;
  coin: Phaser.GameObjects.Image;
}

/** Buy from the list on the left; click backpack items on the right to sell them. */
export class ShopMenu {
  private readonly root: Phaser.GameObjects.Container;
  private readonly shade: Phaser.GameObjects.Rectangle;
  private readonly title: PixelText;
  private readonly gold: PixelText;
  private readonly rows: Row[] = [];
  private readonly slots: SlotView[] = [];
  private readonly info: PixelText;
  private readonly infoSub: PixelText;
  private readonly empty: PixelText;
  private shop: ShopDef | null = null;
  private stock: string[] = [];
  private hoverRow = -1;
  private hoverSlot = -1;
  /** Slot index in the backpack for each grid cell (the backpack is 30 slots; the grid shows them all). */
  private readonly cells: number[] = [];

  constructor(
    scene: Phaser.Scene,
    private readonly state: GameState,
  ) {
    this.shade = scene.add.rectangle(0, 0, 10, 10, hex('ink'), 0.45).setOrigin(0, 0).setVisible(false).setInteractive();
    this.root = scene.add.container(0, 0).setVisible(false);
    this.root.add(addPanel(scene, 0, 0, W, H));
    this.title = new PixelText(scene, LAYOUT.pad + 2, 7, '', { color: 'brick', shadow: 'sand' });
    this.gold = new PixelText(scene, 0, 7, '', { color: 'umber', shadow: 'mist' });
    const coin = scene.add.image(0, 6, UI_TEXTURES.icons, UI_ICON.coin).setOrigin(0, 0).setName('coin');
    this.root.add([this.title, this.gold, coin]);

    const listY = LAYOUT.titleH + 2;
    for (let i = 0; i < LAYOUT.rows; i++) {
      const y = listY + i * LAYOUT.rowH;
      const bg = scene.add.rectangle(LAYOUT.pad, y, LAYOUT.listW, LAYOUT.rowH - 1, hex('sand'), 1).setOrigin(0, 0).setAlpha(0.001);
      const icon = scene.add.image(LAYOUT.pad + 1, y, ITEM_TEXTURES.icons, 0).setOrigin(0, 0);
      const name = new PixelText(scene, LAYOUT.pad + 20, y + 5, '', { color: 'night', shadow: 'mist' });
      const price = new PixelText(scene, 0, y + 5, '', { color: 'umber', shadow: 'mist' });
      const rc = scene.add.image(LAYOUT.pad + LAYOUT.listW - 11, y + 4, UI_TEXTURES.icons, UI_ICON.coin).setOrigin(0, 0);
      bg.setInteractive({ useHandCursor: true })
        .on('pointerover', () => {
          this.hoverRow = i;
          this.refresh();
        })
        .on('pointerout', () => {
          if (this.hoverRow === i) this.hoverRow = -1;
          this.refresh();
        })
        .on('pointerdown', (p: Phaser.Input.Pointer) => this.buy(i, p.event.shiftKey ? SHOP_CFG.bulk : 1));
      this.root.add([bg, icon, name, price, rc]);
      this.rows.push({ bg, icon, name, price, coin: rc });
    }
    this.empty = new PixelText(scene, LAYOUT.pad + 4, listY + 6, '', { color: 'umber', shadow: 'mist', wrapWidth: LAYOUT.listW - 8 });
    this.root.add(this.empty);

    const packX = LAYOUT.pad * 2 + LAYOUT.listW;
    // Show the whole backpack: 6 columns x 5 rows = 30 slots.
    for (let i = 0; i < LAYOUT.packCols * LAYOUT.packRows; i++) {
      const c = i % LAYOUT.packCols;
      const r = Math.floor(i / LAYOUT.packCols);
      const sv = new SlotView(scene, this.root, packX + c * (SLOT.size + SLOT.gap), listY + r * (SLOT.size + SLOT.gap));
      this.cells.push(i);
      sv.bg
        .setInteractive()
        .on('pointerover', () => {
          this.hoverSlot = i;
          this.refresh();
        })
        .on('pointerout', () => {
          if (this.hoverSlot === i) this.hoverSlot = -1;
          this.refresh();
        })
        .on('pointerdown', (p: Phaser.Input.Pointer) => this.sell(i, p.event.shiftKey));
      this.slots.push(sv);
    }

    const infoY = H - LAYOUT.infoH + 1;
    this.root.add(scene.add.rectangle(6, infoY - 2, W - 12, 1, hex('mist')).setOrigin(0, 0));
    this.info = new PixelText(scene, 8, infoY + 1, '', { color: 'night', shadow: 'mist' });
    this.infoSub = new PixelText(scene, 8, infoY + 10, '', { color: 'umber', shadow: 'mist' });
    this.root.add([this.info, this.infoSub]);
  }

  get isOpen(): boolean {
    return this.shop !== null;
  }

  layout(w: number, h: number): void {
    this.shade.setSize(w, h);
    this.root.setPosition(Math.round((w - W) / 2), Math.max(2, Math.round((h - H) / 2) - 10));
  }

  open(id: string): void {
    const shop = SHOPS[id];
    if (!shop) return;
    this.shop = shop;
    this.stock = shop.stock.filter((item) => {
      const crop = itemDef(item).crop;
      return !crop || inSeason(CROPS[crop], this.state.season);
    });
    this.hoverRow = -1;
    this.hoverSlot = -1;
    this.title.setText(shop.name);
    this.shade.setVisible(true);
    this.root.setVisible(true);
    audio.playSfx('menuOpen', 0.8);
    this.refresh();
  }

  close(): void {
    this.shop = null;
    this.shade.setVisible(false);
    this.root.setVisible(false);
    audio.playSfx('menuClose', 0.8);
  }

  private sellPrice(id: string): number {
    return Math.max(1, Math.floor(itemDef(id).price * SHOP_CFG.sellRatio));
  }

  private buys(id: string): boolean {
    const d = itemDef(id);
    return !!this.shop && d.price > 0 && this.shop.buys.includes(d.kind);
  }

  private buy(row: number, qty: number): void {
    const id = this.stock[row];
    if (!id) return;
    const price = itemDef(id).price;
    const n = Math.min(qty, Math.floor(this.state.gold / price), roomFor(this.state, id));
    if (n <= 0) {
      audio.playSfx('bonk', 0.5);
      bus.emit(EV.notice, this.state.gold < price ? "You can't afford that." : 'Your backpack is full');
      return;
    }
    this.state.gold -= n * price;
    addItem(this.state, id, n);
    bus.emit(EV.goldChanged, this.state.gold);
    audio.playSfx('coin', 0.8);
    this.refresh();
  }

  private sell(slot: number, all: boolean): void {
    const st = this.state.inventory[slot];
    if (!st) return;
    if (!this.buys(st.id)) {
      audio.playSfx('bonk', 0.5);
      bus.emit(EV.notice, `${this.shop?.name} doesn't buy that.`);
      return;
    }
    const n = takeFromSlot(this.state, slot, all ? st.qty : 1);
    this.state.gold += n * this.sellPrice(st.id);
    bus.emit(EV.goldChanged, this.state.gold);
    audio.playSfx('coin', 0.8);
    this.refresh();
  }

  refresh(): void {
    if (!this.shop) return;
    this.gold.setText(`${this.state.gold}g`);
    this.gold.x = W - LAYOUT.pad - 2 - this.gold.width;
    const coin = this.root.getByName('coin') as Phaser.GameObjects.Image;
    coin.x = this.gold.x - 11;

    this.rows.forEach((r, i) => {
      const id = this.stock[i];
      const vis = !!id;
      r.bg.setVisible(vis).setAlpha(i === this.hoverRow ? 0.9 : 0.001);
      r.icon.setVisible(vis);
      r.name.setVisible(vis);
      r.price.setVisible(vis);
      r.coin.setVisible(vis);
      if (!id) return;
      const d = itemDef(id);
      r.icon.setFrame(iconFrame(d.icon));
      r.name.setText(d.name);
      const afford = this.state.gold >= d.price;
      r.price.setStyle({ color: afford ? 'umber' : 'brick' }).setText(String(d.price));
      r.price.x = LAYOUT.pad + LAYOUT.listW - 13 - r.price.width;
    });
    this.empty.setVisible(this.stock.length === 0).setText(this.shop.emptyText ?? 'Sold out.');

    this.slots.forEach((sv, i) => {
      const st = this.state.inventory[this.cells[i]];
      sv.set(st, false, this.state.water);
      sv.setAlpha(st && !this.buys(st.id) ? 0.4 : 1);
    });
    this.showInfo();
  }

  private showInfo(): void {
    const id = this.hoverRow >= 0 ? this.stock[this.hoverRow] : null;
    if (id) {
      const d = itemDef(id);
      this.info.setText(`Buy ${d.name} for ${d.price}g`);
      const crop = d.crop ? CROPS[d.crop] : null;
      this.infoSub.setText(
        d.food ? foodLine(d.food) : crop ? `Grows in ${crop.stageDays.reduce((a, b) => a + b, 0)} days. Shift-click buys ${SHOP_CFG.bulk}.` : `Shift-click buys ${SHOP_CFG.bulk}.`,
      );
      return;
    }
    const st = this.hoverSlot >= 0 ? this.state.inventory[this.hoverSlot] : null;
    if (st) {
      const d = itemDef(st.id);
      if (this.buys(st.id)) {
        this.info.setText(`Sell ${d.name} for ${this.sellPrice(st.id)}g each`);
        this.infoSub.setText('Click: sell 1   Shift-click: sell all');
      } else {
        this.info.setText(d.name);
        this.infoSub.setText(d.food ? foodLine(d.food) : "This shop doesn't buy it.");
      }
      return;
    }
    this.info.setText('Click an item to buy it.');
    this.infoSub.setText('Click your items to sell.  E or Esc: leave');
  }
}
