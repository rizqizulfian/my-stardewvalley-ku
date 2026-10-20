// The single fixed palette. Every pixel the game draws comes from this table.
// Material ramps follow docs/style-guide.json: dark ends lean cool (teal,
// red-brown, purple), light ends lean warm yellow. There is no pure black
// (#000) and no pure white (#fff).

export const PALETTE = {
  // Neutrals (cool darks to warm lights), mostly for UI and night.
  ink: '#1c1626',
  night: '#2b2342',
  plum: '#4c3a64',
  mauve: '#7d6b8f',
  haze: '#ada3b8',
  mist: '#ddd5d0',
  cream: '#f6f0dc',
  // Tree foliage: outline, shadow, base, light, highlight.
  pine: '#1a3a2a',
  moss: '#1f5a4a',
  leaf: '#2f7d4a',
  fern: '#5aa84a',
  lime: '#a0d050',
  // Ground grass: outline, shadow, base, light, highlight.
  turfDark: '#1f4a32',
  turf: '#2f6b4f',
  grass: '#5a9a3a',
  grassLight: '#8fc24a',
  grassHi: '#c4dc5a',
  // Wood: outline, shadow, base, light.
  bark: '#4a2a1a',
  umber: '#7a4524',
  clay: '#b0703a',
  tan: '#d99a55',
  // Dirt path and straw: outline, shadow, base, light, highlight.
  dirtDark: '#6b3a1e',
  dirtShade: '#9a5a2a',
  dirt: '#d98e32',
  dirtLight: '#f0b44a',
  dirtHi: '#ffd877',
  // Cliff earth: shadow, base, light (the top lip is grassLight).
  earthDark: '#5a3a20',
  earth: '#8a5a2e',
  earthLight: '#b07a3a',
  // Stone: outline, shadow, base, light.
  slate: '#4a4550',
  stoneDark: '#5a5560',
  stone: '#8b8478',
  stoneLight: '#b8b0a0',
  // Water: outline, shadow, base, light, foam.
  deep: '#1e4a7a',
  sea: '#2f78b8',
  sky: '#4aa3d8',
  foam: '#8fd3f0',
  spray: '#e8f8ff',
  // Red roof: outline, shadow, base, light, highlight.
  wine: '#4a1a1a',
  maroon: '#8a2a2a',
  brick: '#b83a2e',
  coral: '#d9553f',
  peach: '#f08060',
  // Skin.
  skinShade: '#c47c58',
  skin: '#f2bf92',
  skinLight: '#fbd8b0',
  // Gold and accent flowers.
  amber: '#e89a28',
  gold: '#f5d04a',
  rose: '#e8506a',
  violet: '#6c44a8',
  lilac: '#a070d8',
  sand: '#f5d89a',
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
 * The next darker, hue-shifted neighbour of each colour, staying inside its
 * own material. Used for outlines ("a dark shade of the object's own
 * material, never black") and shadows.
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
  fern: 'leaf',
  lime: 'fern',
  turfDark: 'pine',
  turf: 'turfDark',
  grass: 'turf',
  grassLight: 'grass',
  grassHi: 'grassLight',
  bark: 'ink',
  umber: 'bark',
  clay: 'umber',
  tan: 'clay',
  dirtDark: 'bark',
  dirtShade: 'dirtDark',
  dirt: 'dirtShade',
  dirtLight: 'dirt',
  dirtHi: 'dirtLight',
  earthDark: 'bark',
  earth: 'earthDark',
  earthLight: 'earth',
  slate: 'night',
  stoneDark: 'slate',
  stone: 'stoneDark',
  stoneLight: 'stone',
  deep: 'night',
  sea: 'deep',
  sky: 'sea',
  foam: 'sky',
  spray: 'foam',
  wine: 'ink',
  maroon: 'wine',
  brick: 'maroon',
  coral: 'brick',
  peach: 'coral',
  skinShade: 'umber',
  skin: 'skinShade',
  skinLight: 'skin',
  amber: 'dirtShade',
  gold: 'amber',
  rose: 'maroon',
  violet: 'night',
  lilac: 'violet',
  sand: 'dirtLight',
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
  leaf: 'fern',
  fern: 'lime',
  lime: 'grassHi',
  turfDark: 'turf',
  turf: 'grass',
  grass: 'grassLight',
  grassLight: 'grassHi',
  grassHi: 'grassHi',
  bark: 'umber',
  umber: 'clay',
  clay: 'tan',
  tan: 'dirtLight',
  dirtDark: 'dirtShade',
  dirtShade: 'dirt',
  dirt: 'dirtLight',
  dirtLight: 'dirtHi',
  dirtHi: 'dirtHi',
  earthDark: 'earth',
  earth: 'earthLight',
  earthLight: 'tan',
  slate: 'stoneDark',
  stoneDark: 'stone',
  stone: 'stoneLight',
  stoneLight: 'mist',
  deep: 'sea',
  sea: 'sky',
  sky: 'foam',
  foam: 'spray',
  spray: 'spray',
  wine: 'maroon',
  maroon: 'brick',
  brick: 'coral',
  coral: 'peach',
  peach: 'dirtHi',
  skinShade: 'skin',
  skin: 'skinLight',
  skinLight: 'cream',
  amber: 'gold',
  gold: 'dirtHi',
  rose: 'peach',
  violet: 'lilac',
  lilac: 'rose',
  sand: 'cream',
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

/** Material ramps, dark (shadow) to light (highlight). Outlines are separate. */
export const RAMPS = {
  foliage: ['moss', 'leaf', 'fern', 'lime'],
  grass: ['turf', 'grass', 'grassLight', 'grassHi'],
  wood: ['umber', 'clay', 'tan'],
  dirt: ['dirtShade', 'dirt', 'dirtLight', 'dirtHi'],
  straw: ['dirtShade', 'dirt', 'dirtLight', 'dirtHi'],
  earth: ['earthDark', 'earth', 'earthLight'],
  stone: ['stoneDark', 'stone', 'stoneLight'],
  water: ['sea', 'sky', 'foam'],
  roof: ['maroon', 'brick', 'coral', 'peach'],
  plaster: ['haze', 'mist', 'cream'],
  skin: ['skinShade', 'skin', 'skinLight'],
  purple: ['violet', 'lilac', 'rose'],
} as const satisfies Record<string, readonly ColorName[]>;

/** The outline colour of each material ramp. */
export const OUTLINE = {
  foliage: 'pine',
  grass: 'turfDark',
  wood: 'bark',
  dirt: 'dirtDark',
  straw: 'dirtDark',
  earth: 'bark',
  stone: 'slate',
  water: 'deep',
  roof: 'wine',
  plaster: 'mauve',
  skin: 'umber',
  purple: 'night',
} as const satisfies Record<keyof typeof RAMPS, ColorName>;

export type RampName = keyof typeof RAMPS;
export type Ramp = readonly ColorName[];

/**
 * The outline colour for any fill: its material's outline when it belongs to
 * a ramp, otherwise two steps darker. Later ramps win for shared colours.
 */
export const OUTLINE_OF: Record<ColorName, ColorName> = (() => {
  const m = {} as Record<ColorName, ColorName>;
  for (const c of COLOR_NAMES) m[c] = darker(c, 2);
  for (const [k, ramp] of Object.entries(RAMPS)) for (const c of ramp) m[c] = OUTLINE[k as RampName];
  return m;
})();
