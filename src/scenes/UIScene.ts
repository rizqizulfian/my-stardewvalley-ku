import Phaser from 'phaser';
import { DEBUG, GAME_TITLE } from '../config';
import { audio } from '../audio/AudioManager';
import { EV, bus } from '../systems/events';
import { state } from '../systems/GameState';
import { selectSlot } from '../systems/Inventory';
import { uiState } from '../systems/uiState';
import { ClockPanel } from '../ui/ClockPanel';
import { Hotbar } from '../ui/Hotbar';
import { InventoryMenu } from '../ui/InventoryMenu';
import { addPanel } from '../ui/Panel';
import { PixelText } from '../ui/PixelText';
import { Notice, Toasts } from '../ui/Toasts';

const PROMPT = {
  width: 150,
  height: 62,
  titleScale: 2,
  blinkMs: 600,
  fadeMs: 400,
} as const;

/** Controls reminder in the top-left; fades after a while, H brings it back. */
const HELP = {
  lines: [
    'WASD walk   Click/Space use   X/Right-click pick',
    '1-0 or wheel: choose item   E backpack   M mute',
    `hold ${DEBUG.fastForwardKey} fast time   ${DEBUG.nextDayKey} next day   H hide help`,
  ],
  showMs: 25000,
} as const;

/** HUD overlay plus the "press any key" start prompt. */
export class UIScene extends Phaser.Scene {
  private clock!: ClockPanel;
  private hotbar!: Hotbar;
  private menu!: InventoryMenu;
  private toasts!: Toasts;
  private notice!: Notice;
  private help!: PixelText;
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

    this.help = new PixelText(this, 4, 4, HELP.lines.join('\n'), { color: 'cream', outline: 'night' }).setAlpha(0.9).setVisible(false);

    this.hotbar = new Hotbar(this, (i) => {
      if (uiState.menuOpen) return;
      selectSlot(state, i);
      audio.playSfx('select', 0.6);
    });
    this.hotbar.setVisible(false);
    this.toasts = new Toasts(this);
    this.notice = new Notice(this);
    this.menu = new InventoryMenu(this, state);
    const refreshInv = () => {
      this.hotbar.refresh(state);
      this.menu.refresh();
    };
    refreshInv();
    const onGained = (id: string, qty: number) => this.toasts.item(id, qty);
    const onNotice = (msg: string) => this.notice.show(msg);
    bus.on(EV.inventoryChanged, refreshInv);
    bus.on(EV.itemGained, onGained);
    bus.on(EV.notice, onNotice);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      bus.off(EV.inventoryChanged, refreshInv);
      bus.off(EV.itemGained, onGained);
      bus.off(EV.notice, onNotice);
    });

    const kb = this.input.keyboard!;
    const toggleMenu = () => {
      if (!this.started) return;
      if (this.menu.isOpen) this.menu.close();
      else this.menu.open();
      uiState.menuOpen = this.menu.isOpen;
      this.hotbar.setVisible(!this.menu.isOpen);
      bus.emit(EV.menu, this.menu.isOpen);
    };
    kb.on('keydown-E', toggleMenu);
    kb.on('keydown-I', toggleMenu);
    kb.on('keydown-ESC', () => {
      if (this.menu.isOpen) toggleMenu();
    });
    kb.on('keydown-H', () => {
      if (!this.started) return;
      this.tweens.killTweensOf(this.help);
      this.help.setVisible(!this.help.visible).setAlpha(0.9);
    });

    this.showStartPrompt();
    const relayout = () => {
      this.clock.layout(this.scale.width);
      const hb = this.hotbar.layout(this.scale.width, this.scale.height);
      uiState.hudRects = [hb];
      this.notice.layout(this.scale.width, hb.y - 24);
      this.toasts.layout(this.scale.height);
      this.menu.layout(this.scale.width, this.scale.height);
      if (this.prompt) this.centerPrompt(this.prompt);
    };
    relayout();
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
      this.hotbar.setVisible(true);
      this.help.setVisible(true);
      this.time.delayedCall(HELP.showMs, () => this.tweens.add({ targets: this.help, alpha: 0, duration: 800, onComplete: () => this.help.setVisible(false) }));
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
