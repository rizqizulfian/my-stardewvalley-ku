// The disco barn on the farm, next to the kandang: a DJ booth and speakers
// along the back wall, a light-up dance floor, a mirror ball, and a doodle
// puppy dancing under it all day and all night.

import type { MapDef } from './types';

export const DISKO_MAP: MapDef = {
  id: 'disko',
  name: 'Gudang Disko',
  terrain: [
    'xWWWWWWWWWWWWWWWWWWx',
    'xWWWWWWWWWWWWWWWWWWx',
    'x__________________x',
    'x__________________x',
    'x__________________x',
    'x__________________x',
    'x__________________x',
    'x__________________x',
    'x__________________x',
    'x__________________x',
    'x__________________x',
    'x__________________x',
    'xxxxxxxxx__xxxxxxxxx',
  ],
  props: [
    '--------------------',
    '--------1##---------',
    '-3----------------3-',
    '----4---2##-----4---',
    '--------------------',
    '--------------------',
    '--------------------',
    '--------------------',
    '--------------------',
    '--------------------',
    '-33--------------33-',
    '--------------------',
    '--------------------',
  ],
  spawn: { x: 10, y: 11 },
  seed: 21,
  decor: { flowers: 0, tufts: 0, pebbles: 0, meadow: 0, reeds: 0, lilies: 0 },
  music: { morning: 'disco', day: 'disco', evening: 'disco', night: 'disco' },
  ambience: {},
  backdrop: 'ink',
  leaves: false,
  indoor: true,
  interiorStyle: 'disco',
  disco: { floor: { x0: 5, y0: 5, x1: 14, y1: 9 }, puppy: { x: 10, y: 7 } },
  propLegend: { '1': 'discoSign', '2': 'djBooth', '3': 'hayBale', '4': 'speaker' },
  warps: [{ x: 9, y: 12, w: 2, to: 'farm', tx: 25, ty: 30, face: 'down', door: true }],
};
