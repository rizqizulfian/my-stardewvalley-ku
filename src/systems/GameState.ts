// Plain-data game state. Everything here is serialisable so it can be saved
// to localStorage as-is in the save/load phase.

import { TIME } from '../config';
import { START_MAP } from '../data/maps';

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
}

export function newGameState(): GameState {
  return {
    minute: TIME.dayStartMinute,
    day: 1,
    season: 0,
    year: 1,
    gold: TIME.startingGold,
    mapId: START_MAP,
  };
}

export const state: GameState = newGameState();
