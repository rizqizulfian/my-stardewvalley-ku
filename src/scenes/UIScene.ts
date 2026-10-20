import Phaser from 'phaser';
import { DEBUG, GAME_TITLE } from '../config';
import { audio } from '../audio/AudioManager';
import { EV, bus } from '../systems/events';
import { state } from '../systems/GameState';
import { ClockPanel } from '../ui/ClockPanel';
import { addPanel } from '../ui/Panel';
import { PixelText } from '../ui/PixelText';

const PROMPT = {
  width: 150,
  height: 62,
  titleScale: 2,
  blinkMs: 600,
  fadeMs: 400,
} as const;

/** HUD overlay plus the "press any key" start prompt. */
export class UIScene extends Phaser.Scene {
  private clock!: ClockPanel;
  private prompt: Phaser.GameObjects.Container | null = null;
  private started = false;

  constructor() {
    super('UI');
  }

  create(): void {
    this.clock = new ClockPanel(this);
    this.clock.update(state);
    bus.on(EV.minute, () => this.clock.update(state), this);
    bus.on(EV.newDay, () => this.clock.update(state), this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => bus.off(EV.minute, undefined, this));

    const hint = new PixelText(this, 4, this.scale.height - 11, `WASD/Arrows walk   hold ${DEBUG.fastForwardKey} fast time   M mute`, {
      color: 'mist',
      shadow: 'night',
    }).setAlpha(0.85);

    this.showStartPrompt();
    const relayout = () => {
      this.clock.layout(this.scale.width);
      hint.y = this.scale.height - 11;
      if (this.prompt) this.centerPrompt(this.prompt);
    };
    this.scale.on(Phaser.Scale.Events.RESIZE, relayout);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, relayout));
  }

  private centerPrompt(box: Phaser.GameObjects.Container): void {
    box.setPosition(Math.round((this.scale.width - PROMPT.width) / 2), Math.round((this.scale.height - PROMPT.height) / 2));
  }

  private showStartPrompt(): void {
    const box = this.add.container(0, 0);
    this.prompt = box;
    this.centerPrompt(box);
    const panel = addPanel(this, 0, 0, PROMPT.width, PROMPT.height);
    const title = new PixelText(this, 0, 9, GAME_TITLE, { color: 'brick', shadow: 'sand', shadowRight: true }).setScale(PROMPT.titleScale);
    title.x = Math.round((PROMPT.width - title.width * PROMPT.titleScale) / 2);
    const sub = new PixelText(this, 0, 32, 'a cozy valley farm', { color: 'clay', shadow: 'mist' });
    sub.x = Math.round((PROMPT.width - sub.width) / 2);
    const press = new PixelText(this, 0, 45, 'Press any key to start', { color: 'night', shadow: 'mist' });
    press.x = Math.round((PROMPT.width - press.width) / 2);
    box.add([panel, title, sub, press]);
    const blink = this.time.addEvent({ delay: PROMPT.blinkMs, loop: true, callback: () => press.setVisible(!press.visible) });

    const begin = () => {
      if (this.started) return;
      this.started = true;
      blink.remove();
      void audio.unlock().then(() => audio.playSfx('start', 0.8));
      bus.emit(EV.started);
      this.tweens.add({
        targets: box,
        alpha: 0,
        duration: PROMPT.fadeMs,
        onComplete: () => {
          box.destroy();
          this.prompt = null;
        },
      });
    };
    this.input.keyboard?.once('keydown', begin);
    this.input.once('pointerdown', begin);
  }
}
