// Weather on screen. Rain: slanted streaks with little splashes and a cool
// grey grade. Storm: heavier, windier rain, a darker grade and lightning
// with thunder (a dim flash through the windows indoors). Snow: flakes
// drifting down and a white dusting on the ground. Indoors nothing falls.

import Phaser from 'phaser';
import { DEPTH } from '../config';
import { FX_TEXTURES } from '../art/fx';
import { audio } from '../audio/AudioManager';
import type { Weather as WeatherKind } from './GameState';
import { viewSize } from './viewZoom';

interface FallDef {
  drops: number;
  /** Screen px per second. */
  fall: number;
  drift: number;
  /** Multiply grade (cool grey-blue for rain, near white for snow). */
  grade: number;
  /** Average seconds between lightning flashes (0: none). */
  lightningEvery: number;
}

const KINDS: Record<Exclude<WeatherKind, 'sun'>, FallDef> = {
  rain: { drops: 140, fall: 260, drift: -70, grade: 0x9aa6bf, lightningEvery: 0 },
  storm: { drops: 260, fall: 380, drift: -150, grade: 0x7c87a6, lightningEvery: 13 },
  snow: { drops: 170, fall: 34, drift: -10, grade: 0xd6dff0, lightningEvery: 0 },
};
const SPLASH_MS = 160;
/** Snowflakes sway side to side (px, ms per sway). */
const SNOW_SWAY = { px: 10, ms: 2200 } as const;
/** How strongly the snow lies on the ground. */
const SNOW_COVER_ALPHA = 0.9;
/** Flash brightness outdoors and through the windows. */
const FLASH = { out: 0.7, in: 0.2 } as const;

interface Drop {
  img: Phaser.GameObjects.Image;
  x: number;
  y: number;
  /** Screen y where it lands. */
  land: number;
  /** Snow: speed factor and sway phase. */
  speed: number;
  phase: number;
}

export class Weather {
  private drops: Drop[] = [];
  private readonly splashes: Phaser.GameObjects.Image[] = [];
  private readonly grade: Phaser.GameObjects.Rectangle;
  private readonly flash: Phaser.GameObjects.Rectangle;
  private readonly cover: Phaser.GameObjects.TileSprite | null = null;
  private readonly def: FallDef | null;
  private nextFlash = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly kind: WeatherKind,
    private readonly indoor: boolean,
    mapWidth: number,
    mapHeight: number,
  ) {
    const { width, height } = viewSize(scene);
    this.def = kind === 'sun' ? null : KINDS[kind];
    this.grade = scene.add
      .rectangle(-4, -4, width + 8, height + 8, this.def?.grade ?? 0xffffff)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(DEPTH.grade + 0.2)
      .setBlendMode(Phaser.BlendModes.MULTIPLY)
      .setVisible(!!this.def && !indoor);
    this.flash = scene.add
      .rectangle(-4, -4, width + 8, height + 8, 0xffffff)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(DEPTH.vignette + 0.5)
      .setAlpha(0);
    if (!this.def) return;
    if (this.def.lightningEvery) this.nextFlash = scene.time.now + 3000 + this.flashGap() / 2;
    if (indoor) return;
    if (kind === 'snow') {
      // Snow lies on the ground, under everything that stands on it.
      this.cover = scene.add
        .tileSprite(0, 0, mapWidth, mapHeight, FX_TEXTURES.snowCover)
        .setOrigin(0, 0)
        .setDepth(DEPTH.cliff + 0.5)
        .setAlpha(SNOW_COVER_ALPHA);
    }
    for (let i = 0; i < this.def.drops; i++) {
      const img =
        kind === 'snow'
          ? scene.add.image(0, 0, FX_TEXTURES.snow, i % 5 === 0 ? 2 : i % 2).setScrollFactor(0).setDepth(DEPTH.particlesAbove).setAlpha(0.9)
          : scene.add.image(0, 0, FX_TEXTURES.rain, i % 2).setScrollFactor(0).setDepth(DEPTH.particlesAbove).setAlpha(kind === 'storm' ? 0.85 : 0.75);
      const d: Drop = { img, x: 0, y: 0, land: 0, speed: 0.6 + Math.random() * 0.8, phase: Math.random() * Math.PI * 2 };
      this.respawn(d, true);
      this.drops.push(d);
    }
  }

  private flashGap(): number {
    return (this.def?.lightningEvery ?? 0) * 1000 * (0.5 + Math.random());
  }

  private respawn(d: Drop, anywhere: boolean): void {
    const { width, height } = viewSize(this.scene);
    d.x = Math.random() * (width + 60) - 40;
    d.y = anywhere ? Math.random() * height : -12 - Math.random() * 40;
    d.land = d.y + 40 + Math.random() * height;
  }

  update(timeMs: number, deltaMs: number): void {
    const { width, height } = viewSize(this.scene);
    this.grade.setSize(width + 8, height + 8);
    this.flash.setSize(width + 8, height + 8);
    const def = this.def;
    if (!def) return;
    if (def.lightningEvery && timeMs > this.nextFlash) {
      this.nextFlash = timeMs + this.flashGap();
      this.strike();
    }
    if (!this.drops.length) return;
    const dt = deltaMs / 1000;
    const snow = this.kind === 'snow';
    for (const d of this.drops) {
      if (snow) {
        d.y += def.fall * d.speed * dt;
        d.x += def.drift * dt;
        if (d.y > height + 6) this.respawn(d, false);
        const sway = Math.sin(timeMs / SNOW_SWAY.ms + d.phase) * SNOW_SWAY.px;
        d.img.setPosition(Math.round(d.x + sway), Math.round(d.y));
        continue;
      }
      d.x += def.drift * dt;
      d.y += def.fall * dt;
      if (d.y >= d.land || d.y > height + 10) {
        if (d.y < height) this.splash(d.x, d.y + 8);
        this.respawn(d, false);
      }
      d.img.setPosition(Math.round(d.x), Math.round(d.y));
    }
  }

  /** A double flash of lightning, then thunder: close ones crack at once, far ones rumble later. */
  private strike(): void {
    const peak = this.indoor ? FLASH.in : FLASH.out;
    const near = Math.random() < 0.4;
    this.flash.setAlpha(peak);
    this.scene.tweens.add({
      targets: this.flash,
      alpha: 0,
      duration: 160,
      onComplete: () => {
        this.flash.setAlpha(peak * 0.8);
        this.scene.tweens.add({ targets: this.flash, alpha: 0, duration: 520, ease: 'Quad.easeOut' });
      },
    });
    this.scene.time.delayedCall(near ? 120 : 900 + Math.random() * 1500, () =>
      audio.playSfx(near ? 'thunderClap' : 'thunder', (near ? 1 : 0.75) * (this.indoor ? 0.6 : 1), 0.9 + Math.random() * 0.2),
    );
  }

  private splash(x: number, y: number): void {
    let s = this.splashes.find((o) => !o.visible);
    if (!s) {
      if (this.splashes.length > 40) return;
      s = this.scene.add.image(0, 0, FX_TEXTURES.splash, 0).setScrollFactor(0).setDepth(DEPTH.particlesAbove).setAlpha(0.7);
      this.splashes.push(s);
    }
    s.setPosition(Math.round(x), Math.round(y)).setFrame(0).setVisible(true);
    const img = s;
    this.scene.time.delayedCall(SPLASH_MS / 2, () => img.setFrame(1));
    this.scene.time.delayedCall(SPLASH_MS, () => img.setVisible(false));
  }

  destroy(): void {
    this.drops.forEach((d) => d.img.destroy());
    this.drops = [];
    this.splashes.forEach((s) => s.destroy());
    this.cover?.destroy();
    this.grade.destroy();
    this.flash.destroy();
  }
}
