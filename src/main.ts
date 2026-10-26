import Phaser from 'phaser';
import { hex } from './art/palette';
import { audio } from './audio/AudioManager';
import { coop } from './net/coop';
import { BootScene } from './scenes/BootScene';
import { IntroScene } from './scenes/IntroScene';
import { TourScene } from './scenes/TourScene';
import { UIScene } from './scenes/UIScene';
import { WorldScene } from './scenes/WorldScene';
import { state } from './systems/GameState';
import { loadGame } from './systems/save';
import { fitView, installZoomControls } from './systems/viewZoom';
import { installCoop } from './ui/CoopPanel';
import { installTouchControls } from './ui/TouchControls';

// Continue from the last morning's save, if there is one.
const saved = loadGame();
if (saved) Object.assign(state, saved);

const view = fitView();

const game = new Phaser.Game({
  type: Phaser.WEBGL,
  parent: 'game',
  width: view.width * view.render,
  height: view.height * view.render,
  zoom: view.zoom / view.render,
  backgroundColor: hex('ink'),
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  scale: { mode: Phaser.Scale.NONE },
  scene: [BootScene, WorldScene, UIScene, IntroScene, TourScene],
});

// Window resizes, +/- keys and pinch refit the view.
installZoomControls(game);

// Handy for debugging in the console, e.g. lembah.state.minute = 1200
(window as unknown as { lembah: unknown }).lembah = { game, state, audio, coop };

// On-screen joystick and buttons for phones (no keyboard there).
installTouchControls(game);

// Play together: the room panel (and straight into it from an invite link).
installCoop();
