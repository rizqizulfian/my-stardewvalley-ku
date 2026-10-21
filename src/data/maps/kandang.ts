// The animal barn on the farm: a coop corner with nesting boxes on the left,
// stalls with hay mangers on the right. The animals sleep here at night and
// shelter here on wet days.

import type { MapDef } from './types';

export const KANDANG_MAP: MapDef = {
  id: 'kandang',
  name: 'Kandang',
  terrain: [
    'xWWWWWWWWWWWWWWWWx',
    'xWWWWWWWWWWWWWWWWx',
    'x________________x',
    'x________________x',
    'x________________x',
    'x________________x',
    'x________________x',
    'x________________x',
    'x________________x',
    'x________________x',
    'x________________x',
    'xxxxxxxx__xxxxxxxx',
  ],
  props: [
    '------------------',
    '------------------',
    '-11111jf--2#2#2#j-',
    '-------f----------',
    '-------f----------',
    '------------------',
    '------------------',
    '--4#--------------',
    '------------------',
    '-3--------------3-',
    '-33-----------333-',
    '------------------',
  ],
  spawn: { x: 8, y: 10 },
  seed: 12,
  decor: { flowers: 0, tufts: 0, pebbles: 0, meadow: 0, reeds: 0, lilies: 0 },
  music: { morning: 'farm-morning', day: 'apple-cider', evening: 'farm-evening', night: 'farm-night' },
  ambience: { birds: 0.1, wind: 0.25, crickets: 0.4, water: 0 },
  backdrop: 'ink',
  leaves: false,
  indoor: true,
  interiorStyle: 'barn',
  propLegend: { '1': 'nestBox', '2': 'manger', '3': 'hayBale', '4': 'trough' },
  warps: [{ x: 8, y: 11, w: 2, to: 'farm', tx: 34, ty: 30, face: 'down', door: true }],
};
