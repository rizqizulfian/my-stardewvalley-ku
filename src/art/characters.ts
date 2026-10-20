// Character sprites built from material templates, 16x32 per frame.
// Templates use material symbols, and each character supplies colour ramps,
// so one set of drawings yields many distinct characters.
//
// Symbols
//   hair  1 2 3        (dark, mid, light)
//   skin  o s S t      (outline, shadow, base, highlight)   e = eye
//   shirt a b c d      (outline, shadow, base, highlight)
//   pants p q r        (outline, shadow, base)
//   shoes x y          (outline, base)
//   hat   A B C D      (outline, shadow, base, highlight)
//
// Frame layout: rows 0-1 hat room, head rows 2-15, torso rows 16-23,
// legs and shoes rows 24-31. Light comes from the top-left.

import { PixelGrid, type Legend } from './pixel';
import type { ColorName } from './palette';
import { PLAYER } from '../config';

export type Facing = 'down' | 'up' | 'right' | 'left';
export const FACINGS: readonly Facing[] = ['down', 'up', 'right', 'left'];

export interface CharacterLook {
  hair: readonly [ColorName, ColorName, ColorName];
  skin: readonly [ColorName, ColorName, ColorName, ColorName];
  eye: ColorName;
  shirt: readonly [ColorName, ColorName, ColorName, ColorName];
  pants: readonly [ColorName, ColorName, ColorName];
  shoes: readonly [ColorName, ColorName];
  hat?: { style: 'caping' | 'peci'; ramp: readonly [ColorName, ColorName, ColorName, ColorName] };
}

/** Frame layout of every character sheet: per facing, 2 idle frames then 4 walk frames. */
export const CHAR_FRAMES = {
  perFacing: 6,
  idle: [0, 1],
  walk: [2, 3, 4, 5],
} as const;

export function charFrame(facing: Facing, n: number): number {
  return FACINGS.indexOf(facing) * CHAR_FRAMES.perFacing + n;
}

// ---------------------------------------------------------------------------
// Templates (16 wide).

const HEAD_Y = 2;
const LEGS_Y = 24;

const DOWN_HEAD = [
  '.....111111.....',
  '...1122333211...',
  '..112233332211..',
  '..122333332221..',
  '.11223333222211.',
  '.12222222222221.',
  '.12221tSSSs1221.',
  '.122tSSSSSSs221.',
  '.12tSeSSSSeSs21.',
  '.12SSeSSSSeSs21.',
  '.1oSSSSSSSSSso1.',
  '..oSSSSssSSSso..',
  '...osSSSSSSso...',
  '.....oossoo.....',
];

const UP_HEAD = [
  '.....111111.....',
  '...1122333211...',
  '..112233332211..',
  '..122333332221..',
  '.11223333222211.',
  '.12223332222221.',
  '.12222222222221.',
  '.12222222222221.',
  '.12222222222221.',
  '.11222222222211.',
  '..o1122222211o..',
  '..oS11111111So..',
  '.....osSSso.....',
  '.....oossoo.....',
];

const SIDE_HEAD = [
  '....111111......',
  '..1122333311....',
  '.112233333321...',
  '.122333333221...',
  '.1222333322221..',
  '.12222222222221.',
  '.122222221tSSs1.',
  '.12222221tSSSSo.',
  '.1222221SSSSeSo.',
  '.1222221SSSSeSSo',
  '.122221sSSSSSso.',
  '..11221osSSSsso.',
  '....11oosSSso...',
  '......ossso.....',
];

const FRONT_BODY = [
  '...adddccccba...',
  '..adddcccccbba..',
  '..addbccccccba..',
  '..adbccccccbba..',
  '..adbccccccbba..',
  '..adbbccccbbba..',
  '..oSaqqqqqqaSo..',
  '....prrrrrqp....',
];

const BACK_BODY = [
  '...addccccbba...',
  '..adddcccccbba..',
  '..addbccccccba..',
  '..adbccccccbba..',
  '..adbccccccbba..',
  '..adbbbccccbba..',
  '..oSaqqqqqqaSo..',
  '....prrrrrqp....',
];

const SIDE_BODY = [
  '.....adccccba...',
  '....adcccccbba..',
  '....adccddcbba..',
  '....adccdccbba..',
  '....adbcdcbbba..',
  '....abbcdcbbba..',
  '....apqqStqqpa..',
  '.....prrrrqp....',
];

const FRONT_LEGS = {
  idle: [
    '....prrrrrqp....',
    '....prrppqqp....',
    '....prrppqqp....',
    '....prqppqqp....',
    '....pqqppqqp....',
    '....xyyxxyyx....',
    '....xxxxxxxx....',
    '................',
  ],
  stepA: [
    '....prrrrrqp....',
    '....prrppqqp....',
    '....prrppqqp....',
    '....prqppqqp....',
    '....pqqpxyyx....',
    '....xyyxxxxx....',
    '....xxxx........',
    '................',
  ],
  stepB: [
    '....prrrrrqp....',
    '....prrppqqp....',
    '....prrppqqp....',
    '....prqppqqp....',
    '....xyyxpqqp....',
    '....xxxxxyyx....',
    '........xxxx....',
    '................',
  ],
};

const SIDE_LEGS = {
  idle: [
    '.....prrrqp.....',
    '.....prrrqp.....',
    '.....prrqqp.....',
    '.....prrqqp.....',
    '.....pqqqqp.....',
    '.....xyyyyyx....',
    '.....xxxxxxx....',
    '................',
  ],
  stepA: [
    '.....prrrqp.....',
    '....pqqrrrrp....',
    '....pqqp.prrp...',
    '...pqqp...prrp..',
    '...pqqp...prrp..',
    '..xyyyx...xyyyx.',
    '..xxxxx...xxxxx.',
    '................',
  ],
  stepB: [
    '.....prrrqp.....',
    '....prrrrqqp....',
    '....prrp.pqqp...',
    '...prrp...pqqp..',
    '...prrp...pqqp..',
    '..xyyyx...xyyyx.',
    '..xxxxx...xxxxx.',
    '................',
  ],
};

// Hats, drawn over the head from the top of the frame.
const CAPING = {
  y: 1,
  rows: [
    '.......AA.......',
    '.....ADDCBA.....',
    '...ADDCCCCCBA...',
    '.ADDCCCCCCCCBBA.',
    'ADCCCCCCCCCCCBBA',
    'AAAAAAAAAAAAAAAA',
  ],
};

const PECI = {
  y: 1,
  rows: ['....AAAAAAAA....', '...ADDCCCCCBA...', '..ADCCCCCCCCBA..', '..ACCCCCCCCCBA..', '..AAAAAAAAAAAA..'],
};

// ---------------------------------------------------------------------------

function legendFor(look: CharacterLook): Legend {
  const [h1, h2, h3] = look.hair;
  const [so, ss, sb, st] = look.skin;
  const [a, b, c, d] = look.shirt;
  const [p, q, r] = look.pants;
  const [x, y] = look.shoes;
  const hat = look.hat?.ramp ?? (['night', 'plum', 'mauve', 'haze'] as const);
  return {
    '1': h1,
    '2': h2,
    '3': h3,
    o: so,
    s: ss,
    S: sb,
    t: st,
    e: look.eye,
    a,
    b,
    c,
    d,
    p,
    q,
    r,
    x,
    y,
    A: hat[0],
    B: hat[1],
    C: hat[2],
    D: hat[3],
  };
}

type View = 'down' | 'up' | 'side';

function upperBody(view: View, look: CharacterLook, legend: Legend): PixelGrid {
  const head = view === 'down' ? DOWN_HEAD : view === 'up' ? UP_HEAD : SIDE_HEAD;
  const body = view === 'down' ? FRONT_BODY : view === 'up' ? BACK_BODY : SIDE_BODY;
  const g = new PixelGrid(PLAYER.frameWidth, LEGS_Y).stamp(PixelGrid.fromRows([...head, ...body], legend, `char-${view}`), 0, HEAD_Y);
  if (look.hat) {
    const hat = look.hat.style === 'caping' ? CAPING : PECI;
    g.stamp(PixelGrid.fromRows(hat.rows, legend, `hat-${look.hat.style}`), 0, hat.y);
  }
  return g;
}

/** Arms swing by a pixel while walking: shift one arm's columns down, the other up. */
function swingArms(g: PixelGrid, view: View, dir: number): PixelGrid {
  if (view === 'side' || dir === 0) return g;
  const out = g.clone();
  const top = HEAD_Y + DOWN_HEAD.length + 2;
  const bottom = HEAD_Y + DOWN_HEAD.length + 7;
  const move = (x0: number, x1: number, dy: number) => {
    for (let x = x0; x <= x1; x++) {
      const col: number[] = [];
      for (let y = top; y <= bottom; y++) col.push(g.get(x, y));
      for (let y = top; y <= bottom; y++) {
        const src = y - dy - top;
        if (src >= 0 && src < col.length) out.data[y * g.w + x] = col[src];
      }
    }
  };
  move(2, 4, dir);
  move(11, 13, -dir);
  return out;
}

function legs(view: View, pose: 'idle' | 'stepA' | 'stepB', legend: Legend): PixelGrid {
  const set = view === 'side' ? SIDE_LEGS : FRONT_LEGS;
  return PixelGrid.fromRows(set[pose], legend, `legs-${view}-${pose}`);
}

function compose(upper: PixelGrid, lower: PixelGrid, bob: number): PixelGrid {
  const g = new PixelGrid(PLAYER.frameWidth, PLAYER.frameHeight);
  g.stamp(lower, 0, LEGS_Y);
  g.stamp(upper, 0, bob);
  return g;
}

/** All frames for one character, in CHAR_FRAMES order for each facing. */
export function buildCharacterFrames(look: CharacterLook): PixelGrid[] {
  const legend = legendFor(look);
  const frames: PixelGrid[] = [];
  for (const facing of FACINGS) {
    const view: View = facing === 'left' || facing === 'right' ? 'side' : facing;
    const up = upperBody(view, look, legend);
    const set: PixelGrid[] = [
      compose(up, legs(view, 'idle', legend), 0),
      compose(up, legs(view, 'idle', legend), 1),
      compose(swingArms(up, view, 1), legs(view, 'stepA', legend), 1),
      compose(up, legs(view, 'idle', legend), 0),
      compose(swingArms(up, view, -1), legs(view, 'stepB', legend), 1),
      compose(up, legs(view, 'idle', legend), 0),
    ];
    frames.push(...(facing === 'left' ? set.map((f) => f.flipX()) : set));
  }
  return frames;
}
