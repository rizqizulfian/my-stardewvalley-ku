// Music tracks. Generative tracks are rendered live by audio/GenerativeTrack.
// A track can instead point at a file ({ kind: 'file', url }); files resume
// where they left off when the player comes back. Credits are in CREDITS.md.

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
  /** Generative track whose rain variant plays instead on rainy days. */
  rainAlt?: string;
}

export type TrackDef = GenerativeTrackDef | FileTrackDef;

/** The first song a player hears each time they start playing. */
export const OPENING_TRACK = 'apple-cider';

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
  {
    // Recorded: "Apple Cider" by Zane Little. Farm daytime.
    kind: 'file',
    id: 'apple-cider',
    url: 'audio/apple-cider.ogg',
    // A mastered recording is far louder than the synthesised tracks; this
    // brings it to about the same loudness so it does not bury the SFX.
    gain: 0.36,
    rainAlt: 'farm-day',
  },
  {
    // The dancing dog's song, from the clip the project owner sent (source unknown, see CREDITS.md).
    kind: 'file',
    id: 'dog-dance',
    url: 'audio/dog-dance.ogg',
    gain: 0.4,
  },
  {
    // The disco barn's song, from the clip the project owner sent (source unknown, see CREDITS.md).
    kind: 'file',
    id: 'disco',
    url: 'audio/disco.ogg',
    gain: 0.45,
  },
  {
    // The park: sunny and open, marimba over brushed drums.
    kind: 'generative',
    id: 'park-day',
    bpm: 88,
    key: 'D',
    scale: 'majorPentatonic',
    progression: ['Dmaj7', 'Bm7', 'Gmaj7', 'A6'],
    barsPerChord: 1,
    swing: 0.12,
    seed: 1212,
    lowpass: 6200,
    reverb: 0.3,
    vinyl: 0.15,
    pad: { voice: 'warmPad', gain: 0.35, octave: 3 },
    chords: { voice: 'epiano', gain: 0.45, octave: 4, style: 'broken', density: 0.55 },
    melody: { voice: 'marimba', gain: 0.5, octave: 5, density: 0.45, motifBars: 2, range: 8 },
    bass: { voice: 'sub', gain: 0.55, octave: 2, style: 'rootFifth' },
    drums: { kick: 0.45, hat: 0.5, shaker: 0.5, pattern: 'brush' },
  },
  {
    // The gallery: slow, hushed, bells in a big room.
    kind: 'generative',
    id: 'museum',
    bpm: 64,
    key: 'A',
    scale: 'majorPentatonic',
    progression: ['Amaj9', 'F#m9', 'Dmaj9', 'E6'],
    barsPerChord: 2,
    swing: 0,
    seed: 3131,
    lowpass: 3400,
    reverb: 0.6,
    vinyl: 0.1,
    pad: { voice: 'warmPad', gain: 0.5, octave: 3 },
    chords: { voice: 'epiano', gain: 0.35, octave: 4, style: 'arp', density: 0.35 },
    melody: { voice: 'bell', gain: 0.32, octave: 5, density: 0.22, motifBars: 2, range: 6 },
    bass: { voice: 'sub', gain: 0.35, octave: 2, style: 'root' },
  },
  {
    // Village by day: marimba and bells, a little like a gamelan heard from a yard.
    kind: 'generative',
    id: 'village-day',
    bpm: 86,
    key: 'G',
    scale: 'majorPentatonic',
    progression: ['Gmaj7', 'Em7', 'Cmaj7', 'D6'],
    barsPerChord: 1,
    swing: 0.14,
    seed: 505,
    lowpass: 5600,
    reverb: 0.32,
    vinyl: 0.18,
    pad: { voice: 'warmPad', gain: 0.4, octave: 3 },
    chords: { voice: 'marimba', gain: 0.5, octave: 4, style: 'broken', density: 0.65 },
    melody: { voice: 'bell', gain: 0.4, octave: 5, density: 0.4, motifBars: 2, range: 7 },
    bass: { voice: 'sub', gain: 0.6, octave: 2, style: 'rootFifth' },
    drums: { kick: 0.4, hat: 0.45, shaker: 0.45, pattern: 'brush' },
  },
  {
    // Village at dusk: soft keys and a far bell, fewer notes.
    kind: 'generative',
    id: 'village-evening',
    bpm: 72,
    key: 'G',
    scale: 'majorPentatonic',
    progression: ['Em9', 'Cmaj9', 'Gmaj7', 'D6'],
    barsPerChord: 1,
    swing: 0.12,
    seed: 606,
    lowpass: 3600,
    reverb: 0.45,
    vinyl: 0.28,
    pad: { voice: 'warmPad', gain: 0.65, octave: 3 },
    chords: { voice: 'epiano', gain: 0.5, octave: 4, style: 'broken', density: 0.5 },
    melody: { voice: 'marimba', gain: 0.38, octave: 5, density: 0.28, motifBars: 2, range: 6 },
    bass: { voice: 'sub', gain: 0.55, octave: 2, style: 'root' },
    drums: { kick: 0, hat: 0.35, shaker: 0, pattern: 'sparse' },
  },
  {
    // Market square: the busiest piece, plucks over a light groove.
    kind: 'generative',
    id: 'town-day',
    bpm: 94,
    key: 'C',
    scale: 'majorPentatonic',
    progression: ['Cmaj7', 'Am7', 'Dm7', 'G7sus4'],
    barsPerChord: 1,
    swing: 0.16,
    seed: 707,
    lowpass: 5800,
    reverb: 0.26,
    vinyl: 0.2,
    pad: { voice: 'warmPad', gain: 0.35, octave: 3 },
    chords: { voice: 'epiano', gain: 0.55, octave: 4, style: 'block', density: 0.75 },
    melody: { voice: 'pluck', gain: 0.55, octave: 5, density: 0.55, motifBars: 2, range: 8 },
    bass: { voice: 'sub', gain: 0.7, octave: 2, style: 'pulse' },
    drums: { kick: 0.65, hat: 0.65, shaker: 0.45, pattern: 'lofi' },
  },
  {
    // Town after work: warm and lazy.
    kind: 'generative',
    id: 'town-evening',
    bpm: 76,
    key: 'C',
    scale: 'majorPentatonic',
    progression: ['Fmaj9', 'Em7', 'Dm9', 'G6'],
    barsPerChord: 1,
    swing: 0.18,
    seed: 808,
    lowpass: 3800,
    reverb: 0.4,
    vinyl: 0.3,
    pad: { voice: 'warmPad', gain: 0.6, octave: 3 },
    chords: { voice: 'epiano', gain: 0.55, octave: 4, style: 'broken', density: 0.55 },
    melody: { voice: 'musicBox', gain: 0.35, octave: 5, density: 0.3, motifBars: 2, range: 6 },
    bass: { voice: 'sub', gain: 0.6, octave: 2, style: 'root' },
    drums: { kick: 0.4, hat: 0.45, shaker: 0, pattern: 'brush' },
  },
  {
    // Beach by day: steel drum over shakers.
    kind: 'generative',
    id: 'beach-day',
    bpm: 90,
    key: 'D',
    scale: 'majorPentatonic',
    progression: ['Dmaj7', 'Bm7', 'Gmaj7', 'A6'],
    barsPerChord: 1,
    swing: 0.2,
    seed: 909,
    lowpass: 5400,
    reverb: 0.34,
    vinyl: 0.15,
    pad: { voice: 'warmPad', gain: 0.35, octave: 3 },
    chords: { voice: 'marimba', gain: 0.45, octave: 4, style: 'arp', density: 0.6 },
    melody: { voice: 'steelDrum', gain: 0.45, octave: 5, density: 0.45, motifBars: 2, range: 7 },
    bass: { voice: 'sub', gain: 0.6, octave: 2, style: 'rootFifth' },
    drums: { kick: 0.45, hat: 0.4, shaker: 0.6, pattern: 'lofi' },
  },
  {
    // Sunset on the sand: slow steel drum, lots of air.
    kind: 'generative',
    id: 'beach-evening',
    bpm: 68,
    key: 'D',
    scale: 'majorPentatonic',
    progression: ['Gmaj9', 'Em9', 'Dmaj7', 'A6'],
    barsPerChord: 2,
    swing: 0.1,
    seed: 1010,
    lowpass: 3400,
    reverb: 0.5,
    vinyl: 0.22,
    pad: { voice: 'warmPad', gain: 0.7, octave: 3 },
    chords: { voice: 'epiano', gain: 0.45, octave: 4, style: 'broken', density: 0.45 },
    melody: { voice: 'steelDrum', gain: 0.32, octave: 5, density: 0.24, motifBars: 2, range: 6 },
    bass: { voice: 'sub', gain: 0.5, octave: 2, style: 'root' },
  },
  {
    // Indoors: music box and keys, quiet and close.
    kind: 'generative',
    id: 'home',
    bpm: 66,
    key: 'Eb',
    scale: 'majorPentatonic',
    progression: ['Ebmaj7', 'Cm7', 'Abmaj7', 'Bb6'],
    barsPerChord: 1,
    swing: 0.1,
    seed: 1111,
    lowpass: 3200,
    reverb: 0.38,
    vinyl: 0.35,
    pad: { voice: 'warmPad', gain: 0.55, octave: 3 },
    chords: { voice: 'epiano', gain: 0.5, octave: 4, style: 'broken', density: 0.5 },
    melody: { voice: 'musicBox', gain: 0.32, octave: 5, density: 0.26, motifBars: 2, range: 6 },
    bass: { voice: 'sub', gain: 0.45, octave: 2, style: 'root' },
  },
];

// ---------------------------------------------------------------------------
// Variants: every generative track gets a summer, fall, winter and rain take
// (same harmony, new melody seed, different voices, tempo and warmth).

type Variant = 'summer' | 'fall' | 'winter' | 'rain';
const SEASON_VARIANT: Array<Variant | null> = [null, 'summer', 'fall', 'winter'];

function variant(t: GenerativeTrackDef, v: Variant): GenerativeTrackDef {
  const m = t.melody;
  const d = t.drums;
  switch (v) {
    case 'summer':
      return {
        ...t,
        id: `${t.id}@summer`,
        seed: t.seed + 101,
        bpm: t.bpm + 4,
        lowpass: t.lowpass + 600,
        melody: m && { ...m, voice: m.voice === 'marimba' ? 'pluck' : 'marimba', density: Math.min(0.6, m.density + 0.05) },
        drums: d && { ...d, shaker: Math.min(0.7, d.shaker + 0.2) },
      };
    case 'fall':
      return {
        ...t,
        id: `${t.id}@fall`,
        seed: t.seed + 202,
        bpm: t.bpm - 4,
        lowpass: Math.round(t.lowpass * 0.8),
        vinyl: Math.min(0.6, t.vinyl + 0.1),
        melody: m && { ...m, voice: m.voice === 'epiano' ? 'pluck' : 'epiano' },
      };
    case 'winter':
      return {
        ...t,
        id: `${t.id}@winter`,
        seed: t.seed + 303,
        bpm: t.bpm - 8,
        lowpass: Math.round(t.lowpass * 0.7),
        reverb: Math.min(0.7, t.reverb + 0.15),
        melody: m && { ...m, voice: m.voice === 'bell' ? 'musicBox' : 'bell', density: m.density * 0.8 },
        drums: d && { ...d, kick: 0, pattern: 'sparse' },
      };
    case 'rain':
      return {
        ...t,
        id: `${t.id}@rain`,
        seed: t.seed + 404,
        bpm: t.bpm - 6,
        lowpass: Math.round(t.lowpass * 0.6),
        reverb: Math.min(0.7, t.reverb + 0.1),
        vinyl: Math.min(0.6, t.vinyl + 0.15),
        melody: m && { ...m, voice: 'epiano', density: m.density * 0.6 },
        drums: d && { ...d, kick: d.kick * 0.5, hat: d.hat * 0.6, pattern: 'brush' },
      };
  }
}

for (const t of [...TRACKS])
  if (t.kind === 'generative') for (const v of ['summer', 'fall', 'winter', 'rain'] as Variant[]) TRACKS.push(variant(t, v));

export const TRACKS_BY_ID: Record<string, TrackDef> = Object.fromEntries(TRACKS.map((t) => [t.id, t]));

/** The take of a map's track for this season and weather. */
export function musicFor(id: string, season: number, raining: boolean): string {
  const t = TRACKS_BY_ID[id];
  if (!t) return id;
  if (raining) return t.kind === 'generative' ? `${id}@rain` : t.rainAlt ? `${t.rainAlt}@rain` : id;
  const v = SEASON_VARIANT[season];
  return v && t.kind === 'generative' ? `${id}@${v}` : id;
}
