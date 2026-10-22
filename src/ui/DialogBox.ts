import Phaser from 'phaser';
import { hex } from '../art/palette';
import { audio } from '../audio/AudioManager';
import { fillName } from '../data/heroes';
import { state } from '../systems/GameState';
import { addPanel } from './Panel';
import { PixelText } from './PixelText';

/** What to show: pages of text, an optional speaker and portrait, and optional choices on the last page. */
export interface DialogRequest {
  speaker?: string;
  portrait?: { texture: string; frame?: number };
  pages: string[];
  choices?: string[];
  /** Called with the chosen index, or -1 if the box was dismissed. */
  onChoose?: (i: number) => void;
  onClose?: () => void;
  /** Talk blip pitch ratio (each NPC sounds a little different). */
  voice?: number;
}

const LAYOUT = {
  maxWidth: 320,
  height: 64,
  margin: 6,
  pad: 8,
  portrait: 40,
  /** Above the hotbar. */
  bottomGap: 36,
  charsPerSecond: 55,
  nameH: 14,
} as const;

/** Text box at the bottom of the screen with typewriter text and choices. */
export class DialogBox {
  private readonly root: Phaser.GameObjects.Container;
  private readonly panel: Phaser.GameObjects.NineSlice;
  private readonly nameTab: Phaser.GameObjects.NineSlice;
  private readonly name: PixelText;
  private readonly portraitFrame: Phaser.GameObjects.Rectangle;
  private readonly portrait: Phaser.GameObjects.Image;
  private readonly body: PixelText;
  private readonly more: PixelText;
  private readonly choiceTexts: PixelText[] = [];
  private req: DialogRequest | null = null;
  private page = 0;
  private shown = 0;
  private choice = 0;
  private width: number = LAYOUT.maxWidth;
  private textWidth = 100;
  private blinkT = 0;
  private lastBlip = 0;
  /** The key press that opened the box must not also advance it. */
  private openedAt = 0;

  constructor(private readonly scene: Phaser.Scene) {
    this.root = scene.add.container(0, 0).setVisible(false).setDepth(50);
    this.panel = addPanel(scene, 0, 0, LAYOUT.maxWidth, LAYOUT.height);
    this.nameTab = addPanel(scene, 6, -LAYOUT.nameH + 3, 60, LAYOUT.nameH + 4);
    this.name = new PixelText(scene, 12, -LAYOUT.nameH + 7, '', { color: 'brick', shadow: 'sand' });
    this.portraitFrame = scene.add.rectangle(LAYOUT.pad - 1, LAYOUT.pad - 1, LAYOUT.portrait + 2, LAYOUT.portrait + 2, hex('umber')).setOrigin(0, 0);
    this.portrait = scene.add.image(LAYOUT.pad, LAYOUT.pad, '__DEFAULT').setOrigin(0, 0);
    this.body = new PixelText(scene, LAYOUT.pad, LAYOUT.pad, '', { color: 'night', shadow: 'mist' });
    this.more = new PixelText(scene, 0, 0, 'v', { color: 'clay', shadow: 'mist' });
    this.root.add([this.nameTab, this.name, this.panel, this.portraitFrame, this.portrait, this.body, this.more]);
    for (let i = 0; i < 4; i++) {
      const t = new PixelText(scene, 0, 0, '', { color: 'umber', shadow: 'mist' }).setVisible(false);
      t.setInteractive({ useHandCursor: true })
        .on('pointerover', () => this.pick(i))
        .on('pointerdown', () => {
          this.pick(i);
          this.confirm();
        });
      this.choiceTexts.push(t);
      this.root.add(t);
    }
    this.panel.setInteractive().on('pointerdown', () => this.advance());
  }

  get isOpen(): boolean {
    return this.req !== null;
  }

  layout(w: number, h: number): void {
    this.width = Math.min(LAYOUT.maxWidth, w - LAYOUT.margin * 2);
    this.panel.width = this.width;
    this.root.setPosition(Math.round((w - this.width) / 2), h - LAYOUT.bottomGap - LAYOUT.height);
    this.render();
  }

  open(req: DialogRequest): void {
    this.req = req;
    this.openedAt = this.scene.time.now;
    this.page = 0;
    this.shown = 0;
    this.choice = 0;
    this.root.setVisible(true);
    const hasName = !!req.speaker;
    this.nameTab.setVisible(hasName);
    this.name.setVisible(hasName).setText(req.speaker ?? '');
    this.nameTab.width = this.name.width + 13;
    const hasPortrait = !!req.portrait;
    this.portraitFrame.setVisible(hasPortrait);
    this.portrait.setVisible(hasPortrait);
    if (req.portrait) this.portrait.setTexture(req.portrait.texture, req.portrait.frame);
    audio.playSfx('menuOpen', 0.5);
    this.render();
  }

  close(choice = -1): void {
    const req = this.req;
    if (!req) return;
    this.req = null;
    this.root.setVisible(false);
    audio.playSfx('menuClose', 0.5);
    req.onChoose?.(choice);
    req.onClose?.();
  }

  private get text(): string {
    return fillName(this.req?.pages[this.page] ?? '', state.name);
  }

  private get lastPage(): boolean {
    return !!this.req && this.page >= this.req.pages.length - 1;
  }

  private get typing(): boolean {
    return this.shown < this.text.length;
  }

  private get choosing(): boolean {
    return this.lastPage && !this.typing && !!this.req?.choices?.length;
  }

  update(deltaMs: number): void {
    if (!this.req) return;
    if (this.typing) {
      const before = Math.floor(this.shown);
      this.shown = Math.min(this.text.length, this.shown + (deltaMs / 1000) * LAYOUT.charsPerSecond);
      if (Math.floor(this.shown) !== before) {
        const now = this.scene.time.now;
        const ch = this.text[Math.floor(this.shown) - 1];
        if (ch && ch !== ' ' && now - this.lastBlip > 70) {
          this.lastBlip = now;
          audio.playSfx('talk', 0.35, this.req.voice ?? 1);
        }
        this.render();
      }
    }
    this.blinkT += deltaMs;
    this.more.setVisible(!this.typing && !this.choosing && Math.floor(this.blinkT / 400) % 2 === 0);
  }

  /** Space / X / Enter / click: finish the line, turn the page, choose, or close. */
  advance(): void {
    if (!this.req || this.scene.time.now - this.openedAt < 120) return;
    if (this.typing) {
      this.shown = this.text.length;
      this.render();
      return;
    }
    if (this.choosing) {
      this.confirm();
      return;
    }
    if (!this.lastPage) {
      this.page++;
      this.shown = 0;
      audio.playSfx('uiClick', 0.5);
      this.render();
      return;
    }
    this.close(-1);
  }

  move(d: number): void {
    if (!this.choosing || !this.req?.choices) return;
    this.pick((this.choice + d + this.req.choices.length) % this.req.choices.length);
  }

  private pick(i: number): void {
    if (!this.choosing || i === this.choice) return;
    this.choice = i;
    audio.playSfx('uiHover', 0.5);
    this.render();
  }

  private confirm(): void {
    if (!this.choosing) return;
    audio.playSfx('uiClick', 0.7);
    this.close(this.choice);
  }

  private render(): void {
    if (!this.req) return;
    const x0 = this.req.portrait ? LAYOUT.pad + LAYOUT.portrait + 7 : LAYOUT.pad;
    this.textWidth = this.width - x0 - LAYOUT.pad;
    const choices = this.choosing ? this.req.choices! : [];
    // Choices sit in a row under the text.
    this.body.setStyle({ wrapWidth: this.textWidth });
    this.body.setPosition(x0, LAYOUT.pad).setText(this.text.slice(0, Math.floor(this.shown)));
    let cx = x0;
    this.choiceTexts.forEach((t, i) => {
      const label = choices[i];
      t.setVisible(!!label);
      if (!label) return;
      const sel = i === this.choice;
      t.setStyle({ color: sel ? 'brick' : 'umber' }).setText(`${sel ? '> ' : '  '}${label}`);
      t.setPosition(cx, LAYOUT.height - LAYOUT.pad - 8);
      cx += t.width + 10;
    });
    this.more.setPosition(this.width - LAYOUT.pad - 6, LAYOUT.height - LAYOUT.pad - 7);
  }
}
