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
  /** Days since the game began (1 on the first day); used for regrowth timers. */
  daysPlayed: number;
  /** Friendship and today's talk/gift per NPC id. */
  npcs: Record<string, NpcState>;
  /** One-off story flags (rod received, letters sent, ...). */
  flags: Record<string, boolean>;
  weather: Weather;
  /** Tomorrow's weather, decided overnight (the TV and the board can tell it). */
  tomorrow: Weather;
  /** Forage lying around today, per map. */
  forage: Record<string, ForageSpot[]>;
  /** daysPlayed the forage above was spawned for. */
  forageDay: number;
  /** Fruit picked per map: prop anchor cell -> daysPlayed when picked. */
  picked: Record<string, Record<number, number>>;
  /** Letters waiting in the mailbox (ids from data/mail.ts). */
  mail: string[];
  fishCaught: number;
  /** Farm animals: daysPlayed of the last pet and of the last product given. */
  animals: Record<string, { petted: number; gave: number }>;
  /** The opening story has been shown. */
  introSeen: boolean;
}

export type Weather = 'sun' | 'rain';

export interface NpcState {
  /** Friendship points; every 100 is one heart. */
  points: number;
  /** daysPlayed of the last chat and the last gift. */
  talked: number;
  gifted: number;
}

export interface ForageSpot {
  x: number;
  y: number;
  id: string;
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
    daysPlayed: 1,
    npcs: {},
    flags: {},
    weather: 'sun',
    tomorrow: 'sun',
    forage: {},
    forageDay: 0,
    picked: {},
    mail: [],
    fishCaught: 0,
    animals: {},
    introSeen: false,
  };
}

export const state: GameState = newGameState();
