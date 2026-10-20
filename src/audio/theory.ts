// Tiny music-theory helpers: note names, scales and chord symbols.

const NOTE_INDEX: Record<string, number> = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6,
  G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11,
};

export const SCALES = {
  majorPentatonic: [0, 2, 4, 7, 9],
  minorPentatonic: [0, 3, 5, 7, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
} as const;

export type ScaleName = keyof typeof SCALES;

const QUALITIES: Record<string, number[]> = {
  '': [0, 4, 7],
  m: [0, 3, 7],
  maj7: [0, 4, 7, 11],
  maj9: [0, 4, 7, 11, 14],
  m7: [0, 3, 7, 10],
  m9: [0, 3, 7, 10, 14],
  '7': [0, 4, 7, 10],
  '9': [0, 4, 7, 10, 14],
  '6': [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
  '69': [0, 4, 7, 9, 14],
  add9: [0, 4, 7, 14],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  '7sus4': [0, 5, 7, 10],
};

export interface Chord {
  /** Pitch class of the root, 0..11. */
  root: number;
  /** Intervals above the root, in semitones. */
  intervals: number[];
}

export function noteIndex(name: string): number {
  const v = NOTE_INDEX[name];
  if (v === undefined) throw new Error(`[music] unknown note ${name}`);
  return v;
}

/** Parse a chord symbol like "Fmaj7", "Bbmaj9", "Dm7", "C7sus4", "G/B" (slash ignored). */
export function parseChord(symbol: string): Chord {
  const base = symbol.split('/')[0];
  const m = /^([A-G](?:#|b)?)(.*)$/.exec(base);
  if (!m) throw new Error(`[music] bad chord ${symbol}`);
  const intervals = QUALITIES[m[2]];
  if (!intervals) throw new Error(`[music] unknown chord quality "${m[2]}" in ${symbol}`);
  return { root: noteIndex(m[1]), intervals };
}

/** MIDI note for a pitch class in a given octave (C4 = 60). */
export function midiOf(pc: number, octave: number): number {
  return 12 * (octave + 1) + pc;
}

/** Close voicing of a chord around a target MIDI note. */
export function voiceChord(chord: Chord, octave: number, maxNotes = 4): number[] {
  const root = midiOf(chord.root, octave);
  const notes = chord.intervals.slice(0, maxNotes).map((i) => root + (i >= 12 ? i - 12 : i));
  // Drop anything that ended up too high to keep pads warm.
  return notes.sort((a, b) => a - b);
}

/** Scale degrees laid out across octaves as absolute MIDI notes. */
export function scaleNotes(keyPc: number, scale: readonly number[], lowOctave: number, octaves: number): number[] {
  const out: number[] = [];
  for (let o = 0; o < octaves; o++) for (const s of scale) out.push(midiOf(keyPc, lowOctave + o) + s);
  return out;
}

export function isChordTone(midi: number, chord: Chord): boolean {
  const pc = (((midi - chord.root) % 12) + 12) % 12;
  return chord.intervals.some((i) => i % 12 === pc);
}
