// The farm's animals: who they are, where they roam (cells, inclusive) and
// what they give. Hens and ducks lay an egg on the ground each morning; the
// cows give milk and the sheep wool when you pet them.

import type { AnimalKind } from '../art/farm';

export interface AnimalDef {
  id: string;
  name: string;
  kind: AnimalKind;
  map: string;
  area: { x0: number; y0: number; x1: number; y1: number };
  /** Lays this item on the ground every morning. */
  lays?: string;
  /** Gives this item when petted, every `every` days. */
  gives?: { item: string; every: number };
}

const PASTURE = { x0: 31, y0: 22, x1: 45, y1: 31 };
const COOP = { x0: 31, y0: 21, x1: 39, y1: 31 };
const POND = { x0: 37, y0: 24, x1: 45, y1: 31 };
const PORCH = { x0: 2, y0: 12, x1: 15, y1: 16 };

export const ANIMAL_INFO: Record<AnimalKind, { speed: number; sound: string; love: string }> = {
  chicken: { speed: 20, sound: 'cluck', love: 'clucks happily.' },
  duck: { speed: 16, sound: 'quack', love: 'quacks and wiggles its tail.' },
  cat: { speed: 24, sound: 'meow', love: 'purrs and rubs against your leg.' },
  sheep: { speed: 12, sound: 'baa', love: 'leans into your hand. So soft!' },
  cow: { speed: 10, sound: 'moo', love: 'gives a slow, happy moo.' },
};

export const ANIMALS: AnimalDef[] = [
  { id: 'kiki', name: 'Kiki', kind: 'chicken', map: 'farm', area: COOP, lays: 'telur' },
  { id: 'koko', name: 'Koko', kind: 'chicken', map: 'farm', area: COOP, lays: 'telur' },
  { id: 'pipit', name: 'Pipit', kind: 'chicken', map: 'farm', area: COOP, lays: 'telur' },
  { id: 'jago', name: 'Jago', kind: 'chicken', map: 'farm', area: COOP, lays: 'telur' },
  { id: 'dodo', name: 'Dodo', kind: 'duck', map: 'farm', area: POND, lays: 'telurBebek' },
  { id: 'wewe', name: 'Wewe', kind: 'duck', map: 'farm', area: POND, lays: 'telurBebek' },
  { id: 'bebi', name: 'Bebi', kind: 'duck', map: 'farm', area: POND, lays: 'telurBebek' },
  { id: 'domi', name: 'Domi', kind: 'sheep', map: 'farm', area: PASTURE, gives: { item: 'wol', every: 3 } },
  { id: 'kapas', name: 'Kapas', kind: 'sheep', map: 'farm', area: PASTURE, gives: { item: 'wol', every: 3 } },
  { id: 'embe', name: 'Embe', kind: 'sheep', map: 'farm', area: PASTURE, gives: { item: 'wol', every: 3 } },
  { id: 'mimi', name: 'Mimi', kind: 'cow', map: 'farm', area: PASTURE, gives: { item: 'susu', every: 1 } },
  { id: 'belang', name: 'Belang', kind: 'cow', map: 'farm', area: PASTURE, gives: { item: 'susu', every: 1 } },
  { id: 'oyen', name: 'Oyen', kind: 'cat', map: 'farm', area: PORCH },
];
