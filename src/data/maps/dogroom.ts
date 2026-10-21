// The little house in town: one bare white room, and a dog dancing to its song.

import type { MapDef } from './types';

export const DOG_ROOM_MAP: MapDef = {
  id: 'dogroom',
  name: 'Rumah Kecil',
  terrain: [
    'xxWWWWWWWWWWxx',
    'xxWWWWWWWWWWxx',
    'xx__________xx',
    'xx__________xx',
    'xx__________xx',
    'xx__________xx',
    'xx__________xx',
    'xx__________xx',
    'xx__________xx',
    'xxxxxx__xxxxxx',
  ],
  props: [
    '--------------',
    '--------------',
    '--------------',
    '--------------',
    '--------------',
    '--------------',
    '--------------',
    '--------------',
    '--------------',
    '--------------',
  ],
  spawn: { x: 6, y: 8 },
  seed: 8,
  decor: { flowers: 0, tufts: 0, pebbles: 0, meadow: 0, reeds: 0, lilies: 0 },
  music: { morning: 'dog-dance', day: 'dog-dance', evening: 'dog-dance', night: 'dog-dance' },
  ambience: {},
  backdrop: 'ink',
  leaves: false,
  indoor: true,
  interiorStyle: 'paper',
  entrance: { blackMs: 900, fadeMs: 1600 },
  dancer: { x: 7, y: 5 },
  warps: [{ x: 6, y: 9, w: 2, to: 'town', tx: 3, ty: 9, face: 'down', door: true }],
};
