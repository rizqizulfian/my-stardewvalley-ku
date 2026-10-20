// Character sprites built from material templates.
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
  hairStyle?: 'short' | 'long';
  hat?: { style: 'caping' | 'peci' | 'hijab'; ramp: readonly [ColorName, ColorName, ColorName, ColorName] };
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
// Templates (16 wide). Upper body = rows 0..16, legs = rows 17..23.

const DOWN_HEAD = [
  '....11111111....',
  '...1223333221...',
  '..122333333221..',
  '..122233332221..',
  '..122122221221..',
  '..12StttSSSs21..',
  '..12SeSSSSes21..',
  '..1oSeSSSSeso1..',
  '...oSSSssSSso...',
  '....osSSSSso....',
  '......osso......',
];

const UP_HEAD = [
  '....11111111....',
  '...1223333221...',
  '..122333333221..',
  '..122333332221..',
  '..122233322221..',
  '..122222222221..',
  '..122222222221..',
  '..112222222211..',
  '...1122222211...',
  '....osSSSSso....',
  '......osso......',
];

const FRONT_BODY = [
  '...addcccccba...',
  '..adcdcccccbba..',
  '..adacccccbaba..',
  '..adacccccbaba..',
  '..adaccccbbaba..',
  '..oSabbbbbbaso..',
];

const BACK_BODY = [
  '...abcccccbba...',
  '..adccccccbbba..',
  '..adacccccbaba..',
  '..adacccccbaba..',
  '..adabcccbbaba..',
  '..oSabbbbbbaso..',
];

const SIDE_HEAD = [
  '....1111111.....',
  '...122333321....',
  '..12233333321...',
  '..12223333221...',
  '..12222221221...',
  '..1222221StSo...',
  '..12222oSSSeSo..',
  '..1222oSSSSeSSo.',
  '..1122oSSSSSso..',
  '...11oosSSsso...',
  '......osso......',
];

const SIDE_BODY = [
  '....addcccba....',
  '...adccdccbba...',
  '...adcadcccba...',
  '...adcadcccba...',
  '...abbadcbbba...',
  '...abboSsobba...',
];

const FRONT_LEGS = {
  idle: [
    '....prrrrrqp....',
    '....prrpprqp....',
    '....prqpprqp....',
    '....pqqppqqp....',
    '....xyyxxyyx....',
    '....xxxxxxxx....',
    '................',
  ],
  stepA: [
    '....prrrrrqp....',
    '....prrpprqp....',
    '....prqpprqp....',
    '....prqppqqp....',
    '....pqqpxyyx....',
    '....xyyxxxxx....',
    '....xxxx........',
  ],
  stepB: [
    '....prrrrrqp....',
    '....prrpprqp....',
    '....prqpprqp....',
    '....pqqpprqp....',
    '....xyyxpqqp....',
    '....xxxxxyyx....',
    '........xxxx....',
  ],
};

const SIDE_LEGS = {
  idle: [
    '.....prrrqp.....',
    '.....prrrqp.....',
    '.....prrqqp.....',
    '.....pqqqqp.....',
    '.....xyyyyyx....',
    '.....xxxxxxx....',
    '................',
  ],
  stepA: [
    '.....prrrqp.....',
    '.....prrqrqp....',
    '....prqp.prqp...',
    '....pqqp..pqqp..',
    '...xyyyx..xyyyx.',
    '...xxxxx..xxxxx.',
    '................',
  ],
  stepB: [
    '.....prrrqp.....',
    '.....prqrrqp....',
    '....pqqp.prqp...',
    '....pqqp..pqqp..',
    '...xxyyx..xyyyx.',
    '...xxxxx..xxxxx.',
    '................',
  ],
};

// Overlays: hats and hairstyles, per facing. Drawn after the head.
const CAPING = [
  '......ADDA......',
  '....ADDCCCBA....',
  '..ADDCCCCCCBBA..',
  'AADCCCCCCCCCBBAA',
  '.AAAAAAAAAAAAAA.',
];

const PECI = ['....AAAAAAAA....', '...ADCCCCCCBA...', '..ADCCCCCCCBBA..', '..AAAAAAAAAAAA..'];

const HIJAB_DOWN = [
  '....AAAAAAAA....',
  '...ACDDDCCCBA...',
  '..ACDDCCCCCCBA..',
  '..ACDCCCCCCCBA..',
  '..ACCCCCCCCCBA..',
  '..AC........BA..',
  '..AC........BA..',
  '..AC........BA..',
  '..ACC......CBA..',
  '..ACCC....CCBA..',
  '..ACCCCCCCCCBA..',
  '.ACCCCCCCCCCCBA.',
  '.ABCCCCCCCCCCBA.',
];

const HIJAB_UP = [
  '....AAAAAAAA....',
  '...ACDDDCCCBA...',
  '..ACDDCCCCCCBA..',
  '..ACDCCCCCCCBA..',
  '..ACCCCCCCCCBA..',
  '..ACCCCCCCCCBA..',
  '..ACCCCCCCCCBA..',
  '..ACCCCCCCCCBA..',
  '..ACCCCCCCCCBA..',
  '..ACCCCCCCCCBA..',
  '..ACCCCCCCCCBA..',
  '.ACCCCCCCCCCCBA.',
  '.ABCCCCCCCCCCBA.',
];

const HIJAB_SIDE = [
  '....AAAAAAA.....',
  '...ACDDDCCBA....',
  '..ACDDCCCCCBA...',
  '..ACDCCCCCCCBA..',
  '..ACCCCCCCCCBA..',
  '..ACCCCCCA......',
  '..ACCCCCA.......',
  '..ACCCCA........',
  '..ACCCCA........',
  '..ACCCCCCCCBA...',
  '..ACCCCCCCCBA...',
  '..ACCCCCCCCCBA..',
  '..ABCCCCCCCCBA..',
];

const LONG_HAIR: Record<'down' | 'up' | 'side', { y: number; rows: string[] }> = {
  down: {
    y: 7,
    rows: [
      '..1..........1..',
      '..12........21..',
      '..122......221..',
      '..122......221..',
      '..122......221..',
      '..112......211..',
      '...11......11...',
    ],
  },
  up: {
    y: 9,
    rows: [
      '..122222222221..',
      '..122222222221..',
      '..122222222221..',
      '..112222222211..',
      '...1122222211...',
      '....11111111....',
    ],
  },
  side: {
    y: 8,
    rows: [
      '..1122..........',
      '..12221.........',
      '..12221.........',
      '..12221.........',
      '..1221..........',
      '...11...........',
    ],
  },
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
  const g = PixelGrid.fromRows([...head, ...body], legend, `char-${view}`);

  if (look.hairStyle === 'long' && look.hat?.style !== 'hijab') {
    const lh = LONG_HAIR[view];
    // Long hair falls behind the shoulders when seen from the front.
    g.stamp(PixelGrid.fromRows(lh.rows, legend, 'hair-long'), 0, lh.y);
  }
  if (look.hat) {
    const rows =
      look.hat.style === 'caping'
        ? CAPING
        : look.hat.style === 'peci'
          ? PECI
          : view === 'down'
            ? HIJAB_DOWN
            : view === 'up'
              ? HIJAB_UP
              : HIJAB_SIDE;
    g.stamp(PixelGrid.fromRows(rows, legend, `hat-${look.hat.style}`), 0, 0);
  }
  return g;
}

function legs(view: View, pose: 'idle' | 'stepA' | 'stepB', legend: Legend): PixelGrid {
  const set = view === 'side' ? SIDE_LEGS : FRONT_LEGS;
  return PixelGrid.fromRows(set[pose], legend, `legs-${view}-${pose}`);
}

const UPPER_ROWS = DOWN_HEAD.length + FRONT_BODY.length;

function compose(upper: PixelGrid, lower: PixelGrid, bob: number): PixelGrid {
  const g = new PixelGrid(PLAYER.frameWidth, PLAYER.frameHeight);
  g.stamp(lower, 0, UPPER_ROWS);
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
      compose(up, legs(view, 'stepA', legend), 1),
      compose(up, legs(view, 'idle', legend), 0),
      compose(up, legs(view, 'stepB', legend), 1),
      compose(up, legs(view, 'idle', legend), 0),
    ];
    frames.push(...(facing === 'left' ? set.map((f) => f.flipX()) : set));
  }
  return frames;
}
