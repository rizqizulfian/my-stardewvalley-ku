// After the opening story: a short tour of every place the player can walk to.
// The World scene draws each map for real (villagers, animals and all) while
// the camera glides across it; this scene only adds the name card on top.
// Any key or tap moves to the next place; Esc or the skip button ends it.

import Phaser from 'phaser';
import { RENDER } from '../config';
import { audio } from '../audio/AudioManager';
import { musicFor } from '../data/music';
import { TOUR_OUTRO, TOUR_STOPS } from '../data/tour';
import { state } from '../systems/GameState';
import { addPanel } from '../ui/Panel';
import { PixelText } from '../ui/PixelText';
import { tourView } from './WorldScene';

const T = RENDER.tileSize;
const TIMING = {
  /** How long each place stays on screen (the camera glides the whole time). */
  stopMs: 5200,
  outroMs: 3200,
  fadeMs: 260,
  cardInMs: 300,
  /** Ignore input this long after a place appears, so one tap skips one place. */
  settleMs: 300,
} as const;
const CARD = { maxW: 300, pad: 8, margin: 10, titleScale: 2 } as const;
const MUSIC = 'farm-morning';

export interface TourData {
  onDone: () => void;
}

export class TourScene extends Phaser.Scene {
  private onDone: () => void = () => undefined;
  private index = -1;
  private busy = false;
  private finished = false;
  private readyAt = 0;
  private nextAt = 0;
  /** Own clock (ms): a freshly launched scene's time.now is not ready in create(). */
  private now = 0;
  private glide: Phaser.Tweens.Tween | null = null;
  private card!: Phaser.GameObjects.Container;
  private box!: Phaser.GameObjects.NineSlice;
  private title!: PixelText;
  private caption!: PixelText;
  private counter!: PixelText;
  private skip!: PixelText;

  constructor() {
    super('Tour');
  }

  init(data: TourData): void {
    this.onDone = data.onDone;
    this.index = -1;
    this.busy = false;
    this.finished = false;
    this.now = 0;
  }

  create(): void {
    this.card = this.add.container(0, 0).setAlpha(0);
    this.box = addPanel(this, 0, 0, CARD.maxW, 40);
    this.title = new PixelText(this, CARD.pad, CARD.pad, '', { color: 'brick', shadow: 'sand', shadowRight: true }).setScale(CARD.titleScale);
    this.caption = new PixelText(this, CARD.pad, 0, '', { color: 'night', shadow: 'mist' });
    this.card.add([this.box, this.title, this.caption]);
    this.counter = new PixelText(this, 0, 0, '', { color: 'cream', outline: 'night' });
    this.skip = new PixelText(this, 0, 0, 'Esc  skip >>', { color: 'cream', outline: 'night' });
    this.skip.setInteractive({ useHandCursor: true }).on('pointerdown', (_p: unknown, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
      e.stopPropagation();
      this.finish();
    });
    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this));

    this.input.keyboard!.on('keydown', (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === 'Escape') this.finish();
      else if (e.key !== 'm' && e.key !== 'M') this.advance();
    });
    this.input.on('pointerdown', () => this.advance());

    tourView.active = true;
    audio.playMusic(musicFor(MUSIC, state.season, false));
    this.next();
  }

  private layout(): void {
    const { width: w, height: h } = this.scale;
    const cw = Math.min(CARD.maxW, w - CARD.margin * 2);
    this.caption.setStyle({ wrapWidth: cw - CARD.pad * 2 });
    this.fitCard(cw);
    this.card.setPosition(Math.round((w - cw) / 2), h - this.box.height - CARD.margin);
    // Top left, clear of the clock in the other corner.
    this.counter.setPosition(6, 6);
    this.skip.setPosition(6, 18);
  }

  private fitCard(cw: number): void {
    this.caption.y = CARD.pad + this.title.height * CARD.titleScale + 4;
    this.box.setSize(cw, Math.round(this.caption.y + this.caption.height + CARD.pad - 1));
  }

  private setCard(title: string, caption: string, count: string): void {
    const { width: w, height: h } = this.scale;
    const cw = Math.min(CARD.maxW, w - CARD.margin * 2);
    this.title.setText(title);
    this.caption.setStyle({ wrapWidth: cw - CARD.pad * 2 }).setText(caption);
    this.fitCard(cw);
    this.card.setPosition(Math.round((w - cw) / 2), h - this.box.height - CARD.margin);
    this.counter.setText(count);
  }

  /** Fade the world out, run `between` while it is black, and fade the card back in. */
  private cut(between: () => void): void {
    this.busy = true;
    this.glide?.stop();
    this.tweens.add({ targets: this.card, alpha: 0, duration: TIMING.fadeMs });
    const cam = this.scene.get('World').cameras.main;
    cam.fade(TIMING.fadeMs, 0, 0, 0, true, (_c: unknown, progress: number) => {
      if (progress < 1) return;
      between();
      this.busy = false;
      this.readyAt = this.now + TIMING.settleMs;
      this.tweens.add({ targets: this.card, alpha: 1, delay: TIMING.fadeMs, duration: TIMING.cardInMs });
    });
  }

  private next(): void {
    this.index++;
    if (this.index >= TOUR_STOPS.length) return this.outro();
    const s = TOUR_STOPS[this.index];
    const go = () => {
      tourView.x = s.from.x * T + T / 2;
      tourView.y = s.from.y * T + T / 2;
      state.mapId = s.map;
      this.scene.get('World').scene.restart();
      this.setCard(s.title, s.caption, `${this.index + 1}/${TOUR_STOPS.length}`);
      this.glide = this.tweens.add({
        targets: tourView,
        x: s.to.x * T + T / 2,
        y: s.to.y * T + T / 2,
        duration: TIMING.stopMs,
        ease: 'Sine.easeInOut',
      });
      this.nextAt = this.now + TIMING.stopMs;
    };
    if (this.index === 0) {
      // The story has just faded out to the farm: no extra black.
      go();
      this.readyAt = this.now + TIMING.settleMs;
      this.tweens.add({ targets: this.card, alpha: 1, duration: TIMING.cardInMs });
    } else this.cut(go);
  }

  /** Back to the farm where the game begins, with a last word. */
  private outro(): void {
    this.cut(() => {
      tourView.active = false;
      state.mapId = 'farm';
      this.scene.get('World').scene.restart();
      this.setCard(TOUR_OUTRO.title, TOUR_OUTRO.caption, '');
      this.skip.setVisible(false);
      this.nextAt = this.now + TIMING.outroMs;
    });
  }

  private advance(): void {
    if (this.busy || this.finished || this.now < this.readyAt) return;
    audio.playSfx('uiClick', 0.5);
    if (this.index >= TOUR_STOPS.length) this.end();
    else this.next();
  }

  /** Skip the rest of the tour: straight to the farm. */
  private finish(): void {
    if (this.finished) return;
    if (this.index >= TOUR_STOPS.length) return this.end();
    this.index = TOUR_STOPS.length;
    this.outro();
  }

  private end(): void {
    if (this.finished) return;
    this.finished = true;
    this.input.keyboard?.off('keydown');
    this.input.off('pointerdown');
    this.tweens.add({
      targets: [this.card, this.counter, this.skip],
      alpha: 0,
      duration: TIMING.fadeMs * 2,
      onComplete: () => {
        this.onDone();
        this.scene.stop();
      },
    });
  }

  update(_time: number, delta: number): void {
    this.now += delta;
    if (this.busy || this.finished || this.now < this.nextAt) return;
    if (this.index >= TOUR_STOPS.length) this.end();
    else this.next();
  }
}
