// Synthesised voices. Every voice schedules one note on a BaseAudioContext so
// the same code runs live and in an OfflineAudioContext (used for testing).
// All voices are deliberately soft: slow-ish attacks, filtered tops, no hard edges.

export type VoiceName = 'epiano' | 'musicBox' | 'pluck' | 'marimba' | 'bell' | 'warmPad' | 'sub' | 'steelDrum';

export interface NoteParams {
  time: number;
  midi: number;
  duration: number;
  velocity: number;
  dest: AudioNode;
  /** Optional extra send (reverb). */
  send?: AudioNode;
  sendLevel?: number;
  pan?: number;
}

export function midiToHz(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12);
}

function out(ctx: BaseAudioContext, p: NoteParams): AudioNode {
  let node: AudioNode;
  if (p.pan !== undefined && ctx.createStereoPanner) {
    const pan = ctx.createStereoPanner();
    pan.pan.value = p.pan;
    pan.connect(p.dest);
    node = pan;
  } else node = p.dest;
  if (p.send && p.sendLevel) {
    const s = ctx.createGain();
    s.gain.value = p.sendLevel;
    s.connect(p.send);
    const split = ctx.createGain();
    split.connect(node);
    split.connect(s);
    return split;
  }
  return node;
}

/** Attack / exponential decay envelope on a gain param. */
function env(g: AudioParam, t: number, peak: number, attack: number, decay: number, end: number): void {
  g.setValueAtTime(0.0001, t);
  g.linearRampToValueAtTime(peak, t + attack);
  // Time constant chosen so the tail is ~-45 dB by `end`, where the oscillator stops.
  const tau = Math.max(0.005, Math.min(decay / 4, (end - t - attack) / 5));
  g.setTargetAtTime(0.0001, t + attack, tau);
}

function osc(ctx: BaseAudioContext, type: OscillatorType, hz: number, t: number, stop: number): OscillatorNode {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(hz, t);
  o.start(t);
  o.stop(stop);
  return o;
}

/** Soft FM electric piano: sine carrier with a decaying modulator and a gentle tremolo. */
function epiano(ctx: BaseAudioContext, p: NoteParams): number {
  const hz = midiToHz(p.midi);
  const t = p.time;
  const len = Math.max(p.duration, 0.6) + 1.2;
  const end = t + len;
  const car = osc(ctx, 'sine', hz, t, end + 0.1);
  const mod = osc(ctx, 'sine', hz * 1, t, end + 0.1);
  const modGain = ctx.createGain();
  modGain.gain.setValueAtTime(hz * 1.4 * p.velocity, t);
  modGain.gain.setTargetAtTime(hz * 0.15, t, 0.12);
  mod.connect(modGain).connect(car.frequency);
  const tine = osc(ctx, 'sine', hz * 4.0, t, t + 0.4);
  const tineGain = ctx.createGain();
  env(tineGain.gain, t, 0.05 * p.velocity, 0.002, 0.15, t + 0.3);
  tine.connect(tineGain);
  const amp = ctx.createGain();
  env(amp.gain, t, 0.22 * p.velocity, 0.006, len * 0.8, end);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 2400;
  car.connect(amp);
  tineGain.connect(amp);
  amp.connect(lp).connect(out(ctx, p));
  return end;
}

/** Music box: pure tone plus an inharmonic shimmer that dies quickly. */
function musicBox(ctx: BaseAudioContext, p: NoteParams): number {
  const hz = midiToHz(p.midi);
  const t = p.time;
  const end = t + 2.2;
  const a = osc(ctx, 'sine', hz, t, end);
  const b = osc(ctx, 'sine', hz * 3.01, t, t + 0.6);
  const c = osc(ctx, 'triangle', hz * 2, t, end);
  const ga = ctx.createGain();
  const gb = ctx.createGain();
  const gc = ctx.createGain();
  env(ga.gain, t, 0.16 * p.velocity, 0.003, 1.6, end - 0.05);
  env(gb.gain, t, 0.04 * p.velocity, 0.002, 0.25, t + 0.5);
  env(gc.gain, t, 0.025 * p.velocity, 0.003, 0.8, end - 0.05);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 5000;
  const o = out(ctx, p);
  a.connect(ga).connect(lp);
  b.connect(gb).connect(lp);
  c.connect(gc).connect(lp);
  lp.connect(o);
  return end;
}

/** Nylon-ish pluck: triangle through a closing low-pass. */
function pluck(ctx: BaseAudioContext, p: NoteParams): number {
  const hz = midiToHz(p.midi);
  const t = p.time;
  const end = t + Math.max(0.5, p.duration) + 0.6;
  const a = osc(ctx, 'triangle', hz, t, end);
  const b = osc(ctx, 'sawtooth', hz * 1.002, t, end);
  const gb = ctx.createGain();
  gb.gain.value = 0.25;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 0.7;
  lp.frequency.setValueAtTime(3200, t);
  lp.frequency.setTargetAtTime(500, t, 0.12);
  const amp = ctx.createGain();
  env(amp.gain, t, 0.2 * p.velocity, 0.004, 0.9, end - 0.05);
  a.connect(lp);
  b.connect(gb).connect(lp);
  lp.connect(amp).connect(out(ctx, p));
  return end;
}

/** Marimba: woody fundamental with a short 4x overtone. */
function marimba(ctx: BaseAudioContext, p: NoteParams): number {
  const hz = midiToHz(p.midi);
  const t = p.time;
  const end = t + 0.9;
  const a = osc(ctx, 'sine', hz, t, end);
  const b = osc(ctx, 'sine', hz * 4, t, t + 0.15);
  const ga = ctx.createGain();
  const gb = ctx.createGain();
  env(ga.gain, t, 0.26 * p.velocity, 0.003, 0.5, end - 0.05);
  env(gb.gain, t, 0.06 * p.velocity, 0.001, 0.05, t + 0.12);
  const o = out(ctx, p);
  a.connect(ga).connect(o);
  b.connect(gb).connect(o);
  return end;
}

/** Steel-drum flavour: sine with slightly detuned 2x and 3x partials, quick bloom. */
function steelDrum(ctx: BaseAudioContext, p: NoteParams): number {
  const hz = midiToHz(p.midi);
  const t = p.time;
  const end = t + 1.1;
  const amp = ctx.createGain();
  env(amp.gain, t, 0.16 * p.velocity, 0.01, 0.6, end - 0.05);
  for (const [ratio, lvl] of [
    [1, 1],
    [2.01, 0.35],
    [2.98, 0.18],
  ] as const) {
    const o = osc(ctx, 'sine', hz * ratio, t, end);
    const g = ctx.createGain();
    g.gain.value = lvl;
    o.connect(g).connect(amp);
  }
  amp.connect(out(ctx, p));
  return end;
}

/** Bell: long, inharmonic partials, like a soft metallophone. */
function bell(ctx: BaseAudioContext, p: NoteParams): number {
  const hz = midiToHz(p.midi);
  const t = p.time;
  const end = t + 3.5;
  const amp = ctx.createGain();
  env(amp.gain, t, 0.12 * p.velocity, 0.004, 2.6, end - 0.05);
  for (const [ratio, lvl] of [
    [1, 1],
    [2.76, 0.3],
    [5.4, 0.08],
  ] as const) {
    const o = osc(ctx, 'sine', hz * ratio, t, end);
    const g = ctx.createGain();
    g.gain.value = lvl;
    o.connect(g).connect(amp);
  }
  amp.connect(out(ctx, p));
  return end;
}

/** Warm pad: detuned triangle + filtered saw, slow attack and release. */
function warmPad(ctx: BaseAudioContext, p: NoteParams): number {
  const hz = midiToHz(p.midi);
  const t = p.time;
  const attack = Math.min(1.2, p.duration * 0.4);
  const release = 1.6;
  const end = t + p.duration + release;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 900;
  lp.Q.value = 0.3;
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.linearRampToValueAtTime(0.06 * p.velocity, t + attack);
  amp.gain.setValueAtTime(0.06 * p.velocity, t + p.duration);
  amp.gain.linearRampToValueAtTime(0.0001, end);
  for (const [type, det, lvl] of [
    ['triangle', -6, 1],
    ['triangle', 6, 1],
    ['sawtooth', 0, 0.25],
  ] as const) {
    const o = osc(ctx, type, hz, t, end + 0.05);
    o.detune.value = det;
    const g = ctx.createGain();
    g.gain.value = lvl;
    o.connect(g).connect(lp);
  }
  lp.connect(amp).connect(out(ctx, p));
  return end;
}

/** Gentle sub bass: sine with a touch of second harmonic. */
function sub(ctx: BaseAudioContext, p: NoteParams): number {
  const hz = midiToHz(p.midi);
  const t = p.time;
  const end = t + p.duration + 0.25;
  const a = osc(ctx, 'sine', hz, t, end);
  const b = osc(ctx, 'sine', hz * 2, t, end);
  const gb = ctx.createGain();
  gb.gain.value = 0.12;
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.linearRampToValueAtTime(0.22 * p.velocity, t + 0.03);
  amp.gain.setTargetAtTime(0.13 * p.velocity, t + 0.03, 0.3);
  amp.gain.setValueAtTime(0.13 * p.velocity, t + p.duration);
  amp.gain.linearRampToValueAtTime(0.0001, end);
  a.connect(amp);
  b.connect(gb).connect(amp);
  amp.connect(out(ctx, p));
  return end;
}

export const VOICES: Record<VoiceName, (ctx: BaseAudioContext, p: NoteParams) => number> = {
  epiano,
  musicBox,
  pluck,
  marimba,
  bell,
  warmPad,
  sub,
  steelDrum,
};

// ---------------------------------------------------------------------------
// Drums and noise

const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>();

export function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  let b = noiseCache.get(ctx);
  if (!b) {
    const len = Math.floor(ctx.sampleRate * 2);
    b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0);
    let seed = 12345;
    for (let i = 0; i < len; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      d[i] = (seed / 0x7fffffff) * 2 - 1;
    }
    noiseCache.set(ctx, b);
  }
  return b;
}

export function noiseSource(ctx: BaseAudioContext, t: number, dur: number, loop = false): AudioBufferSourceNode {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuffer(ctx);
  s.loop = loop;
  s.start(t, Math.random() * 1.5);
  if (!loop) s.stop(t + dur);
  return s;
}

/** Muted kick: a short pitch-dropping sine, low-passed. */
export function kick(ctx: BaseAudioContext, t: number, vel: number, dest: AudioNode): void {
  const o = osc(ctx, 'sine', 110, t, t + 0.3);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.42 * vel, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 300;
  o.connect(g).connect(lp).connect(dest);
}

/** Brushed hi-hat: band-passed noise with a soft swish attack. */
export function brushHat(ctx: BaseAudioContext, t: number, vel: number, dest: AudioNode, long = false): void {
  const dur = long ? 0.22 : 0.09;
  const n = noiseSource(ctx, t, dur + 0.02);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 6500;
  bp.Q.value = 0.6;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 3000;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.05 * vel, t + (long ? 0.03 : 0.008));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  n.connect(bp).connect(hp).connect(g).connect(dest);
}

/** Soft rim / shaker tick for lighter grooves. */
export function shaker(ctx: BaseAudioContext, t: number, vel: number, dest: AudioNode): void {
  const n = noiseSource(ctx, t, 0.06);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 9000;
  bp.Q.value = 1.2;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.035 * vel, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  n.connect(bp).connect(g).connect(dest);
}

/** Generated stereo impulse response for the shared reverb. */
export function makeImpulse(ctx: BaseAudioContext, seconds: number, decay: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let seed = 777 + ch * 31;
    for (let i = 0; i < len; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const r = (seed / 0x7fffffff) * 2 - 1;
      d[i] = r * Math.pow(1 - i / len, decay);
    }
  }
  return buf;
}
