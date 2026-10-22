// The farmers a player can be. Alvira is Zulfian's own PNG sheet; the two
// generic farmers are drawn in code like the villagers, and their players
// name them. Story text says {name} where the farmer's name goes.

import type { CharacterLook } from '../art/characters';

export type HeroId = 'farmer-f' | 'farmer-m' | 'alvira' | 'alvira2';

export interface HeroDef {
  id: HeroId;
  /** Shown on the picker card. */
  label: string;
  texture: string;
  /** Code-drawn farmers only. */
  look?: CharacterLook;
  /** PNG sheet (in public/, PLAYER_ART frame size) loaded by BootScene, for drawn farmers. */
  sheet?: string;
  /** Generic farmers take the player's own name; this is the suggestion. */
  defaultName: string;
  namable: boolean;
}

export const HEROES: HeroDef[] = [
  {
    id: 'farmer-f',
    label: 'Petani perempuan',
    texture: 'char-farmer-f',
    defaultName: 'Sekar',
    namable: true,
    look: {
      hair: ['bark', 'umber', 'clay'],
      skin: ['umber', 'skinShade', 'skin', 'peach'],
      eye: 'night',
      shirt: ['plum', 'violet', 'lilac', 'rose'],
      pants: ['deep', 'sea', 'sky'],
      shoes: ['bark', 'umber'],
      hairStyle: 'long',
      hat: { style: 'caping', ramp: ['clay', 'amber', 'gold', 'cream'] },
    },
  },
  {
    id: 'farmer-m',
    label: 'Petani laki-laki',
    texture: 'char-farmer-m',
    defaultName: 'Bayu',
    namable: true,
    // The Phase 1 farmer.
    look: {
      hair: ['bark', 'umber', 'clay'],
      skin: ['umber', 'skinShade', 'skin', 'peach'],
      eye: 'night',
      shirt: ['wine', 'brick', 'coral', 'peach'],
      pants: ['deep', 'sea', 'sky'],
      shoes: ['bark', 'umber'],
      hairStyle: 'short',
      hat: { style: 'caping', ramp: ['clay', 'amber', 'gold', 'cream'] },
    },
  },
  { id: 'alvira', label: 'Alvira', texture: 'char-alvira', sheet: 'sprites/alvira.png', defaultName: 'Alvira', namable: false },
  // For testing Zulfian's new drawing (tools/build_alvira2.py); she is still Alvira in the story.
  { id: 'alvira2', label: 'Alvira 2.0 Testing', texture: 'char-alvira2', sheet: 'sprites/alvira2.png', defaultName: 'Alvira', namable: false },
];

export const DEFAULT_HERO: HeroId = 'alvira';

export const NAME_MAX = 12;

export function heroDef(id: string): HeroDef {
  return HEROES.find((h) => h.id === id) ?? HEROES.find((h) => h.id === DEFAULT_HERO)!;
}

export function cleanHeroName(raw: string): string {
  return raw.replace(/[^A-Za-z0-9 .'-]/g, '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
}

/** Puts the farmer's name into story text. */
export function fillName(text: string, name: string): string {
  return text.split('{name}').join(name);
}
