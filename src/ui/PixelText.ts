import Phaser from 'phaser';
import { FONT, GLYPHS, glyphWidth, measureText, wrapText } from '../art/font';
import { PixelGrid, toCanvas } from '../art/pixel';
import type { ColorName } from '../art/palette';

export interface PixelTextStyle {
  color?: ColorName;
  /** Drop shadow one pixel below (and right, if `shadowRight`). */
  shadow?: ColorName | null;
  shadowRight?: boolean;
  /** Full 1px outline instead of a drop shadow. */
  outline?: ColorName | null;
  wrapWidth?: number;
  align?: 'left' | 'center' | 'right';
  lineHeight?: number;
}

let uid = 0;

/** Draw text into a palette grid. Exported so other art can bake text in. */
export function renderTextGrid(text: string, style: PixelTextStyle = {}): PixelGrid {
  const color = style.color ?? 'cream';
  const lines = style.wrapWidth ? wrapText(text, style.wrapWidth) : text.split('\n');
  const lh = style.lineHeight ?? FONT.lineHeight;
  const pad = style.outline ? 1 : 0;
  const extraX = style.outline ? 2 : style.shadow && style.shadowRight ? 1 : 0;
  const extraY = style.outline ? 2 : style.shadow ? 1 : 0;
  const innerW = Math.max(1, ...lines.map(measureText), style.wrapWidth && style.align !== 'left' ? style.wrapWidth : 0);
  const w = innerW + extraX;
  const h = Math.max(1, (lines.length - 1) * lh + FONT.height) + extraY;
  const ink = new PixelGrid(w, h);

  lines.forEach((line, li) => {
    const lw = measureText(line);
    let x = pad;
    if (style.align === 'center') x += Math.floor((innerW - lw) / 2);
    else if (style.align === 'right') x += innerW - lw;
    const y = pad + li * lh;
    for (const ch of line) {
      if (ch !== ' ') {
        const rows = GLYPHS[ch] ?? GLYPHS['?'];
        rows.forEach((row, ry) => {
          for (let rx = 0; rx < row.length; rx++) if (row[rx] === '#') ink.set(x + rx, y + ry, color);
        });
      }
      x += glyphWidth(ch) + FONT.spacing;
    }
  });

  const out = new PixelGrid(w, h);
  if (style.outline) {
    ink.forEachFilled((x, y) => {
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ])
        out.set(x + dx, y + dy, style.outline!);
    });
  } else if (style.shadow) {
    ink.forEachFilled((x, y) => out.set(x + (style.shadowRight ? 1 : 0), y + 1, style.shadow!));
  }
  out.stamp(ink);
  return out;
}

/**
 * Crisp bitmap text. Each instance owns a small canvas texture that is
 * redrawn only when the text or style changes.
 */
export class PixelText extends Phaser.GameObjects.Image {
  private readonly texKey: string;
  private current = '';
  private style: PixelTextStyle;

  constructor(scene: Phaser.Scene, x: number, y: number, text: string, style: PixelTextStyle = {}) {
    const key = `__ptext_${uid++}`;
    super(scene, x, y, '__DEFAULT');
    this.texKey = key;
    this.style = { shadow: 'night', ...style };
    this.setOrigin(0, 0);
    this.setText(text, true);
    scene.add.existing(this);
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      if (scene.textures.exists(key)) scene.textures.remove(key);
    });
  }

  get text(): string {
    return this.current;
  }

  setText(text: string, force = false): this {
    if (text === this.current && !force) return this;
    this.current = text;
    const grid = renderTextGrid(text, this.style);
    if (this.scene.textures.exists(this.texKey)) this.scene.textures.remove(this.texKey);
    this.scene.textures.addCanvas(this.texKey, toCanvas(grid));
    this.setTexture(this.texKey);
    this.setSize(grid.w, grid.h);
    return this;
  }

  setStyle(style: PixelTextStyle): this {
    this.style = { ...this.style, ...style };
    return this.setText(this.current, true);
  }
}
