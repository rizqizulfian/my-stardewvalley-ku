// The farm's animals: who they are, where they roam (cells, inclusive) and
// what they give. Hens and ducks lay an egg on the ground each morning; the
// cows give milk and the sheep wool when you pet them. At night and on wet
// days they stay in the barn (Oyen the cat stays by the house).

import type { AnimalKind } from '../art/farm';
import { TIME } from '../config';
import type { Weather } from '../systems/GameState';

export interface CellArea {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface AnimalDef {
  id: string;
  name: string;
  kind: AnimalKind;
  map: string;
  area: CellArea;
  /** Lays this item on the ground every morning. */
  lays?: string;
  /** Gives this item when petted, every `every` days. */
  gives?: { item: string; every: number };
}

const PASTURE = { x0: 31, y0: 22, x1: 45, y1: 31 };
const COOP = { x0: 31, y0: 21, x1: 39, y1: 31 };
const POND = { x0: 37, y0: 24, x1: 45, y1: 31 };
const PORCH = { x0: 2, y0: 12, x1: 15, y1: 16 };

/** The barn: its interior map, the cells in front of each door, and the indoor runs. */
export const BARN = {
  map: 'kandang',
  /** Animals head home from this minute and come out again the next morning. */
  homeMinute: 19 * 60,
  doors: { farm: { x: 34, y: 30 }, kandang: { x: 8, y: 10 } } as Record<string, { x: number; y: number }>,
  /** On the farm the barn's back faces the pasture: animals north of the door go round its east side. */
  detour: { farm: { aboveRow: 30, via: [{ x: 38, y: 25 }, { x: 38, y: 30 }] } } as Record<string, { aboveRow: number; via: Array<{ x: number; y: number }> }>,
  coop: { x0: 1, y0: 3, x1: 6, y1: 9 },
  stalls: { x0: 9, y0: 3, x1: 16, y1: 9 },
} as const;


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

/** Where an animal is at this time: its outdoor run, or inside the barn. */
export function animalPlace(a: AnimalDef, minute: number, weather: Weather): { map: string; area: CellArea } {
  const inside = a.kind !== 'cat' && (weather !== 'sun' || minute >= BARN.homeMinute || minute < TIME.dayStartMinute);
  if (!inside) return { map: a.map, area: a.area };
  return { map: BARN.map, area: a.kind === 'chicken' || a.kind === 'duck' ? BARN.coop : BARN.stalls };
}
