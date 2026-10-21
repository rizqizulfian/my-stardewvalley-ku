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
//   inner m n          (shirt under a coat: shadow, base)   g = gold trim / chain

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
  hairStyle?: 'short' | 'long' | 'bun';
  hat?: { style: 'caping' | 'peci' | 'hijab' | 'cap'; ramp: readonly [ColorName, ColorName, ColorName, ColorName] };
  /** 'coat' is a long open coat over `inner`; 'safari' adds pockets and a belt; 'dress' swaps trousers for a skirt. */
  outfit?: 'shirt' | 'coat' | 'safari' | 'dress';
  inner?: readonly [ColorName, ColorName];
  /** Gold trim (coat chain, cap badge). */
  trim?: ColorName;
  /** Children: same head, shorter body. */
  small?: boolean;
  /** Scarf colour used in the dance frames (a selendang). */
  scarf?: ColorName;
}

/** Frame layout of every character sheet: per facing, 2 idle, 4 walk, 2 tool-use poses (wind-up, strike), sitting, 4 dance poses. */
export const CHAR_FRAMES = {
  perFacing: 13,
  idle: [0, 1],
  walk: [2, 3, 4, 5],
  use: [6, 7],
  sit: 8,
  dance: [9, 10, 11, 12],
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

/** Seated legs, drawn under a torso lowered by SIT_DROP rows. */
const SIT_LEGS: Record<View, string[]> = {
  down: ['....prrrrrqp....', '....prqpprqp....', '....xyyxxyyx....', '....xxxxxxxx....'],
  up: ['....prrrrrqp....', '....pqqqqqqp....', '................', '................'],
  side: ['.....prrrrrrqp..', '.....pqqqqqqrp..', '..........pqp...', '..........xyyx..'],
};
const SIT_DROP = 3;

// Long open coat (front): coat in the shirt ramp, inner shirt m/n, gold chain g.
const COAT_FRONT = [
  '...adcmnnmcba...',
  '..adcamnnmgbba..',
  '..adacmnnmgaba..',
  '..adacmnnmbaba..',
  '..adacmnnmbaba..',
  '..oSacnmmncaso..',
];

const DRESS_LEGS = {
  idle: [
    '....pqrrrrqp....',
    '...pqrrrrrrqp...',
    '...pqrrrrrrqp...',
    '..pqrrrrrrrrqp..',
    '..pppppppppppp..',
    '.....xy..yx.....',
    '.....xx..xx.....',
  ],
  stepA: [
    '....pqrrrrqp....',
    '...pqrrrrrrqp...',
    '..pqrrrrrrrqp...',
    '..pqrrrrrrrrqp..',
    '..pppppppppppp..',
    '....xy....yx....',
    '....xx.....xx...',
  ],
  stepB: [
    '....pqrrrrqp....',
    '...pqrrrrrrqp...',
    '...pqrrrrrrrqp..',
    '..pqrrrrrrrrqp..',
    '..pppppppppppp..',
    '....xy....yx....',
    '...xx.....xx....',
  ],
};

const DRESS_SIDE = [
  '.....pqrrrqp....',
  '....pqrrrrrqp...',
  '....pqrrrrrqp...',
  '...pqrrrrrrrqp..',
  '...ppppppppppp..',
  '......xyyyx.....',
  '......xxxxx.....',
];

/** A peaked cap with a gold badge, worn low over spiky hair. */
const CAP_FRONT = ['...AAAAAAAAAA...', '..ACCCCggCCCBA..', '..ACDCCggCCCBA..', '..ACCCCCCCCBBA..', '.AAAAAAAAAAAAAA.', '..111......111..'];
const CAP_BACK = ['...AAAAAAAAAA...', '..ACCCCCCCCCBA..', '..ACDCCCCCCCBA..', '..ACCCCCCCCBBA..', '..AAAAAAAAAAAA..', '..121211212121..'];
const CAP_SIDE = ['...AAAAAAAA.....', '..ACCCCCCggA....', '..ACDCCCCggCA...', '..ACCCCCCCCCBAAA', '..AAAAAAAAAAAAA.', '..1121..........'];

const BUN = {
  down: ['......1221......', '.....122221.....', '......1111......'],
  up: ['......1221......', '.....123321.....', '.....122221.....', '......1111......'],
  side: ['...1221.........', '..122221........', '...1111.........'],
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
  const [m, n] = look.inner ?? look.shirt.slice(1, 3);
  return {
    m,
    n,
    g: look.trim ?? 'gold',
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
  const body = view === 'down' ? (look.outfit === 'coat' ? COAT_FRONT : FRONT_BODY) : view === 'up' ? BACK_BODY : SIDE_BODY;
  const g = PixelGrid.fromRows([...head, ...body], legend, `char-${view}`);
  const top = head.length;
  if (look.outfit === 'coat' && view === 'side') {
    // The coat hangs open at the front: a stripe of inner shirt and the chain.
    for (let y = top; y < top + 5; y++) g.set(10, y, legend.n as ColorName);
    g.set(9, top + 1, legend.g as ColorName).set(9, top + 2, legend.g as ColorName);
  }
  if (look.outfit === 'safari' && view !== 'up') {
    // Chest pockets with flaps, a button placket and a belt.
    const flap = legend.a as ColorName;
    const pk = view === 'down' ? [5, 9] : [7];
    for (const x of pk) g.set(x, top + 1, flap).set(x + 1, top + 1, flap).set(x, top + 2, legend.b as ColorName);
    if (view === 'down') for (let y = top + 1; y < top + 5; y += 2) g.set(7, y, legend.d as ColorName);
  }
  if (look.hairStyle === 'bun' && look.hat?.style !== 'hijab') {
    const bun = BUN[view];
    // The bun sits on top of the head, nudging the sprite's top edge.
    g.stamp(PixelGrid.fromRows(bun, legend, `bun-${view}`), 0, 0);
  }

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
          : look.hat.style === 'cap'
            ? view === 'down'
              ? CAP_FRONT
              : view === 'up'
                ? CAP_BACK
                : CAP_SIDE
            : view === 'down'
              ? HIJAB_DOWN
              : view === 'up'
                ? HIJAB_UP
                : HIJAB_SIDE;
    g.stamp(PixelGrid.fromRows(rows, legend, `hat-${look.hat.style}`), 0, 0);
  }
  return g;
}

/**
 * Tool-use pose: the arms are lifted off the torso (the tool sprite draws the
 * hands on the handle). Side views keep their near arm.
 */
function armless(g: PixelGrid, view: View, legend: Legend): PixelGrid {
  if (view === 'side') return g;
  const out = g.clone();
  const top = DOWN_HEAD.length;
  const edge = legend.a as ColorName;
  for (let y = top; y < g.h; y++) {
    for (const x of [2, 3, 12, 13]) out.set(x, y, null);
    for (const x of [4, 11]) if (out.filled(x, y)) out.set(x, y, edge);
  }
  return out;
}

function legs(view: View, pose: 'idle' | 'stepA' | 'stepB', legend: Legend, look?: CharacterLook): PixelGrid {
  if (look?.outfit === 'dress') {
    const rows = view === 'side' ? DRESS_SIDE : DRESS_LEGS[pose];
    return PixelGrid.fromRows(rows, legend, `dress-${view}-${pose}`);
  }
  const set = view === 'side' ? SIDE_LEGS : FRONT_LEGS;
  const g = PixelGrid.fromRows(set[pose], legend, `legs-${view}-${pose}`);
  if (look?.outfit === 'coat') {
    // Coat tails to the knees.
    const a = legend.a as ColorName;
    const c = legend.c as ColorName;
    const b = legend.b as ColorName;
    if (view === 'down')
      for (let y = 0; y < 4; y++) {
        g.set(3, y, a).set(4, y, c).set(11, y, b).set(12, y, a);
        if (y === 3) g.set(3, y, a).set(4, y, a).set(11, y, a).set(12, y, a);
      }
    else if (view === 'up')
      for (let y = 0; y < 4; y++) for (let x = 3; x <= 12; x++) g.set(x, y, x === 3 || x === 12 || y === 3 ? a : x === 7 && y > 1 ? a : x > 8 ? b : c);
    else for (let y = 0; y < 4; y++) g.set(3, y, a).set(4, y, c).set(5, y, b);
  }
  return g;
}

/** Children: drop a few body and leg rows so the head is bigger in proportion. */
function shrink(g: PixelGrid): PixelGrid {
  const skip = new Set([12, 14, 19]);
  const out = new PixelGrid(g.w, g.h);
  let dy = g.h - 1;
  for (let y = g.h - 1; y >= 0; y--) {
    if (skip.has(y)) continue;
    for (let x = 0; x < g.w; x++) {
      const c = g.colorAt(x, y);
      if (c) out.set(x, dy, c);
    }
    dy--;
  }
  return out;
}

/** Dance poses: arms raised in four shapes, a scarf trailing from the hands. */
function dancing(upper: PixelGrid, view: View, look: CharacterLook, legend: Legend, pose: number): PixelGrid {
  const body = armless(upper, 'down', legend);
  const sleeve = legend.c as ColorName;
  const edge = legend.a as ColorName;
  const hand = legend.S as ColorName;
  const scarf = look.scarf ?? 'rose';
  const top = DOWN_HEAD.length;
  // [shoulder x, hand x, hand y] for left and right arms, per pose.
  const arms: Array<[[number, number, number], [number, number, number]]> = [
    [[3, 0, top - 4], [12, 15, top - 4]],
    [[3, 0, top + 2], [12, 14, top - 5]],
    [[3, 1, top - 5], [12, 15, top + 2]],
    [[3, 0, top + 1], [12, 15, top + 1]],
  ];
  const g = body.clone();
  for (const [sx, hx, hy] of arms[pose]) {
    g.line(sx, top + 1, hx, hy, edge).line(sx + (hx < sx ? 0 : 0), top + 2, hx, hy + 1, sleeve);
    g.set(hx, hy, hand);
    // Scarf: a short ribbon hanging from the hand.
    for (let i = 1; i <= 4; i++) g.set(hx + (hx < 8 ? (i > 2 ? 1 : 0) : i > 2 ? -1 : 0), hy + i, scarf);
  }
  if (view !== 'down') return g;
  return g;
}

const UPPER_ROWS = DOWN_HEAD.length + FRONT_BODY.length;

function compose(upper: PixelGrid, lower: PixelGrid, bob: number): PixelGrid {
  const g = new PixelGrid(PLAYER.frameWidth, PLAYER.frameHeight);
  g.stamp(lower, 0, UPPER_ROWS);
  g.stamp(upper, 0, bob);
  return g;
}

function seated(upper: PixelGrid, view: View, legend: Legend): PixelGrid {
  const g = new PixelGrid(PLAYER.frameWidth, PLAYER.frameHeight);
  g.stamp(PixelGrid.fromRows(SIT_LEGS[view], legend, `legs-${view}-sit`), 0, UPPER_ROWS + SIT_DROP);
  g.stamp(upper, 0, SIT_DROP);
  return g;
}

/** All frames for one character, in CHAR_FRAMES order for each facing. */
export function buildCharacterFrames(look: CharacterLook): PixelGrid[] {
  const legend = legendFor(look);
  const frames: PixelGrid[] = [];
  const front = upperBody('down', look, legend);
  for (const facing of FACINGS) {
    const view: View = facing === 'left' || facing === 'right' ? 'side' : facing;
    const up = upperBody(view, look, legend);
    const L = (pose: 'idle' | 'stepA' | 'stepB') => legs(view, pose, legend, look);
    let set: PixelGrid[] = [
      compose(up, L('idle'), 0),
      compose(up, L('idle'), 1),
      compose(up, L('stepA'), 1),
      compose(up, L('idle'), 0),
      compose(up, L('stepB'), 1),
      compose(up, L('idle'), 0),
      compose(armless(up, view, legend), L('idle'), 0),
      compose(armless(up, view, legend), L('idle'), 1),
      seated(up, view, legend),
    ];
    if (facing === 'left') set = set.map((f) => f.flipX());
    // Dancers always face the audience.
    const fl = (pose: 'idle' | 'stepA' | 'stepB') => legs('down', pose, legend, look);
    set.push(
      compose(dancing(front, view, look, legend, 0), fl('idle'), 0),
      compose(dancing(front, view, look, legend, 1), fl('stepA'), 1),
      compose(dancing(front, view, look, legend, 2), fl('stepB'), 1),
      compose(dancing(front, view, look, legend, 3), fl('idle'), 0),
    );
    frames.push(...(look.small ? set.map(shrink) : set));
  }
  return frames;
}
