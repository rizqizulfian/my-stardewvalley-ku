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
    /** 0..1 coverage of darker meadow patches. */
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
}
