// A generative track: a small step sequencer that plays a chord progression
// with pad, keys, bass, soft drums and a melody built from repeating,
// slowly mutating motifs. Runs on any BaseAudioContext.

import type { GenerativeTrackDef } from '../data/music';
import { VOICES, brushHat, kick, noiseSource, shaker } from './instruments';
import { SCALES, isChordTone, midiOf, noteIndex, parseChord, scaleNotes, voiceChord, type Chord } from './theory';

export interface MusicSource {
  readonly output: GainNode;
  start(at: number): void;
  /** Called by the scheduler; schedules every event up to `horizon` seconds. */
  scheduleUntil(horizon: number): void;
  stop(at: number): void;
  readonly stopped: boolean;
}

const STEPS_PER_BAR = 16;

interface MotifNote {
  slot: number; // eighth-note slot within the motif
  degree: number; // index into the melody scale
  len: number; // in eighths
  vel: number;
}

function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class GenerativeTrack implements MusicSource {
  readonly output: GainNode;
  private readonly bus: AudioNode;
  private readonly chords: Chord[];
  private readonly melodyScale: number[];
  private readonly rand: () => number;
  private readonly stepDur: number;
  private nextTime = 0;
  private step = 0;
  private stopAt = Infinity;
  private _stopped = false;
  private motif: MotifNote[] = [];
  private motifVariant: MotifNote[] = [];
  private lastDegree: number;
  private crackleNode?: AudioBufferSourceNode;

  constructor(
    private readonly ctx: BaseAudioContext,
    private readonly def: GenerativeTrackDef,
    destination: AudioNode,
    private readonly reverbIn?: AudioNode,
  ) {
    this.output = ctx.createGain();
    this.output.gain.value = 0.0001;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = def.lowpass;
    lp.Q.value = 0.4;
    lp.connect(this.output);
    this.output.connect(destination);
    this.bus = lp;
    this.chords = def.progression.map(parseChord);
    this.rand = seeded(def.seed);
    this.stepDur = 60 / def.bpm / 4;
    const key = noteIndex(def.key);
    const mel = def.melody;
    this.melodyScale = scaleNotes(key, SCALES[def.scale], mel ? mel.octave - 1 : 4, 3);
    this.lastDegree = Math.floor(this.melodyScale.length / 2);
    this.newMotif(true);
  }

  get stopped(): boolean {
    return this._stopped;
  }

  start(at: number): void {
    this.nextTime = at + 0.05;
    this.step = 0;
    if (this.def.vinyl > 0) this.startVinyl(at);
  }

  stop(at: number): void {
    this.stopAt = at;
    this.crackleNode?.stop(at + 0.1);
  }

  scheduleUntil(horizon: number): void {
    while (this.nextTime < horizon) {
      if (this.nextTime >= this.stopAt) {
        this._stopped = true;
        return;
      }
      this.scheduleStep(this.step, this.nextTime);
      this.step++;
      this.nextTime += this.stepDur;
    }
  }

  // -------------------------------------------------------------------------

  private time(step: number, base: number): number {
    // Swing the off-beat eighths, plus a tiny human timing wobble.
    const swing = step % 4 === 2 ? this.def.swing * this.stepDur * 2 : 0;
    return base + swing + (this.rand() - 0.5) * 0.008;
  }

  private chordAt(bar: number): Chord {
    return this.chords[Math.floor(bar / this.def.barsPerChord) % this.chords.length];
  }

  private play(voice: keyof typeof VOICES, midi: number, t: number, dur: number, vel: number, gain: number, pan = 0): void {
    VOICES[voice](this.ctx, {
      time: t,
      midi,
      duration: dur,
      velocity: vel * gain,
      dest: this.bus,
      send: this.reverbIn,
      sendLevel: this.def.reverb,
      pan,
    });
  }

  private scheduleStep(step: number, base: number): void {
    const def = this.def;
    const bar = Math.floor(step / STEPS_PER_BAR);
    const s = step % STEPS_PER_BAR;
    const chord = this.chordAt(bar);
    const t = this.time(s, base);
    const beat = this.stepDur * 4;
    const barStartOfChord = bar % def.barsPerChord === 0 && s === 0;

    // Pad: the whole chord, held for the length of the chord.
    if (def.pad && barStartOfChord) {
      const dur = def.barsPerChord * beat * 4;
      for (const n of voiceChord(chord, def.pad.octave)) this.play(def.pad.voice, n, base, dur, 0.8, def.pad.gain);
    }

    // Keys.
    if (def.chords) {
      const c = def.chords;
      const notes = voiceChord(chord, c.octave);
      if (c.style === 'block') {
        if ((s === 0 || (s === 10 && this.rand() < c.density)) && !(s === 10 && bar % 4 === 3)) {
          notes.forEach((n, i) => this.play(c.voice, n, t + i * 0.012, beat * 1.5, s === 0 ? 0.75 : 0.5, c.gain));
        }
      } else if (c.style === 'arp') {
        if (s % 2 === 0 && (s === 0 || this.rand() < c.density)) {
          const order = [0, 1, 2, 3, 2, 1, 3, 1];
          const n = notes[order[(s / 2) % order.length] % notes.length];
          this.play(c.voice, n + (s >= 8 && this.rand() < 0.2 ? 12 : 0), t, beat, 0.45 + this.rand() * 0.2, c.gain);
        }
      } else {
        const hits = [0, 3, 6, 8, 11, 14];
        const idx = hits.indexOf(s);
        if (idx >= 0 && (s === 0 || this.rand() < c.density)) {
          const n = notes[(idx * 2) % notes.length];
          this.play(c.voice, n, t, beat * 1.2, 0.4 + this.rand() * 0.2, c.gain);
        }
      }
    }

    // Bass.
    if (def.bass) {
      const b = def.bass;
      const root = midiOf(chord.root, b.octave);
      const fifth = root + 7;
      if (s === 0) this.play(b.voice, root, t, beat * 1.6, 0.9, b.gain);
      if (b.style === 'rootFifth' && s === 8) this.play(b.voice, this.rand() < 0.6 ? fifth : root, t, beat * 1.2, 0.7, b.gain);
      if (b.style === 'root' && s === 10 && this.rand() < 0.4) this.play(b.voice, root, t, beat * 0.8, 0.55, b.gain);
      if (b.style === 'pulse' && s % 4 === 0 && s > 0) this.play(b.voice, root, t, beat * 0.6, 0.55, b.gain);
    }

    // Drums.
    if (def.drums) this.drums(s, t, bar);

    // Melody: motif slots are eighths, so only even steps.
    if (def.melody && s % 2 === 0) this.melodyStep(bar, s, t, chord);

    // Vinyl crackle pops.
    if (def.vinyl > 0 && this.rand() < def.vinyl * 0.12) this.pop(base + this.rand() * this.stepDur);
  }

  private pop(t: number): void {
    const ctx = this.ctx;
    const n = noiseSource(ctx, t, 0.012);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.012 * (0.3 + this.rand()), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.01);
    n.connect(hp).connect(g).connect(this.output);
  }

  private drums(s: number, t: number, bar: number): void {
    const d = this.def.drums!;
    const ctx = this.ctx;
    if (d.pattern === 'lofi') {
      if (d.kick > 0 && (s === 0 || s === 10 || (s === 7 && this.rand() < 0.25))) kick(ctx, t, d.kick * (s === 0 ? 1 : 0.75), this.bus);
      if (d.hat > 0 && s % 2 === 0) brushHat(ctx, t, d.hat * (s % 4 === 0 ? 0.6 : 1) * (0.8 + this.rand() * 0.3), this.bus);
      if (d.hat > 0 && (s === 4 || s === 12)) brushHat(ctx, t, d.hat * 0.9, this.bus, true);
      if (d.shaker > 0 && s % 2 === 1 && this.rand() < 0.5) shaker(ctx, t, d.shaker, this.bus);
    } else if (d.pattern === 'brush') {
      if (d.kick > 0 && (s === 0 || (s === 8 && bar % 2 === 1))) kick(ctx, t, d.kick, this.bus);
      if (d.hat > 0 && (s === 4 || s === 12)) brushHat(ctx, t, d.hat, this.bus, true);
      if (d.hat > 0 && s % 4 === 2 && this.rand() < 0.6) brushHat(ctx, t, d.hat * 0.5, this.bus);
    } else {
      if (d.hat > 0 && s % 4 === 0 && this.rand() < 0.8) brushHat(ctx, t, d.hat * 0.7, this.bus);
      if (d.shaker > 0 && s % 4 === 2 && this.rand() < 0.5) shaker(ctx, t, d.shaker, this.bus);
      if (d.kick > 0 && s === 0 && bar % 2 === 0) kick(ctx, t, d.kick, this.bus);
    }
  }

  // -------------------------------------------------------------------------
  // Melody: motif A, A, A', rest-ish ... then evolve.

  private newMotif(fresh: boolean): void {
    const m = this.def.melody;
    if (!m) return;
    const slots = m.motifBars * 8;
    const keep = fresh ? [] : this.motif.filter(() => this.rand() < 0.5);
    const notes: MotifNote[] = [...keep];
    let degree = this.lastDegree;
    const center = Math.floor(this.melodyScale.length / 2);
    for (let slot = 0; slot < slots; slot++) {
      if (notes.some((n) => n.slot === slot)) continue;
      const strong = slot % 4 === 0;
      const p = m.density * (strong ? 1.3 : 0.8);
      // Leave the end of each motif as a breath.
      if (slot >= slots - 2 || this.rand() > p) continue;
      const r = this.rand();
      const stepSize = r < 0.15 ? 0 : r < 0.65 ? 1 : r < 0.9 ? 2 : 3;
      const dir = degree > center + m.range / 2 ? -1 : degree < center - m.range / 2 ? 1 : this.rand() < 0.5 ? -1 : 1;
      degree = Math.max(0, Math.min(this.melodyScale.length - 1, degree + stepSize * dir));
      notes.push({ slot, degree, len: 1 + Math.floor(this.rand() * 3), vel: 0.6 + this.rand() * 0.35 });
    }
    notes.sort((a, b) => a.slot - b.slot);
    this.motif = notes;
    this.lastDegree = degree;
    this.motifVariant = notes.map((n) =>
      this.rand() < 0.3 ? { ...n, degree: Math.max(0, Math.min(this.melodyScale.length - 1, n.degree + (this.rand() < 0.5 ? -1 : 1))) } : n,
    );
  }

  private melodyStep(bar: number, s: number, t: number, chord: Chord): void {
    const m = this.def.melody!;
    const phraseBars = m.motifBars * 4;
    const inPhrase = bar % phraseBars;
    const rep = Math.floor(inPhrase / m.motifBars); // 0..3
    if (inPhrase === 0 && s === 0 && bar > 0) this.newMotif(false);
    // Fourth repetition is a rest, so phrases breathe.
    if (rep === 3) return;
    const slot = (inPhrase % m.motifBars) * 8 + s / 2;
    const motif = rep === 2 ? this.motifVariant : this.motif;
    const note = motif.find((n) => n.slot === slot);
    if (!note) return;
    let midi = this.melodyScale[note.degree];
    // On strong beats, lean onto a chord tone.
    if (slot % 4 === 0 && !isChordTone(midi, chord)) {
      const up = this.melodyScale[Math.min(this.melodyScale.length - 1, note.degree + 1)];
      const down = this.melodyScale[Math.max(0, note.degree - 1)];
      if (isChordTone(up, chord)) midi = up;
      else if (isChordTone(down, chord)) midi = down;
    }
    const dur = note.len * this.stepDur * 2;
    this.play(m.voice, midi, t, dur, note.vel, m.gain, (this.rand() - 0.5) * 0.3);
  }

  // -------------------------------------------------------------------------

  private startVinyl(at: number): void {
    const ctx = this.ctx;
    const hiss = noiseSource(ctx, at, 0, true);
    const hp = ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.value = 3500;
    hp.Q.value = 0.5;
    const g = ctx.createGain();
    g.gain.value = 0.006 * this.def.vinyl;
    hiss.connect(hp).connect(g).connect(this.output);
    this.crackleNode = hiss;
  }
}
