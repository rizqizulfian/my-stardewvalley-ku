// The parts of GameState that are one shared world in co-op, and how changes
// to them travel. Each side flattens the shared parts into path -> JSON
// leaves, sends the leaves that changed since its last look, and applies the
// other side's leaves. Everything else in GameState (backpack, needs,
// friendships, mail) stays with each player.

import type { GameState } from '../systems/GameState';

/** A changed leaf: its path and new JSON, or null when it went away. */
export type Change = [path: string, value: string | null];

/** Plain values the host's world decides for everyone. */
const SCALARS = ['minute', 'day', 'season', 'year', 'weather', 'tomorrow', 'daysPlayed', 'forageDay'] as const;

/** The shared keys, copied whole into a joining player's state. */
export const WORLD_KEYS = [...SCALARS, 'gold', 'shipped', 'soil', 'picked', 'removed', 'forage', 'animals'] as const;

export type WorldSnapshot = Pick<GameState, (typeof WORLD_KEYS)[number]>;

export function snapshot(s: GameState): WorldSnapshot {
  return JSON.parse(JSON.stringify(Object.fromEntries(WORLD_KEYS.map((k) => [k, s[k]])))) as WorldSnapshot;
}

function flatten(s: GameState): Map<string, string> {
  const out = new Map<string, string>();
  for (const k of SCALARS) out.set(k, JSON.stringify(s[k]));
  out.set('gold', String(s.gold));
  out.set('shipped', JSON.stringify(s.shipped));
  for (const [m, cells] of Object.entries(s.soil)) for (const [c, v] of Object.entries(cells)) out.set(`soil/${m}/${c}`, JSON.stringify(v));
  for (const [m, cells] of Object.entries(s.picked)) for (const [c, v] of Object.entries(cells)) out.set(`picked/${m}/${c}`, String(v));
  for (const [m, cells] of Object.entries(s.removed)) for (const c of cells) out.set(`removed/${m}/${c}`, '1');
  for (const [m, spots] of Object.entries(s.forage)) for (const p of spots) out.set(`forage/${m}/${p.x},${p.y}`, JSON.stringify(p.id));
  for (const [id, a] of Object.entries(s.animals)) out.set(`animals/${id}`, JSON.stringify(a));
  return out;
}

/** What a batch of remote changes touched, so the scene can redraw just that. */
export interface Touched {
  /** New clock minute from the host (guests follow it minute by minute). */
  minute?: number;
  gold: boolean;
  soil: Set<string>;
  /** [map, anchor cell] of props cleared by someone else. */
  removed: Array<[string, number]>;
  forage: Set<string>;
  picked: Set<string>;
}

export class WorldSync {
  private base = new Map<string, string>();

  /** Start comparing from the state as it is now. */
  reset(s: GameState): void {
    this.base = flatten(s);
  }

  /** Changes since the last call. Gold travels as a difference so two shoppers never undo each other. */
  collect(s: GameState): Change[] {
    const cur = flatten(s);
    const out: Change[] = [];
    for (const [k, v] of cur) {
      const was = this.base.get(k);
      if (was === v) continue;
      out.push(k === 'gold' ? [k, String(Number(v) - Number(was ?? 0))] : [k, v]);
    }
    for (const k of this.base.keys()) if (!cur.has(k)) out.push([k, null]);
    this.base = cur;
    return out;
  }

  apply(s: GameState, changes: Change[]): Touched {
    const t: Touched = { gold: false, soil: new Set(), removed: [], forage: new Set(), picked: new Set() };
    for (const [path, v] of changes) {
      if (path === 'gold') {
        const d = Number(v);
        s.gold += d;
        this.base.set('gold', String(Number(this.base.get('gold') ?? 0) + d));
        t.gold = true;
        continue;
      }
      if (v === null) this.base.delete(path);
      else this.base.set(path, v);
      const [kind, m, key] = path.split('/');
      switch (kind) {
        case 'minute':
          // The scene steps the clock up to it (needs drain, period changes).
          t.minute = JSON.parse(v!) as number;
          break;
        case 'shipped':
          s.shipped = v ? JSON.parse(v) : [];
          break;
        case 'soil': {
          const cells = (s.soil[m] ??= {});
          if (v) cells[Number(key)] = JSON.parse(v);
          else delete cells[Number(key)];
          t.soil.add(m);
          break;
        }
        case 'picked': {
          const cells = (s.picked[m] ??= {});
          if (v) cells[Number(key)] = Number(v);
          else delete cells[Number(key)];
          t.picked.add(m);
          break;
        }
        case 'removed': {
          const list = (s.removed[m] ??= []);
          const c = Number(key);
          const i = list.indexOf(c);
          if (v && i < 0) {
            list.push(c);
            t.removed.push([m, c]);
          } else if (!v && i >= 0) list.splice(i, 1);
          break;
        }
        case 'forage': {
          const spots = (s.forage[m] ??= []);
          const [x, y] = key.split(',').map(Number);
          const i = spots.findIndex((p) => p.x === x && p.y === y);
          if (i >= 0) spots.splice(i, 1);
          if (v) spots.push({ x, y, id: JSON.parse(v) });
          t.forage.add(m);
          break;
        }
        case 'animals':
          if (v) s.animals[m] = JSON.parse(v);
          else delete s.animals[m];
          break;
        default:
          if ((SCALARS as readonly string[]).includes(kind) && v) (s as unknown as Record<string, unknown>)[kind] = JSON.parse(v);
      }
    }
    return t;
  }
}
