// Item definitions. Icons are frames of the generated item sheet, looked up
// by icon name (see art/items.ts).

export type ToolKind = 'hoe' | 'can' | 'axe' | 'pickaxe' | 'scythe';
export type ItemKind = 'tool' | 'seed' | 'produce' | 'resource';

export interface ItemDef {
  id: string;
  name: string;
  kind: ItemKind;
  /** Icon name in the item icon sheet. */
  icon: string;
  /** Largest stack in one slot. Tools never stack. */
  stack: number;
  /** Sell price in gold (used by the shipping box later). */
  price: number;
  tool?: ToolKind;
  /** Crop id planted by this seed. */
  crop?: string;
}

const STACK = 99;

export const ITEMS: Record<string, ItemDef> = {
  hoe: { id: 'hoe', name: 'Hoe', kind: 'tool', icon: 'hoe', stack: 1, price: 0, tool: 'hoe' },
  can: { id: 'can', name: 'Watering Can', kind: 'tool', icon: 'can', stack: 1, price: 0, tool: 'can' },
  axe: { id: 'axe', name: 'Axe', kind: 'tool', icon: 'axe', stack: 1, price: 0, tool: 'axe' },
  pickaxe: { id: 'pickaxe', name: 'Pickaxe', kind: 'tool', icon: 'pickaxe', stack: 1, price: 0, tool: 'pickaxe' },
  scythe: { id: 'scythe', name: 'Scythe', kind: 'tool', icon: 'scythe', stack: 1, price: 0, tool: 'scythe' },

  seedPadi: { id: 'seedPadi', name: 'Rice Seeds', kind: 'seed', icon: 'seedPadi', stack: STACK, price: 10, crop: 'padi' },
  seedJagung: { id: 'seedJagung', name: 'Corn Seeds', kind: 'seed', icon: 'seedJagung', stack: STACK, price: 15, crop: 'jagung' },
  seedCabai: { id: 'seedCabai', name: 'Chili Seeds', kind: 'seed', icon: 'seedCabai', stack: STACK, price: 20, crop: 'cabai' },
  seedTerong: { id: 'seedTerong', name: 'Eggplant Seeds', kind: 'seed', icon: 'seedTerong', stack: STACK, price: 20, crop: 'terong' },

  padi: { id: 'padi', name: 'Rice', kind: 'produce', icon: 'padi', stack: STACK, price: 40 },
  jagung: { id: 'jagung', name: 'Corn', kind: 'produce', icon: 'jagung', stack: STACK, price: 50 },
  cabai: { id: 'cabai', name: 'Chili', kind: 'produce', icon: 'cabai', stack: STACK, price: 35 },
  terong: { id: 'terong', name: 'Eggplant', kind: 'produce', icon: 'terong', stack: STACK, price: 45 },

  seedMatahari: { id: 'seedMatahari', name: 'Sunflower Seeds', kind: 'seed', icon: 'seedMatahari', stack: STACK, price: 25, crop: 'matahari' },
  seedMawar: { id: 'seedMawar', name: 'Rose Seeds', kind: 'seed', icon: 'seedMawar', stack: STACK, price: 30, crop: 'mawar' },
  seedMelati: { id: 'seedMelati', name: 'Jasmine Seeds', kind: 'seed', icon: 'seedMelati', stack: STACK, price: 20, crop: 'melati' },
  matahari: { id: 'matahari', name: 'Sunflower', kind: 'produce', icon: 'matahari', stack: STACK, price: 60 },
  mawar: { id: 'mawar', name: 'Rose', kind: 'produce', icon: 'mawar', stack: STACK, price: 70 },
  melati: { id: 'melati', name: 'Jasmine', kind: 'produce', icon: 'melati', stack: STACK, price: 55 },

  wood: { id: 'wood', name: 'Wood', kind: 'resource', icon: 'wood', stack: STACK, price: 2 },
  stone: { id: 'stone', name: 'Stone', kind: 'resource', icon: 'stone', stack: STACK, price: 2 },
  fiber: { id: 'fiber', name: 'Fiber', kind: 'resource', icon: 'fiber', stack: STACK, price: 1 },
};

/** What a new game starts with, in slot order (the first ten are the hotbar). */
export const STARTING_ITEMS: Array<[string, number]> = [
  ['hoe', 1],
  ['can', 1],
  ['axe', 1],
  ['pickaxe', 1],
  ['scythe', 1],
  ['seedPadi', 15],
  ['seedJagung', 10],
  ['seedCabai', 10],
  ['seedTerong', 10],
  // Flower seeds start in the backpack (second row).
  ['seedMatahari', 5],
  ['seedMawar', 5],
  ['seedMelati', 5],
];
