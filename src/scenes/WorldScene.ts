import Phaser from 'phaser';
import { DEBUG, NEEDS, PLAYER, RENDER, TIME } from '../config';
import { hex } from '../art/palette';
import { audio } from '../audio/AudioManager';
import { PLAYER_CHARACTER } from '../data/characters';
import type { Facing } from '../art/characters';
import { FX_TEXTURES, EMOTE } from '../art/fx';
import { letter } from '../data/mail';
import { ARTWORKS } from '../data/museum';
import { MAPS } from '../data/maps';
import { musicFor } from '../data/music';
import { SHOPS } from '../data/shops';
import type { MapDef, WarpDef } from '../data/maps/types';
import { DOG_BEAT_MS, DogDance } from '../entities/DogDance';
import { Player } from '../entities/Player';
import { AnimalSystem } from '../systems/AnimalSystem';
import { Atmosphere } from '../systems/Atmosphere';
import { Effects } from '../systems/Effects';
import { Fishing } from '../systems/Fishing';
import { ensureForage } from '../systems/forage';
import { Gathering } from '../systems/Gathering';
import { Weather } from '../systems/Weather';
import { NpcSystem } from '../systems/NpcSystem';
import { EV, bus } from '../systems/events';
import { soilOf } from '../systems/farming';
import { FarmView } from '../systems/FarmView';
import { isWet, state, type Weather as WeatherKind } from '../systems/GameState';
import { endDay } from '../systems/day';
import { addItem, itemDef, selectSlot, selectedStack } from '../systems/Inventory';
import { addNeed, walkFactor } from '../systems/needs';
import { saveGame } from '../systems/save';
import { canShip, shipSlot } from '../systems/shipping';
import { renderMap, worldDepth, type RenderedMap } from '../systems/MapRenderer';
import { TimeSystem, formatClock, timeOfDay } from '../systems/TimeSystem';
import { ToolController } from '../systems/ToolController';
import { overHud, uiState } from '../systems/uiState';
import { WorldMap, type PlacedProp } from '../systems/WorldMap';
import type { DialogRequest } from '../ui/DialogBox';

/** The notice board's line about tomorrow. */
const FORECAST: Record<WeatherKind, string> = {
  sun: 'sunny.',
  rain: 'rain. No need to water!',
  storm: 'thunderstorms! Stay near a roof.',
  snow: 'snow. Wrap up warm!',
};

const T = RENDER.tileSize;
/** How often ambience levels are refreshed (ms). */
const AMBIENCE_REFRESH_MS = 500;
/** Cells from water at which the pond is inaudible. */
const WATER_HEARING_CELLS = 7;
/** The sea carries further; waves never drop below this share on the beach. */
const WAVES_HEARING_CELLS = 16;
const WAVES_FLOOR = 0.3;
/** Player sprite's visual center sits this far above the feet. */
const CAMERA_FOCUS_OFFSET_Y = 12;
/** A ripe crop twinkles about this often (ms). */
const RIPE_SPARKLE_MS = 900;
const HOTBAR_KEYS = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'ZERO'];
const FADE_OUT_MS = 220;
const FADE_IN_MS = 280;
/** How far ahead of the feet (px) a step is checked against exits. */
const WARP_PROBE = 3;

/** Seated, the sprite sits this many px above the feet point so the bench sorts behind the legs. */
const SEAT_LIFT = 7;
const SLEEP_FADE_MS = 900;
const PASS_OUT_FADE_MS = 400;

function dialog(req: DialogRequest): void {
  bus.emit(EV.dialog, req);
}

/** Where the player appears after a map change (set just before the scene restarts). */
let arrival: { x: number; y: number; face: Facing } | null = null;

export class WorldScene extends Phaser.Scene {
  private def!: MapDef;
  private map!: WorldMap;
  private rendered!: RenderedMap;
  private player!: Player;
  private time2!: TimeSystem;
  private atmosphere!: Atmosphere;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private farm!: FarmView;
  private fx!: Effects;
  private tools!: ToolController;
  private npcs!: NpcSystem;
  private animals!: AnimalSystem;
  private fishing!: Fishing;
  private gather!: Gathering;
  private weather!: Weather;
  private mailFlag: Phaser.GameObjects.Image | null = null;
  private dog: DogDance | null = null;
  private closedNoticeAt = 0;
  private camX = 0;
  private camY = 0;
  private started = false;
  private nextAmbience = 0;
  private nextSparkle = 0;
  private leaving = false;

  constructor() {
    super('World');
  }

  create(): void {
    this.def = MAPS[state.mapId];
    this.map = new WorldMap(this.def, new Set(state.removed[this.def.id] ?? []));
    const soil = soilOf(state, this.def.id);
    this.rendered = renderMap(this, this.map, (x, y) => !!soil[this.map.index(x, y)]);
    this.farm = new FarmView(this, this.map, state);
    this.cameras.main.setBackgroundColor(hex(this.def.backdrop));
    this.cameras.main.setRoundPixels(true);

    const spot = arrival ?? { ...this.def.spawn, face: 'down' as Facing };
    arrival = null;
    const sx = spot.x * T + T / 2;
    const sy = (spot.y + 1) * T - 2;
    this.player = new Player(this, this.map, PLAYER_CHARACTER.texture, sx, sy);
    this.player.facing = spot.face;
    this.player.onFootstep = (surface) => audio.footstep(surface);

    this.time2 = new TimeSystem(state);
    this.atmosphere = new Atmosphere(this, this.rendered, this.def.leaves, !!this.def.indoor, this.def.interiorStyle === 'paper');
    this.weather = new Weather(this, state.weather, !!this.def.indoor, this.map.pixelWidth, this.map.pixelHeight);
    this.fx = new Effects(this);
    this.fx.collect = (id, qty) => {
      const left = addItem(state, id, qty);
      if (left < qty) audio.playSfx('pickup', 0.7);
      if (left > 0) bus.emit(EV.notice, 'Your backpack is full');
      return left;
    };
    this.tools = new ToolController(this, state, this.map, this.rendered, this.farm, this.player, this.fx);
    this.npcs = new NpcSystem(this, this.map, state, this.fx);
    this.dog = this.def.dancer ? new DogDance(this, this.def.dancer) : null;
    this.animals = new AnimalSystem(this, this.map, state, this.fx);
    this.player.blocked = (b) => this.npcs.blocked(b) || this.animals.blocked(b) || !!this.dog?.blocks(b);
    this.fishing = new Fishing(this, state, this.map, this.player, this.fx);
    ensureForage(state);
    this.gather = new Gathering(this, this.map, state, this.rendered, this.fx);
    this.tools.onPickup = (cx, cy) => this.gather.pickUp(cx, cy);
    this.npcs.setRaining(isWet(state.weather) && !this.def.indoor);
    const box = this.map.props.find((p) => p.def.use === 'mailbox');
    if (box) {
      const [mx, my] = this.propCenter(box);
      this.mailFlag = this.add.image(mx, my - 22, FX_TEXTURES.emote, EMOTE.alert).setDepth(worldDepth(my + 8) + 1);
      this.tweens.add({ targets: this.mailFlag, y: my - 25, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', onUpdate: () => this.mailFlag?.setY(Math.round(this.mailFlag.y)) });
      this.refreshMailFlag();
    }
    this.tools.onCast = () => this.fishing.cast();
    this.tools.onTalk = (px, py) => {
      if (this.dog && this.dog.distanceTo(px, py) < 24) return this.talkToDog();
      const n = this.npcs.at(px, py);
      const a = this.animals.at(px, py);
      if (a && (!n || a.distanceTo(px, py) < Math.hypot(px - n.x, py - n.y + 6))) {
        this.player.face(a.x, a.y - 4);
        this.animals.pet(a, this.player.x);
        return true;
      }
      if (!n) return false;
      this.player.face(n.x, n.y - 6);
      this.npcs.talk(n, this.player.x, this.player.y, { openShop: (id) => this.openShop(id) });
      return true;
    };

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys(
      ['W,A,S,D,UP,DOWN,LEFT,RIGHT,M,SPACE,C,X,F', DEBUG.fastForwardKey, DEBUG.nextDayKey, ...HOTBAR_KEYS].join(','),
    ) as Record<string, Phaser.Input.Keyboard.Key>;
    this.keys.M.on('down', () => audio.toggleMute());
    HOTBAR_KEYS.forEach((k, i) =>
      this.keys[k].on('down', () => {
        if (uiState.menuOpen) return;
        selectSlot(state, i);
        audio.playSfx('select', 0.6);
      }),
    );
    this.keys[DEBUG.nextDayKey].on('down', () => {
      if (this.started && !uiState.menuOpen) this.sleep(false);
    });
    const interact = () => {
      if (this.started && !uiState.menuOpen) this.tools.interact();
    };
    this.keys.X.on('down', interact);
    this.keys.F.on('down', interact);
    // While the line is out, the use button hooks and reels (one press each).
    const reel = () => {
      if (this.started && !uiState.menuOpen && this.fishing.active) this.fishing.press();
    };
    this.keys.SPACE.on('down', reel);
    this.keys.C.on('down', reel);
    this.input.mouse?.disableContextMenu();
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!this.started || uiState.menuOpen || overHud(p.x, p.y)) return;
      if (this.fishing.active) {
        if (!p.rightButtonDown()) this.fishing.press();
        return;
      }
      this.tools.aim(p);
      if (p.rightButtonDown()) this.tools.interact();
      else this.tools.use();
    });
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      if (!this.started || uiState.menuOpen || dy === 0) return;
      selectSlot(state, state.selected + Math.sign(dy));
      audio.playSfx('select', 0.6);
    });
    this.tools.onUseProp = (p) => this.useProp(p);
    const onFarm = () => this.farm.refresh();
    const onPassOut = () => this.sleep(true);
    // Resting on a bench brings energy back minute by minute.
    const onMinute = () => {
      if (this.player.seated) addNeed(state, 'energy', NEEDS.benchEnergy);
      this.npcs.onMinute();
      this.animals.onMinute();
    };
    bus.on(EV.farmChanged, onFarm);
    bus.on(EV.passOut, onPassOut);
    bus.on(EV.minute, onMinute);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      bus.off(EV.farmChanged, onFarm);
      bus.off(EV.passOut, onPassOut);
      bus.off(EV.minute, onMinute);
      bus.off(EV.started, this.onStarted, this);
      // Keys and pointer handlers belong to this map; the scene restarts on every map change.
      this.input.keyboard?.removeAllKeys(true);
      this.input.off('pointerdown');
      this.input.off('wheel');
      this.fishing.destroy();
      this.gather.destroy();
      this.weather.destroy();
      this.dog?.destroy();
      this.dog = null;
      this.mailFlag = null;
      this.npcs.destroy();
      this.animals.destroy();
      this.fx.destroy();
      this.tools.destroy();
      this.farm.destroy();
      this.rendered.destroy();
    });

    this.snapCamera();
    const entrance = this.def.entrance;
    if (entrance) {
      // Hold on black, then fade slowly up into the room.
      this.cameras.main.fadeOut(1, 0, 0, 0);
      this.time.delayedCall(entrance.blackMs, () => this.cameras.main.fadeIn(entrance.fadeMs, 0, 0, 0));
    } else this.cameras.main.fadeIn(FADE_IN_MS, 0, 0, 0);
    this.leaving = false;
    if (uiState.started) this.onStarted();
    else bus.once(EV.started, this.onStarted, this);
    bus.on(EV.periodChanged, this.onPeriod, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => bus.off(EV.periodChanged, this.onPeriod, this));
  }

  private onStarted(): void {
    this.started = true;
    this.playMusic();
  }

  private playMusic(): void {
    audio.playMusic(musicFor(this.def.music[timeOfDay(state.minute)], state.season, isWet(state.weather)));
  }

  /** Leave through an exit: fade out, switch map, restart the scene there. */
  private warp(w: WarpDef): void {
    if (this.leaving) return;
    if (w.hours && (state.minute < w.hours[0] || state.minute >= w.hours[1])) {
      if (this.time.now > this.closedNoticeAt) {
        this.closedNoticeAt = this.time.now + 2500;
        audio.playSfx('bonk', 0.5);
        bus.emit(EV.notice, `${w.place ?? 'It'} is closed. Open ${formatClock(w.hours[0])} - ${formatClock(w.hours[1])}.`);
      }
      return;
    }
    this.leaving = true;
    this.tools.enabled = false;
    audio.playSfx(w.door ? 'door' : 'whoosh', 0.8);
    arrival = { x: w.tx, y: w.ty, face: w.face ?? this.player.facing };
    this.cameras.main.fadeOut(FADE_OUT_MS, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      // A new map brings its own music, even mid opening song.
      audio.endOpening(false);
      state.mapId = w.to;
      this.scene.restart();
    });
  }

  /** The exit the player is stepping into, if any. */
  private warpAt(dx: number, dy: number): WarpDef | undefined {
    const fw = PLAYER.feetWidth;
    const fh = PLAYER.feetHeight;
    const bx = this.player.x - fw / 2 + Math.sign(dx) * WARP_PROBE;
    const by = this.player.y - fh + Math.sign(dy) * WARP_PROBE;
    return this.def.warps?.find((w) => {
      const x0 = w.x * T;
      const y0 = w.y * T;
      const x1 = x0 + (w.w ?? 1) * T;
      const y1 = y0 + (w.h ?? 1) * T;
      return bx < x1 && bx + fw > x0 && by < y1 && by + fh > y0;
    });
  }

  // -------------------------------------------------------------------------
  // Things the action button can use

  private useProp(p: PlacedProp): boolean {
    const use = p.def.use;
    if (!use) return false;
    if (use.startsWith('shop:')) return this.openShop(use.slice(5));
    switch (use) {
      case 'bed':
        dialog({
          pages: [state.minute < 18 * 60 ? 'Go to bed already? The day will end.' : 'Go to sleep for the night?'],
          choices: ['Sleep', 'Not yet'],
          onChoose: (i) => i === 0 && this.sleep(false),
        });
        return true;
      case 'bench':
        this.sit(p);
        return true;
      case 'well':
        return this.drinkFromWell(p);
      case 'ship':
        return this.ship(p);
      case 'mailbox':
        this.readMail();
        return true;
      case 'sign':
        dialog({ pages: [this.def.sign ?? 'The sign is too weathered to read.'] });
        return true;
      case 'board':
        dialog({ pages: [...(this.def.board ?? ['Nothing pinned up today.']), `Weather tomorrow: ${FORECAST[state.tomorrow]}`] });
        return true;
      case 'pick':
        return this.pickFruit(p);
      default:
        if (use.startsWith('art:')) {
          const a = ARTWORKS[use.slice(4)];
          if (!a) return false;
          dialog({ speaker: a.title, pages: [`"${a.title}". ${a.artist}.`, a.text] });
          return true;
        }
        return false;
    }
  }

  private refreshMailFlag(): void {
    this.mailFlag?.setVisible(state.mail.length > 0);
  }

  /** Opens the oldest letter in the mailbox. */
  private readMail(): void {
    const id = state.mail.shift();
    const l = id ? letter(id) : undefined;
    this.refreshMailFlag();
    if (!l) {
      dialog({ pages: ['No letters today.'] });
      return;
    }
    audio.playSfx('mail', 0.9);
    const pages = [...l.pages];
    if (l.item) pages.push(`(Something is tucked inside: ${l.item[1]} ${itemDef(l.item[0]).name}.)`);
    dialog({
      speaker: `Letter: ${l.from}`,
      pages,
      onClose: () => {
        if (l.item) {
          const left = addItem(state, l.item[0], l.item[1]);
          if (left > 0) this.fx.drop(l.item[0], left, this.player.x, this.player.y + 6);
        }
        if (state.mail.length) bus.emit(EV.notice, `${state.mail.length} more letter${state.mail.length > 1 ? 's' : ''} in the mailbox.`);
      },
    });
  }

  private talkToDog(): boolean {
    const dog = this.dog!;
    this.player.face(dog.x, dog.y - 8);
    dog.love();
    audio.playSfx('heart', 0.7);
    dialog({
      pages: ['The little dog is dancing its heart out. An old brick phone lies on the floor next to it.'],
      choices: ['Dance along!', 'Just watch'],
      onChoose: (i) => {
        if (i === 0) this.time.delayedCall(250, () => this.player.dance(16, DOG_BEAT_MS, () => dog.love()));
      },
    });
    return true;
  }

  private pickFruit(p: PlacedProp): boolean {
    if (!this.gather.hasFruit(p)) return this.gather.pickFruit(p);
    const [x, y] = this.propCenter(p);
    this.player.face(x, y);
    return this.player.act({ tool: null, frames: [140, 260], impact: 0, onImpact: () => this.gather.pickFruit(p) });
  }

  private openShop(id: string): boolean {
    const shop = SHOPS[id];
    if (!shop) return false;
    if (state.minute < shop.open || state.minute >= shop.close) {
      audio.playSfx('bonk', 0.5);
      bus.emit(EV.notice, `${shop.name} is closed. Open ${formatClock(shop.open)} - ${formatClock(shop.close)}.`);
      return true;
    }
    bus.emit(EV.shop, id);
    return true;
  }

  private drinkFromWell(p: PlacedProp): boolean {
    const [x, y] = this.propCenter(p);
    this.player.face(x, y);
    return this.player.act({
      tool: null,
      frames: [160, 300],
      impact: 0,
      onImpact: () => {
        addNeed(state, 'thirst', NEEDS.max);
        audio.playSfx('drink', 0.9);
        this.fx.burst('drop', x, y, { count: 5, spread: 20, up: 40 });
        bus.emit(EV.notice, 'Fresh, cool water. Thirst restored.');
      },
    });
  }

  private ship(p: PlacedProp): boolean {
    const st = selectedStack(state);
    if (st && canShip(st.id)) {
      const name = itemDef(st.id).name;
      const sent = shipSlot(state, state.selected);
      if (!sent) return false;
      audio.playSfx('ship', 0.9);
      this.rendered.shakeProp(p, 1);
      bus.emit(EV.notice, `Shipped ${sent.qty} ${name}. Sold overnight.`);
      return true;
    }
    const inBox = state.shipped.map((l) => `${l.qty} ${itemDef(l.id).name}`).join(', ');
    const worth = state.shipped.reduce((n, l) => n + l.qty * itemDef(l.id).price, 0);
    dialog({
      pages: [
        'Shipping box. Hold a crop or item and press X (or right-click) here to put it in. Everything sells overnight at full price.',
        ...(inBox ? [`In the box: ${inBox}. Worth ${worth}g.`] : []),
      ],
    });
    return true;
  }

  private propCenter(p: PlacedProp): [number, number] {
    return [p.cx * T + (p.def.footprint.w * T) / 2, (p.cy + 1) * T - T / 2];
  }

  private sit(p: PlacedProp): void {
    const x = p.cx * T + (p.def.footprint.w * T) / 2;
    this.player.sit(x, (p.cy + 1) * T + 1, SEAT_LIFT, 'down');
    audio.playSfx('sit', 0.8);
    bus.emit(EV.notice, 'Resting. Energy comes back slowly. Walk to get up.');
  }

  private standUp(): void {
    this.player.stand(this.player.x, this.player.y + T - 3);
  }

  /** Bed (or collapse at 2:00): fade out, end the day, save, show the summary, wake up at home. */
  private sleep(passedOut: boolean): void {
    if (this.leaving) return;
    this.leaving = true;
    this.tools.enabled = false;
    this.fishing.cancel();
    if (this.player.seated) this.standUp();
    if (passedOut) bus.emit(EV.notice, "It's 2:00 am... you collapse from exhaustion.");
    audio.playSfx(passedOut ? 'bonk' : 'sleep', 0.8);
    this.cameras.main.fadeOut(passedOut ? PASS_OUT_FADE_MS : SLEEP_FADE_MS, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      audio.endOpening(false);
      const summary = endDay(state, passedOut);
      const home = MAPS.house;
      state.mapId = home.id;
      arrival = { x: home.spawn.x, y: home.spawn.y, face: 'left' };
      saveGame(state);
      bus.emit(EV.newDay, state.day);
      bus.emit(EV.farmChanged);
      bus.once(EV.dayDone, () => this.scene.restart());
      bus.emit(EV.daySummary, summary);
    });
  }

  private onPeriod(): void {
    this.playMusic();
  }

  update(time: number, delta: number): void {
    const k = this.keys;
    const active = this.started && !uiState.menuOpen && !this.leaving;
    if (active) {
      const ff = k[DEBUG.fastForwardKey].isDown ? TIME.fastForwardMultiplier : 1;
      this.time2.update(delta, ff);
      const dx = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
      const dy = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
      if (this.player.seated && (dx || dy)) this.standUp();
      if (this.fishing.active && (dx || dy)) this.fishing.cancel();
      this.player.speedFactor = walkFactor(state);
      const wasMoving = this.player.isMoving;
      this.player.update(delta, { dx, dy });
      if (!wasMoving && this.player.isMoving) this.player.resetAnim();
      if ((dx || dy) && !this.player.seated) {
        const w = this.warpAt(dx, dy);
        if (w) this.warp(w);
      }
    } else {
      this.player.update(delta, { dx: 0, dy: 0 });
    }

    // Aim, then keep swinging while the use button is held.
    const p = this.input.activePointer;
    const pointerOk = active && !overHud(p.x, p.y);
    const handsFree = active && !this.player.seated && !this.fishing.active && time > uiState.blockUntil;
    this.tools.enabled = handsFree;
    this.tools.aim(pointerOk && this.pointerInside(p) ? p : null);
    this.tools.updateCursor();
    if (handsFree && !this.player.busy) {
      if (k.SPACE.isDown || k.C.isDown || (p.leftButtonDown() && pointerOk)) this.tools.use();
    }
    if (!uiState.menuOpen) this.fishing.update(delta);
    this.npcs.update(delta, this.player.x, this.player.y, this.player.feet());
    this.animals.update(delta, this.player.x, this.player.y, this.player.feet());
    this.dog?.update(delta, (x, y) => this.npcs.note(x, y));
    this.fx.update(delta, this.player.x, this.player.y);
    if (time > this.nextSparkle) {
      this.nextSparkle = time + RIPE_SPARKLE_MS;
      const ripe = this.farm.ripeCells();
      if (ripe.length) {
        const [cx, cy] = ripe[Math.floor(Math.random() * ripe.length)];
        this.fx.burst('spark', cx * RENDER.tileSize + 4 + Math.random() * 8, cy * RENDER.tileSize + 8, { count: 1, spread: 2, up: 12, z: 6, gravity: 0, life: 700 });
      }
      const g = this.gather.glint();
      if (g && Math.random() < 0.5) this.fx.burst('spark', g[0] + Math.random() * 6 - 3, g[1], { count: 1, spread: 2, up: 10, z: 4, gravity: 0, life: 600 });
    }

    this.followCamera(delta);
    this.rendered.update(time);
    this.atmosphere.update(time, delta, state.minute);
    this.weather.update(time, delta);

    if (time > this.nextAmbience) {
      this.nextAmbience = time + AMBIENCE_REFRESH_MS;
      const d = this.map.waterDistance(this.player.x, this.player.y);
      const water = Math.max(0, 1 - d / WATER_HEARING_CELLS);
      const waves = Math.max(WAVES_FLOOR, 1 - d / WAVES_HEARING_CELLS);
      const amb = this.def.ambience;
      const inside = this.def.indoor ? 0.35 : 1;
      const levels: Record<string, number> =
        state.weather === 'sun'
          ? amb
          : state.weather === 'snow'
            ? // Snow hushes everything but the wind.
              { ...amb, birds: (amb.birds ?? 0) * 0.1, crickets: 0, wind: Math.max(amb.wind ?? 0, 0.6) * inside }
            : {
                ...amb,
                birds: (amb.birds ?? 0) * 0.15,
                gulls: (amb.gulls ?? 0) * 0.3,
                crickets: 0,
                rain: inside,
                wind: state.weather === 'storm' ? Math.max(amb.wind ?? 0, 0.9) * inside : amb.wind ?? 0,
              };
      audio.updateAmbience(state.minute, levels, { water, waves });
    }
  }

  private pointerInside(p: Phaser.Input.Pointer): boolean {
    return p.x > 0 && p.y > 0 && p.x < this.scale.width && p.y < this.scale.height && p.wasTouch === false;
  }

  private target(): [number, number] {
    const cam = this.cameras.main;
    // Rooms smaller than the view sit in the middle of it.
    const fit = (size: number, view: number, focus: number) =>
      size <= view ? Math.round((size - view) / 2) : Phaser.Math.Clamp(focus - Math.floor(view / 2), 0, size - view);
    const x = fit(this.map.pixelWidth, cam.width, Math.round(this.player.x));
    const y = fit(this.map.pixelHeight, cam.height, Math.round(this.player.y) - CAMERA_FOCUS_OFFSET_Y);
    return [x, y];
  }

  private snapCamera(): void {
    [this.camX, this.camY] = this.target();
    this.cameras.main.setScroll(Math.round(this.camX), Math.round(this.camY));
  }

  /** Rigid follow: player and camera share whole pixels, so there is no lag or wobble. */
  private followCamera(_delta: number): void {
    this.snapCamera();
  }
}


