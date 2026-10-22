import Phaser from 'phaser';
import { registerAllArt } from '../art';
import { PhaserTextureSink } from '../art/pixel';
import { PLAYER_ART } from '../config';
import { PLAYER_CHARACTER } from '../data/characters';

/** Loads the player's PNG sheet, generates every other texture, then starts the world and the UI overlay. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    this.load.spritesheet(PLAYER_CHARACTER.texture, PLAYER_ART.url, { frameWidth: PLAYER_ART.frameWidth, frameHeight: PLAYER_ART.frameHeight });
  }

  create(): void {
    const t0 = performance.now();
    registerAllArt(new PhaserTextureSink(this.textures));
    console.info(`[boot] art generated in ${Math.round(performance.now() - t0)} ms`);
    this.scene.start('World');
    this.scene.launch('UI');
  }
}
