import Phaser from 'phaser';
import { registerAllArt } from '../art';
import { PhaserTextureSink } from '../art/pixel';

/** Generates every texture, then starts the world and the UI overlay. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    const t0 = performance.now();
    registerAllArt(new PhaserTextureSink(this.textures));
    console.info(`[boot] art generated in ${Math.round(performance.now() - t0)} ms`);
    this.scene.start('World');
    this.scene.launch('UI');
  }
}
