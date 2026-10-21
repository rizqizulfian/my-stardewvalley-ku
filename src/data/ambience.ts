// Ambience layers and how loud each is over the day (minute -> 0..1).
// Maps scale these with their own `ambience` multipliers.

export type AmbienceLayerId = 'birds' | 'crickets' | 'wind' | 'water' | 'waves' | 'gulls';

export type Curve = ReadonlyArray<readonly [minute: number, level: number]>;

export const AMBIENCE_CURVES: Record<AmbienceLayerId, Curve> = {
  birds: [
    [360, 0.5],
    [420, 1],
    [600, 0.85],
    [840, 0.45],
    [1080, 0.55],
    [1170, 0.15],
    [1230, 0],
    [1560, 0],
  ],
  crickets: [
    [360, 0.25],
    [420, 0],
    [1110, 0],
    [1200, 0.7],
    [1290, 1],
    [1560, 1],
  ],
  wind: [
    [360, 0.4],
    [720, 0.55],
    [1080, 0.7],
    [1320, 0.5],
    [1560, 0.4],
  ],
  water: [
    [360, 1],
    [1560, 1],
  ],
  waves: [
    [360, 1],
    [1560, 1],
  ],
  gulls: [
    [360, 0.3],
    [450, 1],
    [960, 0.8],
    [1140, 0.35],
    [1200, 0],
    [1560, 0],
  ],
};

export function sampleCurve(curve: Curve, minute: number): number {
  if (minute <= curve[0][0]) return curve[0][1];
  for (let i = 1; i < curve.length; i++) {
    const [m1, v1] = curve[i];
    const [m0, v0] = curve[i - 1];
    if (minute <= m1) return v0 + ((minute - m0) / (m1 - m0)) * (v1 - v0);
  }
  return curve[curve.length - 1][1];
}
