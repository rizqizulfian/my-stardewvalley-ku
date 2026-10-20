import Phaser from 'phaser';
import { DEBUG, RENDER, TIME } from '../config';
import { hex } from '../art/palette';
import { audio } from '../audio/AudioManager';
import { PLAYER_CHARACTER } from '../data/characters';
import { MAPS } from '../data/maps';
import type { MapDef } from '../data/maps/types';
import { Player } from '../entities/Player';
import { Atmosphere } from '../systems/Atmosphere';
import { EV, bus } from '../systems/events';
import { state } from '../systems/GameState';
import { renderMap, type RenderedMap } from '../systems/MapRenderer';
import { TimeSystem, timeOfDay } from '../systems/TimeSystem';
import { WorldMap } from '../systems/WorldMap';

const T = RENDER.tileSize;
/** How often ambience levels are refreshed (ms). */
const AMBIENCE_REFRESH_MS = 500;
/** Cells from water at which the pond is inaudible. */
const WATER_HEARING_CELLS = 7;
/** Player sprite's visual center sits this far above the feet. */
const CAMERA_FOCUS_OFFSET_Y = 12;

export class WorldScene extends Phaser.Scene {
  private def!: MapDef;
  private map!: WorldMap;
  private rendered!: RenderedMap;
  private player!: Player;
  private time2!: TimeSystem;
  private atmosphere!: Atmosphere;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private camX = 0;
  private camY = 0;
  private started = false;
  private nextAmbience = 0;

  constructor() {
    super('World');
  }

  create(): void {
    this.def = MAPS[state.mapId];
    this.map = new WorldMap(this.def);
    this.rendered = renderMap(this, this.map);
    this.cameras.main.setBackgroundColor(hex(this.def.backdrop));
    this.cameras.main.setRoundPixels(true);

    const sx = this.def.spawn.x * T + T / 2;
    const sy = (this.def.spawn.y + 1) * T - 2;
    this.player = new Player(this, this.map, PLAYER_CHARACTER.texture, sx, sy);
    this.player.onFootstep = (surface) => audio.footstep(surface);

    this.time2 = new TimeSystem(state);
    this.atmosphere = new Atmosphere(this, this.rendered, this.def.leaves);

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,M,' + DEBUG.fastForwardKey) as Record<string, Phaser.Input.Keyboard.Key>;
    this.keys.M.on('down', () => audio.toggleMute());

    this.snapCamera();
    bus.once(EV.started, () => {
      this.started = true;
      audio.playMusic(this.def.music[timeOfDay(state.minute)]);
    });
    bus.on(EV.periodChanged, this.onPeriod, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => bus.off(EV.periodChanged, this.onPeriod, this));
  }

  private onPeriod(): void {
    audio.playMusic(this.def.music[timeOfDay(state.minute)]);
  }

  update(time: number, delta: number): void {
    const k = this.keys;
    if (this.started) {
      const ff = k[DEBUG.fastForwardKey].isDown ? TIME.fastForwardMultiplier : 1;
      this.time2.update(delta, ff);
      const dx = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
      const dy = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
      const wasMoving = this.player.isMoving;
      this.player.update(delta, { dx, dy });
      if (!wasMoving && this.player.isMoving) this.player.resetAnim();
    } else {
      this.player.update(delta, { dx: 0, dy: 0 });
    }

    this.followCamera(delta);
    this.rendered.update(time);
    this.atmosphere.update(time, delta, state.minute);

    if (time > this.nextAmbience) {
      this.nextAmbience = time + AMBIENCE_REFRESH_MS;
      const d = this.map.waterDistance(this.player.x, this.player.y);
      const water = Math.max(0, 1 - d / WATER_HEARING_CELLS);
      audio.updateAmbience(state.minute, this.def.ambience, { water });
    }
  }

  private target(): [number, number] {
    const cam = this.cameras.main;
    const maxX = Math.max(0, this.map.pixelWidth - cam.width);
    const maxY = Math.max(0, this.map.pixelHeight - cam.height);
    const x = Phaser.Math.Clamp(Math.round(this.player.x) - Math.floor(cam.width / 2), 0, maxX);
    const y = Phaser.Math.Clamp(Math.round(this.player.y) - CAMERA_FOCUS_OFFSET_Y - Math.floor(cam.height / 2), 0, maxY);
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


