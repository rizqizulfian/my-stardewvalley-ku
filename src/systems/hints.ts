// "Wrong tool" hints: a soft nope and a short line on what would work instead.
// Holding the use button retries every frame, so both are throttled.

import { audio } from '../audio/AudioManager';
import { EV, bus } from './events';

/** The same line is not repeated within this window. */
const REPEAT_MS = 2200;
/** The "nope" sound plays at most this often. */
const SFX_MS = 600;

let lastMsg = '';
let lastMsgAt = -Infinity;
let lastSfxAt = -Infinity;

export function hint(msg: string): void {
  const now = performance.now();
  if (now - lastSfxAt >= SFX_MS) {
    audio.playSfx('nope', 0.6);
    lastSfxAt = now;
  }
  if (msg === lastMsg && now - lastMsgAt < REPEAT_MS) return;
  lastMsg = msg;
  lastMsgAt = now;
  bus.emit(EV.notice, msg);
}
