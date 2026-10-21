import Phaser from 'phaser';
import { RENDER } from './config';
import { hex } from './art/palette';
import { audio } from './audio/AudioManager';
import { BootScene } from './scenes/BootScene';
import { UIScene } from './scenes/UIScene';
import { WorldScene } from './scenes/WorldScene';
import { EV, bus } from './systems/events';
import { advanceFarms } from './systems/farming';
import { state } from './systems/GameState';

/** Whole-number zoom plus the native size that fills the window at that zoom. */
function fitView(): { zoom: number; width: number; height: number } {
  const target = RENDER.viewTilesWide * RENDER.tileSize;
  const zoom = Math.min(RENDER.maxZoom, Math.max(RENDER.minZoom, Math.round(window.innerWidth / target)));
  return { zoom, width: Math.ceil(window.innerWidth / zoom), height: Math.ceil(window.innerHeight / zoom) };
}

const view = fitView();

const game = new Phaser.Game({
  type: Phaser.WEBGL,
  parent: 'game',
  width: view.width,
  height: view.height,
  zoom: view.zoom,
  backgroundColor: hex('ink'),
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  scale: { mode: Phaser.Scale.NONE },
  scene: [BootScene, WorldScene, UIScene],
});

// Overnight growth runs for every map, whichever one the player is on.
bus.on(EV.newDay, () => {
  advanceFarms(state);
  bus.emit(EV.farmChanged);
});

window.addEventListener('resize', () => {
  const v = fitView();
  game.scale.setZoom(v.zoom);
  game.scale.resize(v.width, v.height);
});

// Handy for debugging in the console, e.g. lembah.state.minute = 1200
(window as unknown as { lembah: unknown }).lembah = { game, state, audio };
