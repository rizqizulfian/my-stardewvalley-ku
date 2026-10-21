import Phaser from 'phaser';
import { hex } from './art/palette';
import { audio } from './audio/AudioManager';
import { BootScene } from './scenes/BootScene';
import { IntroScene } from './scenes/IntroScene';
import { UIScene } from './scenes/UIScene';
import { WorldScene } from './scenes/WorldScene';
import { state } from './systems/GameState';
import { loadGame } from './systems/save';
import { fitView, installZoomControls } from './systems/viewZoom';
import { installTouchControls } from './ui/TouchControls';

// Continue from the last morning's save, if there is one.
const saved = loadGame();
if (saved) Object.assign(state, saved);

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
  scene: [BootScene, WorldScene, UIScene, IntroScene],
});

// Window resizes, +/- keys and pinch refit the view.
installZoomControls(game);

// Handy for debugging in the console, e.g. lembah.state.minute = 1200
(window as unknown as { lembah: unknown }).lembah = { game, state, audio };

// On-screen joystick and buttons for phones (no keyboard there).
installTouchControls(game);
