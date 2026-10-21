// Generated layout, then hand-tuned. See data/terrain.ts and data/props.ts for
// what each character means.

import type { MapDef } from './types';

export const HOUSE_MAP: MapDef = {
  id: 'house',
  name: 'Rumah',
  terrain: [
    'xWWWWWWWWWWWWx',
    'xWWWWWWWWWWWWx',
    'xWWWWWWWWWWWWx',
    'x____________x',
    'x____________x',
    'x____________x',
    'x____________x',
    'x____________x',
    'x____________x',
    'x____________x',
    'x____________x',
    'xxxxxx__xxxxxx',
  ],
  props: [
    '--------------',
    '---i#----i#---',
    '--------------',
    '---js#----z#o-',
    '-##-----------',
    '-d#-----------',
    '--------------',
    '-----kt#k-----',
    '-----###------',
    '-----G##------',
    '-j----m-----o-',
    '--------------',
  ],
  spawn: { x: 6, y: 10 },
  seed: 3,
  decor: { flowers: 0, tufts: 0, pebbles: 0, meadow: 0, reeds: 0, lilies: 0 },
  music: { morning: 'home', day: 'home', evening: 'home', night: 'home' },
  ambience: { birds: 0.15, wind: 0.1, crickets: 0.3, water: 0 },
  backdrop: 'ink',
  leaves: false,
  indoor: true,
  interiorStyle: 'home',
  warps: [{ x: 6, y: 11, w: 2, to: 'farm', tx: 6, ty: 12, face: 'down', door: true }],
};
