import Phaser from 'phaser';
import { PANEL_SLICE, UI_TEXTURES } from '../art/fx';

/** 9-slice wooden panel. */
export function addPanel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, dark = false): Phaser.GameObjects.NineSlice {
  return scene.add
    .nineslice(x, y, dark ? UI_TEXTURES.panelDark : UI_TEXTURES.panel, undefined, w, h, PANEL_SLICE, PANEL_SLICE, PANEL_SLICE, PANEL_SLICE)
    .setOrigin(0, 0);
}
