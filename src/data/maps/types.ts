import type { ColorName } from '../../art/palette';
import type { TerrainKind } from '../terrain';

export type TimeOfDay = 'morning' | 'day' | 'evening' | 'night';

export interface MapDef {
  id: string;
  name: string;
  /** Terrain rows, one character per cell (see TERRAIN_LEGEND). */
  terrain: string[];
  /** Prop rows, same size as terrain (see PROP_LEGEND). */
  props: string[];
  terrainLegend?: Record<string, TerrainKind>;
  propLegend?: Record<string, string>;
  /** Player start cell. */
  spawn: { x: number; y: number };
  /** Seed for scattered decor and large-scale grass patches. */
  seed: number;
  decor: {
    flowers: number;
    tufts: number;
    pebbles: number;
    /** Chance of reeds on a grass cell next to water. */
    reeds: number;
    /** Chance of a lily pad on open water. */
    lilies: number;
    /** Noise threshold for the flowery meadow patches (higher = more; 0.17 covers ~9% of the farm). */
    meadow: number;
  };
  /** Music track id per time of day. */
  music: Record<TimeOfDay, string>;
  /** Ambience layer id -> level multiplier for this map. */
  ambience: Record<string, number>;
  /** Background colour outside the map. */
  backdrop: ColorName;
  /** Falling leaves near trees. */
  leaves: boolean;
  /** Open grass here can be tilled for crops. */
  tillable?: boolean;
  /** Indoor maps: steady lighting, no sky effects. 'shop' picks the second wall colourway. */
  indoor?: boolean;
  interiorStyle?: 'home' | 'shop' | 'paper' | 'gallery' | 'barn' | 'disco';
  /** Exits: stepping into the rectangle (cells) moves the player to another map. */
  warps?: WarpDef[];
  /** What signposts here say. */
  sign?: string;
  /** Pages pinned to notice boards here. */
  board?: string[];
  /** A slow way in: the screen stays black, then fades up (the dog's room). */
  entrance?: { blackMs: number; fadeMs: number };
  /** Where the dancing dog stands (feet cell). */
  dancer?: { x: number; y: number };
  /** A disco: the light-up dance floor (cells, inclusive) and where the puppy dances under the mirror ball. */
  disco?: { floor: { x0: number; y0: number; x1: number; y1: number }; puppy: { x: number; y: number } };
}

export interface WarpDef {
  x: number;
  y: number;
  w?: number;
  h?: number;
  to: string;
  /** Arrival cell and facing on the target map. */
  tx: number;
  ty: number;
  face?: 'down' | 'up' | 'left' | 'right';
  /** Door sound instead of a plain fade. */
  door?: boolean;
  /** Opening hours (minutes); outside them the door is locked. */
  hours?: [number, number];
  /** Name for the "closed" notice. */
  place?: string;
}
