import Phaser from 'phaser';
import { hex } from '../art/palette';
import { UI_ICON, UI_TEXTURES } from '../art/fx';
import { formatClock, timeOfDay, weekday } from '../systems/TimeSystem';
import type { GameState } from '../systems/GameState';
import { addPanel } from './Panel';
import { PixelText } from './PixelText';

const LAYOUT = {
  width: 74,
  height: 44,
  margin: 4,
  padX: 7,
  rowY: [6, 16, 28],
  iconX: 58,
} as const;

const SEASON_ICONS = [UI_ICON.spring, UI_ICON.summer, UI_ICON.fall, UI_ICON.winter];

/** Top-right panel: weekday and date, season, clock, gold. */
export class ClockPanel {
  private readonly container: Phaser.GameObjects.Container;
  private readonly date: PixelText;
  private readonly clock: PixelText;
  private readonly gold: PixelText;
  private readonly seasonIcon: Phaser.GameObjects.Image;
  private readonly sunIcon: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene) {
    this.container = scene.add.container(0, LAYOUT.margin);
    this.layout(scene.scale.width);
    const panel = addPanel(scene, 0, 0, LAYOUT.width, LAYOUT.height);
    const ink = { color: 'night' as const, shadow: 'mist' as const };
    this.date = new PixelText(scene, LAYOUT.padX, LAYOUT.rowY[0], '', ink);
    this.clock = new PixelText(scene, LAYOUT.padX, LAYOUT.rowY[1], '', ink);
    // Divider between time and money.
    const divider = scene.add.rectangle(5, LAYOUT.rowY[2] - 3, LAYOUT.width - 10, 1, hex('mist')).setOrigin(0, 0);
    this.gold = new PixelText(scene, LAYOUT.padX + 11, LAYOUT.rowY[2], '', { color: 'umber', shadow: 'mist' });
    const coin = scene.add.image(LAYOUT.padX, LAYOUT.rowY[2] - 1, UI_TEXTURES.icons, UI_ICON.coin).setOrigin(0, 0);
    this.seasonIcon = scene.add.image(LAYOUT.iconX, LAYOUT.rowY[0] - 1, UI_TEXTURES.icons, SEASON_ICONS[0]).setOrigin(0, 0);
    this.sunIcon = scene.add.image(LAYOUT.iconX, LAYOUT.rowY[1] - 1, UI_TEXTURES.icons, UI_ICON.sun).setOrigin(0, 0);
    this.container.add([panel, divider, this.date, this.clock, this.gold, coin, this.seasonIcon, this.sunIcon]);
  }

  /** Keep the panel pinned to the top-right corner. */
  layout(viewWidth: number): void {
    this.container.x = viewWidth - LAYOUT.width - LAYOUT.margin;
  }

  update(s: GameState): void {
    this.date.setText(`${weekday(s.day)} ${s.day}`);
    // Clock shows 10-minute steps, like a wall clock that ticks.
    this.clock.setText(formatClock(Math.floor(s.minute / 10) * 10));
    this.gold.setText(`${s.gold}g`);
    this.seasonIcon.setFrame(SEASON_ICONS[s.season]);
    this.sunIcon.setFrame(timeOfDay(s.minute) === 'night' ? UI_ICON.moon : UI_ICON.sun);
  }
}
