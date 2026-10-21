// The farm's shipping box: items put in during the day are sold overnight at
// full value.

import { itemDef } from './Inventory';
import { EV, bus } from './events';
import type { GameState } from './GameState';

export interface SaleLine {
  id: string;
  qty: number;
  gold: number;
}

export function canShip(id: string): boolean {
  const d = itemDef(id);
  return d.kind !== 'tool' && d.price > 0;
}

/** Moves a whole backpack slot into the box. Returns the stack shipped. */
export function shipSlot(s: GameState, slot: number): { id: string; qty: number } | null {
  const st = s.inventory[slot];
  if (!st || !canShip(st.id)) return null;
  const line = s.shipped.find((l) => l.id === st.id);
  if (line) line.qty += st.qty;
  else s.shipped.push({ id: st.id, qty: st.qty });
  s.inventory[slot] = null;
  bus.emit(EV.inventoryChanged);
  return { id: st.id, qty: st.qty };
}

/** Overnight sale: pays out and empties the box. */
export function sellShipped(s: GameState): { lines: SaleLine[]; total: number } {
  const lines = s.shipped.map((l) => ({ id: l.id, qty: l.qty, gold: l.qty * itemDef(l.id).price }));
  const total = lines.reduce((n, l) => n + l.gold, 0);
  s.shipped = [];
  if (total > 0) {
    s.gold += total;
    bus.emit(EV.goldChanged, s.gold);
  }
  return { lines, total };
}
