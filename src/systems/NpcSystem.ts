// The villagers on the current map: spawns them from their schedules, moves
// them along as the clock runs, keeps them solid, and runs conversations
// (daily chat, gifts, shops, one-off presents and Jotaro's Stand).

import Phaser from 'phaser';
import { DEPTH } from '../config';
import { FX_TEXTURES } from '../art/fx';
import { portraitTexture } from '../art/npcs';
import { audio } from '../audio/AudioManager';
import { NPCS, GIFT_LINES, stopAt, type NpcDef } from '../data/npcs';
import type { Box } from '../data/props';
import { Npc } from '../entities/Npc';
import type { DialogRequest } from '../ui/DialogBox';
import type { Effects } from './Effects';
import { EV, bus } from './events';
import { canGift, chat, giveGift, hasMet, hearts, pickLine } from './friendship';
import { isWet, type GameState } from './GameState';
import { addItem, itemDef, selectedStack, takeFromSlot } from './Inventory';
import type { WorldMap } from './WorldMap';

const TALK_REACH = 22;
const ORA_MS = 1500;

export interface TalkHooks {
  openShop: (id: string) => boolean;
}

export class NpcSystem {
  readonly npcs: Npc[] = [];
  private readonly notes: Phaser.GameObjects.Image[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly map: WorldMap,
    private readonly state: GameState,
    private readonly fx: Effects,
  ) {
    for (const def of NPCS) {
      const stop = stopAt(def, state.minute);
      if (stop?.map === map.def.id) this.add(def, true);
    }
  }

  private add(def: NpcDef, placed: boolean): Npc {
    const n = new Npc(this.scene, this.map, def, stopAt(def, this.state.minute)!, placed);
    n.raining = isWet(this.state.weather) && !this.map.def.indoor;
    n.onNote = (x, y) => this.note(x, y);
    this.npcs.push(n);
    return n;
  }

  /** Each game minute: follow the schedules. */
  onMinute(): void {
    for (const def of NPCS) {
      const stop = stopAt(def, this.state.minute);
      const here = this.npcs.find((n) => n.def.id === def.id);
      if (here) {
        if (here.leaving || here.talking) continue;
        if (!stop || stop.map !== this.map.def.id) here.leave(() => this.remove(here));
        else if (stop !== here.stop) here.moveTo(stop);
      } else if (stop?.map === this.map.def.id) this.add(def, false);
    }
  }

  private remove(n: Npc): void {
    const i = this.npcs.indexOf(n);
    if (i >= 0) this.npcs.splice(i, 1);
    n.destroy();
  }

  blocked(b: Box): boolean {
    return this.npcs.some((n) => n.blocks(b));
  }

  /** The villager closest to a point, within talking reach. */
  at(px: number, py: number): Npc | null {
    let best: Npc | null = null;
    let bd = TALK_REACH;
    for (const n of this.npcs) {
      if (n.leaving) continue;
      const d = n.distanceTo(px, py);
      if (d < bd) {
        bd = d;
        best = n;
      }
    }
    return best;
  }

  update(deltaMs: number, px: number, py: number, playerFeet: Box): void {
    for (const n of this.npcs) n.update(deltaMs, px, py, playerFeet);
    for (let i = this.notes.length - 1; i >= 0; i--) {
      const o = this.notes[i];
      if (!o.active) this.notes.splice(i, 1);
    }
  }

  /** A music note floats up from a dancer. */
  note(x: number, y: number): void {
    const img = this.scene.add.image(Math.round(x), Math.round(y), FX_TEXTURES.note, Math.floor(Math.random() * 2)).setDepth(DEPTH.particlesAbove);
    this.notes.push(img);
    this.scene.tweens.add({
      targets: img,
      y: y - 18,
      x: x + (Math.random() * 8 - 4),
      alpha: 0,
      duration: 1600,
      onUpdate: () => img.setPosition(Math.round(img.x), Math.round(img.y)),
      onComplete: () => img.destroy(),
    });
  }

  // -------------------------------------------------------------------------
  // Conversations

  private speaker(def: NpcDef): string {
    const h = hearts(this.state, def.id);
    return h > 0 ? `${def.name}  ${'~'.repeat(h)}` : def.name;
  }

  private say(n: Npc, pages: string[], extra: Partial<DialogRequest> = {}): void {
    const def = n.def;
    n.talking = true;
    bus.emit(EV.dialog, {
      speaker: this.speaker(def),
      portrait: { texture: portraitTexture(def.id) },
      voice: def.voice,
      pages,
      ...extra,
      onClose: () => {
        n.talking = false;
        extra.onClose?.();
      },
    } satisfies DialogRequest);
  }

  /** Talk to a villager. The player stands at (px, py). */
  talk(n: Npc, px: number, py: number, hooks: TalkHooks): void {
    const def = n.def;
    n.faceToward(px, py);
    const s = this.state;
    const first = !hasMet(s, def.id);
    const rose = chat(s, def.id);
    if (rose && !first) n.react('note');
    const pages = first ? [...def.intro] : [pickLine(s, def)];

    // A one-off present (Darto's fishing rod).
    const gift = def.gift && !s.flags[def.gift.flag] ? def.gift : null;
    if (gift) pages.push(...gift.pages);

    const held = selectedStack(s);
    const heldDef = held ? itemDef(held.id) : null;
    const choices: string[] = [];
    const actions: Array<() => void> = [];
    if (heldDef && heldDef.kind !== 'tool' && !gift) {
      choices.push(`Give ${heldDef.name}`);
      actions.push(() => this.gift(n, held!.id));
    }
    if (def.shop) {
      choices.push('Shop');
      actions.push(() => hooks.openShop(def.shop!));
    }
    if (def.stand) {
      choices.push('Your Stand?');
      actions.push(() => this.ora(n));
    }
    if (choices.length) {
      choices.push('Bye');
      actions.push(() => undefined);
    }
    this.say(n, pages, {
      choices: choices.length ? choices : undefined,
      onChoose: (i) => {
        if (i >= 0) this.scene.time.delayedCall(60, () => actions[i]?.());
      },
      onClose: () => {
        if (gift) this.handOver(n, gift.item, gift.flag);
      },
    });
  }

  private handOver(n: Npc, item: string, flag: string): void {
    this.state.flags[flag] = true;
    const left = addItem(this.state, item, 1);
    audio.playSfx('gift', 0.9);
    if (left > 0) this.fx.drop(item, left, n.x, n.y + 6);
    bus.emit(EV.notice, `Received: ${itemDef(item).name}!`);
  }

  private gift(n: Npc, item: string): void {
    const def = n.def;
    if (!canGift(this.state, def.id)) {
      this.say(n, ['Hari ini kamu sudah memberiku sesuatu. Terima kasih, ya!']);
      return;
    }
    const slot = this.state.selected;
    if (this.state.inventory[slot]?.id !== item || takeFromSlot(this.state, slot, 1) < 1) return;
    const before = hearts(this.state, def.id);
    const taste = giveGift(this.state, def, item);
    audio.playSfx(taste === 'dislike' ? 'bonk' : 'gift', 0.8);
    n.react(taste === 'love' || taste === 'like' ? 'heart' : taste === 'dislike' ? 'angry' : 'dots');
    const up = hearts(this.state, def.id) > before;
    if (up) audio.playSfx('heart', 0.8);
    this.say(n, [GIFT_LINES[taste]]);
  }

  /** Star Platinum's rush, then a word from Jotaro. */
  private ora(n: Npc): void {
    n.talking = true;
    n.rush(ORA_MS);
    audio.playSfx('ora', 0.9);
    this.scene.time.delayedCall(ORA_MS / 2, () => audio.playSfx('ora', 0.9));
    this.scene.cameras.main.shake(ORA_MS, 0.003);
    this.scene.time.delayedCall(ORA_MS + 150, () => {
      n.react('alert');
      this.say(n, ['ORA ORA ORA ORA ORA ORA!!', 'Yare yare daze. ...Jangan bilang siapa-siapa.']);
    });
  }

  /** Rain stops the dancing (and starts it again). */
  setRaining(r: boolean): void {
    for (const n of this.npcs) n.raining = r;
  }

  destroy(): void {
    for (const n of this.npcs) n.destroy();
    this.npcs.length = 0;
    for (const o of this.notes) o.destroy();
  }
}

