// Parsed map data: terrain per cell, placed props, colliders and the rules
// for walking (walkable cells, elevation, stairs). No rendering here.

import { RENDER } from '../config';
import type { MapDef } from '../data/maps/types';
import { PROPS, PROP_LEGEND, type Box, type PropDef } from '../data/props';
import { TERRAIN, TERRAIN_LEGEND, type Surface, type TerrainDef, type TerrainKind } from '../data/terrain';

const T = RENDER.tileSize;

export interface PlacedProp {
  id: string;
  def: PropDef;
  /** Anchor (bottom-left footprint) cell. */
  cx: number;
  cy: number;
  /** Fence connection mask, if the prop connects. */
  connections: number;
  /** Index into WorldMap.colliders, or -1. */
  collider: number;
}

export class WorldMap {
  readonly w: number;
  readonly h: number;
  readonly kinds: TerrainKind[];
  readonly props: PlacedProp[] = [];
  readonly colliders: Box[] = [];
  /** Cell index -> collider indices overlapping it. */
  private readonly colliderCells = new Map<number, number[]>();
  /** Cells covered by a prop footprint (no decor there). */
  readonly occupied = new Set<number>();
  /** Cell index -> the prop whose footprint covers it. */
  private readonly propCells = new Map<number, PlacedProp>();

  /** `removed` lists anchor cells of props cleared earlier (they are skipped). */
  constructor(
    readonly def: MapDef,
    private readonly removed: ReadonlySet<number> = new Set(),
  ) {
    this.h = def.terrain.length;
    this.w = def.terrain[0].length;
    const legend = { ...TERRAIN_LEGEND, ...(def.terrainLegend ?? {}) };
    this.kinds = [];
    def.terrain.forEach((row, y) => {
      if (row.length !== this.w) throw new Error(`[map ${def.id}] terrain row ${y} has width ${row.length}, expected ${this.w}`);
      for (let x = 0; x < this.w; x++) {
        const k = legend[row[x]];
        if (!k) throw new Error(`[map ${def.id}] unknown terrain '${row[x]}' at ${x},${y}`);
        this.kinds.push(k);
      }
    });
    this.parseProps();
  }

  private parseProps(): void {
    const legend: Record<string, string> = { ...PROP_LEGEND, ...(this.def.propLegend ?? {}) };
    const rows = this.def.props;
    if (rows.length !== this.h) throw new Error(`[map ${this.def.id}] prop rows: ${rows.length}, expected ${this.h}`);
    const at = (x: number, y: number) => rows[y]?.[x] ?? '-';
    for (let y = 0; y < this.h; y++) {
      if (rows[y].length !== this.w) throw new Error(`[map ${this.def.id}] prop row ${y} has width ${rows[y].length}`);
      for (let x = 0; x < this.w; x++) {
        const ch = at(x, y);
        if (ch === '-' || ch === '#') continue;
        const id = legend[ch];
        const def = id ? PROPS[id] : undefined;
        if (!def) throw new Error(`[map ${this.def.id}] unknown prop '${ch}' at ${x},${y}`);
        if (this.removed.has(this.index(x, y))) continue;
        let connections = 0;
        if (def.connects) {
          const same = (dx: number, dy: number) => at(x + dx, y + dy) === ch;
          connections = (same(0, -1) ? 1 : 0) | (same(1, 0) ? 2 : 0) | (same(0, 1) ? 4 : 0) | (same(-1, 0) ? 8 : 0);
        }
        const placed: PlacedProp = { id, def, cx: x, cy: y, connections, collider: -1 };
        this.props.push(placed);
        for (let j = 0; j < def.footprint.h; j++)
          for (let i = 0; i < def.footprint.w; i++) {
            this.occupied.add(this.index(x + i, y - j));
            this.propCells.set(this.index(x + i, y - j), placed);
          }
        if (def.collider) {
          const left = x * T;
          const top = (y - def.footprint.h + 1) * T;
          placed.collider = this.addCollider({ x: left + def.collider.x, y: top + def.collider.y, w: def.collider.w, h: def.collider.h });
        }
      }
    }
  }

  private addCollider(b: Box): number {
    const i = this.colliders.length;
    this.colliders.push(b);
    for (let cy = Math.floor(b.y / T); cy <= Math.floor((b.y + b.h - 1) / T); cy++)
      for (let cx = Math.floor(b.x / T); cx <= Math.floor((b.x + b.w - 1) / T); cx++) {
        const k = this.index(cx, cy);
        const list = this.colliderCells.get(k);
        if (list) list.push(i);
        else this.colliderCells.set(k, [i]);
      }
    return i;
  }

  propAt(cx: number, cy: number): PlacedProp | undefined {
    return this.propCells.get(this.index(cx, cy));
  }

  /** Clears a prop from the map: footprint, collider and lookup. */
  removeProp(p: PlacedProp): void {
    const i = this.props.indexOf(p);
    if (i >= 0) this.props.splice(i, 1);
    for (let j = 0; j < p.def.footprint.h; j++)
      for (let k = 0; k < p.def.footprint.w; k++) {
        const c = this.index(p.cx + k, p.cy - j);
        this.occupied.delete(c);
        this.propCells.delete(c);
      }
    if (p.collider >= 0) this.colliders[p.collider] = { x: 0, y: 0, w: 0, h: 0 };
  }

  /** Can this cell be tilled (open ground, nothing standing on it)? */
  canTill(cx: number, cy: number): boolean {
    if (!this.def.tillable || !this.inBounds(cx, cy)) return false;
    return this.kindAt(cx, cy) === 'grass' && !this.occupied.has(this.index(cx, cy));
  }

  index(x: number, y: number): number {
    return y * this.w + x;
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  /** Terrain kind with edge clamping, so autotiles extend past the border. */
  kindAt(x: number, y: number): TerrainKind {
    const cx = Math.min(this.w - 1, Math.max(0, x));
    const cy = Math.min(this.h - 1, Math.max(0, y));
    return this.kinds[this.index(cx, cy)];
  }

  terrainAt(x: number, y: number): TerrainDef {
    return TERRAIN[this.kindAt(x, y)];
  }

  surfaceAtPx(px: number, py: number): Surface {
    return this.terrainAt(Math.floor(px / T), Math.floor(py / T)).surface;
  }

  get pixelWidth(): number {
    return this.w * T;
  }

  get pixelHeight(): number {
    return this.h * T;
  }

  /**
   * Can a box (world pixels) stand here at a given elevation?
   * `elevation` null means "on stairs": any elevation is allowed.
   */
  canOccupy(b: Box, elevation: number | null): boolean {
    if (b.x < 0 || b.y < 0 || b.x + b.w > this.pixelWidth || b.y + b.h > this.pixelHeight) return false;
    const x0 = Math.floor(b.x / T);
    const x1 = Math.floor((b.x + b.w - 1) / T);
    const y0 = Math.floor(b.y / T);
    const y1 = Math.floor((b.y + b.h - 1) / T);
    for (let cy = y0; cy <= y1; cy++)
      for (let cx = x0; cx <= x1; cx++) {
        const t = this.terrainAt(cx, cy);
        if (!t.walkable) return false;
        if (elevation !== null && !t.stairs && t.elevation !== elevation) return false;
        for (const ci of this.colliderCells.get(this.index(cx, cy)) ?? []) {
          const c = this.colliders[ci];
          if (b.x < c.x + c.w && b.x + b.w > c.x && b.y < c.y + c.h && b.y + b.h > c.y) return false;
        }
      }
    return true;
  }

  /** Elevation for a standing point, or null when on stairs. */
  elevationAtPx(px: number, py: number): number | null {
    const t = this.terrainAt(Math.floor(px / T), Math.floor(py / T));
    return t.stairs ? null : t.elevation;
  }

  /** Distance in cells to the nearest water cell (capped). */
  waterDistance(px: number, py: number, cap = 8): number {
    const cx = Math.floor(px / T);
    const cy = Math.floor(py / T);
    let best = cap;
    for (let y = cy - cap; y <= cy + cap; y++)
      for (let x = cx - cap; x <= cx + cap; x++) {
        if (!this.inBounds(x, y) || !TERRAIN[this.kindAt(x, y)].water) continue;
        best = Math.min(best, Math.hypot(x - cx, y - cy));
      }
    return best;
  }
}
