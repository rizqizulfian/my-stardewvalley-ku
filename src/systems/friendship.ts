// Friendship with villagers: a chat a day and gifts raise it; hearts unlock
// warmer lines.

import { FRIENDSHIP, GIFT_LINES, type NpcDef } from '../data/npcs';
import type { GameState, NpcState } from './GameState';

export type Taste = keyof typeof GIFT_LINES;

export function npcState(s: GameState, id: string): NpcState {
  return (s.npcs[id] ??= { points: 0, talked: 0, gifted: 0 });
}

export function hasMet(s: GameState, id: string): boolean {
  return !!s.npcs[id];
}

export function hearts(s: GameState, id: string): number {
  return Math.min(FRIENDSHIP.maxHearts, Math.floor((s.npcs[id]?.points ?? 0) / FRIENDSHIP.perHeart));
}

function addPoints(st: NpcState, n: number): void {
  st.points = Math.max(0, Math.min(FRIENDSHIP.perHeart * FRIENDSHIP.maxHearts, st.points + n));
}

/** First chat of the day counts. Returns true if friendship rose. */
export function chat(s: GameState, id: string): boolean {
  const st = npcState(s, id);
  if (st.talked === s.daysPlayed) return false;
  st.talked = s.daysPlayed;
  addPoints(st, FRIENDSHIP.chat);
  return true;
}

export function canGift(s: GameState, id: string): boolean {
  return npcState(s, id).gifted !== s.daysPlayed;
}

export function tasteOf(def: NpcDef, item: string): Taste {
  if (def.loves.includes(item)) return 'love';
  if (def.likes.includes(item)) return 'like';
  if (def.dislikes.includes(item)) return 'dislike';
  return 'neutral';
}

/** One gift a day per person. */
export function giveGift(s: GameState, def: NpcDef, item: string): Taste {
  const st = npcState(s, def.id);
  const taste = tasteOf(def, item);
  st.gifted = s.daysPlayed;
  addPoints(st, FRIENDSHIP.gift[taste]);
  return taste;
}

/** Today's line for this person: weather first sometimes, else by friendship tier. */
export function pickLine(s: GameState, def: NpcDef, rand: () => number = Math.random): string {
  const h = hearts(s, def.id);
  if (s.weather === 'rain' && def.rain?.length && rand() < 0.6) return def.rain[Math.floor(rand() * def.rain.length)];
  const tier = h >= 6 ? 2 : h >= 3 ? 1 : 0;
  const pool = def.lines.slice(0, tier + 1).flat();
  // Favour the newest tier a little.
  const fresh = def.lines[tier];
  const list = rand() < 0.5 && fresh.length ? fresh : pool;
  return list[Math.floor(rand() * list.length)];
}
