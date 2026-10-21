// Rain on screen: slanted streaks falling through the view, little splashes
// where they land, a cool grey grade and, now and then, a lightning flash.
// Indoors there is nothing to see (the rain is only heard).

import Phaser from 'phaser';
import { DEPTH } from '../config';
import { FX_TEXTURES } from '../art/fx';
import { audio } from '../audio/AudioManager';

const RAIN = {
  drops: 140,
  /** Screen px per second. */
  fall: 260,
  drift: -70,
  /** Multiply grade while it rains (cool grey-blue). */
  grade: 0x9aa6bf,
  splashMs: 160,
  /** Average seconds between lightning flashes. */
  lightningEvery: 70,
} as const;

interface Drop {
  img: Phaser.GameObjects.Image;
  x: number;
  y: number;
  /** Screen y where it lands. */
  land: number;
}

export class Weather {
  private drops: Drop[] = [];
  private readonly splashes: Phaser.GameObjects.Image[] = [];
  private readonly grade: Phaser.GameObjects.Rectangle;
  private readonly flash: Phaser.GameObjects.Rectangle;
  private nextFlash = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly raining: boolean,
    indoor: boolean,
  ) {
    const { width, height } = scene.scale;
    this.grade = scene.add
      .rectangle(-4, -4, width + 8, height + 8, RAIN.grade)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(DEPTH.grade + 0.2)
      .setBlendMode(Phaser.BlendModes.MULTIPLY)
      .setVisible(raining && !indoor);
    this.flash = scene.add
      .rectangle(-4, -4, width + 8, height + 8, 0xffffff)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(DEPTH.vignette + 0.5)
      .setAlpha(0);
    if (!raining || indoor) return;
    for (let i = 0; i < RAIN.drops; i++) {
      const img = scene.add.image(0, 0, FX_TEXTURES.rain, i % 2).setScrollFactor(0).setDepth(DEPTH.particlesAbove).setAlpha(0.75);
      const d: Drop = { img, x: 0, y: 0, land: 0 };
      this.respawn(d, true);
      this.drops.push(d);
    }
    this.nextFlash = scene.time.now + this.flashGap();
  }

  private flashGap(): number {
    return RAIN.lightningEvery * 1000 * (0.5 + Math.random());
  }

  private respawn(d: Drop, anywhere: boolean): void {
    const { width, height } = this.scene.scale;
    d.x = Math.random() * (width + 60) - 40;
    d.y = anywhere ? Math.random() * height : -12 - Math.random() * 40;
    d.land = d.y + 40 + Math.random() * height;
  }

  update(timeMs: number, deltaMs: number): void {
    const { width, height } = this.scene.scale;
    this.grade.setSize(width + 8, height + 8);
    this.flash.setSize(width + 8, height + 8);
    if (!this.drops.length) return;
    const dt = deltaMs / 1000;
    for (const d of this.drops) {
      d.x += RAIN.drift * dt;
      d.y += RAIN.fall * dt;
      if (d.y >= d.land || d.y > height + 10) {
        if (d.y < height) this.splash(d.x, d.y + 8);
        this.respawn(d, false);
      }
      d.img.setPosition(Math.round(d.x), Math.round(d.y));
    }
    if (timeMs > this.nextFlash) {
      this.nextFlash = timeMs + this.flashGap();
      this.flash.setAlpha(0.55);
      this.scene.tweens.add({ targets: this.flash, alpha: 0, duration: 420, ease: 'Quad.easeOut' });
      this.scene.time.delayedCall(700 + Math.random() * 1200, () => audio.playSfx('thunder', 0.8));
    }
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
    this.scene.time.delayedCall(RAIN.splashMs / 2, () => img.setFrame(1));
    this.scene.time.delayedCall(RAIN.splashMs, () => img.setVisible(false));
  }

  destroy(): void {
    this.drops.forEach((d) => d.img.destroy());
    this.drops = [];
    this.splashes.forEach((s) => s.destroy());
    this.grade.destroy();
    this.flash.destroy();
  }
}
