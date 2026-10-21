// Item definitions. Icons are frames of the generated item sheet, looked up
// by icon name (see art/items.ts).

export type ToolKind = 'hoe' | 'can' | 'axe' | 'pickaxe' | 'scythe';
export type ItemKind = 'tool' | 'seed' | 'produce' | 'resource' | 'food';

/** What eating or drinking one restores (need points, 0..100 scale; sleep is alertness). */
export interface FoodEffect {
  hunger?: number;
  thirst?: number;
  energy?: number;
  sleep?: number;
  /** Drinks play a sip instead of a bite. */
  drink?: boolean;
}

export interface ItemDef {
  id: string;
  name: string;
  kind: ItemKind;
  /** Icon name in the item icon sheet. */
  icon: string;
  /** Largest stack in one slot. Tools never stack. */
  stack: number;
  /** Value in gold: produce sells for this; shops charge this. */
  price: number;
  tool?: ToolKind;
  /** Crop id planted by this seed. */
  crop?: string;
  /** Edible: what one portion restores. */
  food?: FoodEffect;
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

  // Warung food and drink. Prices are what shops charge; selling gets half (see SHOPS.sellRatio).
  nasiGoreng: { id: 'nasiGoreng', name: 'Fried Rice', kind: 'food', icon: 'nasiGoreng', stack: 20, price: 60, food: { hunger: 60, energy: 25 } },
  soto: { id: 'soto', name: 'Chicken Soto', kind: 'food', icon: 'soto', stack: 20, price: 50, food: { hunger: 45, thirst: 20, energy: 20 } },
  pisangGoreng: { id: 'pisangGoreng', name: 'Fried Banana', kind: 'food', icon: 'pisangGoreng', stack: 20, price: 20, food: { hunger: 25, energy: 12 } },
  esTeh: { id: 'esTeh', name: 'Iced Tea', kind: 'food', icon: 'esTeh', stack: 20, price: 15, food: { thirst: 60, energy: 5, drink: true } },
  kopi: { id: 'kopi', name: 'Coffee', kind: 'food', icon: 'kopi', stack: 20, price: 25, food: { sleep: 45, thirst: 10, energy: 10, drink: true } },
  kelapa: { id: 'kelapa', name: 'Young Coconut', kind: 'food', icon: 'kelapa', stack: 20, price: 35, food: { thirst: 80, energy: 10, drink: true } },
  // Fruit stall.
  pisang: { id: 'pisang', name: 'Banana', kind: 'food', icon: 'pisang', stack: STACK, price: 15, food: { hunger: 20, energy: 8 } },
  mangga: { id: 'mangga', name: 'Mango', kind: 'food', icon: 'mangga', stack: STACK, price: 25, food: { hunger: 20, thirst: 20, energy: 5 } },
  jeruk: { id: 'jeruk', name: 'Orange', kind: 'food', icon: 'jeruk', stack: STACK, price: 20, food: { thirst: 30, hunger: 10, energy: 5 } },
  semangka: { id: 'semangka', name: 'Watermelon', kind: 'food', icon: 'semangka', stack: STACK, price: 20, food: { thirst: 45, energy: 5 } },

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
  ['pisang', 3],
  ['esTeh', 1],
];
