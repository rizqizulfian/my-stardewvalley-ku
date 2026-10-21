// Ambience layers mixed under the music. Each layer owns a gain node and
// either a continuous noise bed (wind, water) or scheduled events (birds,
// crickets). Levels glide; nothing starts or stops abruptly.

import type { AmbienceLayerId } from '../data/ambience';
import { noiseSource } from './instruments';

export interface AmbienceLayer {
  readonly id: AmbienceLayerId;
  readonly gain: GainNode;
  /** Schedule events up to `horizon`. */
  schedule(now: number, horizon: number): void;
  setLevel(level: number, now: number, glide: number): void;
}

abstract class BaseLayer implements AmbienceLayer {
  readonly gain: GainNode;
  protected level = 0;

  constructor(
    readonly id: AmbienceLayerId,
    protected readonly ctx: BaseAudioContext,
    dest: AudioNode,
    protected readonly reverb?: AudioNode,
  ) {
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    this.gain.connect(dest);
  }

  setLevel(level: number, now: number, glide: number): void {
    if (Math.abs(level - this.level) < 0.002) return;
    this.level = level;
    this.gain.gain.cancelScheduledValues(now);
    this.gain.gain.setTargetAtTime(level, now, glide / 3);
  }

  schedule(_now: number, _horizon: number): void {}
}

/** Short melodic chirps from a few virtual birds, each with its own song shape. */
class Birds extends BaseLayer {
  private next = 0;
  private readonly birds = [
    { base: 3200, spread: 900, notes: [2, 4], gap: 0.09 },
    { base: 4400, spread: 600, notes: [3, 6], gap: 0.06 },
    { base: 2500, spread: 500, notes: [1, 3], gap: 0.16 },
  ];

  schedule(now: number, horizon: number): void {
    if (this.next < now) this.next = now + 0.5;
    while (this.next < horizon) {
      if (this.level > 0.02) this.song(this.next);
      // Fewer songs when quiet.
      this.next += 0.8 + Math.random() * (3.5 - this.level * 2);
    }
  }

  private song(t: number): void {
    const ctx = this.ctx;
    const b = this.birds[Math.floor(Math.random() * this.birds.length)];
    const count = b.notes[0] + Math.floor(Math.random() * (b.notes[1] - b.notes[0] + 1));
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.random() * 1.6 - 0.8;
    pan.connect(this.gain);
    if (this.reverb) {
      const s = ctx.createGain();
      s.gain.value = 0.5;
      pan.connect(s).connect(this.reverb);
    }
    const f0 = b.base + (Math.random() - 0.5) * b.spread;
    for (let i = 0; i < count; i++) {
      const st = t + i * (b.gap + Math.random() * 0.03);
      const o = ctx.createOscillator();
      o.type = 'sine';
      const up = Math.random() < 0.5;
      o.frequency.setValueAtTime(f0 * (up ? 0.8 : 1.15), st);
      o.frequency.exponentialRampToValueAtTime(f0 * (up ? 1.2 : 0.85), st + 0.05);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, st);
      g.gain.linearRampToValueAtTime(0.05, st + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, st + 0.07);
      o.connect(g).connect(pan);
      o.start(st);
      o.stop(st + 0.09);
    }
  }
}

/** Two crickets at different pitches, chirping in pulse trains. */
class Crickets extends BaseLayer {
  private next = [0, 0];
  private readonly voices = [
    { hz: 4300, pulses: 3, period: 0.75, pan: -0.5 },
    { hz: 4900, pulses: 4, period: 0.92, pan: 0.45 },
  ];

  schedule(now: number, horizon: number): void {
    this.voices.forEach((v, i) => {
      if (this.next[i] < now) this.next[i] = now + Math.random() * v.period;
      while (this.next[i] < horizon) {
        if (this.level > 0.02) this.chirp(this.next[i], v);
        this.next[i] += v.period * (0.9 + Math.random() * 0.25);
      }
    });
  }

  private chirp(t: number, v: { hz: number; pulses: number; pan: number }): void {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = v.hz;
    const g = ctx.createGain();
    g.gain.value = 0;
    for (let p = 0; p < v.pulses; p++) {
      const st = t + p * 0.045;
      g.gain.setValueAtTime(0, st);
      g.gain.linearRampToValueAtTime(0.02, st + 0.008);
      g.gain.linearRampToValueAtTime(0, st + 0.03);
    }
    const pan = ctx.createStereoPanner();
    pan.pan.value = v.pan;
    o.connect(g).connect(pan).connect(this.gain);
    o.start(t);
    o.stop(t + v.pulses * 0.045 + 0.05);
  }
}

/** Filtered noise bed with slow drifting colour and swell. */
class NoiseBed extends BaseLayer {
  private readonly filter: BiquadFilterNode;
  private readonly swell: GainNode;
  private nextDrift = 0;

  constructor(
    id: AmbienceLayerId,
    ctx: BaseAudioContext,
    dest: AudioNode,
    private readonly opts: { freq: number; q: number; gain: number; drift: number; swell: number; period: number },
  ) {
    super(id, ctx, dest);
    const src = noiseSource(ctx, ctx.currentTime, 0, true);
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'bandpass';
    this.filter.frequency.value = opts.freq;
    this.filter.Q.value = opts.q;
    this.swell = ctx.createGain();
    this.swell.gain.value = opts.gain;
    src.connect(this.filter).connect(this.swell).connect(this.gain);
  }

  schedule(now: number, horizon: number): void {
    if (this.nextDrift > horizon) return;
    const t = Math.max(now, this.nextDrift);
    const p = this.opts.period * (0.7 + Math.random() * 0.6);
    this.filter.frequency.setTargetAtTime(this.opts.freq * (1 + (Math.random() - 0.5) * this.opts.drift), t, p / 3);
    this.swell.gain.setTargetAtTime(this.opts.gain * (1 - this.opts.swell + Math.random() * this.opts.swell), t, p / 3);
    this.nextDrift = t + p;
  }
}

/** Sea: a low surf bed plus waves that roll in, break and wash back out. */
class Waves extends BaseLayer {
  private next = 0;

  constructor(id: AmbienceLayerId, ctx: BaseAudioContext, dest: AudioNode, reverb?: AudioNode) {
    super(id, ctx, dest, reverb);
    const bed = noiseSource(ctx, ctx.currentTime, 0, true);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 260;
    const g = ctx.createGain();
    g.gain.value = 0.05;
    bed.connect(lp).connect(g).connect(this.gain);
  }

  schedule(now: number, horizon: number): void {
    if (this.next < now) this.next = now + 0.3;
    while (this.next < horizon) {
      if (this.level > 0.02) this.wave(this.next);
      this.next += 5.5 + Math.random() * 3.5;
    }
  }

  private wave(t: number): void {
    const ctx = this.ctx;
    const rise = 1.8 + Math.random() * 0.8;
    const wash = 3.2 + Math.random() * 1.5;
    const peak = 0.07 + Math.random() * 0.04;
    const n = noiseSource(ctx, t, rise + wash + 0.2);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 0.4;
    lp.frequency.setValueAtTime(320, t);
    lp.frequency.exponentialRampToValueAtTime(1500 + Math.random() * 500, t + rise);
    lp.frequency.exponentialRampToValueAtTime(420, t + rise + wash);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + rise);
    g.gain.exponentialRampToValueAtTime(0.0001, t + rise + wash);
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.random() * 0.8 - 0.4;
    n.connect(lp).connect(g).connect(pan).connect(this.gain);
  }
}

/** Distant gulls: a few gliding cries, then quiet for a while. */
class Gulls extends BaseLayer {
  private next = 0;

  schedule(now: number, horizon: number): void {
    if (this.next < now) this.next = now + 2 + Math.random() * 4;
    while (this.next < horizon) {
      if (this.level > 0.05) this.call(this.next);
      this.next += 6 + Math.random() * (14 - this.level * 6);
    }
  }

  private call(t: number): void {
    const ctx = this.ctx;
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.random() * 1.4 - 0.7;
    pan.connect(this.gain);
    if (this.reverb) {
      const s = ctx.createGain();
      s.gain.value = 0.7;
      pan.connect(s).connect(this.reverb);
    }
    const f0 = 1150 + Math.random() * 250;
    const cries = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < cries; i++) {
      const st = t + i * (0.24 + Math.random() * 0.08);
      const len = i === cries - 1 ? 0.3 : 0.17;
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(f0 * 0.82, st);
      o.frequency.linearRampToValueAtTime(f0 * 1.3, st + len * 0.3);
      o.frequency.exponentialRampToValueAtTime(f0 * 0.75, st + len);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f0 * 1.4;
      bp.Q.value = 1.2;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, st);
      g.gain.linearRampToValueAtTime(0.035, st + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, st + len);
      o.connect(bp).connect(g).connect(pan);
      o.start(st);
      o.stop(st + len + 0.02);
    }
  }
}

export function createAmbienceLayers(ctx: BaseAudioContext, dest: AudioNode, reverb?: AudioNode): AmbienceLayer[] {
  return [
    new Birds('birds', ctx, dest, reverb),
    new Crickets('crickets', ctx, dest, reverb),
    new NoiseBed('wind', ctx, dest, { freq: 480, q: 0.6, gain: 0.09, drift: 0.8, swell: 0.7, period: 4 }),
    new NoiseBed('water', ctx, dest, { freq: 900, q: 0.9, gain: 0.05, drift: 0.5, swell: 0.6, period: 1.6 }),
    new Waves('waves', ctx, dest, reverb),
    new Gulls('gulls', ctx, dest, reverb),
  ];
}
