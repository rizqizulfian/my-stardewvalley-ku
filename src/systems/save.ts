// Save and load the whole GameState as JSON in localStorage. The game saves
// each morning after sleeping.

import { FARM, SAVE } from '../config';
import { cleanHeroName, heroDef } from '../data/heroes';
import { ITEMS } from '../data/items';
import { MAPS } from '../data/maps';
import { newGameState, type GameState } from './GameState';

export function hasSave(): boolean {
  try {
    return localStorage.getItem(SAVE.key) !== null;
  } catch {
    return false;
  }
}

export function saveGame(s: GameState): boolean {
  try {
    localStorage.setItem(SAVE.key, JSON.stringify(s));
    return true;
  } catch (e) {
    console.warn('[save] could not save', e);
    return false;
  }
}

/** Reads the save, filling anything missing (older saves) with new-game values. */
export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE.key);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Partial<GameState>;
    const fresh = newGameState();
    const s: GameState = { ...fresh, ...saved, needs: { ...fresh.needs, ...saved.needs } };
    // Drop anything the current game no longer knows about.
    s.inventory = Array.from({ length: FARM.inventorySlots }, (_, i) => {
      const st = s.inventory[i];
      return st && ITEMS[st.id] ? st : null;
    });
    s.shipped = (s.shipped ?? []).filter((l) => ITEMS[l.id]);
    if (!MAPS[s.mapId]) s.mapId = fresh.mapId;
    // Saves from before the opening story already know the farm.
    if (saved.introSeen === undefined) s.introSeen = true;
    // Saves from before the character choice were Alvira.
    const hero = heroDef(s.hero);
    s.hero = hero.id;
    s.name = hero.namable ? cleanHeroName(s.name ?? '') || hero.defaultName : hero.defaultName;
    return s;
  } catch (e) {
    console.warn('[save] could not load', e);
    return null;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE.key);
  } catch {
    // Nothing to clear.
  }
}
