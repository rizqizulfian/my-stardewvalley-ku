// Plain-data game state. Everything here is serialisable and is saved to
// localStorage as-is (see save.ts).

import { FARM, NEEDS, TIME } from '../config';
import { STARTING_ITEMS } from '../data/items';
import { START_MAP } from '../data/maps';

export interface ItemStack {
  id: string;
  qty: number;
}

export interface CropState {
  id: string;
  /** Growth stage; the last stage (stageDays.length) is ripe. */
  stage: number;
  /** Watered days spent in the current stage. */
  days: number;
  /** True after a regrowing crop has been picked once. */
  regrowing?: boolean;
}

export interface SoilState {
  wet: boolean;
  crop?: CropState;
}

export interface GameState {
  /** Minutes since midnight of the current day (6:00 = 360, can exceed 1440 until 2:00). */
  minute: number;
  /** 1-based day of the season. */
  day: number;
  /** 0..3 index into SEASONS. */
  season: number;
  year: number;
  gold: number;
  mapId: string;
  /** Backpack; the first FARM.hotbarSlots entries are the hotbar. */
  inventory: Array<ItemStack | null>;
  /** Selected hotbar slot. */
  selected: number;
  /** Water left in the watering can. */
  water: number;
  /** Tilled cells per map, keyed by cell index. */
  soil: Record<string, Record<number, SoilState>>;
  /** Props cleared per map (anchor cell indices). */
  removed: Record<string, number[]>;
  /** Body needs, 0..100 (see NEEDS in config). */
  needs: Needs;
  /** Items in the shipping box, sold overnight. */
  shipped: ItemStack[];
}

export interface Needs {
  energy: number;
  hunger: number;
  thirst: number;
  /** Alertness: 100 just after waking, falls through the day. */
  sleep: number;
}

export type NeedId = keyof Needs;

export function newGameState(): GameState {
  const inventory: Array<ItemStack | null> = new Array(FARM.inventorySlots).fill(null);
  STARTING_ITEMS.forEach(([id, qty], i) => (inventory[i] = { id, qty }));
  return {
    minute: TIME.dayStartMinute,
    day: 1,
    season: 0,
    year: 1,
    gold: TIME.startingGold,
    mapId: START_MAP,
    inventory,
    selected: 0,
    water: FARM.canCapacity,
    soil: {},
    removed: {},
    needs: { energy: NEEDS.max, hunger: 85, thirst: 80, sleep: NEEDS.max },
    shipped: [],
  };
}

export const state: GameState = newGameState();
