import Phaser from 'phaser';
import { registerAllArt } from '../art';
import { PhaserTextureSink } from '../art/pixel';
import { PLAYER_ART } from '../config';
import { HEROES } from '../data/heroes';

/** Loads the drawn farmers' PNG sheets, generates every other texture, then starts the world and the UI overlay. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    for (const h of HEROES)
      if (h.sheet) this.load.spritesheet(h.texture, h.sheet.url, { frameWidth: PLAYER_ART.frameWidth * h.sheet.res, frameHeight: PLAYER_ART.frameHeight * h.sheet.res });
  }

  create(): void {
    const t0 = performance.now();
    registerAllArt(new PhaserTextureSink(this.textures));
    console.info(`[boot] art generated in ${Math.round(performance.now() - t0)} ms`);
    this.scene.start('World');
    this.scene.launch('UI');
  }
}
