// Esc menu: volumes, mute, zoom, save now, start a new farm, and the controls.
// Keyboard (up/down to pick, left/right to change, Enter/Space/X to use) or mouse.

import Phaser from 'phaser';
import { hex } from '../art/palette';
import { audio, type Bus } from '../audio/AudioManager';
import { coop } from '../net/coop';
import { EV, bus } from '../systems/events';
import type { GameState } from '../systems/GameState';
import { saveGame } from '../systems/save';
import { onZoomChange, setZoomLevel, zoomLevel } from '../systems/viewZoom';
import { ZOOM } from '../config';
import { addPanel } from './Panel';
import { PixelText } from './PixelText';

const LAYOUT = {
  w: 236,
  pad: 10,
  titleH: 20,
  rowH: 14,
  barX: 112,
  barStep: 9,
  steps: 10,
  /** How long "New farm" waits for the second press. */
  confirmMs: 3000,
} as const;

export const CONTROLS = [
  'WASD / arrows  walk',
  'Space / click  use tool, eat, reel in',
  'X / right-click  pick, talk, sit, read',
  '1-0 / wheel  choose item    E  backpack',
  'M  mute    H  help    Esc  this menu',
  '+ / -  zoom in / out (phone: pinch)',
];

type RowKind =
  | { kind: 'volume'; bus: Bus; label: string }
  | { kind: 'mute' }
  | { kind: 'zoom'; label: string }
  | { kind: 'action'; id: 'coop' | 'save' | 'new' | 'close'; label: string };

const ROWS: RowKind[] = [
  { kind: 'volume', bus: 'music', label: 'Music' },
  { kind: 'volume', bus: 'ambience', label: 'Ambience' },
  { kind: 'volume', bus: 'sfx', label: 'Sound effects' },
  { kind: 'mute' },
  { kind: 'zoom', label: 'Zoom' },
  { kind: 'action', id: 'coop', label: 'Play together (co-op)' },
  { kind: 'action', id: 'save', label: 'Save now' },
  { kind: 'action', id: 'new', label: 'Start a new farm' },
  { kind: 'action', id: 'close', label: 'Back to the game' },
];

const H = LAYOUT.titleH + ROWS.length * LAYOUT.rowH + 12 + CONTROLS.length * 9 + LAYOUT.pad;

export class SettingsMenu {
  private readonly root: Phaser.GameObjects.Container;
  private readonly shade: Phaser.GameObjects.Rectangle;
  private readonly highlight: Phaser.GameObjects.Rectangle;
  private readonly labels: PixelText[] = [];
  private readonly values: PixelText[] = [];
  private readonly bars: Phaser.GameObjects.Graphics;
  private open_ = false;
  private cursor = 0;
  private confirmUntil = 0;
  /** Starts a fresh farm (the scene owns the reset). */
  onNewFarm: () => void = () => undefined;
  /** Opens the co-op room panel. */
  onCoop: () => void = () => undefined;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly state: GameState,
  ) {
    this.shade = scene.add.rectangle(0, 0, 10, 10, hex('ink'), 0.45).setOrigin(0, 0).setVisible(false).setInteractive();
    this.root = scene.add.container(0, 0).setVisible(false);
    this.root.add(addPanel(scene, 0, 0, LAYOUT.w, H));
    this.root.add(new PixelText(scene, LAYOUT.pad, 7, 'Settings', { color: 'brick', shadow: 'sand' }));
    this.highlight = scene.add.rectangle(LAYOUT.pad - 3, 0, LAYOUT.w - LAYOUT.pad * 2 + 6, LAYOUT.rowH - 1, hex('sand')).setOrigin(0, 0);
    this.root.add(this.highlight);
    this.bars = scene.add.graphics();
    this.root.add(this.bars);
    ROWS.forEach((r, i) => {
      const y = LAYOUT.titleH + i * LAYOUT.rowH;
      const label = new PixelText(scene, LAYOUT.pad, y + 3, r.kind === 'mute' ? 'Mute all sound' : r.label, { color: 'night', shadow: 'mist' });
      const value = new PixelText(scene, LAYOUT.barX, y + 3, '', { color: 'umber', shadow: 'mist' });
      const hit = scene.add
        .rectangle(LAYOUT.pad - 3, y, LAYOUT.w - LAYOUT.pad * 2 + 6, LAYOUT.rowH - 1, 0, 0)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => {
          this.cursor = i;
          this.refresh();
        })
        .on('pointerdown', (p: Phaser.Input.Pointer) => {
          this.cursor = i;
          if (r.kind === 'volume') {
            // Click on the bar sets the level directly.
            const lx = p.x - this.root.x - LAYOUT.barX;
            if (lx >= 0) this.setVolume(r.bus, Math.min(LAYOUT.steps, Math.ceil(lx / LAYOUT.barStep)) / LAYOUT.steps);
            else this.change(1);
          } else if (r.kind === 'zoom') {
            const lx = p.x - this.root.x - LAYOUT.barX;
            if (lx >= 0) this.setZoom(Math.floor(lx / LAYOUT.barStep));
            else this.change(1);
          } else this.activate();
        });
      this.root.add([hit, label, value]);
      this.labels.push(label);
      this.values.push(value);
    });
    const cy = LAYOUT.titleH + ROWS.length * LAYOUT.rowH + 4;
    this.root.add(scene.add.rectangle(6, cy, LAYOUT.w - 12, 1, hex('mist')).setOrigin(0, 0));
    CONTROLS.forEach((line, i) => this.root.add(new PixelText(scene, LAYOUT.pad, cy + 5 + i * 9, line, { color: 'umber', shadow: 'mist' })));
    onZoomChange(() => this.refresh());
  }

  get isOpen(): boolean {
    return this.open_;
  }

  layout(w: number, h: number): void {
    this.shade.setSize(w, h);
    this.root.setPosition(Math.round((w - LAYOUT.w) / 2), Math.max(2, Math.round((h - H) / 2) - 10));
  }

  open(): void {
    this.open_ = true;
    this.cursor = 0;
    this.confirmUntil = 0;
    this.shade.setVisible(true);
    this.root.setVisible(true);
    audio.playSfx('menuOpen', 0.8);
    this.refresh();
  }

  close(): void {
    this.open_ = false;
    this.shade.setVisible(false);
    this.root.setVisible(false);
    audio.playSfx('menuClose', 0.8);
  }

  move(d: number): void {
    if (!this.open_) return;
    this.cursor = (this.cursor + d + ROWS.length) % ROWS.length;
    audio.playSfx('uiHover', 0.6);
    this.refresh();
  }

  /** Left/right: change the current row's value. */
  change(d: number): void {
    if (!this.open_) return;
    const r = ROWS[this.cursor];
    if (r.kind === 'volume') this.setVolume(r.bus, Math.round(audio.settings[r.bus] * LAYOUT.steps + d) / LAYOUT.steps);
    else if (r.kind === 'zoom') this.setZoom(zoomLevel() + d);
    else if (r.kind === 'mute') this.activate();
  }

  activate(): void {
    if (!this.open_) return;
    const r = ROWS[this.cursor];
    if (r.kind === 'volume' || r.kind === 'zoom') return this.change(1);
    if (r.kind === 'mute') {
      audio.toggleMute();
      audio.playSfx('uiClick', 0.8);
    } else if (r.id === 'coop') {
      this.close();
      this.onCoop();
      return;
    } else if (r.id === 'save' && coop.isGuest) {
      audio.playSfx('bonk', 0.6);
      bus.emit(EV.notice, "This is the host's farm: their game keeps it saved.");
    } else if (r.id === 'new' && coop.active) {
      audio.playSfx('bonk', 0.6);
      bus.emit(EV.notice, 'Leave the co-op room first (Play together > Leave).');
    } else if (r.id === 'save') {
      const ok = saveGame(this.state);
      audio.playSfx(ok ? 'coin' : 'bonk', 0.8);
      bus.emit(EV.notice, ok ? 'Game saved.' : 'Could not save (storage is blocked).');
    } else if (r.id === 'new') {
      if (this.scene.time.now < this.confirmUntil) {
        this.close();
        this.onNewFarm();
        return;
      }
      this.confirmUntil = this.scene.time.now + LAYOUT.confirmMs;
      audio.playSfx('bonk', 0.6);
      this.scene.time.delayedCall(LAYOUT.confirmMs + 20, () => this.refresh());
    } else {
      this.close();
      return;
    }
    this.refresh();
  }

  private setVolume(b: Bus, v: number): void {
    audio.setVolume(b, Math.min(1, Math.max(0, v)));
    if (b === 'sfx') audio.playSfx('select', 0.8);
    this.refresh();
  }

  private setZoom(n: number): void {
    setZoomLevel(n);
    audio.playSfx('select', 0.8);
    this.refresh();
  }

  refresh(): void {
    if (!this.open_) return;
    this.highlight.setY(LAYOUT.titleH + this.cursor * LAYOUT.rowH);
    this.bars.clear();
    ROWS.forEach((r, i) => {
      const y = LAYOUT.titleH + i * LAYOUT.rowH;
      if (r.kind === 'volume') {
        const filled = Math.round(audio.settings[r.bus] * LAYOUT.steps);
        for (let k = 0; k < LAYOUT.steps; k++) {
          const x = LAYOUT.barX + k * LAYOUT.barStep;
          this.bars.fillStyle(hex('umber')).fillRect(x, y + 3, LAYOUT.barStep - 2, 7);
          this.bars.fillStyle(hex(k < filled ? (audio.settings.muted ? 'clay' : 'leaf') : 'cream')).fillRect(x + 1, y + 4, LAYOUT.barStep - 4, 5);
        }
        this.values[i].setText('');
      } else if (r.kind === 'zoom') {
        // One box per zoom step; the filled run shows how far in it is.
        for (let k = 0; k < ZOOM.factors.length; k++) {
          const x = LAYOUT.barX + k * LAYOUT.barStep;
          this.bars.fillStyle(hex('umber')).fillRect(x, y + 3, LAYOUT.barStep - 2, 7);
          this.bars.fillStyle(hex(k <= zoomLevel() ? 'sky' : 'cream')).fillRect(x + 1, y + 4, LAYOUT.barStep - 4, 5);
        }
      } else if (r.kind === 'mute') this.values[i].setText(audio.settings.muted ? 'On' : 'Off');
      else if (r.id === 'new') {
        const confirming = this.scene.time.now < this.confirmUntil;
        this.labels[i].setText(confirming ? 'Press again: erase this farm!' : r.label).setStyle({ color: confirming ? 'brick' : 'night' });
      }
    });
  }
}
