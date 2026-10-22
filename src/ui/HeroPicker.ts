// "Choose your farmer": a woman farmer, a man farmer (both named by the
// player), Alvira or the Alvira 2.0 test drawing. Shown before the opening
// story of a new farm, and from Settings to change farmer later. Plain DOM over the canvas like the co-op
// panel, since naming needs a real text input (phone keyboards).

import type Phaser from 'phaser';
import { CHAR_FRAMES, charFrame } from '../art/characters';
import { PALETTE } from '../art/palette';
import { audio } from '../audio/AudioManager';
import { HEROES, NAME_MAX, cleanHeroName, heroDef, heroScale, type HeroId } from '../data/heroes';
import { PLAYER } from '../config';

const P = PALETTE;
/** Preview canvas in game pixels (fits the 18x30 Alvira frame) with RES pixels each, shown SCALE times larger. */
const PREVIEW = { w: 20, h: 31, scale: 3, res: 2 } as const;

const CSS = `
.lp-hero { position: fixed; inset: 0; z-index: 2100; display: none; align-items: center; justify-content: center;
  background: rgba(26, 20, 36, 0.6); font: 13px/1.4 ui-monospace, Menlo, Consolas, 'Courier New', monospace; }
.lp-hero.lp-open { display: flex; }
.lp-hero * { box-sizing: border-box; }
.lp-hero .lp-box { width: min(440px, calc(100vw - 24px)); max-height: calc(100dvh - 16px); overflow: auto;
  background: ${P.cream}; color: ${P.night}; border: 3px solid ${P.night}; border-radius: 4px;
  box-shadow: 0 5px 0 ${P.night}, inset -3px -3px 0 ${P.mist}; padding: 12px; }
.lp-hero h2 { margin: 0 0 8px; font-size: 15px; color: ${P.brick}; letter-spacing: 1px; text-transform: uppercase; text-align: center; }
.lp-hero .lp-cards { display: flex; gap: 6px; }
.lp-hero .lp-card { flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 4px;
  padding: 6px 2px; background: ${P.mist}; border: 2px solid ${P.haze}; border-radius: 3px; cursor: pointer;
  font: inherit; font-size: 11px; font-weight: bold; color: ${P.umber}; text-align: center; line-height: 1.2;
  -webkit-tap-highlight-color: transparent; }
.lp-hero .lp-card.lp-on { background: ${P.sand}; border-color: ${P.night}; color: ${P.night}; box-shadow: 0 3px 0 ${P.night}; }
.lp-hero canvas { width: ${PREVIEW.w * PREVIEW.scale}px; height: ${PREVIEW.h * PREVIEW.scale}px; image-rendering: pixelated; }
.lp-hero label { display: block; margin: 10px 0 3px; color: ${P.umber}; font-weight: bold; }
.lp-hero input { width: 100%; padding: 8px; font: inherit; font-size: 15px; color: ${P.night}; background: #fff;
  border: 2px solid ${P.night}; border-radius: 3px; user-select: text; -webkit-user-select: text; }
.lp-hero .lp-note { min-height: 2.8em; margin: 8px 0 0; font-size: 11px; color: ${P.mauve}; }
.lp-hero .lp-name-row[hidden] { display: none; }
.lp-hero button.lp-go { display: block; width: 100%; margin-top: 8px; padding: 9px 8px; font: inherit; font-weight: bold;
  color: ${P.night}; background: ${P.sand}; border: 2px solid ${P.night}; border-radius: 3px; cursor: pointer;
  box-shadow: 0 3px 0 ${P.night}; letter-spacing: 1px; }
.lp-hero button.lp-go:active { transform: translateY(2px); box-shadow: 0 1px 0 ${P.night}; }
.lp-hero button.lp-quiet { background: ${P.mist}; }
`;

const NOTES: Record<HeroId, string> = {
  'farmer-f': 'Petani baru di Lembah Padi. Beri dia nama.',
  'farmer-m': 'Petani baru di Lembah Padi. Beri dia nama.',
  alvira: 'Alvira, cucu Nek Lastri. Namanya tetap Alvira.',
  alvira2: 'Gambar Alvira yang baru, untuk dicoba, dengan detail lebih halus.',
};

export interface HeroChoice {
  hero: HeroId;
  name: string;
}

interface Opening {
  textures: Phaser.Textures.TextureManager;
  current: HeroChoice;
  /** New farm: no way back. Settings: can cancel. */
  canCancel: boolean;
  onDone: (c: HeroChoice) => void;
  onCancel?: () => void;
}

let root: HTMLDivElement | null = null;
let open: Opening | null = null;
let picked: HeroId = 'alvira';
/** Names typed per farmer, so switching cards back and forth keeps them. */
const names: Partial<Record<HeroId, string>> = {};
let anim = 0;
let tick = 0;

function install(): HTMLDivElement {
  if (root) return root;
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  root = document.createElement('div');
  root.className = 'lp-hero';
  document.body.appendChild(root);
  root.addEventListener('click', (e) => {
    const el = e.target as HTMLElement;
    const card = el.closest<HTMLElement>('.lp-card');
    if (card?.dataset.hero) return select(card.dataset.hero as HeroId);
    const b = el.closest<HTMLButtonElement>('button[data-act]');
    if (b?.dataset.act === 'ok') confirm();
    if (b?.dataset.act === 'cancel') cancel();
  });
  // While open, every key belongs to the picker (Phaser listens on window).
  window.addEventListener(
    'keydown',
    (e) => {
      if (!open) return;
      e.stopPropagation();
      const typing = (e.target as HTMLElement).tagName === 'INPUT';
      if (e.key === 'Enter') {
        e.preventDefault();
        confirm();
      } else if (e.key === 'Escape') cancel();
      else if (!typing && (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A')) step(-1);
      else if (!typing && (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D')) step(1);
    },
    true,
  );
  for (const type of ['keyup', 'keypress']) window.addEventListener(type, (e) => open && e.stopPropagation(), true);
  return root;
}

function render(): void {
  if (!root || !open) return;
  const def = heroDef(picked);
  root.innerHTML = `
    <div class="lp-box">
      <h2>Pilih petanimu</h2>
      <div class="lp-cards">
        ${HEROES.map((h) => `<button class="lp-card${h.id === picked ? ' lp-on' : ''}" data-hero="${h.id}"><canvas width="${PREVIEW.w * PREVIEW.res}" height="${PREVIEW.h * PREVIEW.res}"></canvas>${h.label}</button>`).join('')}
      </div>
      <div class="lp-name-row" ${def.namable ? '' : 'hidden'}>
        <label for="lp-hero-name">Nama</label>
        <input id="lp-hero-name" maxlength="${NAME_MAX}" autocomplete="off" value="${esc(names[picked] ?? def.defaultName)}">
      </div>
      <p class="lp-note">${NOTES[picked]}</p>
      <button class="lp-go" data-act="ok">${open.canCancel ? 'Simpan' : 'Mulai'}</button>
      ${open.canCancel ? '<button class="lp-go lp-quiet" data-act="cancel">Batal</button>' : ''}
    </div>`;
  root.querySelector<HTMLInputElement>('#lp-hero-name')?.addEventListener('input', (e) => (names[picked] = (e.target as HTMLInputElement).value));
  draw();
}

/** Each card walks towards the viewer. */
function draw(): void {
  if (!root || !open) return;
  const frame = charFrame('down', CHAR_FRAMES.walk[tick % CHAR_FRAMES.walk.length]);
  root.querySelectorAll<HTMLCanvasElement>('canvas').forEach((cv, i) => {
    const h = HEROES[i];
    const ctx = cv.getContext('2d');
    if (!ctx || !open!.textures.exists(h.texture)) return;
    const f = open!.textures.getFrame(h.texture, h.id === picked ? frame : CHAR_FRAMES.idle[0]);
    // The canvas holds PREVIEW.res pixels per game pixel; a farmer taller than it is fitted in.
    const k = Math.min(PREVIEW.res * heroScale(h.texture), cv.height / f.cutHeight);
    const w = f.cutWidth * k;
    const hh = f.cutHeight * k;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.drawImage(f.source.image as CanvasImageSource, f.cutX, f.cutY, f.cutWidth, f.cutHeight, Math.floor((cv.width - w) / 2), cv.height - hh, w, hh);
  });
}

function select(id: HeroId): void {
  if (id === picked) return;
  saveTyped();
  picked = id;
  audio.playSfx('select', 0.7);
  render();
}

function step(d: number): void {
  const i = HEROES.findIndex((h) => h.id === picked);
  select(HEROES[(i + d + HEROES.length) % HEROES.length].id);
}

function saveTyped(): void {
  const el = root?.querySelector<HTMLInputElement>('#lp-hero-name');
  if (el) names[picked] = el.value;
}

function confirm(): void {
  if (!open) return;
  saveTyped();
  const def = heroDef(picked);
  const name = def.namable ? cleanHeroName(names[picked] ?? '') || def.defaultName : def.defaultName;
  const done = open.onDone;
  close();
  audio.playSfx('uiClick', 0.8);
  done({ hero: picked, name });
}

function cancel(): void {
  if (!open?.canCancel) return;
  const back = open.onCancel;
  close();
  audio.playSfx('menuClose', 0.8);
  back?.();
}

function close(): void {
  open = null;
  window.clearInterval(anim);
  root?.classList.remove('lp-open');
  (document.activeElement as HTMLElement | null)?.blur?.();
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export function isHeroPickerOpen(): boolean {
  return open !== null;
}

/** Shows the picker with the current farmer selected; onDone gets the choice. */
export function openHeroPicker(o: Opening): void {
  const el = install();
  open = o;
  picked = o.current.hero;
  if (heroDef(picked).namable) names[picked] = o.current.name;
  tick = 0;
  window.clearInterval(anim);
  anim = window.setInterval(() => {
    tick++;
    draw();
  }, PLAYER.walkFrameMs * 1.5);
  render();
  el.classList.add('lp-open');
}

/** Joined a co-op room while choosing: the host's world takes over. */
export function closeHeroPicker(): void {
  if (open) close();
}
