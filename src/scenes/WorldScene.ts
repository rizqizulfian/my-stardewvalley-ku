import Phaser from 'phaser';
import { DEBUG, PLAYER, RENDER, TIME } from '../config';
import { hex } from '../art/palette';
import { audio } from '../audio/AudioManager';
import { PLAYER_CHARACTER } from '../data/characters';
import type { Facing } from '../art/characters';
import { MAPS } from '../data/maps';
import type { MapDef, WarpDef } from '../data/maps/types';
import { Player } from '../entities/Player';
import { Atmosphere } from '../systems/Atmosphere';
import { Effects } from '../systems/Effects';
import { EV, bus } from '../systems/events';
import { soilOf } from '../systems/farming';
import { FarmView } from '../systems/FarmView';
import { state } from '../systems/GameState';
import { addItem, selectSlot } from '../systems/Inventory';
import { renderMap, type RenderedMap } from '../systems/MapRenderer';
import { TimeSystem, timeOfDay } from '../systems/TimeSystem';
import { ToolController } from '../systems/ToolController';
import { overHud, uiState } from '../systems/uiState';
import { WorldMap } from '../systems/WorldMap';

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
    this.atmosphere = new Atmosphere(this, this.rendered, this.def.leaves, !!this.def.indoor);
    this.fx = new Effects(this);
    this.fx.collect = (id, qty) => {
      const left = addItem(state, id, qty);
      if (left < qty) audio.playSfx('pickup', 0.7);
      if (left > 0) bus.emit(EV.notice, 'Your backpack is full');
      return left;
    };
    this.tools = new ToolController(this, state, this.map, this.rendered, this.farm, this.player, this.fx);

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
      if (this.started && !uiState.menuOpen) this.time2.nextDay();
    });
    const interact = () => {
      if (this.started && !uiState.menuOpen) this.tools.interact();
    };
    this.keys.X.on('down', interact);
    this.keys.F.on('down', interact);
    this.input.mouse?.disableContextMenu();
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!this.started || uiState.menuOpen || overHud(p.x, p.y)) return;
      this.tools.aim(p);
      if (p.rightButtonDown()) this.tools.interact();
      else this.tools.use();
    });
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      if (!this.started || uiState.menuOpen || dy === 0) return;
      selectSlot(state, state.selected + Math.sign(dy));
      audio.playSfx('select', 0.6);
    });
    const onFarm = () => this.farm.refresh();
    bus.on(EV.farmChanged, onFarm);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      bus.off(EV.farmChanged, onFarm);
      bus.off(EV.started, this.onStarted, this);
      // Keys and pointer handlers belong to this map; the scene restarts on every map change.
      this.input.keyboard?.removeAllKeys(true);
      this.input.off('pointerdown');
      this.input.off('wheel');
      this.fx.destroy();
      this.tools.destroy();
      this.farm.destroy();
      this.rendered.destroy();
    });

    this.snapCamera();
    this.cameras.main.fadeIn(FADE_IN_MS, 0, 0, 0);
    this.leaving = false;
    if (uiState.started) this.onStarted();
    else bus.once(EV.started, this.onStarted, this);
    bus.on(EV.periodChanged, this.onPeriod, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => bus.off(EV.periodChanged, this.onPeriod, this));
  }

  private onStarted(): void {
    this.started = true;
    audio.playMusic(this.def.music[timeOfDay(state.minute)]);
  }

  /** Leave through an exit: fade out, switch map, restart the scene there. */
  private warp(w: WarpDef): void {
    if (this.leaving) return;
    this.leaving = true;
    this.tools.enabled = false;
    audio.playSfx(w.door ? 'door' : 'whoosh', 0.8);
    arrival = { x: w.tx, y: w.ty, face: w.face ?? this.player.facing };
    this.cameras.main.fadeOut(FADE_OUT_MS, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
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

  private onPeriod(): void {
    audio.playMusic(this.def.music[timeOfDay(state.minute)]);
  }

  update(time: number, delta: number): void {
    const k = this.keys;
    const active = this.started && !uiState.menuOpen && !this.leaving;
    if (active) {
      const ff = k[DEBUG.fastForwardKey].isDown ? TIME.fastForwardMultiplier : 1;
      this.time2.update(delta, ff);
      const dx = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
      const dy = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
      const wasMoving = this.player.isMoving;
      this.player.update(delta, { dx, dy });
      if (!wasMoving && this.player.isMoving) this.player.resetAnim();
      if (dx || dy) {
        const w = this.warpAt(dx, dy);
        if (w) this.warp(w);
      }
    } else {
      this.player.update(delta, { dx: 0, dy: 0 });
    }

    // Aim, then keep swinging while the use button is held.
    const p = this.input.activePointer;
    const pointerOk = active && !overHud(p.x, p.y);
    this.tools.enabled = active;
    this.tools.aim(pointerOk && this.pointerInside(p) ? p : null);
    this.tools.updateCursor();
    if (active && !this.player.busy) {
      if (k.SPACE.isDown || k.C.isDown || (p.leftButtonDown() && pointerOk)) this.tools.use();
    }
    this.fx.update(delta, this.player.x, this.player.y);
    if (time > this.nextSparkle) {
      this.nextSparkle = time + RIPE_SPARKLE_MS;
      const ripe = this.farm.ripeCells();
      if (ripe.length) {
        const [cx, cy] = ripe[Math.floor(Math.random() * ripe.length)];
        this.fx.burst('spark', cx * RENDER.tileSize + 4 + Math.random() * 8, cy * RENDER.tileSize + 8, { count: 1, spread: 2, up: 12, z: 6, gravity: 0, life: 700 });
      }
    }

    this.followCamera(delta);
    this.rendered.update(time);
    this.atmosphere.update(time, delta, state.minute);

    if (time > this.nextAmbience) {
      this.nextAmbience = time + AMBIENCE_REFRESH_MS;
      const d = this.map.waterDistance(this.player.x, this.player.y);
      const water = Math.max(0, 1 - d / WATER_HEARING_CELLS);
      const waves = Math.max(WAVES_FLOOR, 1 - d / WAVES_HEARING_CELLS);
      audio.updateAmbience(state.minute, this.def.ambience, { water, waves });
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


