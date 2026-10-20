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
};
