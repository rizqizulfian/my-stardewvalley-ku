// Prop definitions. Map prop rows place these by character; the character
// marks the bottom-left cell of the prop's footprint.

import { BUILDING_TEXTURES as B } from '../art/buildings';
import { EXTRA_TEXTURES as X, PAINTINGS, SCULPTURES } from '../art/extras';
import { PROP_TEXTURES, bareTexture } from '../art/props';
import type { ToolKind } from './items';
import type { Surface } from './terrain';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LightDef {
  /** Offset from the prop's bottom-center, in pixels. */
  x: number;
  y: number;
  texture: 'light-warm' | 'light-window';
  scale?: number;
}

/** How a prop reacts to tools. Props without this cannot be cleared. */
export interface BreakableDef {
  /** Tools that damage it. */
  tools: ToolKind[];
  hits: number;
  /** [item id, min, max] dropped when it breaks. */
  drops: Array<[string, number, number]>;
  /** Sound per hit and when it breaks. */
  hitSfx: string;
  breakSfx: string;
  /** Particle bit frame (see art/items BIT). */
  bit: 'chip' | 'pebble' | 'leaf';
}

export interface PropDef {
  texture: string;
  /** Footprint in cells, extending right and up from the anchor cell. */
  footprint: { w: number; h: number };
  /** Collision box in pixels, relative to the footprint's top-left corner. */
  collider?: Box;
  /** Pixels to shift the sprite sideways from the footprint center. */
  offsetX?: number;
  /** Pixels to push the sprite down past the footprint bottom (for overhang). */
  offsetY?: number;
  /** Plays the 3-frame sway animation. */
  sway?: boolean;
  /** Ground shadow texture under the sprite. */
  shadow?: string;
  shadowOffsetY?: number;
  /** Emissive overlay shown at night (lit windows, lamp glass). */
  emissive?: string;
  lights?: LightDef[];
  /** Fences join up with their neighbours. */
  connects?: boolean;
  /** Flat props sort below everything standing on them. */
  flat?: boolean;
  surface?: Surface;
  /** Small horizontal jitter, in pixels, so rows of trees do not look gridded. */
  jitter?: number;
  breakable?: BreakableDef;
  /** Trees shake and drop leaves when hit with an axe, but stay. */
  shakes?: boolean;
  /** What the action button does here (see WorldScene.useProp). */
  use?: PropUse;
  /** Fruit the action button picks; it grows back after some days. */
  pick?: PickDef;
  /** Sheet frame to show (one sheet holding several pictures). */
  frame?: number;
  /** Loops through sheet frames on its own (fountains, windmill sails). */
  anim?: { frames: number; ms: number };
}

export interface PickDef {
  item: string;
  min: number;
  max: number;
  regrowDays: number;
  /** Texture shown while the fruit grows back. */
  bare: string;
}

export type PropUse = 'bed' | 'bench' | 'well' | 'ship' | 'mailbox' | 'board' | 'sign' | 'pick' | `shop:${string}` | `art:${string}`;

const fruit = (texture: string, item: string, min: number, max: number): Pick<PropDef, 'use' | 'pick'> => ({
  use: 'pick',
  pick: { item, min, max, regrowDays: 3, bare: bareTexture(texture) },
});

/** Village houses, the shop and the hall share the farmhouse's 5x3 footprint. */
function houseLike(texture: string, lit: string): PropDef {
  return {
    texture,
    footprint: { w: 5, h: 3 },
    collider: { x: 2, y: 4, w: 76, h: 44 },
    offsetY: 1,
    shadow: PROP_TEXTURES.shadowXL,
    emissive: lit,
    lights: [
      { x: -20, y: -21, texture: 'light-window', scale: 0.9 },
      { x: 20, y: -21, texture: 'light-window', scale: 0.9 },
    ],
  };
}

export const PROPS: Record<string, PropDef> = {
  treeRound: {
    texture: PROP_TEXTURES.treeRound,
    shakes: true,
    footprint: { w: 1, h: 1 },
    collider: { x: 3, y: 9, w: 10, h: 6 },
    offsetY: 1,
    sway: true,
    shadow: PROP_TEXTURES.shadowL,
    shadowOffsetY: 1,
    jitter: 3,
  },
  treeFruit: {
    texture: PROP_TEXTURES.treeFruit,
    ...fruit(PROP_TEXTURES.treeFruit, 'jambu', 2, 3),
    shakes: true,
    footprint: { w: 1, h: 1 },
    collider: { x: 3, y: 9, w: 10, h: 6 },
    offsetY: 1,
    sway: true,
    shadow: PROP_TEXTURES.shadowL,
    shadowOffsetY: 1,
    jitter: 3,
  },
  treeSlender: {
    texture: PROP_TEXTURES.treeSlender,
    shakes: true,
    footprint: { w: 1, h: 1 },
    collider: { x: 4, y: 10, w: 8, h: 5 },
    offsetY: 1,
    sway: true,
    shadow: PROP_TEXTURES.shadowM,
    shadowOffsetY: 1,
    jitter: 3,
  },
  bush: {
    texture: PROP_TEXTURES.bush,
    footprint: { w: 1, h: 1 },
    collider: { x: 1, y: 6, w: 14, h: 9 },
    sway: true,
    shadow: PROP_TEXTURES.shadowM,
    jitter: 2,
  },
  bushBerry: {
    texture: PROP_TEXTURES.bushBerry,
    footprint: { w: 1, h: 1 },
    collider: { x: 1, y: 6, w: 14, h: 9 },
    sway: true,
    shadow: PROP_TEXTURES.shadowM,
    jitter: 2,
  },
  rock: {
    texture: PROP_TEXTURES.rock,
    footprint: { w: 1, h: 1 },
    collider: { x: 2, y: 5, w: 12, h: 9 },
    shadow: PROP_TEXTURES.shadowS,
    jitter: 1,
    breakable: { tools: ['pickaxe'], hits: 2, drops: [['stone', 1, 3]], hitSfx: 'clink', breakSfx: 'crumble', bit: 'pebble' },
  },
  boulder: {
    texture: PROP_TEXTURES.boulder,
    footprint: { w: 2, h: 2 },
    collider: { x: 2, y: 10, w: 28, h: 20 },
    offsetY: 1,
    shadow: PROP_TEXTURES.shadowL,
    breakable: { tools: ['pickaxe'], hits: 8, drops: [['stone', 8, 12]], hitSfx: 'clink', breakSfx: 'crumble', bit: 'pebble' },
  },
  stump: {
    texture: PROP_TEXTURES.stump,
    footprint: { w: 1, h: 1 },
    collider: { x: 2, y: 5, w: 12, h: 10 },
    shadow: PROP_TEXTURES.shadowS,
    breakable: { tools: ['axe'], hits: 4, drops: [['wood', 4, 6]], hitSfx: 'chop', breakSfx: 'woodBreak', bit: 'chip' },
  },
  weeds: {
    texture: PROP_TEXTURES.weeds,
    footprint: { w: 1, h: 1 },
    sway: true,
    jitter: 1,
    breakable: { tools: ['scythe', 'hoe', 'axe', 'pickaxe'], hits: 1, drops: [['fiber', 0, 1]], hitSfx: 'rustle', breakSfx: 'rustle', bit: 'leaf' },
  },
  branch: {
    texture: PROP_TEXTURES.branch,
    footprint: { w: 1, h: 1 },
    flat: true,
    jitter: 1,
    breakable: { tools: ['axe'], hits: 1, drops: [['wood', 1, 2]], hitSfx: 'chop', breakSfx: 'chop', bit: 'chip' },
  },
  log: {
    texture: PROP_TEXTURES.log,
    footprint: { w: 2, h: 1 },
    collider: { x: 1, y: 4, w: 30, h: 10 },
    shadow: PROP_TEXTURES.shadowL,
    breakable: { tools: ['axe'], hits: 6, drops: [['wood', 8, 10]], hitSfx: 'chop', breakSfx: 'woodBreak', bit: 'chip' },
  },
  fence: {
    texture: PROP_TEXTURES.fence,
    footprint: { w: 1, h: 1 },
    collider: { x: 5, y: 9, w: 6, h: 6 },
    connects: true,
    surface: 'wood',
  },
  lamp: {
    texture: PROP_TEXTURES.lamp,
    footprint: { w: 1, h: 1 },
    collider: { x: 4, y: 10, w: 8, h: 5 },
    shadow: PROP_TEXTURES.shadowS,
    emissive: PROP_TEXTURES.lampLit,
    lights: [{ x: 0, y: -26, texture: 'light-warm', scale: 1.4 }],
  },
  shippingBox: {
    texture: PROP_TEXTURES.shippingBox,
    footprint: { w: 1, h: 1 },
    collider: { x: -2, y: 4, w: 20, h: 11 },
    shadow: PROP_TEXTURES.shadowM,
    use: 'ship',
  },
  mailbox: {
    texture: PROP_TEXTURES.mailbox,
    footprint: { w: 1, h: 1 },
    collider: { x: 5, y: 10, w: 6, h: 5 },
    shadow: PROP_TEXTURES.shadowS,
    use: 'mailbox',
  },
  house: {
    texture: PROP_TEXTURES.house,
    footprint: { w: 5, h: 3 },
    collider: { x: 2, y: 4, w: 76, h: 44 },
    offsetY: 1,
    shadow: PROP_TEXTURES.shadowXL,
    emissive: PROP_TEXTURES.houseLit,
    lights: [
      { x: -20, y: -21, texture: 'light-window', scale: 0.9 },
      { x: 20, y: -21, texture: 'light-window', scale: 0.9 },
    ],
    surface: 'wood',
  },
  lumbung: {
    texture: PROP_TEXTURES.lumbung,
    footprint: { w: 3, h: 2 },
    collider: { x: 4, y: 12, w: 40, h: 18 },
    shadow: PROP_TEXTURES.shadowL,
    emissive: PROP_TEXTURES.lumbungLit,
    lights: [{ x: 0, y: -22, texture: 'light-window', scale: 0.7 }],
  },
  // Village and town --------------------------------------------------------
  houseBlue: houseLike(B.houseBlue, B.houseBlueLit),
  houseGreen: houseLike(B.houseGreen, B.houseGreenLit),
  housePurple: houseLike(B.housePurple, B.housePurpleLit),
  shop: { ...houseLike(B.shop, B.shopLit), use: 'shop:toko' },
  hall: houseLike(B.hall, B.hallLit),
  warung: { texture: B.warung, footprint: { w: 3, h: 2 }, collider: { x: 2, y: 14, w: 44, h: 18 }, shadow: PROP_TEXTURES.shadowL, use: 'shop:warung' },
  fruitStall: { texture: B.fruitStall, footprint: { w: 3, h: 2 }, collider: { x: 2, y: 14, w: 44, h: 18 }, shadow: PROP_TEXTURES.shadowL, use: 'shop:buah' },
  well: { texture: B.well, footprint: { w: 2, h: 1 }, collider: { x: 4, y: 2, w: 24, h: 13 }, shadow: PROP_TEXTURES.shadowL, use: 'well' },
  bench: { texture: B.bench, footprint: { w: 2, h: 1 }, collider: { x: 2, y: 8, w: 28, h: 6 }, shadow: PROP_TEXTURES.shadowL, surface: 'wood', use: 'bench' },
  signpost: { texture: B.signpost, footprint: { w: 1, h: 1 }, collider: { x: 6, y: 10, w: 4, h: 5 }, shadow: PROP_TEXTURES.shadowS, use: 'sign' },
  barrel: { texture: B.barrel, footprint: { w: 1, h: 1 }, collider: { x: 3, y: 7, w: 10, h: 8 }, shadow: PROP_TEXTURES.shadowS },
  crate: { texture: B.crate, footprint: { w: 1, h: 1 }, collider: { x: 2, y: 6, w: 12, h: 9 }, shadow: PROP_TEXTURES.shadowS },
  planter: { texture: B.planter, footprint: { w: 1, h: 1 }, collider: { x: 1, y: 8, w: 14, h: 7 }, shadow: PROP_TEXTURES.shadowS },
  board: { texture: B.board, footprint: { w: 2, h: 1 }, collider: { x: 4, y: 9, w: 24, h: 6 }, shadow: PROP_TEXTURES.shadowL, use: 'board' },
  fountain: { texture: B.fountain, footprint: { w: 3, h: 2 }, collider: { x: 2, y: 10, w: 44, h: 20 }, sway: true, shadow: PROP_TEXTURES.shadowXL },
  banana: {
    texture: B.banana,
    ...fruit(B.banana, 'pisang', 2, 4),
    shakes: true,
    footprint: { w: 1, h: 1 },
    collider: { x: 5, y: 10, w: 6, h: 5 },
    offsetY: 1,
    sway: true,
    shadow: PROP_TEXTURES.shadowL,
    jitter: 2,
  },
  hibiscus: { texture: B.hibiscus, footprint: { w: 1, h: 1 }, collider: { x: 1, y: 6, w: 14, h: 9 }, sway: true, shadow: PROP_TEXTURES.shadowM, jitter: 2 },
  flowerBed: { texture: B.flowerBed, footprint: { w: 1, h: 1 }, sway: true, jitter: 1 },
  // Beach ---------------------------------------------------------------------
  palm: {
    texture: B.palm,
    ...fruit(B.palm, 'kelapa', 1, 2),
    shakes: true,
    footprint: { w: 1, h: 1 },
    collider: { x: 5, y: 10, w: 6, h: 5 },
    offsetY: 1,
    sway: true,
    shadow: PROP_TEXTURES.shadowL,
    jitter: 3,
  },
  boat: { texture: B.boat, footprint: { w: 3, h: 1 }, collider: { x: 2, y: 3, w: 44, h: 12 }, shadow: PROP_TEXTURES.shadowXL, surface: 'wood' },
  hut: { texture: B.hut, footprint: { w: 3, h: 2 }, collider: { x: 4, y: 16, w: 40, h: 14 }, shadow: PROP_TEXTURES.shadowXL },
  umbrella: { texture: B.umbrella, footprint: { w: 1, h: 1 }, collider: { x: 6, y: 10, w: 4, h: 4 }, shadow: PROP_TEXTURES.shadowL },
  // Indoors -------------------------------------------------------------------
  bed: { texture: B.bed, footprint: { w: 2, h: 2 }, collider: { x: 2, y: 2, w: 28, h: 28 }, use: 'bed' },
  table: { texture: B.table, footprint: { w: 2, h: 1 }, collider: { x: 1, y: 4, w: 30, h: 11 }, shadow: PROP_TEXTURES.shadowL },
  chair: { texture: B.chair, footprint: { w: 1, h: 1 }, collider: { x: 2, y: 8, w: 10, h: 6 } },
  stove: { texture: B.stove, footprint: { w: 2, h: 1 }, collider: { x: 0, y: 0, w: 32, h: 15 }, use: 'well' },
  shelf: { texture: B.shelf, footprint: { w: 2, h: 1 }, collider: { x: 1, y: 0, w: 28, h: 15 } },
  rug: { texture: B.rug, footprint: { w: 3, h: 2 }, flat: true, offsetY: -1 },
  plantPot: { texture: B.plantPot, footprint: { w: 1, h: 1 }, collider: { x: 3, y: 9, w: 10, h: 6 }, shadow: PROP_TEXTURES.shadowS },
  windowWall: { texture: B.windowWall, footprint: { w: 2, h: 1 }, flat: true, offsetY: 4 },
  floorLamp: {
    texture: B.floorLamp,
    footprint: { w: 1, h: 1 },
    collider: { x: 4, y: 10, w: 8, h: 5 },
    emissive: B.floorLampLit,
    lights: [{ x: 0, y: -24, texture: 'light-warm', scale: 1.1 }],
  },
  doormat: { texture: B.doormat, footprint: { w: 1, h: 1 }, flat: true, offsetY: -3, offsetX: 8 },
  // Phase 6: dog house, museum, park ----------------------------------------
  dogHouse: {
    texture: X.dogHouse,
    footprint: { w: 3, h: 2 },
    collider: { x: 3, y: 2, w: 42, h: 26 },
    offsetY: 1,
    shadow: PROP_TEXTURES.shadowL,
    emissive: X.dogHouseLit,
    lights: [{ x: 0, y: -14, texture: 'light-window', scale: 0.8 }],
  },
  museum: {
    texture: X.museum,
    footprint: { w: 7, h: 4 },
    collider: { x: 2, y: 8, w: 108, h: 48 },
    offsetY: 1,
    shadow: PROP_TEXTURES.shadowXL,
    emissive: X.museumLit,
    lights: [
      { x: 0, y: -22, texture: 'light-window', scale: 1.2 },
      { x: -31, y: -30, texture: 'light-window', scale: 0.9 },
      { x: 31, y: -30, texture: 'light-window', scale: 0.9 },
    ],
  },
  bigFountain: {
    texture: X.bigFountain,
    footprint: { w: 5, h: 3 },
    collider: { x: 2, y: 8, w: 76, h: 38 },
    anim: { frames: 4, ms: 140 },
    offsetX: 2,
    shadow: PROP_TEXTURES.shadowXL,
  },
  hedge: { texture: X.hedge, footprint: { w: 1, h: 1 }, collider: { x: 0, y: 6, w: 16, h: 9 }, shadow: PROP_TEXTURES.shadowM },
  parkLamp: {
    texture: X.parkLamp,
    footprint: { w: 1, h: 1 },
    collider: { x: 6, y: 11, w: 4, h: 4 },
    shadow: PROP_TEXTURES.shadowS,
    lights: [{ x: 0, y: -27, texture: 'light-warm', scale: 1 }],
  },
  ropePost: { texture: X.ropePost, footprint: { w: 1, h: 1 }, collider: { x: 0, y: 9, w: 16, h: 6 } },
  ...Object.fromEntries(
    PAINTINGS.map((id, i) => [
      `painting-${id}`,
      { texture: X.painting, frame: i, footprint: { w: 2, h: 1 }, flat: true, offsetY: -1, use: `art:${id}` } satisfies PropDef,
    ]),
  ),
  ...Object.fromEntries(
    SCULPTURES.map((id, i) => [
      `sculpture-${id}`,
      { texture: X.sculpture, frame: i, footprint: { w: 1, h: 1 }, collider: { x: 2, y: 8, w: 12, h: 7 }, shadow: PROP_TEXTURES.shadowS, use: `art:${id}` } satisfies PropDef,
    ]),
  ),
};

/** Default characters for prop rows. '-' is empty, '#' marks cells covered by a larger prop. */
export const PROP_LEGEND: Record<string, keyof typeof PROPS> = {
  T: 'treeRound',
  F: 'treeFruit',
  Y: 'treeSlender',
  B: 'bush',
  E: 'bushBerry',
  r: 'rock',
  R: 'boulder',
  S: 'stump',
  v: 'weeds',
  b: 'branch',
  l: 'log',
  f: 'fence',
  L: 'lamp',
  X: 'shippingBox',
  M: 'mailbox',
  H: 'house',
  K: 'lumbung',
  // Village and town
  '1': 'houseBlue',
  '2': 'houseGreen',
  '3': 'housePurple',
  '4': 'shop',
  '5': 'hall',
  W: 'warung',
  U: 'fruitStall',
  O: 'well',
  n: 'bench',
  g: 'signpost',
  a: 'barrel',
  c: 'crate',
  p: 'planter',
  N: 'board',
  Q: 'fountain',
  P: 'banana',
  h: 'hibiscus',
  w: 'flowerBed',
  // Beach
  A: 'palm',
  V: 'boat',
  J: 'hut',
  u: 'umbrella',
  // Indoors
  d: 'bed',
  t: 'table',
  k: 'chair',
  z: 'stove',
  s: 'shelf',
  G: 'rug',
  o: 'plantPot',
  i: 'windowWall',
  j: 'floorLamp',
  m: 'doormat',
};
