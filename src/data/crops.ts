// Crop definitions. A crop moves through growth stages 0..n-1, spending
// `stageDays[i]` watered days in stage i, then reaches the final ripe stage.
// Art for each stage is generated in art/items.ts under the crop's texture.

export interface CropDef {
  id: string;
  name: string;
  /** Item given on harvest. */
  produce: string;
  /** Watered days needed in each growing stage before the next one. */
  stageDays: number[];
  /** Harvest amount, inclusive range. */
  yield: [number, number];
  /** If set, the plant stays after harvest and ripens again after this many watered days. */
  regrowDays?: number;
  /** Season indices (0 Spring .. 3 Winter) it grows in; it withers when the season moves on. */
  seasons: number[];
  texture: string;
}

export const CROPS: Record<string, CropDef> = {
  padi: { id: 'padi', name: 'Rice', produce: 'padi', stageDays: [1, 2, 2, 2], yield: [1, 2], seasons: [0, 1], texture: 'crop-padi' },
  jagung: { id: 'jagung', name: 'Corn', produce: 'jagung', stageDays: [1, 1, 2, 2], yield: [1, 1], seasons: [0, 1, 2], texture: 'crop-jagung' },
  cabai: { id: 'cabai', name: 'Chili', produce: 'cabai', stageDays: [1, 1, 1, 2], yield: [2, 4], regrowDays: 3, seasons: [0, 1], texture: 'crop-cabai' },
  terong: { id: 'terong', name: 'Eggplant', produce: 'terong', stageDays: [1, 1, 2, 2], yield: [1, 2], regrowDays: 3, seasons: [0, 1, 2], texture: 'crop-terong' },
  matahari: { id: 'matahari', name: 'Sunflower', produce: 'matahari', stageDays: [1, 2, 2, 2], yield: [1, 1], seasons: [0, 1, 2], texture: 'crop-matahari' },
  mawar: { id: 'mawar', name: 'Rose', produce: 'mawar', stageDays: [1, 1, 2, 2], yield: [1, 2], regrowDays: 4, seasons: [0, 1, 2], texture: 'crop-mawar' },
  melati: { id: 'melati', name: 'Jasmine', produce: 'melati', stageDays: [1, 1, 1, 2], yield: [2, 3], regrowDays: 3, seasons: [0, 1], texture: 'crop-melati' },
};

export function inSeason(c: CropDef, season: number): boolean {
  return c.seasons.includes(season);
}

/** Total stages per crop sheet: growing stages plus the ripe stage. */
export function ripeStage(c: CropDef): number {
  return c.stageDays.length;
}
