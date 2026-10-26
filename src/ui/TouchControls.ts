// On-screen touch controls for phones: a virtual joystick and a few chunky
// buttons, built as plain DOM over the canvas. They drive the game by
// dispatching synthetic KeyboardEvents on `window`, which Phaser's keyboard
// plugin listens to, so no scene needs to know touch exists.

import type Phaser from 'phaser';
import { PALETTE } from '../art/palette';
import { uiState } from '../systems/uiState';
import { renderScale } from '../systems/viewZoom';

type KeyDef = { key: string; code: string; keyCode: number };

const KEYS = {
  w: { key: 'w', code: 'KeyW', keyCode: 87 },
  a: { key: 'a', code: 'KeyA', keyCode: 65 },
  s: { key: 's', code: 'KeyS', keyCode: 83 },
  d: { key: 'd', code: 'KeyD', keyCode: 68 },
  space: { key: ' ', code: 'Space', keyCode: 32 },
  x: { key: 'x', code: 'KeyX', keyCode: 88 },
  e: { key: 'e', code: 'KeyE', keyCode: 69 },
  esc: { key: 'Escape', code: 'Escape', keyCode: 27 },
} satisfies Record<string, KeyDef>;

/** Keys this overlay currently holds down, so we never double-press or leak a held key. */
const held = new Set<KeyDef>();

function dispatch(type: 'keydown' | 'keyup', k: KeyDef): void {
  const ev = new KeyboardEvent(type, { key: k.key, code: k.code, bubbles: true, cancelable: true });
  // Chrome ignores keyCode/which in the init dict; Phaser reads keyCode.
  Object.defineProperty(ev, 'keyCode', { get: () => k.keyCode });
  Object.defineProperty(ev, 'which', { get: () => k.keyCode });
  window.dispatchEvent(ev);
}

function press(k: KeyDef): void {
  if (held.has(k)) return;
  held.add(k);
  dispatch('keydown', k);
}

function release(k: KeyDef): void {
  if (!held.delete(k)) return;
  dispatch('keyup', k);
}

function tap(k: KeyDef): void {
  release(k);
  dispatch('keydown', k);
  dispatch('keyup', k);
}

/** Whether the on-screen controls are in use (touch device, or forced with ?touch=1). */
export function shouldShow(): boolean {
  const q = new URLSearchParams(window.location.search).get('touch');
  if (q === '1') return true;
  if (q === '0') return false;
  return (
    window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0
  );
}

const P = PALETTE;
const CSS = `
.lp-touch, .lp-touch * {
  touch-action: none; user-select: none; -webkit-user-select: none;
  -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent;
  box-sizing: border-box;
}
.lp-touch { position: fixed; inset: 0; pointer-events: none; z-index: 1000; }
.lp-touch .lp-c { position: absolute; pointer-events: auto; image-rendering: pixelated; }
.lp-touch .lp-c.lp-hide { display: none; }
.lp-touch .lp-btn {
  display: flex; align-items: center; justify-content: center;
  min-width: 48px; min-height: 48px; padding: 0 8px;
  background: ${P.cream}; color: ${P.night};
  border: 3px solid ${P.night}; border-radius: 4px;
  box-shadow: 0 4px 0 ${P.night}, inset -3px -3px 0 ${P.mist};
  font: bold 12px/1 ui-monospace, Menlo, Consolas, 'Courier New', monospace;
  letter-spacing: 1px; text-transform: uppercase; opacity: 0.75;
}
.lp-touch .lp-btn.lp-down {
  opacity: 1; transform: translateY(3px);
  box-shadow: 0 1px 0 ${P.night}, inset 3px 3px 0 ${P.mist};
}
.lp-touch .lp-use { width: 76px; height: 76px; background: ${P.brick}; color: ${P.cream}; font-size: 14px;
  box-shadow: 0 4px 0 ${P.night}, inset -3px -3px 0 ${P.wine}; }
.lp-touch .lp-use.lp-down { box-shadow: 0 1px 0 ${P.night}, inset 3px 3px 0 ${P.wine}; }
.lp-touch .lp-act { width: 60px; height: 60px; background: ${P.leaf}; color: ${P.cream};
  box-shadow: 0 4px 0 ${P.night}, inset -3px -3px 0 ${P.moss}; }
.lp-touch .lp-act.lp-down { box-shadow: 0 1px 0 ${P.night}, inset 3px 3px 0 ${P.moss}; }
.lp-touch .lp-small { width: 56px; height: 48px; font-size: 11px; }
.lp-touch .lp-stick {
  width: 110px; height: 110px; border-radius: 50%;
  background: ${P.night}; border: 3px solid ${P.ink}; opacity: 0.6;
  box-shadow: inset 0 0 0 4px ${P.plum};
}
.lp-touch .lp-stick.lp-down { opacity: 0.85; }
.lp-touch .lp-knob {
  position: absolute; left: 50%; top: 50%; width: 48px; height: 48px; margin: -24px 0 0 -24px;
  border-radius: 50%; background: ${P.cream}; border: 3px solid ${P.night};
  box-shadow: inset -3px -3px 0 ${P.mist}; pointer-events: none;
}
`;

const STICK = 110;
const KNOB_TRAVEL = 34;
const DEAD_ZONE = 0.3;
const GAP = 12;
/** Top edge of the Menu/Tas row (CSS px); the help text starts below it. */
export const TOUCH_TOP_ROW = 8 + 48 + 8;
const TOP = 8;

export function installTouchControls(game: Phaser.Game): void {
  if (!shouldShow()) return;

  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const root = document.createElement('div');
  root.className = 'lp-touch';
  document.body.appendChild(root);

  const el = (cls: string, label = ''): HTMLDivElement => {
    const d = document.createElement('div');
    d.className = `lp-c ${cls}`;
    d.textContent = label;
    root.appendChild(d);
    return d;
  };

  const block = (e: Event) => {
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();
  };
  // Never let touches on the controls scroll, zoom, select or reach the canvas.
  for (const t of ['touchstart', 'touchmove', 'touchend', 'touchcancel', 'contextmenu', 'mousedown', 'dblclick'])
    root.addEventListener(t, block, { passive: false });

  /** A button: `hold` keeps the key down while pressed; otherwise one tap on press. */
  const button = (cls: string, label: string, k: KeyDef, hold: boolean): HTMLDivElement => {
    const b = el(`lp-btn ${cls}`, label);
    let pid: number | null = null;
    const up = (e: PointerEvent) => {
      if (e.pointerId !== pid) return;
      block(e);
      pid = null;
      b.classList.remove('lp-down');
      if (hold) release(k);
    };
    b.addEventListener('pointerdown', (e) => {
      block(e);
      if (pid !== null) return;
      pid = e.pointerId;
      b.setPointerCapture?.(e.pointerId);
      b.classList.add('lp-down');
      if (hold) press(k);
      else tap(k);
    });
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('lostpointercapture', up);
    b.addEventListener('pointermove', block);
    resetters.push(() => {
      pid = null;
      b.classList.remove('lp-down');
    });
    return b;
  };
  const resetters: Array<() => void> = [];

  // Joystick.
  const stick = el('lp-stick');
  const knob = document.createElement('div');
  knob.className = 'lp-knob';
  stick.appendChild(knob);
  let stickId: number | null = null;
  const setDir = (dx: number, dy: number) => {
    // 8 directions: each axis is on when it is past the dead zone and within
    // ~67.5 degrees of that axis (so diagonals get a fair 45-degree wedge).
    const len = Math.hypot(dx, dy);
    let h = 0;
    let v = 0;
    if (len > DEAD_ZONE) {
      const ang = Math.atan2(dy, dx);
      const oct = ((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8; // 0=right, 2=down, 4=left, 6=up
      h = [1, 1, 0, -1, -1, -1, 0, 1][oct];
      v = [0, 1, 1, 1, 0, -1, -1, -1][oct];
    }
    (h > 0 ? press : release)(KEYS.d);
    (h < 0 ? press : release)(KEYS.a);
    (v > 0 ? press : release)(KEYS.s);
    (v < 0 ? press : release)(KEYS.w);
  };
  const moveStick = (e: PointerEvent) => {
    const r = stick.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > KNOB_TRAVEL) {
      dx = (dx / len) * KNOB_TRAVEL;
      dy = (dy / len) * KNOB_TRAVEL;
    }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    setDir(dx / KNOB_TRAVEL, dy / KNOB_TRAVEL);
  };
  const resetStick = () => {
    stickId = null;
    knob.style.transform = '';
    stick.classList.remove('lp-down');
    setDir(0, 0);
  };
  stick.addEventListener('pointerdown', (e) => {
    block(e);
    if (stickId !== null) return;
    stickId = e.pointerId;
    stick.setPointerCapture?.(e.pointerId);
    stick.classList.add('lp-down');
    moveStick(e);
  });
  stick.addEventListener('pointermove', (e) => {
    block(e);
    if (e.pointerId === stickId) moveStick(e);
  });
  const stickUp = (e: PointerEvent) => {
    if (e.pointerId !== stickId) return;
    block(e);
    resetStick();
  };
  stick.addEventListener('pointerup', stickUp);
  stick.addEventListener('pointercancel', stickUp);
  stick.addEventListener('lostpointercapture', stickUp);
  resetters.push(resetStick);

  const use = button('lp-use', 'Pakai', KEYS.space, true);
  const act = button('lp-act', 'Aksi', KEYS.x, false);
  const bag = button('lp-small', 'Tas', KEYS.e, false);
  const menu = button('lp-small', 'Menu', KEYS.esc, false);

  const releaseAll = () => {
    for (const r of resetters) r();
    for (const k of [...held]) release(k);
  };
  window.addEventListener('blur', releaseAll);
  window.addEventListener('pagehide', releaseAll);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) releaseAll();
  });

  const show = (node: HTMLElement, on: boolean) => node.classList.toggle('lp-hide', !on);

  let lastKey = '';
  const layout = () => {
    // Visibility. Before the game starts only Menu (skips the intro) is
    // needed; taps on the canvas handle the start prompt. While a modal is
    // open (dialog, inventory, shop, settings, summary) the world is paused:
    // hide the joystick and Aksi, keep Pakai (advances dialog / activates a
    // settings row), Tas (closes inventory) and Menu (closes anything).
    const playing = uiState.started;
    const free = playing && !uiState.menuOpen;
    if (!free && stickId !== null) resetStick();
    show(stick, free);
    show(act, free);
    show(use, playing);
    show(bag, playing);
    show(menu, true);
    if (!free) {
      release(KEYS.w);
      release(KEYS.a);
      release(KEYS.s);
      release(KEYS.d);
    }

    // Keep everything above the hotbar, whose rect is in game native px.
    const canvas = game.canvas;
    const cr = canvas?.getBoundingClientRect();
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    let bottom = GAP;
    if (cr && cr.height > 0) {
      const gameH = game.scale.height / renderScale();
      const scale = cr.height / gameH;
      const canvasBottomGap = Math.max(0, vh - cr.bottom);
      const hb = uiState.hudRects[0];
      const hbTop = hb ? (gameH - hb.y) * scale : 0;
      bottom = canvasBottomGap + Math.max(hbTop, 0) + GAP;
    }
    const key = `${vw}x${vh}:${Math.round(bottom)}`;
    if (key === lastKey) return;
    lastKey = key;

    const b = `calc(${Math.round(bottom)}px + env(safe-area-inset-bottom, 0px))`;
    const l = `calc(16px + env(safe-area-inset-left, 0px))`;
    const r = `calc(16px + env(safe-area-inset-right, 0px))`;
    stick.style.left = l;
    stick.style.bottom = b;
    // Pakai at the far right, Aksi up and to its left (thumb arc).
    use.style.right = r;
    use.style.bottom = b;
    act.style.right = `calc(16px + 76px + 10px + env(safe-area-inset-right, 0px))`;
    act.style.bottom = `calc(${Math.round(bottom) + 34}px + env(safe-area-inset-bottom, 0px))`;
    // Menu and Tas side by side in the top-left corner, clear of the
    // top-right clock/needs HUD in both orientations.
    const t = `calc(${TOP}px + env(safe-area-inset-top, 0px))`;
    menu.style.top = t;
    menu.style.left = `calc(16px + env(safe-area-inset-left, 0px))`;
    bag.style.top = t;
    bag.style.left = `calc(16px + 56px + 10px + env(safe-area-inset-left, 0px))`;
    stick.style.width = stick.style.height = `${STICK}px`;
  };

  layout();
  window.addEventListener('resize', () => {
    lastKey = '';
    layout();
  });
  window.addEventListener('orientationchange', () => {
    lastKey = '';
    setTimeout(layout, 50);
  });
  window.setInterval(layout, 250);
}
