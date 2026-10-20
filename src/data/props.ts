// Prop definitions. Map prop rows place these by character; the character
// marks the bottom-left cell of the prop's footprint.

import { PROP_TEXTURES } from '../art/props';
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
}

export const PROPS: Record<string, PropDef> = {
  treeRound: {
    texture: PROP_TEXTURES.treeRound,
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
  },
  boulder: {
    texture: PROP_TEXTURES.boulder,
    footprint: { w: 2, h: 2 },
    collider: { x: 2, y: 10, w: 28, h: 20 },
    offsetY: 1,
    shadow: PROP_TEXTURES.shadowL,
  },
  stump: {
    texture: PROP_TEXTURES.stump,
    footprint: { w: 1, h: 1 },
    collider: { x: 2, y: 5, w: 12, h: 10 },
    shadow: PROP_TEXTURES.shadowS,
  },
  weeds: {
    texture: PROP_TEXTURES.weeds,
    footprint: { w: 1, h: 1 },
    sway: true,
    jitter: 1,
  },
  branch: {
    texture: PROP_TEXTURES.branch,
    footprint: { w: 1, h: 1 },
    flat: true,
    jitter: 1,
  },
  log: {
    texture: PROP_TEXTURES.log,
    footprint: { w: 2, h: 1 },
    collider: { x: 1, y: 4, w: 30, h: 10 },
    shadow: PROP_TEXTURES.shadowL,
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
  },
  mailbox: {
    texture: PROP_TEXTURES.mailbox,
    footprint: { w: 1, h: 1 },
    collider: { x: 5, y: 10, w: 6, h: 5 },
    shadow: PROP_TEXTURES.shadowS,
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
};
