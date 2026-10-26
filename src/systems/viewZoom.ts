// Player-chosen camera zoom. The default fits RENDER.viewTilesWide tiles
// across the window (never below 1x, so phones keep their framing); the
// player scales that up or down in steps with +/-, a two-finger pinch, or
// the Zoom row in Settings. The chosen step is remembered in localStorage.
//
// The canvas itself is drawn RENDER.maxRenderScale times denser than the game
// pixel grid where the screen has the pixels for it (every scene camera zooms
// by renderScale()), so drawn sheets with res > 1 (Alvira 2.0) keep their
// detail. Layout code works in game pixels: use viewSize(), not scene.scale.
// A slow device steps the render scale down (see watchFrameRate); `?render=N`
// in the URL fixes it.

import type Phaser from 'phaser';
import { RENDER, ZOOM } from '../config';

let level = load();
let render = 1;
const forcedRender = Number(new URLSearchParams(window.location.search).get('render')) || 0;
let renderCap: number = forcedRender || RENDER.maxRenderScale;
let game: Phaser.Game | undefined;
const listeners: Array<() => void> = [];
const renderListeners: Array<(scale: number) => void> = [];

function load(): number {
  try {
    const raw = Number(localStorage.getItem(ZOOM.storageKey));
    if (localStorage.getItem(ZOOM.storageKey) !== null && Number.isInteger(raw)) return clampLevel(raw);
  } catch {
    // Storage blocked: use the default.
  }
  return ZOOM.defaultLevel;
}

function clampLevel(n: number): number {
  return Math.min(ZOOM.factors.length - 1, Math.max(0, n));
}

function zoomFor(l: number): number {
  const base = Math.max(1, window.innerWidth / (RENDER.viewTilesWide * RENDER.tileSize));
  const max = Math.max(RENDER.minZoom, Math.min(RENDER.maxZoom, window.innerWidth / ZOOM.minViewWidth));
  return Math.min(max, Math.max(RENDER.minZoom, base * ZOOM.factors[l]));
}

/** Canvas pixels per game pixel: as many as the screen shows, up to RENDER.maxRenderScale. */
function renderScaleFor(zoom: number): number {
  if (forcedRender) return Math.max(1, Math.min(RENDER.maxRenderScale, forcedRender));
  return Math.max(1, Math.min(renderCap, Math.ceil(zoom * (window.devicePixelRatio || 1) - 0.05)));
}

/**
 * Zoom for the current window and step, the native size (game pixels) that fills the window
 * at it, and the canvas pixels per game pixel.
 */
export function fitView(): { zoom: number; width: number; height: number; render: number } {
  const zoom = zoomFor(level);
  render = renderScaleFor(zoom);
  return { zoom, width: Math.ceil(window.innerWidth / zoom), height: Math.ceil(window.innerHeight / zoom), render };
}

/** Canvas pixels per game pixel right now. */
export function renderScale(): number {
  return render;
}

/** The view in game pixels (scene.scale is in canvas pixels). */
export function viewSize(scene: { scale: Phaser.Scale.ScaleManager }): { width: number; height: number } {
  return { width: scene.scale.width / render, height: scene.scale.height / render };
}

/** Points a scene's camera at game pixels: zoomed by the render scale from the top-left corner. */
export function fitCamera(scene: Phaser.Scene): void {
  const cam = scene.cameras.main.setOrigin(0, 0).setZoom(render);
  // Phaser works out worldView (used for tile culling) as if the origin were the middle;
  // from the top-left corner the view starts at the scroll position.
  const patched = cam as unknown as { cornerView?: boolean; preRender: () => void };
  if (patched.cornerView) return;
  patched.cornerView = true;
  const preRender = patched.preRender.bind(cam);
  patched.preRender = () => {
    preRender();
    cam.worldView.setTo(Math.floor(cam.scrollX), Math.floor(cam.scrollY), cam.width / cam.zoom, cam.height / cam.zoom);
    cam.midPoint.set(cam.worldView.centerX, cam.worldView.centerY);
  };
}

export function applyView(): void {
  if (!game) return;
  const before = render;
  const v = fitView();
  if (v.render !== before) renderListeners.forEach((fn) => fn(v.render));
  for (const s of game.scene.getScenes(false)) if (s.cameras?.main) fitCamera(s);
  game.scale.setZoom(v.zoom / v.render);
  game.scale.resize(v.width * v.render, v.height * v.render);
}

/** Current step, 0 = furthest out. */
export function zoomLevel(): number {
  return level;
}

export function setZoomLevel(n: number): void {
  const next = clampLevel(n);
  // At the 1x floor or the narrowest view (phones) a step changes nothing on screen.
  if (next === level || zoomFor(next) === zoomFor(level)) return;
  level = next;
  try {
    localStorage.setItem(ZOOM.storageKey, String(level));
  } catch {
    // Storage blocked: the zoom just isn't remembered.
  }
  applyView();
  listeners.forEach((fn) => fn());
}

export function onZoomChange(fn: () => void): void {
  listeners.push(fn);
}

/** Called with the new canvas pixels per game pixel when the render scale changes. */
export function onRenderChange(fn: (scale: number) => void): void {
  renderListeners.push(fn);
}

/** Keyboard +/- and two-finger pinch on the canvas. */
export function installZoomControls(g: Phaser.Game): void {
  game = g;
  if (!forcedRender) watchFrameRate(g);
  window.addEventListener('resize', applyView);
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === '+' || e.key === '=') setZoomLevel(level + 1);
    else if (e.key === '-' || e.key === '_') setZoomLevel(level - 1);
  });

  let startDist = 0;
  const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  const canvas = g.canvas;
  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) startDist = dist(e.touches);
  });
  canvas.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches.length !== 2 || startDist === 0) return;
      e.preventDefault();
      const ratio = dist(e.touches) / startDist;
      if (ratio > ZOOM.pinchStep) {
        setZoomLevel(level + 1);
        startDist = dist(e.touches);
      } else if (ratio < 1 / ZOOM.pinchStep) {
        setZoomLevel(level - 1);
        startDist = dist(e.touches);
      }
    },
    { passive: false },
  );
  canvas.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) startDist = 0;
  });
}

/** If the denser canvas is too much for this device, step the render scale down (not back up). */
function watchFrameRate(g: Phaser.Game): void {
  const { warmupMs, everyMs, minFps } = RENDER.renderFallback;
  window.setTimeout(function check() {
    if (render > 1 && !document.hidden && g.loop.actualFps < minFps) {
      renderCap = render - 1;
      applyView();
    }
    if (render > 1) window.setTimeout(check, everyMs);
  }, warmupMs);
}
