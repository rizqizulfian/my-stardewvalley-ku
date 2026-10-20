// The single fixed palette. Every pixel the game draws comes from this table.
// Dark ends of ramps lean blue/purple, light ends lean warm yellow.
// There is no pure black (#000) and no pure white (#fff).

export const PALETTE = {
  // Neutrals (cool darks to warm lights)
  ink: '#1a1424',
  night: '#2b2342',
  plum: '#4c3a64',
  mauve: '#7d6b8f',
  haze: '#ada3b8',
  mist: '#ddd5d0',
  cream: '#fbf3dc',
  // Foliage
  pine: '#103e3a',
  moss: '#1d6b3c',
  leaf: '#38a038',
  grass: '#6cc83c',
  lime: '#bce85a',
  // Earth and wood
  bark: '#40202c',
  umber: '#6e3a2a',
  clay: '#a8622e',
  tan: '#d9943c',
  sand: '#f2c868',
  // Water
  deep: '#1a3c7a',
  sea: '#2a74c0',
  sky: '#46aee6',
  foam: '#9ae6f2',
  // Warm reds
  wine: '#78203a',
  brick: '#c43a32',
  coral: '#ec6a3a',
  peach: '#f8aa72',
  // Skin
  skinShade: '#c47c58',
  skin: '#f2bf92',
  // Gold
  amber: '#f0a828',
  gold: '#fadc5c',
  // Accents
  violet: '#6c44a8',
  lilac: '#b07ad6',
  rose: '#f0849c',
} as const;

export type ColorName = keyof typeof PALETTE;

/** Index order, used by palette-indexed grids. */
export const COLOR_NAMES = Object.keys(PALETTE) as ColorName[];
export const COLOR_INDEX: Record<ColorName, number> = Object.fromEntries(
  COLOR_NAMES.map((n, i) => [n, i]),
) as Record<ColorName, number>;

function hexToRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
}

/** RGB triples by palette index, for fast canvas writes. */
export const PALETTE_RGB: ReadonlyArray<readonly [number, number, number]> = COLOR_NAMES.map((n) =>
  hexToRgb(PALETTE[n]),
);

/** 0xRRGGBB number for Phaser APIs (fills, tints, camera background). */
export function hex(name: ColorName): number {
  return parseInt(PALETTE[name].slice(1), 16);
}

export function css(name: ColorName): string {
  return PALETTE[name];
}

/**
 * The next darker, hue-shifted neighbour of each colour.
 * Used for outlines ("a darker shade of the fill, never black") and shadows.
 */
export const DARKER: Record<ColorName, ColorName> = {
  ink: 'ink',
  night: 'ink',
  plum: 'night',
  mauve: 'plum',
  haze: 'mauve',
  mist: 'haze',
  cream: 'mist',
  pine: 'ink',
  moss: 'pine',
  leaf: 'moss',
  grass: 'leaf',
  lime: 'grass',
  bark: 'ink',
  umber: 'bark',
  clay: 'umber',
  tan: 'clay',
  sand: 'tan',
  deep: 'ink',
  sea: 'deep',
  sky: 'sea',
  foam: 'sky',
  wine: 'night',
  brick: 'wine',
  coral: 'brick',
  peach: 'coral',
  skinShade: 'umber',
  skin: 'skinShade',
  amber: 'clay',
  gold: 'amber',
  violet: 'night',
  lilac: 'violet',
  rose: 'brick',
};

/** The next lighter, warmer neighbour. */
export const LIGHTER: Record<ColorName, ColorName> = {
  ink: 'night',
  night: 'plum',
  plum: 'mauve',
  mauve: 'haze',
  haze: 'mist',
  mist: 'cream',
  cream: 'cream',
  pine: 'moss',
  moss: 'leaf',
  leaf: 'grass',
  grass: 'lime',
  lime: 'gold',
  bark: 'umber',
  umber: 'clay',
  clay: 'tan',
  tan: 'sand',
  sand: 'cream',
  deep: 'sea',
  sea: 'sky',
  sky: 'foam',
  foam: 'cream',
  wine: 'brick',
  brick: 'coral',
  coral: 'peach',
  peach: 'gold',
  skinShade: 'skin',
  skin: 'peach',
  amber: 'gold',
  gold: 'cream',
  violet: 'lilac',
  lilac: 'rose',
  rose: 'peach',
};

export function darker(c: ColorName, steps = 1): ColorName {
  let r = c;
  for (let i = 0; i < steps; i++) r = DARKER[r];
  return r;
}

export function lighter(c: ColorName, steps = 1): ColorName {
  let r = c;
  for (let i = 0; i < steps; i++) r = LIGHTER[r];
  return r;
}

/** Material ramps, dark (shadow) to light (highlight). */
export const RAMPS = {
  foliage: ['pine', 'moss', 'leaf', 'grass', 'lime'],
  grass: ['moss', 'leaf', 'grass', 'lime'],
  wood: ['bark', 'umber', 'clay', 'tan'],
  lightWood: ['umber', 'clay', 'tan', 'sand'],
  dirt: ['bark', 'umber', 'clay', 'tan'],
  stone: ['night', 'plum', 'mauve', 'haze', 'mist'],
  water: ['deep', 'sea', 'sky', 'foam'],
  roof: ['wine', 'brick', 'coral', 'peach'],
  straw: ['clay', 'amber', 'gold', 'cream'],
  plaster: ['mauve', 'haze', 'mist', 'cream'],
  skin: ['umber', 'skinShade', 'skin', 'peach'],
  purple: ['night', 'violet', 'lilac', 'rose'],
  denim: ['deep', 'sea', 'sky', 'foam'],
  sand: ['clay', 'tan', 'sand', 'cream'],
} as const satisfies Record<string, readonly ColorName[]>;

export type RampName = keyof typeof RAMPS;
export type Ramp = readonly ColorName[];
