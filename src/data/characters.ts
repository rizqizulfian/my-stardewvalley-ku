// Character appearances. Colours are palette names; see art/characters.ts
// for what each ramp slot means.

import type { CharacterLook } from '../art/characters';

export interface CharacterDef {
  id: string;
  name: string;
  texture: string;
  look: CharacterLook;
}

export const PLAYER_CHARACTER: CharacterDef = {
  id: 'player',
  name: 'You',
  texture: 'char-player',
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
};

/** Everyone whose sprite sheet is generated at boot. NPCs join this list later. */
export const CHARACTERS: CharacterDef[] = [PLAYER_CHARACTER];
