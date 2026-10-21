// The animals on the current map: spawns them in their runs, keeps them out
// of each other's (and the player's) way, and handles petting. A pet a day
// keeps them happy; cows give milk and sheep wool when it is time. As the
// evening comes (or on a wet day) they file into the barn, and out again.

import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import { ANIMALS, ANIMAL_INFO, BARN, animalPlace, type AnimalDef } from '../data/animals';
import type { Box } from '../data/props';
import { Animal } from '../entities/Animal';
import type { Effects } from './Effects';
import { EV, bus } from './events';
import type { GameState } from './GameState';
import { itemDef } from './Inventory';
import type { WorldMap } from './WorldMap';

const PET_REACH = 22;
/** Animals settle down for the night from this minute. */
const NIGHT_MINUTE = 21 * 60;
/** A random moo or cluck now and then when the player is near (ms, px). */
const CHATTER = { everyMs: 2600, chance: 0.35, hearPx: 150 } as const;
const T = 16;

export class AnimalSystem {
  readonly animals: Animal[] = [];
  private chatter = CHATTER.everyMs;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly map: WorldMap,
    private readonly state: GameState,
    private readonly fx: Effects,
  ) {
    for (const def of ANIMALS) {
      const place = animalPlace(def, state.minute, state.weather);
      if (place.map !== map.def.id) continue;
      const a = place.area;
      for (let tries = 0; tries < 40; tries++) {
        const cell = { x: a.x0 + Math.floor(Math.random() * (a.x1 - a.x0 + 1)), y: a.y0 + Math.floor(Math.random() * (a.y1 - a.y0 + 1)) };
        // Start on dry land, clear of props and of each other.
        if (!map.terrainAt(cell.x, cell.y).walkable || map.occupied.has(map.index(cell.x, cell.y))) continue;
        const animal = new Animal(scene, map, def, cell, a);
        if (!map.canOccupy(animal.body(), null) || this.animals.some((o) => overlap(o.body(), animal.body()))) {
          animal.destroy();
          continue;
        }
        this.animals.push(animal);
        break;
      }
    }
  }

  /** Each game minute: send animals through the barn door, or let them in. */
  onMinute(): void {
    const door = BARN.doors[this.map.def.id];
    if (!door) return;
    const px = (c: { x: number; y: number }) => ({ x: c.x * T + T / 2, y: c.y * T + T - 2 });
    const detour = BARN.detour[this.map.def.id];
    for (const def of ANIMALS) {
      const place = animalPlace(def, this.state.minute, this.state.weather);
      const here = this.animals.find((a) => a.def.id === def.id);
      if (here && place.map !== this.map.def.id && !here.leaving) {
        const route = detour && here.y < detour.aboveRow * T ? [...detour.via.map(px), px(door)] : [px(door)];
        here.leave(route, () => this.remove(here));
      }
      else if (!here && place.map === this.map.def.id) this.enter(def, door, place.area);
    }
  }

  private enter(def: AnimalDef, door: { x: number; y: number }, area: Animal['area']): void {
    const animal = new Animal(this.scene, this.map, def, door, area);
    animal.arrive();
    this.animals.push(animal);
  }

  private remove(a: Animal): void {
    const i = this.animals.indexOf(a);
    if (i >= 0) this.animals.splice(i, 1);
    a.destroy();
  }

  blocked(b: Box): boolean {
    return this.animals.some((a) => a.blocks(b));
  }

  /** The animal closest to a point, within reach. */
  at(px: number, py: number): Animal | null {
    let best: Animal | null = null;
    let bd = PET_REACH;
    for (const a of this.animals) {
      const d = a.distanceTo(px, py);
      if (d < bd) {
        bd = d;
        best = a;
      }
    }
    return best;
  }

  pet(a: Animal, fromX: number): void {
    const s = this.state;
    const rec = (s.animals[a.def.id] ??= { petted: -1, gave: -999 });
    const info = ANIMAL_INFO[a.def.kind];
    audio.playSfx(info.sound, 0.9, 0.95 + Math.random() * 0.1);
    if (rec.petted === s.daysPlayed) {
      a.react('note', fromX);
      bus.emit(EV.notice, `${a.def.name} already had a cuddle today.`);
      return;
    }
    rec.petted = s.daysPlayed;
    a.react('heart', fromX);
    audio.playSfx('heart', 0.6);
    const g = a.def.gives;
    if (g && s.daysPlayed - rec.gave >= g.every) {
      rec.gave = s.daysPlayed;
      this.fx.drop(g.item, 1, a.x, a.y);
      bus.emit(EV.notice, `${a.def.name} ${info.love} You got some ${itemDef(g.item).name.toLowerCase()}.`);
    } else if (g) {
      const left = g.every - (s.daysPlayed - rec.gave);
      bus.emit(EV.notice, `${a.def.name} ${info.love} More ${itemDef(g.item).name.toLowerCase()} in ${left} day${left === 1 ? '' : 's'}.`);
    } else bus.emit(EV.notice, `${a.def.name} ${info.love}`);
  }

  update(deltaMs: number, playerX: number, playerY: number, playerFeet: Box): void {
    const sleepy = this.state.minute >= NIGHT_MINUTE;
    const blocked = (b: Box, self: Animal) => overlap(b, playerFeet) || this.animals.some((o) => o !== self && overlap(b, o.body()));
    for (const a of [...this.animals]) {
      a.sleepy = sleepy;
      a.update(deltaMs, blocked);
    }
    this.chatter -= deltaMs;
    if (this.chatter <= 0 && !sleepy) {
      this.chatter = CHATTER.everyMs;
      const near = this.animals.filter((a) => a.distanceTo(playerX, playerY) < CHATTER.hearPx);
      if (near.length && Math.random() < CHATTER.chance) {
        const a = near[Math.floor(Math.random() * near.length)];
        const d = a.distanceTo(playerX, playerY);
        audio.playSfx(ANIMAL_INFO[a.def.kind].sound, 0.5 * (1 - d / CHATTER.hearPx) + 0.1, 0.9 + Math.random() * 0.2);
      }
    }
  }

  destroy(): void {
    for (const a of this.animals) a.destroy();
    this.animals.length = 0;
  }
}

function overlap(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
