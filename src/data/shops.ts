// Shops: what each sells, which kinds of items it buys back, and its hours.
// Seeds only appear while their crop is in season.

import type { ItemKind } from './items';

export interface ShopDef {
  id: string;
  name: string;
  /** Opening hours in minutes since midnight. */
  open: number;
  close: number;
  /** Item ids for sale. */
  stock: string[];
  /** Item kinds the shop buys from the player. */
  buys: ItemKind[];
  /** Shown when nothing is in stock (e.g. no seeds in winter). */
  emptyText?: string;
}

export const SHOPS: Record<string, ShopDef> = {
  toko: {
    id: 'toko',
    name: 'Toko Tani',
    open: 9 * 60,
    close: 17 * 60,
    stock: ['seedPadi', 'seedJagung', 'seedCabai', 'seedTerong', 'seedMatahari', 'seedMawar', 'seedMelati'],
    buys: ['produce', 'resource', 'seed'],
    emptyText: 'No seeds grow in winter. See you in spring!',
  },
  warung: {
    id: 'warung',
    name: 'Warung Bu Sari',
    open: 7 * 60,
    close: 22 * 60,
    stock: ['nasiGoreng', 'soto', 'pisangGoreng', 'esTeh', 'kopi', 'kelapa'],
    buys: ['produce'],
  },
  buah: {
    id: 'buah',
    name: 'Kios Buah',
    open: 8 * 60,
    close: 18 * 60,
    stock: ['pisang', 'mangga', 'jeruk', 'semangka'],
    buys: ['produce', 'food'],
  },
};
