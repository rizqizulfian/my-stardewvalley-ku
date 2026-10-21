// Body needs: energy, hunger, thirst and alertness ("sleep"). They drain with
// time and work, come back with food, drink, rest and sleep, and slow the
// player down when they run out.

import { NEEDS } from '../config';
import type { FoodEffect, ToolKind } from '../data/items';
import { EV, bus } from './events';
import type { GameState, NeedId } from './GameState';

const LOW_MESSAGES: Record<NeedId, string> = {
  energy: "You're getting tired. Rest on a bench or eat something.",
  hunger: "You're hungry. Time to eat.",
  thirst: "You're thirsty. Drink at a well or the warung.",
  sleep: "You're getting sleepy. Head home to bed.",
};

const EMPTY_MESSAGES: Record<NeedId, string> = {
  energy: "You're exhausted.",
  hunger: "You're starving! You're losing energy.",
  thirst: "You're parched! You're losing energy.",
  sleep: 'You can barely keep your eyes open...',
};

function clamp(v: number): number {
  return Math.max(0, Math.min(NEEDS.max, v));
}

/** Changes one need, announcing threshold crossings. */
export function addNeed(s: GameState, id: NeedId, amount: number): void {
  const before = s.needs[id];
  const after = clamp(before + amount);
  s.needs[id] = after;
  if (amount < 0) {
    if (before >= NEEDS.low && after < NEEDS.low) bus.emit(EV.notice, LOW_MESSAGES[id]);
    else if (before > 0 && after <= 0) bus.emit(EV.notice, EMPTY_MESSAGES[id]);
  }
  bus.emit(EV.needsChanged);
}

/** One game minute passes. */
export function tickNeeds(s: GameState): void {
  const late = s.minute >= 24 * 60;
  addNeed(s, 'hunger', -NEEDS.drain.hunger);
  addNeed(s, 'thirst', -NEEDS.drain.thirst);
  addNeed(s, 'sleep', -NEEDS.drain.sleep * (late ? NEEDS.lateSleepMultiplier : 1));
  const empty = (['hunger', 'thirst', 'sleep'] as const).filter((k) => s.needs[k] <= 0).length;
  if (empty > 0) addNeed(s, 'energy', -NEEDS.emptyEnergyDrain * empty);
}

/** Pays for one tool swing. False if too exhausted to swing at all. */
export function spendToolEnergy(s: GameState, tool: ToolKind): boolean {
  if (s.needs.energy <= 0) {
    bus.emit(EV.notice, "Too tired to work. Rest, eat, or sleep.");
    return false;
  }
  addNeed(s, 'energy', -NEEDS.toolEnergy[tool]);
  addNeed(s, 'thirst', -NEEDS.toolThirst);
  return true;
}

export function consume(s: GameState, f: FoodEffect): void {
  if (f.hunger) addNeed(s, 'hunger', f.hunger);
  if (f.thirst) addNeed(s, 'thirst', f.thirst);
  if (f.energy) addNeed(s, 'energy', f.energy);
  if (f.sleep) addNeed(s, 'sleep', f.sleep);
}

/** Walking speed factor: slower when worn out. */
export function walkFactor(s: GameState): number {
  const n = s.needs;
  const worn = n.energy < NEEDS.low / 2 || n.hunger <= 0 || n.thirst <= 0 || n.sleep < NEEDS.low / 2;
  return worn ? NEEDS.slowWalk : 1;
}
