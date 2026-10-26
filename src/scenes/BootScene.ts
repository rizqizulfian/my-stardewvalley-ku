import Phaser from 'phaser';
import { registerAllArt } from '../art';
import { applyHires, preloadHires } from '../art/hires';
import { PhaserTextureSink } from '../art/pixel';
import { HEROES } from '../data/heroes';

/**
 * Loads the drawn farmers' PNG sheets and the hi-res world art, generates every other
 * texture, then starts the world and the UI overlay.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    for (const h of HEROES)
      if (h.sheet) this.load.spritesheet(h.texture, h.sheet.url, { frameWidth: h.sheet.frameWidth, frameHeight: h.sheet.frameHeight });
    preloadHires(this.load);
  }

  create(): void {
    const t0 = performance.now();
    registerAllArt(new PhaserTextureSink(this.textures));
    applyHires(this.textures);
    console.info(`[boot] art generated in ${Math.round(performance.now() - t0)} ms`);
    this.scene.start('World');
    this.scene.launch('UI');
  }
}
