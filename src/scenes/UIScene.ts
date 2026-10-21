import Phaser from 'phaser';
import { DEBUG, GAME_TITLE } from '../config';
import type { DaySummary } from '../systems/day';
import { audio } from '../audio/AudioManager';
import { OPENING_TRACK } from '../data/music';
import { EV, bus } from '../systems/events';
import { newGameState, state } from '../systems/GameState';
import { clearSave, hasSave } from '../systems/save';
import { selectSlot } from '../systems/Inventory';
import { uiState } from '../systems/uiState';
import { ClockPanel } from '../ui/ClockPanel';
import { DaySummaryView } from '../ui/DaySummary';
import { DialogBox, type DialogRequest } from '../ui/DialogBox';
import { NeedsPanel } from '../ui/NeedsPanel';
import { SettingsMenu } from '../ui/SettingsMenu';
import { ShopMenu } from '../ui/ShopMenu';
import { Hotbar } from '../ui/Hotbar';
import { InventoryMenu } from '../ui/InventoryMenu';
import { addPanel } from '../ui/Panel';
import { TOUCH_TOP_ROW, shouldShow } from '../ui/TouchControls';
import { PixelText } from '../ui/PixelText';
import { Notice, Toasts } from '../ui/Toasts';
import type { IntroData } from './IntroScene';
import type { TourData } from './TourScene';

const PROMPT = {
  width: 150,
  height: 62,
  titleScale: 2,
  blinkMs: 600,
  fadeMs: 400,
} as const;

/** Controls reminder in the top-left; fades after a while, H brings it back. */
const touch = shouldShow();

const HELP = {
  lines: [
    'WASD walk   Click/Space use tool, eat, reel   X/Right-click pick, talk, sit, read',
    '1-0 or wheel: choose item   E backpack   M mute   +/- zoom   Esc settings',
    `hold ${DEBUG.fastForwardKey} fast time   ${DEBUG.nextDayKey} next day   H hide help`,
  ],
  /** The same reminder for the on-screen phone controls. */
  touchLines: [
    'Stick walk   PAKAI use tool, eat, reel',
    'AKSI pick, talk, sit, read',
    'Tap item to choose   TAS backpack   MENU settings',
    'Pinch with two fingers to zoom',
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
  private needs!: NeedsPanel;
  private dialog!: DialogBox;
  private shop!: ShopMenu;
  private settings!: SettingsMenu;
  private summary!: DaySummaryView;
  private prompt: Phaser.GameObjects.Container | null = null;
  private started = false;
  /** Released after the start prompt is gone, so the key that starts the game is not read twice. */
  private wasModal = false;

  constructor() {
    super('UI');
  }

  create(): void {
    this.clock = new ClockPanel(this);
    this.clock.update(state);
    bus.on(EV.minute, () => this.clock.update(state), this);
    bus.on(EV.newDay, () => this.clock.update(state), this);
    bus.on(EV.goldChanged, () => this.clock.update(state), this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      bus.off(EV.minute, undefined, this);
      bus.off(EV.newDay, undefined, this);
      bus.off(EV.goldChanged, undefined, this);
    });
    this.needs = new NeedsPanel(this);
    this.needs.setVisible(false);

    this.help = new PixelText(this, 4, 4, (touch ? HELP.touchLines : HELP.lines).join('\n'), { color: 'cream', outline: 'night' }).setAlpha(0.9).setVisible(false);

    this.hotbar = new Hotbar(this, (i) => {
      if (uiState.menuOpen) return;
      selectSlot(state, i);
      audio.playSfx('select', 0.6);
    });
    this.hotbar.setVisible(false);
    this.toasts = new Toasts(this);
    this.notice = new Notice(this);
    this.menu = new InventoryMenu(this, state);
    this.shop = new ShopMenu(this, state);
    this.settings = new SettingsMenu(this, state);
    this.settings.onNewFarm = () => {
      // Back to the opening story; the world waits until it ends.
      this.started = false;
      uiState.started = false;
      this.newFarm();
      this.syncModal();
      this.help.setVisible(false);
      this.playIntro();
    };
    this.dialog = new DialogBox(this);
    this.summary = new DaySummaryView(this);
    const refreshInv = () => {
      this.hotbar.refresh(state);
      this.menu.refresh();
      this.shop.refresh();
    };
    refreshInv();
    // On phones the help shares the top-left corner with messages, so it makes way.
    const clearHelp = () => {
      if (!touch) return;
      this.tweens.killTweensOf(this.help);
      this.help.setVisible(false);
    };
    const onGained = (id: string, qty: number) => {
      clearHelp();
      this.toasts.item(id, qty);
    };
    const onNotice = (msg: string) => {
      clearHelp();
      this.notice.show(msg);
    };
    const onDialog = (req: DialogRequest) => {
      this.dialog.open(req);
      this.syncModal();
    };
    const onShop = (id: string) => {
      this.shop.open(id);
      this.syncModal();
    };
    const onSummary = (s: DaySummary) => {
      this.summary.show(s, () => {
        this.syncModal();
        bus.emit(EV.dayDone);
      });
      this.syncModal();
    };
    bus.on(EV.inventoryChanged, refreshInv);
    bus.on(EV.goldChanged, refreshInv);
    bus.on(EV.itemGained, onGained);
    bus.on(EV.notice, onNotice);
    bus.on(EV.dialog, onDialog);
    bus.on(EV.shop, onShop);
    bus.on(EV.daySummary, onSummary);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      bus.off(EV.inventoryChanged, refreshInv);
      bus.off(EV.goldChanged, refreshInv);
      bus.off(EV.itemGained, onGained);
      bus.off(EV.notice, onNotice);
      bus.off(EV.dialog, onDialog);
      bus.off(EV.shop, onShop);
      bus.off(EV.daySummary, onSummary);
    });

    const kb = this.input.keyboard!;
    const toggleMenu = () => {
      if (!this.started || this.dialog.isOpen || this.summary.isOpen || this.settings.isOpen) return;
      if (this.shop.isOpen) this.shop.close();
      else if (this.menu.isOpen) this.menu.close();
      else this.menu.open();
      this.syncModal();
    };
    kb.on('keydown-E', toggleMenu);
    kb.on('keydown-I', toggleMenu);
    kb.on('keydown-ESC', () => {
      if (this.dialog.isOpen) this.dialog.close(-1);
      else if (this.shop.isOpen) this.shop.close();
      else if (this.menu.isOpen) this.menu.close();
      else if (this.settings.isOpen) this.settings.close();
      else if (this.started && !this.summary.isOpen) this.settings.open();
      this.syncModal();
    });
    // Dialog: advance with Space / Enter / X / F, choose with the arrows or WASD.
    for (const k of ['SPACE', 'ENTER', 'X', 'F']) kb.on(`keydown-${k}`, () => this.dialog.isOpen && (this.dialog.advance(), this.syncModal()));
    for (const k of ['LEFT', 'UP', 'A', 'W']) kb.on(`keydown-${k}`, () => this.dialog.move(-1));
    for (const k of ['RIGHT', 'DOWN', 'D', 'S']) kb.on(`keydown-${k}`, () => this.dialog.move(1));
    // Settings: up/down pick a row, left/right change it, Enter/Space/X use it.
    const inSettings = () => this.settings.isOpen && !this.dialog.isOpen;
    for (const [keys, fn] of [
      [['UP', 'W'], () => this.settings.move(-1)],
      [['DOWN', 'S'], () => this.settings.move(1)],
      [['LEFT', 'A'], () => this.settings.change(-1)],
      [['RIGHT', 'D'], () => this.settings.change(1)],
      [['SPACE', 'ENTER', 'X'], () => this.settings.activate()],
    ] as Array<[string[], () => void]>)
      for (const k of keys)
        kb.on(`keydown-${k}`, () => {
          if (!inSettings()) return;
          fn();
          this.syncModal();
        });
    kb.on('keydown-M', () => this.settings.refresh());
    kb.on('keydown', () => {
      if (this.summary.isOpen) this.summary.finish();
    });
    kb.on('keydown-H', () => {
      if (!this.started) return;
      this.tweens.killTweensOf(this.help);
      this.help.setVisible(!this.help.visible).setAlpha(0.9);
    });

    this.showStartPrompt();
    const relayout = () => {
      this.clock.layout(this.scale.width);
      this.needs.layout(this.scale.width);
      this.dialog.layout(this.scale.width, this.scale.height);
      this.shop.layout(this.scale.width, this.scale.height);
      this.settings.layout(this.scale.width, this.scale.height);
      this.summary.layout(this.scale.width, this.scale.height);
      const hb = this.hotbar.layout(this.scale.width, this.scale.height);
      uiState.hudRects = [hb];
      // Phones: messages and pickups go top-left, under the Menu/Tas buttons,
      // since the joystick and action buttons sit around the hotbar.
      const touchTop = Math.ceil(TOUCH_TOP_ROW / this.scale.zoom);
      if (touch) {
        this.notice.layout(this.scale.width, touchTop, 4);
        this.toasts.layout(this.scale.height, touchTop + 12);
      } else {
        this.notice.layout(this.scale.width, hb.y - 24);
        this.toasts.layout(this.scale.height);
      }
      this.menu.layout(this.scale.width, this.scale.height);
      // Below the on-screen Menu/Tas buttons on phones.
      this.help.y = touch ? touchTop : 4;
      if (this.prompt) this.centerPrompt(this.prompt);
    };
    relayout();
    this.scale.on(Phaser.Scale.Events.RESIZE, relayout);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, relayout));
  }

  update(_time: number, delta: number): void {
    this.dialog.update(delta);
    this.needs.update(state);
    // A dialog closed by clicking or by its own choice callbacks.
    if (this.wasModal && !this.anyModal()) this.syncModal();
  }

  private anyModal(): boolean {
    return this.menu.isOpen || this.shop.isOpen || this.dialog.isOpen || this.summary.isOpen || this.settings.isOpen;
  }

  /** One place decides whether the world is paused and which HUD shows. */
  private syncModal(): void {
    const modal = this.anyModal();
    if (this.wasModal && !modal) uiState.blockUntil = this.time.now + 200;
    this.wasModal = modal;
    uiState.menuOpen = modal;
    const fullscreen = this.menu.isOpen || this.shop.isOpen || this.summary.isOpen || this.settings.isOpen;
    this.hotbar.setVisible(this.started && !fullscreen);
    this.needs.setVisible(this.started && !this.summary.isOpen);
    bus.emit(EV.menu, modal);
  }

  /** Erase the save and start over on day one. */
  private newFarm(): void {
    clearSave();
    Object.assign(state, newGameState());
    this.scene.get('World').scene.restart();
    this.clock.update(state);
    bus.emit(EV.inventoryChanged);
  }

  /** The world starts running: HUD, controls reminder, the map's music. */
  private startPlaying(): void {
    this.started = true;
    uiState.started = true;
    bus.emit(EV.started);
    this.syncModal();
    this.help.setVisible(true).setAlpha(0.9);
    this.time.delayedCall(HELP.showMs, () => this.tweens.add({ targets: this.help, alpha: 0, duration: 800, onComplete: () => this.help.setVisible(false) }));
  }

  /** The opening story and the tour of the valley, once per farm, then the game. */
  private playIntro(): void {
    const data: IntroData = {
      onDone: () => {
        state.introSeen = true;
        this.playTour();
      },
    };
    this.scene.launch('Intro', data);
    this.scene.bringToTop('Intro');
  }

  private playTour(): void {
    const data: TourData = { onDone: () => this.startPlaying() };
    this.scene.launch('Tour', data);
    this.scene.bringToTop('Tour');
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
    const saved = hasSave();
    const press = new PixelText(this, 0, 45, saved ? 'Press any key to continue' : 'Press any key to start', { color: 'night', shadow: 'mist' });
    press.x = Math.round((PROMPT.width - press.width) / 2);
    box.add([panel, title, sub, press]);
    if (saved) {
      const fresh = new PixelText(this, 0, PROMPT.height + 3, 'Delete: start a new farm', { color: 'cream', outline: 'night' });
      fresh.x = Math.round((PROMPT.width - fresh.width) / 2);
      box.add(fresh);
    }
    const blink = this.time.addEvent({ delay: PROMPT.blinkMs, loop: true, callback: () => press.setVisible(!press.visible) });

    let begun = false;
    const begin = () => {
      if (begun || this.dialog.isOpen) return;
      begun = true;
      blink.remove();
      audio.startOpening(OPENING_TRACK);
      void audio.unlock().then(() => audio.playSfx('start', 0.8));
      if (state.introSeen) this.startPlaying();
      else this.playIntro();
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
    const onKey = (e: KeyboardEvent) => {
      if (this.started) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && hasSave()) {
        this.dialog.open({
          pages: ['Start a new farm? This erases your saved game.'],
          choices: ['Keep my farm', 'Start over'],
          onChoose: (i) => {
            if (i === 1) this.newFarm();
          },
        });
        return;
      }
      if (this.dialog.isOpen) return;
      this.input.keyboard?.off('keydown', onKey);
      begin();
    };
    this.input.keyboard?.on('keydown', onKey);
    this.input.once('pointerdown', () => {
      if (!this.dialog.isOpen) {
        this.input.keyboard?.off('keydown', onKey);
        begin();
      }
    });
  }
}
