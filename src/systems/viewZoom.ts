// Player-chosen camera zoom. The default fits RENDER.viewTilesWide tiles
// across the window (never below 1x, so phones keep their framing); the
// player scales that up or down in steps with +/-, a two-finger pinch, or
// the Zoom row in Settings. The chosen step is remembered in localStorage.

import type Phaser from 'phaser';
import { RENDER, ZOOM } from '../config';

let level = load();
let game: Phaser.Game | undefined;
const listeners: Array<() => void> = [];

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

/** Zoom for the current window and step, plus the native size that fills the window at it. */
export function fitView(): { zoom: number; width: number; height: number } {
  const zoom = zoomFor(level);
  return { zoom, width: Math.ceil(window.innerWidth / zoom), height: Math.ceil(window.innerHeight / zoom) };
}

export function applyView(): void {
  if (!game) return;
  const v = fitView();
  game.scale.setZoom(v.zoom);
  game.scale.resize(v.width, v.height);
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

/** Keyboard +/- and two-finger pinch on the canvas. */
export function installZoomControls(g: Phaser.Game): void {
  game = g;
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
