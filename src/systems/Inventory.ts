// Backpack operations on GameState.inventory. Every change announces
// EV.inventoryChanged so the hotbar and menus can redraw.

import { FARM } from '../config';
import { ITEMS, type ItemDef } from '../data/items';
import { EV, bus } from './events';
import type { GameState, ItemStack } from './GameState';

export function itemDef(id: string): ItemDef {
  const d = ITEMS[id];
  if (!d) throw new Error(`[inventory] unknown item '${id}'`);
  return d;
}

export function selectedStack(s: GameState): ItemStack | null {
  return s.inventory[s.selected] ?? null;
}

export function selectSlot(s: GameState, i: number): void {
  const n = ((i % FARM.hotbarSlots) + FARM.hotbarSlots) % FARM.hotbarSlots;
  if (n === s.selected) return;
  s.selected = n;
  bus.emit(EV.inventoryChanged);
}

/** How many of `id` could still be added. */
export function roomFor(s: GameState, id: string): number {
  const max = itemDef(id).stack;
  let room = 0;
  for (const st of s.inventory) {
    if (!st) room += max;
    else if (st.id === id) room += max - st.qty;
  }
  return room;
}

/** Adds items, filling existing stacks first. Returns how many did not fit. */
export function addItem(s: GameState, id: string, qty: number, announce = true): number {
  const max = itemDef(id).stack;
  let left = qty;
  for (const st of s.inventory) {
    if (left <= 0) break;
    if (st && st.id === id && st.qty < max) {
      const n = Math.min(max - st.qty, left);
      st.qty += n;
      left -= n;
    }
  }
  for (let i = 0; i < s.inventory.length && left > 0; i++) {
    if (s.inventory[i]) continue;
    const n = Math.min(max, left);
    s.inventory[i] = { id, qty: n };
    left -= n;
  }
  const added = qty - left;
  if (added > 0) {
    bus.emit(EV.inventoryChanged);
    if (announce) bus.emit(EV.itemGained, id, added);
  }
  return left;
}

/** Removes up to `qty` from one slot. Returns how many were taken. */
export function takeFromSlot(s: GameState, slot: number, qty = 1): number {
  const st = s.inventory[slot];
  if (!st) return 0;
  const n = Math.min(qty, st.qty);
  st.qty -= n;
  if (st.qty <= 0) s.inventory[slot] = null;
  bus.emit(EV.inventoryChanged);
  return n;
}

export function countItem(s: GameState, id: string): number {
  return s.inventory.reduce((n, st) => n + (st && st.id === id ? st.qty : 0), 0);
}

/** Removes `qty` of an item from anywhere in the backpack. Returns false (and changes nothing) if there are not enough. */
export function removeItem(s: GameState, id: string, qty: number): boolean {
  if (countItem(s, id) < qty) return false;
  let left = qty;
  for (let i = s.inventory.length - 1; i >= 0 && left > 0; i--) {
    const st = s.inventory[i];
    if (!st || st.id !== id) continue;
    const n = Math.min(left, st.qty);
    st.qty -= n;
    left -= n;
    if (st.qty <= 0) s.inventory[i] = null;
  }
  bus.emit(EV.inventoryChanged);
  return true;
}

/** Swap or merge two slots (used by the backpack menu). */
export function moveSlot(s: GameState, from: number, to: number): void {
  if (from === to) return;
  const a = s.inventory[from];
  const b = s.inventory[to];
  if (a && b && a.id === b.id) {
    const max = itemDef(a.id).stack;
    const n = Math.min(max - b.qty, a.qty);
    b.qty += n;
    a.qty -= n;
    if (a.qty <= 0) s.inventory[from] = null;
  } else {
    s.inventory[from] = b;
    s.inventory[to] = a;
  }
  bus.emit(EV.inventoryChanged);
}
