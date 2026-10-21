// The opening story: a framed picture with a little life in it (drifting
// clouds, rain on the office window, the bus rolling past the terraces) and
// typewriter narration under it. Any key or click moves on; Esc skips.

import Phaser from 'phaser';
import { PLAYER_CHARACTER } from '../data/characters';
import { INTRO_SHOTS, type IntroShot } from '../data/intro';
import { CHAR_FRAMES, charFrame } from '../art/characters';
import { wrapText } from '../art/font';
import { BIRD, BUS, INTRO, INTRO_TEXTURES, OFFICE, RAIN_FRAMES } from '../art/intro';
import { hex } from '../art/palette';
import { PROP_TEXTURES } from '../art/props';
import { GRASS_VARIANTS, TERRAIN_TEXTURES } from '../art/terrain';
import { audio } from '../audio/AudioManager';
import { hash2 } from '../art/pixel';
import { addPanel } from '../ui/Panel';
import { PixelText } from '../ui/PixelText';

const LAYOUT = {
  gap: 6,
  textH: 44,
  pad: 8,
  frame: 3,
} as const;
const TIMING = {
  charsPerSecond: 40,
  fadeMs: 500,
  outroMs: 900,
  /** Ignore input this long after a shot starts, so a held key does not skip it. */
  settleMs: 350,
} as const;
/** Parallax speeds of the bus ride (px per second). */
const SCROLL = { far: 4, mid: 16, near: 110 } as const;
const T = 16;
/** Left edge of the open sky in the porch picture (the roof ends there). */
const SKY_LEFT = 142;

export interface IntroData {
  onDone: () => void;
}

export class IntroScene extends Phaser.Scene {
  private onDone: () => void = () => undefined;
  private shot = 0;
  private line = 0;
  private shown = 0;
  private wrapped: string[] = [];
  private full = '';
  private busy = false;
  private finished = false;
  private readyAt = 0;
  private t = 0;
  private px = 0;
  private py = 0;
  private stage!: Phaser.GameObjects.Container;
  private cover!: Phaser.GameObjects.Rectangle;
  private backdrop!: Phaser.GameObjects.Rectangle;
  private box!: Phaser.GameObjects.NineSlice;
  private body!: PixelText;
  private more!: PixelText;
  private caption!: PixelText;
  private skip!: PixelText;
  private frameG!: Phaser.GameObjects.Graphics;
  /** Per-shot animation, run every frame. */
  private animate: (dt: number) => void = () => undefined;

  constructor() {
    super('Intro');
  }

  init(data: IntroData): void {
    this.onDone = data.onDone;
    this.shot = 0;
    this.line = 0;
    this.busy = false;
    this.finished = false;
    this.t = 0;
  }

  create(): void {
    const { width: w, height: h } = this.scale;
    this.backdrop = this.add.rectangle(0, 0, w, h, hex('ink')).setOrigin(0, 0);
    this.frameG = this.add.graphics();
    this.stage = this.add.container(0, 0);
    this.cover = this.add.rectangle(0, 0, INTRO.w, INTRO.h, hex('ink')).setOrigin(0, 0);
    this.caption = new PixelText(this, 0, 0, '', { color: 'cream', outline: 'night' });
    this.box = addPanel(this, 0, 0, INTRO.w, LAYOUT.textH);
    this.body = new PixelText(this, 0, 0, '', { color: 'night', shadow: 'mist' });
    this.more = new PixelText(this, 0, 0, 'v', { color: 'clay', shadow: 'mist' });
    this.skip = new PixelText(this, 0, 0, 'Esc  skip', { color: 'mauve', shadow: null });
    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this));

    const kb = this.input.keyboard!;
    kb.on('keydown', (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === 'Escape') this.finish();
      else if (e.key !== 'm' && e.key !== 'M') this.advance();
    });
    this.input.on('pointerdown', () => this.advance());
    this.startShot();
  }

  private layout(): void {
    const { width: w, height: h } = this.scale;
    const total = INTRO.h + LAYOUT.gap + LAYOUT.textH;
    this.px = Math.round((w - INTRO.w) / 2);
    this.py = Math.max(LAYOUT.frame + 2, Math.round((h - total) / 2));
    this.backdrop.setSize(w, h);
    this.stage.setPosition(this.px, this.py);
    this.cover.setPosition(this.px, this.py);
    // Only the picture area shows the stage.
    const maskShape = this.make.graphics({}, false).fillRect(this.px, this.py, INTRO.w, INTRO.h);
    this.stage.setMask(maskShape.createGeometryMask());
    this.frameG.clear();
    this.frameG.fillStyle(hex('umber')).fillRect(this.px - LAYOUT.frame, this.py - LAYOUT.frame, INTRO.w + LAYOUT.frame * 2, INTRO.h + LAYOUT.frame * 2);
    this.frameG.fillStyle(hex('clay')).fillRect(this.px - LAYOUT.frame + 1, this.py - LAYOUT.frame + 1, INTRO.w + LAYOUT.frame * 2 - 2, 1);
    this.caption.setPosition(this.px + 6, this.py + 5);
    const by = this.py + INTRO.h + LAYOUT.gap;
    this.box.setPosition(this.px, by);
    this.body.setPosition(this.px + LAYOUT.pad, by + LAYOUT.pad);
    this.more.setPosition(this.px + INTRO.w - LAYOUT.pad - 6, by + LAYOUT.textH - LAYOUT.pad - 7);
    this.skip.setPosition(w - this.skip.width - 6, h - 12);
  }

  private get current(): IntroShot {
    return INTRO_SHOTS[this.shot];
  }

  private startShot(): void {
    const s = this.current;
    this.stage.removeAll(true);
    this.t = 0;
    this.build(s);
    this.caption.setText(s.caption ?? '').setAlpha(0);
    if (s.caption) this.tweens.add({ targets: this.caption, alpha: 1, delay: 300, duration: 600 });
    audio.playMusic(s.music);
    this.cover.setAlpha(1);
    this.busy = true;
    this.tweens.add({
      targets: this.cover,
      alpha: 0,
      duration: TIMING.fadeMs,
      onComplete: () => {
        this.busy = false;
      },
    });
    this.line = 0;
    this.startLine();
  }

  private startLine(): void {
    this.full = this.current.lines[this.line];
    this.wrapped = wrapText(this.full, INTRO.w - LAYOUT.pad * 2 - 8);
    this.shown = 0;
    this.readyAt = this.time.now + TIMING.settleMs;
    this.body.setText('');
  }

  private get typing(): boolean {
    return this.shown < this.full.length;
  }

  /** The visible part of the line, wrapped the same way as the whole line. */
  private visibleText(): string {
    let left = Math.floor(this.shown);
    const out: string[] = [];
    for (const l of this.wrapped) {
      if (left <= 0) break;
      out.push(l.slice(0, left));
      left -= l.length + 1;
    }
    return out.join('\n');
  }

  private advance(): void {
    if (this.busy || this.time.now < this.readyAt) return;
    if (this.typing) {
      this.shown = this.full.length;
      this.body.setText(this.visibleText());
      return;
    }
    audio.playSfx('uiClick', 0.5);
    if (this.line < this.current.lines.length - 1) {
      this.line++;
      this.startLine();
      return;
    }
    if (this.shot >= INTRO_SHOTS.length - 1) return this.finish();
    this.busy = true;
    this.tweens.add({ targets: this.caption, alpha: 0, duration: TIMING.fadeMs / 2 });
    this.tweens.add({
      targets: this.cover,
      alpha: 1,
      duration: TIMING.fadeMs,
      onComplete: () => {
        this.shot++;
        this.startShot();
      },
    });
  }

  /** Fade the whole story away, showing the farm behind it. */
  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    this.busy = true;
    this.input.keyboard?.off('keydown');
    this.input.off('pointerdown');
    this.tweens.killAll();
    this.tweens.add({ targets: [this.stage, this.cover, this.box, this.body, this.more, this.caption, this.skip, this.frameG], alpha: 0, duration: TIMING.outroMs / 2 });
    this.tweens.add({
      targets: this.backdrop,
      alpha: 0,
      delay: TIMING.outroMs / 2,
      duration: TIMING.outroMs,
      onComplete: () => {
        this.onDone();
        this.scene.stop();
      },
    });
  }

  update(_time: number, delta: number): void {
    this.t += delta;
    if (this.typing && !this.busy) {
      const before = Math.floor(this.shown);
      this.shown = Math.min(this.full.length, this.shown + (delta / 1000) * TIMING.charsPerSecond);
      if (Math.floor(this.shown) !== before) this.body.setText(this.visibleText());
    }
    this.more.setVisible(!this.typing && !this.busy && Math.floor(this.t / 400) % 2 === 0);
    this.animate(delta / 1000);
  }

  // -------------------------------------------------------------------------
  // The pictures

  private build(s: IntroShot): void {
    const add = <G extends Phaser.GameObjects.GameObject>(o: G): G => {
      this.stage.add(o);
      return o;
    };
    const img = (key: string, x = 0, y = 0, frame?: number) => add(this.add.image(x, y, key, frame).setOrigin(0, 0));
    switch (s.panel) {
      case 'porch': {
        img(INTRO_TEXTURES.porch);
        // Clouds and birds stay in the open sky right of the roof.
        const clouds = [img(INTRO_TEXTURES.cloud, 200, 16), img(INTRO_TEXTURES.cloud, 290, 44).setAlpha(0.8)];
        const birds = [0, 1, 2].map((i) => img(INTRO_TEXTURES.bird, 300 + i * 14, 34 + (i % 2) * 6, 0));
        this.animate = (dt) => {
          clouds.forEach((c, i) => {
            c.x -= (i ? 1.2 : 2) * dt;
            if (c.x < SKY_LEFT) c.x = INTRO.w;
          });
          birds.forEach((b, i) => {
            b.x -= 14 * dt;
            b.y = 34 + (i % 2) * 6 + Math.round(Math.sin(this.t / 500 + i) * 2);
            b.setFrame(Math.floor(this.t / 220 + i) % BIRD.frames);
            if (b.x < SKY_LEFT) b.x += INTRO.w - SKY_LEFT + 20;
          });
        };
        break;
      }
      case 'office': {
        img(INTRO_TEXTURES.office);
        const rain = img(INTRO_TEXTURES.rain, OFFICE.window.x, OFFICE.window.y, 0).setAlpha(0.8);
        const glow = add(this.add.image(OFFICE.monitor.x, OFFICE.monitor.y + 4, INTRO_TEXTURES.glow).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.3));
        const you = add(
          this.add.sprite(OFFICE.seat.x, OFFICE.seat.y, PLAYER_CHARACTER.texture, charFrame('up', CHAR_FRAMES.sit)).setOrigin(0.5, 1),
        );
        // A tube light that cannot make up its mind.
        const tube = add(this.add.rectangle(246, 4, 36, 1, hex('mist')).setOrigin(0, 0));
        this.animate = () => {
          rain.setFrame(Math.floor(this.t / 90) % RAIN_FRAMES);
          glow.setAlpha(0.26 + (Math.floor(this.t / 120) % 7 === 0 ? 0.06 : 0));
          tube.setVisible(hash2(Math.floor(this.t / 90), 0, 7) > 0.35 && this.t % 4000 < 1800);
          // Every few seconds, a tired stretch.
          you.y = OFFICE.seat.y - (this.t % 5000 > 4400 ? 1 : 0);
        };
        break;
      }
      case 'letter': {
        img(INTRO_TEXTURES.letter);
        const warm = add(this.add.image(INTRO.w - 220, 0, INTRO_TEXTURES.lamp).setOrigin(0, 0).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.12));
        const motes = Array.from({ length: 10 }, (_, i) => add(this.add.rectangle(200 + hash2(i, 1, 3) * 110, hash2(i, 2, 3) * 120, 1, 1, hex('gold')).setOrigin(0, 0).setAlpha(0.7)));
        this.animate = (dt) => {
          warm.setAlpha(0.11 + Math.sin(this.t / 900) * 0.025);
          motes.forEach((m, i) => {
            m.y += (3 + (i % 3)) * dt;
            m.x += Math.sin(this.t / 700 + i) * 2 * dt;
            if (m.y > INTRO.h) m.y = -2;
          });
        };
        break;
      }
      case 'bus': {
        img(INTRO_TEXTURES.sky);
        const layers = [
          [add(this.add.tileSprite(0, 0, INTRO.w, INTRO.h, INTRO_TEXTURES.far).setOrigin(0, 0)), SCROLL.far],
          [add(this.add.tileSprite(0, 0, INTRO.w, INTRO.h, INTRO_TEXTURES.mid).setOrigin(0, 0)), SCROLL.mid],
        ] as Array<[Phaser.GameObjects.TileSprite, number]>;
        const busX = 110;
        const busY = 150 - BUS.h;
        const bus = img(INTRO_TEXTURES.bus, busX, busY, 0);
        const puffs = Array.from({ length: 4 }, () => add(this.add.ellipse(0, 0, 5, 4, hex('mist')).setAlpha(0)));
        layers.push([add(this.add.tileSprite(0, 0, INTRO.w, INTRO.h, INTRO_TEXTURES.near).setOrigin(0, 0)), SCROLL.near]);
        // The bus drives on the near road, in front of the verge and its palm.
        this.stage.bringToTop(bus);
        for (const p of puffs) this.stage.bringToTop(p);
        let nextPuff = 0;
        this.animate = (dt) => {
          for (const [l, v] of layers) l.tilePositionX += v * dt;
          bus.setFrame(Math.floor(this.t / 90) % BUS.frames);
          bus.y = busY + (Math.floor(this.t / 160) % 3 === 0 ? -1 : 0);
          if (this.t > nextPuff) {
            nextPuff = this.t + 380;
            const p = puffs.find((q) => q.alpha <= 0.01);
            if (p) p.setPosition(busX + 1, busY + 40).setAlpha(0.8).setScale(1);
          }
          for (const p of puffs) {
            if (p.alpha <= 0.01) continue;
            p.x -= 30 * dt;
            p.y -= 6 * dt;
            p.setScale(p.scale + dt * 1.5);
            p.setAlpha(Math.max(0, p.alpha - dt * 1.1));
          }
        };
        break;
      }
      case 'arrival': {
        // The farm as the game draws it: grass, the old house, trees, weeds.
        for (let y = 0; y < INTRO.h; y += T)
          for (let x = 0; x < INTRO.w; x += T) img(TERRAIN_TEXTURES.grass, x, y, Math.floor(hash2(x, y, 61) * GRASS_VARIANTS));
        const props: Array<[string, number, number, number?]> = [
          [PROP_TEXTURES.treeRound, 6, 20, 1],
          [PROP_TEXTURES.treeRound, 266, 4, 1],
          [PROP_TEXTURES.treeRound, 288, 60, 1],
          [PROP_TEXTURES.weeds, 70, 112, 0],
          [PROP_TEXTURES.weeds, 92, 128, 1],
          [PROP_TEXTURES.weeds, 216, 110, 2],
          [PROP_TEXTURES.weeds, 240, 132, 0],
          [PROP_TEXTURES.weeds, 40, 140, 1],
          [PROP_TEXTURES.weeds, 196, 146, 2],
          [PROP_TEXTURES.weeds, 112, 96, 0],
          [PROP_TEXTURES.rock, 258, 104, 0],
          [PROP_TEXTURES.branch, 56, 96, 0],
          [PROP_TEXTURES.stump, 28, 118, 0],
        ];
        const house = add(this.add.image(160, 86, PROP_TEXTURES.house).setOrigin(0.5, 1));
        house.setDepth(86);
        for (const [key, x, y, f] of props) {
          const tex = this.textures.get(key);
          const frame = f !== undefined && tex.has(String(f)) ? f : undefined;
          const o = add(this.add.image(x, y, key, frame).setOrigin(0, 0));
          o.setDepth(y + o.height);
        }
        const you = add(this.add.sprite(160, INTRO.h + 20, PLAYER_CHARACTER.texture, charFrame('up', 0)).setOrigin(0.5, 1));
        this.stage.sort('depth');
        this.stage.bringToTop(you);
        const stopY = 118;
        this.animate = (dt) => {
          if (you.y > stopY) {
            you.y = Math.max(stopY, you.y - 34 * dt);
            you.setFrame(charFrame('up', CHAR_FRAMES.walk[Math.floor(this.t / 140) % CHAR_FRAMES.walk.length]));
          } else if (this.line === this.current.lines.length - 1 && !this.typing) {
            // Turn round to take it all in.
            you.setFrame(charFrame('down', CHAR_FRAMES.idle[Math.floor(this.t / 600) % 2]));
          } else you.setFrame(charFrame('up', CHAR_FRAMES.idle[Math.floor(this.t / 600) % 2]));
        };
        break;
      }
    }
  }
}
