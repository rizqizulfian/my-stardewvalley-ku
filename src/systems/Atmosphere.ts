// Atmosphere: day/night multiply grade, vignette, night lights and emissive
// windows, falling leaves and fireflies.

import Phaser from 'phaser';
import { ATMOSPHERE, DEPTH } from '../config';
import { FX_TEXTURES, LEAF_COLORS } from '../art/fx';
import { PALETTE_RGB, COLOR_INDEX } from '../art/palette';
import type { RenderedMap } from './MapRenderer';
import { sampleGrade } from './TimeSystem';

interface Leaf {
  s: Phaser.GameObjects.Sprite;
  vx: number;
  vy: number;
  life: number;
  max: number;
  phase: number;
  color: number;
}

interface Firefly {
  s: Phaser.GameObjects.Image;
  ox: number;
  oy: number;
  t: number;
  life: number;
  max: number;
  speed: number;
}

function gradeRgb(color: keyof typeof COLOR_INDEX, strength: number): [number, number, number] {
  const [r, g, b] = PALETTE_RGB[COLOR_INDEX[color]];
  // Mix from "no change" toward the palette key colour.
  return [255 - (255 - r) * strength, 255 - (255 - g) * strength, 255 - (255 - b) * strength];
}

export class Atmosphere {
  private readonly grade: Phaser.GameObjects.Rectangle;
  private readonly glow: Phaser.GameObjects.Rectangle;
  private readonly vignette: Phaser.GameObjects.Image;
  private leaves: Leaf[] = [];
  private flies: Firefly[] = [];
  private nextLeaf = 0;
  private nextFly = 0;
  darkness = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly rendered: RenderedMap,
    private readonly leavesEnabled: boolean,
  ) {
    const pad = 4;
    this.grade = scene.add
      .rectangle(-pad, -pad, 1, 1, 0xffffff)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(DEPTH.grade)
      .setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.glow = scene.add
      .rectangle(-pad, -pad, 1, 1, 0)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(DEPTH.grade + 0.5)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.vignette = scene.add
      .image(0, 0, FX_TEXTURES.vignette)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(DEPTH.vignette)
      .setAlpha(ATMOSPHERE.vignetteStrength);
    this.fit();
    scene.scale.on(Phaser.Scale.Events.RESIZE, this.fit, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.scale.off(Phaser.Scale.Events.RESIZE, this.fit, this));
  }

  /** Full-screen layers follow the view size. */
  private fit(): void {
    const pad = 4;
    const { width, height } = this.scene.scale;
    this.grade.setSize(width + pad * 2, height + pad * 2);
    this.glow.setSize(width + pad * 2, height + pad * 2);
    this.vignette.setDisplaySize(width, height);
  }

  update(timeMs: number, deltaMs: number, minute: number): void {
    // Grade.
    const { a, b, t } = sampleGrade(minute);
    const ca = gradeRgb(a.color, a.strength);
    const cb = gradeRgb(b.color, b.strength);
    const mix = (i: number) => Math.round(ca[i] + (cb[i] - ca[i]) * t);
    this.grade.setFillStyle((mix(0) << 16) | (mix(1) << 8) | mix(2), 1);
    this.darkness = a.darkness + (b.darkness - a.darkness) * t;
    // Additive sky light: the glow colour of whichever key is closer, faded by amount.
    const g = t < 0.5 ? a : b;
    const [gr, gg, gb] = PALETTE_RGB[COLOR_INDEX[g.glow]];
    this.glow.setFillStyle((gr << 16) | (gg << 8) | gb, a.glowAlpha + (b.glowAlpha - a.glowAlpha) * t);
    this.vignette.setAlpha(ATMOSPHERE.vignetteStrength + ATMOSPHERE.vignetteNight * this.darkness);

    // Lights and emissive windows.
    const on = this.darkness > ATMOSPHERE.lightsOnThreshold;
    const lightLevel = Math.max(0, (this.darkness - ATMOSPHERE.lightsOnThreshold) / (1 - ATMOSPHERE.lightsOnThreshold));
    for (const e of this.rendered.emissives) e.setVisible(on);
    for (const l of this.rendered.lights) {
      const flicker = 0.92 + 0.08 * Math.sin(timeMs * 0.004 + l.flicker) * Math.sin(timeMs * 0.0017 + l.flicker * 2);
      l.image.setAlpha(on ? lightLevel * ATMOSPHERE.lightMaxAlpha * flicker : 0);
    }

    this.updateLeaves(timeMs, deltaMs);
    this.updateFireflies(timeMs, deltaMs);
  }

  private view(): Phaser.Geom.Rectangle {
    return this.scene.cameras.main.worldView;
  }

  private updateLeaves(timeMs: number, deltaMs: number): void {
    const dt = deltaMs / 1000;
    if (this.leavesEnabled && timeMs > this.nextLeaf && this.leaves.length < ATMOSPHERE.leafMaxAlive) {
      this.nextLeaf = timeMs + ATMOSPHERE.leafSpawnEveryMs * (0.5 + Math.random());
      const v = this.view();
      const visible = this.rendered.trees.filter((t) => Phaser.Geom.Rectangle.Overlaps(v, t.getBounds()));
      const tree = visible[Math.floor(Math.random() * visible.length)];
      if (tree) {
        const color = Math.floor(Math.random() * LEAF_COLORS);
        const s = this.scene.add
          .sprite(tree.x + (Math.random() - 0.5) * 22, tree.y - 26 - Math.random() * 12, FX_TEXTURES.leaf, color * 2)
          .setDepth(tree.depth + 1);
        this.leaves.push({ s, vx: 4 + Math.random() * 6, vy: 9 + Math.random() * 6, life: 0, max: 2.8 + Math.random() * 2, phase: Math.random() * 6, color });
      }
    }
    this.leaves = this.leaves.filter((l) => {
      l.life += dt;
      l.s.x += (l.vx + Math.sin(l.life * 2.4 + l.phase) * 12) * dt;
      l.s.y += l.vy * dt;
      l.s.setFrame(l.color * 2 + (Math.floor(l.life * 4) % 2));
      if (l.life > l.max - 0.6) l.s.setAlpha(Math.max(0, (l.max - l.life) / 0.6));
      if (l.life >= l.max) {
        l.s.destroy();
        return false;
      }
      return true;
    });
  }

  private updateFireflies(timeMs: number, deltaMs: number): void {
    const dt = deltaMs / 1000;
    if (this.darkness > 0.6 && timeMs > this.nextFly && this.flies.length < ATMOSPHERE.fireflyMaxAlive) {
      this.nextFly = timeMs + ATMOSPHERE.fireflySpawnEveryMs * (0.5 + Math.random());
      const v = this.view();
      const ox = v.x + Math.random() * v.width;
      const oy = v.y + Math.random() * v.height;
      const s = this.scene.add.image(ox, oy, FX_TEXTURES.firefly).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.particlesAbove).setAlpha(0);
      this.flies.push({ s, ox, oy, t: Math.random() * 10, life: 0, max: 4 + Math.random() * 4, speed: 0.6 + Math.random() * 0.6 });
    }
    this.flies = this.flies.filter((f) => {
      f.life += dt;
      f.t += dt * f.speed;
      f.s.setPosition(Math.round(f.ox + Math.sin(f.t) * 14 + Math.sin(f.t * 2.3) * 4), Math.round(f.oy + Math.cos(f.t * 0.8) * 8));
      const fade = Math.min(1, f.life / 0.8, (f.max - f.life) / 0.8);
      const blink = 0.55 + 0.45 * Math.sin(f.t * 5);
      f.s.setAlpha(Math.max(0, fade * blink * this.darkness));
      if (f.life >= f.max) {
        f.s.destroy();
        return false;
      }
      return true;
    });
  }
}
