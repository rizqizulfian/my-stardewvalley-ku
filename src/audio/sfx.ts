// Synthesised sound effects. Each takes a pitch ratio so the manager can add
// small random variation. Later, any entry can be replaced by a sample.

import type { Surface } from '../data/terrain';
import { noiseSource } from './instruments';

export type SfxFn = (ctx: BaseAudioContext, dest: AudioNode, t: number, pitch: number) => void;

function burst(
  ctx: BaseAudioContext,
  dest: AudioNode,
  t: number,
  o: { type: BiquadFilterType; freq: number; q: number; dur: number; gain: number; attack?: number; sweepTo?: number },
): void {
  const n = noiseSource(ctx, t, o.dur + 0.02);
  const f = ctx.createBiquadFilter();
  f.type = o.type;
  f.frequency.setValueAtTime(o.freq, t);
  if (o.sweepTo) f.frequency.exponentialRampToValueAtTime(o.sweepTo, t + o.dur);
  f.Q.value = o.q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(o.gain, t + (o.attack ?? 0.004));
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  n.connect(f).connect(g).connect(dest);
}

function thump(ctx: BaseAudioContext, dest: AudioNode, t: number, hz: number, toHz: number, dur: number, gain: number, type: OscillatorType = 'sine'): void {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(hz, t);
  o.frequency.exponentialRampToValueAtTime(toHz, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export const FOOTSTEPS: Record<Surface, SfxFn> = {
  grass: (ctx, d, t, p) => {
    burst(ctx, d, t, { type: 'bandpass', freq: 2600 * p, q: 0.8, dur: 0.07, gain: 0.07, attack: 0.008 });
    burst(ctx, d, t + 0.025, { type: 'highpass', freq: 4000 * p, q: 0.5, dur: 0.05, gain: 0.025 });
  },
  dirt: (ctx, d, t, p) => {
    burst(ctx, d, t, { type: 'lowpass', freq: 1300 * p, q: 0.7, dur: 0.06, gain: 0.12 });
    thump(ctx, d, t, 110 * p, 70 * p, 0.05, 0.06);
  },
  sand: (ctx, d, t, p) => {
    burst(ctx, d, t, { type: 'bandpass', freq: 3200 * p, q: 0.7, dur: 0.11, gain: 0.06, attack: 0.02, sweepTo: 1400 * p });
  },
  wood: (ctx, d, t, p) => {
    thump(ctx, d, t, 190 * p, 120 * p, 0.08, 0.12, 'triangle');
    burst(ctx, d, t, { type: 'bandpass', freq: 1500 * p, q: 2, dur: 0.03, gain: 0.05 });
  },
  stone: (ctx, d, t, p) => {
    burst(ctx, d, t, { type: 'bandpass', freq: 4200 * p, q: 1.5, dur: 0.03, gain: 0.07 });
    thump(ctx, d, t, 320 * p, 260 * p, 0.03, 0.035);
  },
};

/** A soft sine/triangle note with a quick attack and exponential tail. */
function tone(ctx: BaseAudioContext, dest: AudioNode, t: number, hz: number, dur: number, gain: number, type: OscillatorType = 'sine', attack = 0.006): void {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(hz, t);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + dur + 0.02);
}

const semi = (hz: number, s: number) => hz * Math.pow(2, s / 12);

export const SFX: Record<string, SfxFn> = {
  uiClick: (ctx, d, t, p) => {
    thump(ctx, d, t, 880 * p, 660 * p, 0.05, 0.06, 'triangle');
  },
  uiHover: (ctx, d, t, p) => {
    thump(ctx, d, t, 1320 * p, 1200 * p, 0.03, 0.025, 'sine');
  },
  start: (ctx, d, t, p) => {
    [0, 4, 7, 11].forEach((s, i) => thump(ctx, d, t + i * 0.09, 523 * p * Math.pow(2, s / 12), 523 * p * Math.pow(2, s / 12), 0.6, 0.05, 'sine'));
  },
  select: (ctx, d, t, p) => {
    thump(ctx, d, t, 1500 * p, 1380 * p, 0.03, 0.03, 'triangle');
  },
  menuOpen: (ctx, d, t, p) => {
    tone(ctx, d, t, 660 * p, 0.09, 0.045, 'triangle');
    tone(ctx, d, t + 0.06, 990 * p, 0.12, 0.04, 'triangle');
  },
  menuClose: (ctx, d, t, p) => {
    tone(ctx, d, t, 880 * p, 0.08, 0.04, 'triangle');
    tone(ctx, d, t + 0.05, 587 * p, 0.12, 0.035, 'triangle');
  },
  // Tools ------------------------------------------------------------------
  swing: (ctx, d, t, p) => {
    burst(ctx, d, t, { type: 'bandpass', freq: 500 * p, q: 1.2, dur: 0.15, gain: 0.09, attack: 0.05, sweepTo: 1400 * p });
  },
  swish: (ctx, d, t, p) => {
    burst(ctx, d, t, { type: 'bandpass', freq: 700 * p, q: 1.4, dur: 0.17, gain: 0.1, attack: 0.04, sweepTo: 2300 * p });
  },
  hoe: (ctx, d, t, p) => {
    thump(ctx, d, t, 150 * p, 60 * p, 0.09, 0.16);
    burst(ctx, d, t, { type: 'lowpass', freq: 900 * p, q: 0.8, dur: 0.12, gain: 0.2 });
    burst(ctx, d, t + 0.045, { type: 'bandpass', freq: 2200 * p, q: 0.9, dur: 0.07, gain: 0.05 });
  },
  water: (ctx, d, t, p) => {
    burst(ctx, d, t, { type: 'bandpass', freq: 2000 * p, q: 1.1, dur: 0.42, gain: 0.08, attack: 0.06, sweepTo: 900 * p });
    burst(ctx, d, t + 0.05, { type: 'lowpass', freq: 700 * p, q: 0.7, dur: 0.35, gain: 0.05, attack: 0.05 });
    for (let i = 0; i < 4; i++) {
      const at = t + 0.06 + i * 0.07 + Math.random() * 0.03;
      const hz = (500 + Math.random() * 400) * p;
      thump(ctx, d, at, hz, hz * 1.6, 0.05, 0.018);
    }
  },
  refill: (ctx, d, t, p) => {
    burst(ctx, d, t, { type: 'lowpass', freq: 650 * p, q: 0.8, dur: 0.55, gain: 0.08, attack: 0.05 });
    for (let i = 0; i < 6; i++) {
      const at = t + i * 0.075 + Math.random() * 0.02;
      const hz = (380 + i * 70 + Math.random() * 60) * p;
      thump(ctx, d, at, hz, hz * 1.8, 0.06, 0.035);
    }
  },
  canEmpty: (ctx, d, t, p) => {
    tone(ctx, d, t, 1180 * p, 0.12, 0.035);
    tone(ctx, d, t, 1770 * p, 0.07, 0.015);
    thump(ctx, d, t, 220 * p, 160 * p, 0.06, 0.05, 'triangle');
  },
  plant: (ctx, d, t, p) => {
    thump(ctx, d, t, 320 * p, 170 * p, 0.08, 0.1);
    burst(ctx, d, t, { type: 'lowpass', freq: 1400 * p, q: 0.7, dur: 0.06, gain: 0.06 });
  },
  harvest: (ctx, d, t, p) => {
    thump(ctx, d, t, 480 * p, 260 * p, 0.07, 0.09, 'triangle');
    burst(ctx, d, t, { type: 'bandpass', freq: 2600 * p, q: 1, dur: 0.06, gain: 0.05 });
    tone(ctx, d, t + 0.07, semi(784, 0) * p, 0.25, 0.035);
    tone(ctx, d, t + 0.13, semi(784, 7) * p, 0.3, 0.03);
  },
  chop: (ctx, d, t, p) => {
    thump(ctx, d, t, 270 * p, 130 * p, 0.11, 0.2, 'triangle');
    burst(ctx, d, t, { type: 'bandpass', freq: 1300 * p, q: 2.5, dur: 0.06, gain: 0.12 });
    burst(ctx, d, t + 0.01, { type: 'highpass', freq: 3000 * p, q: 0.7, dur: 0.03, gain: 0.04 });
  },
  woodBreak: (ctx, d, t, p) => {
    thump(ctx, d, t, 200 * p, 80 * p, 0.2, 0.2, 'triangle');
    [0, 0.05, 0.11].forEach((o, i) => burst(ctx, d, t + o, { type: 'bandpass', freq: (1600 - i * 300) * p, q: 1.8, dur: 0.07, gain: 0.1 - i * 0.025 }));
  },
  clink: (ctx, d, t, p) => {
    burst(ctx, d, t, { type: 'bandpass', freq: 3600 * p, q: 2, dur: 0.035, gain: 0.12 });
    tone(ctx, d, t, 1650 * p, 0.14, 0.04);
    tone(ctx, d, t, 2490 * p, 0.08, 0.02);
    thump(ctx, d, t, 210 * p, 120 * p, 0.05, 0.08);
  },
  crumble: (ctx, d, t, p) => {
    thump(ctx, d, t, 130 * p, 50 * p, 0.18, 0.16);
    [0, 0.035, 0.08, 0.13].forEach((o, i) =>
      burst(ctx, d, t + o, { type: 'lowpass', freq: (1500 - i * 250) * p, q: 0.8, dur: 0.08, gain: 0.14 - i * 0.03 }),
    );
  },
  rustle: (ctx, d, t, p) => {
    burst(ctx, d, t, { type: 'bandpass', freq: 2100 * p, q: 1.1, dur: 0.12, gain: 0.09, attack: 0.01 });
    burst(ctx, d, t + 0.04, { type: 'bandpass', freq: 1400 * p, q: 1.1, dur: 0.1, gain: 0.06 });
  },
  leaves: (ctx, d, t, p) => {
    burst(ctx, d, t, { type: 'bandpass', freq: 1800 * p, q: 1, dur: 0.35, gain: 0.07, attack: 0.04, sweepTo: 1100 * p });
  },
  bonk: (ctx, d, t, p) => {
    thump(ctx, d, t, 170 * p, 120 * p, 0.09, 0.12, 'triangle');
    burst(ctx, d, t, { type: 'lowpass', freq: 800 * p, q: 1, dur: 0.05, gain: 0.06 });
  },
  pickup: (ctx, d, t, p) => {
    thump(ctx, d, t, 880 * p, 1320 * p, 0.07, 0.05);
  },
  door: (ctx, d, t, p) => {
    // Latch, a short wooden creak, then the door settling.
    burst(ctx, d, t, { type: 'bandpass', freq: 2400 * p, q: 3, dur: 0.03, gain: 0.05 });
    burst(ctx, d, t + 0.04, { type: 'bandpass', freq: 700 * p, q: 6, dur: 0.22, gain: 0.05, attack: 0.05, sweepTo: 520 * p });
    thump(ctx, d, t + 0.2, 140 * p, 90 * p, 0.1, 0.1, 'triangle');
  },
  whoosh: (ctx, d, t, p) => {
    burst(ctx, d, t, { type: 'bandpass', freq: 500 * p, q: 0.7, dur: 0.3, gain: 0.06, attack: 0.12, sweepTo: 1200 * p });
  },
};
