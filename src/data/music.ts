// Music tracks. Generative tracks are rendered live by audio/GenerativeTrack.
// A track can instead point at a file ({ kind: 'file', url }) once recorded
// music exists; nothing else in the game needs to change.

import type { VoiceName } from '../audio/instruments';
import type { ScaleName } from '../audio/theory';

export interface InstrumentPart {
  voice: VoiceName;
  gain: number;
  octave: number;
}

export interface GenerativeTrackDef {
  kind: 'generative';
  id: string;
  bpm: number;
  key: string;
  scale: ScaleName;
  /** Chord symbols, e.g. "Fmaj7". */
  progression: string[];
  barsPerChord: number;
  /** 0..0.5 delay of off-beat eighths, in sixteenth-note fractions. */
  swing: number;
  seed: number;
  /** Track low-pass in Hz (warmth). */
  lowpass: number;
  /** Reverb send level 0..1. */
  reverb: number;
  /** Vinyl crackle level 0..1. */
  vinyl: number;
  pad?: InstrumentPart;
  chords?: InstrumentPart & { style: 'block' | 'arp' | 'broken'; density: number };
  melody?: InstrumentPart & {
    density: number;
    /** Bars per motif before it repeats with variation. */
    motifBars: number;
    /** Scale steps the melody may wander. */
    range: number;
  };
  bass?: InstrumentPart & { style: 'root' | 'rootFifth' | 'pulse' };
  drums?: { kick: number; hat: number; shaker: number; pattern: 'lofi' | 'brush' | 'sparse' };
}

export interface FileTrackDef {
  kind: 'file';
  id: string;
  url: string;
  gain: number;
}

export type TrackDef = GenerativeTrackDef | FileTrackDef;

export const TRACKS: TrackDef[] = [
  {
    // Bright and airy: music box over soft keys, no drums yet.
    kind: 'generative',
    id: 'farm-morning',
    bpm: 76,
    key: 'F',
    scale: 'majorPentatonic',
    progression: ['Fmaj7', 'Am7', 'Bbmaj7', 'C6'],
    barsPerChord: 1,
    swing: 0.12,
    seed: 101,
    lowpass: 6000,
    reverb: 0.4,
    vinyl: 0.15,
    pad: { voice: 'warmPad', gain: 0.6, octave: 3 },
    chords: { voice: 'epiano', gain: 0.5, octave: 4, style: 'arp', density: 0.6 },
    melody: { voice: 'musicBox', gain: 0.55, octave: 5, density: 0.42, motifBars: 2, range: 8 },
    bass: { voice: 'sub', gain: 0.55, octave: 2, style: 'root' },
    drums: { kick: 0, hat: 0.35, shaker: 0.4, pattern: 'sparse' },
  },
  {
    // Main daytime loop: plucked melody, warm keys, a light lo-fi groove.
    kind: 'generative',
    id: 'farm-day',
    bpm: 84,
    key: 'F',
    scale: 'majorPentatonic',
    progression: ['Bbmaj7', 'Am7', 'Gm7', 'C7sus4'],
    barsPerChord: 1,
    swing: 0.18,
    seed: 202,
    lowpass: 5200,
    reverb: 0.3,
    vinyl: 0.25,
    pad: { voice: 'warmPad', gain: 0.45, octave: 3 },
    chords: { voice: 'epiano', gain: 0.6, octave: 4, style: 'block', density: 0.7 },
    melody: { voice: 'pluck', gain: 0.6, octave: 5, density: 0.5, motifBars: 2, range: 7 },
    bass: { voice: 'sub', gain: 0.7, octave: 2, style: 'rootFifth' },
    drums: { kick: 0.7, hat: 0.7, shaker: 0.3, pattern: 'lofi' },
  },
  {
    // Golden hour: slower, minor-leaning, brushed drums.
    kind: 'generative',
    id: 'farm-evening',
    bpm: 72,
    key: 'F',
    scale: 'majorPentatonic',
    progression: ['Dm9', 'Bbmaj7', 'Fmaj7', 'C6'],
    barsPerChord: 1,
    swing: 0.15,
    seed: 303,
    lowpass: 3800,
    reverb: 0.42,
    vinyl: 0.3,
    pad: { voice: 'warmPad', gain: 0.7, octave: 3 },
    chords: { voice: 'epiano', gain: 0.55, octave: 4, style: 'broken', density: 0.55 },
    melody: { voice: 'epiano', gain: 0.45, octave: 5, density: 0.32, motifBars: 2, range: 6 },
    bass: { voice: 'sub', gain: 0.6, octave: 2, style: 'root' },
    drums: { kick: 0.45, hat: 0.5, shaker: 0, pattern: 'brush' },
  },
  {
    // Night: pad and sparse music box, bells far away, no drums.
    kind: 'generative',
    id: 'farm-night',
    bpm: 70,
    key: 'F',
    scale: 'majorPentatonic',
    progression: ['Fmaj9', 'Dm9', 'Bbmaj9', 'Gm7'],
    barsPerChord: 2,
    swing: 0,
    seed: 404,
    lowpass: 2600,
    reverb: 0.55,
    vinyl: 0.2,
    pad: { voice: 'warmPad', gain: 0.8, octave: 3 },
    melody: { voice: 'musicBox', gain: 0.38, octave: 5, density: 0.2, motifBars: 2, range: 6 },
    bass: { voice: 'sub', gain: 0.45, octave: 2, style: 'root' },
  },
];

export const TRACKS_BY_ID: Record<string, TrackDef> = Object.fromEntries(TRACKS.map((t) => [t.id, t]));
