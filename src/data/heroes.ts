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
  /** Drawn farmers: PNG sheet in public/ (loaded by BootScene) with its cell size, drawn at `res`
   * sheet pixels per game pixel (shown at 1 / res). */
  sheet?: { url: string; frameWidth: number; frameHeight: number; res: number };
  /** Her own dance: sheet frames played one per beat, in place of the shared four dance poses. */
  danceFrames?: readonly number[];
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
  { id: 'alvira', label: 'Alvira', texture: 'char-alvira', sheet: { url: 'sprites/alvira.png', frameWidth: 18, frameHeight: 30, res: 1 }, defaultName: 'Alvira', namable: false },
  // For testing Zulfian's new drawing (tools/build_alvira2.py); she is still Alvira in the story.
  // Drawn bigger than the villagers so the drawing's details show (the canvas is at game resolution).
  {
    id: 'alvira2',
    label: 'Alvira 2.0 Testing',
    texture: 'char-alvira2',
    sheet: { url: 'sprites/alvira2.png', frameWidth: 22, frameHeight: 36, res: 1 },
    // Zulfian's 16-step dance, after the 4 x 13 facing frames (DANCE_START in the build script).
    danceFrames: Array.from({ length: 16 }, (_, i) => 52 + i),
    defaultName: 'Alvira',
    namable: false,
  },
];

export const DEFAULT_HERO: HeroId = 'alvira';

export const NAME_MAX = 12;

export function heroDef(id: string): HeroDef {
  return HEROES.find((h) => h.id === id) ?? HEROES.find((h) => h.id === DEFAULT_HERO)!;
}

/** Display scale for a farmer's texture (1 / res for drawn sheets), by texture key. */
export function heroScale(texture: string): number {
  return 1 / (HEROES.find((h) => h.texture === texture)?.sheet?.res ?? 1);
}

/** A farmer's own dance frames, by texture key (none: the shared dance poses). */
export function heroDance(texture: string): readonly number[] | undefined {
  return HEROES.find((h) => h.texture === texture)?.danceFrames;
}

export function cleanHeroName(raw: string): string {
  return raw.replace(/[^A-Za-z0-9 .'-]/g, '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
}

/** Puts the farmer's name into story text. */
export function fillName(text: string, name: string): string {
  return text.split('{name}').join(name);
}
