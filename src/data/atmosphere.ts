// Day/night colour grading. Each key is a minute of the day, a palette
// colour to multiply the scene by and how strongly (0..1), an additive
// "sky light" colour and amount that warms or cools the image, and how dark
// it is for lights (0 = full day, 1 = full night).

import type { ColorName } from '../art/palette';

export interface GradeKey {
  minute: number;
  color: ColorName;
  strength: number;
  darkness: number;
  glow: ColorName;
  glowAlpha: number;
}

export const GRADE_KEYS: GradeKey[] = [
  { minute: 360, color: 'lilac', strength: 0.55, darkness: 0.55, glow: 'lilac', glowAlpha: 0.1 }, // 6:00 blue-violet dawn
  { minute: 420, color: 'sand', strength: 0.4, darkness: 0.15, glow: 'dirtLight', glowAlpha: 0.08 }, // 7:00 warm sunrise
  { minute: 540, color: 'cream', strength: 0.04, darkness: 0, glow: 'gold', glowAlpha: 0 }, // 9:00 soft morning
  { minute: 720, color: 'cream', strength: 0, darkness: 0, glow: 'gold', glowAlpha: 0.0 }, // noon
  { minute: 960, color: 'cream', strength: 0.04, darkness: 0, glow: 'gold', glowAlpha: 0 },
  { minute: 1050, color: 'dirtHi', strength: 0.3, darkness: 0.05, glow: 'dirtLight', glowAlpha: 0.08 }, // 17:30 golden hour
  { minute: 1140, color: 'peach', strength: 0.36, darkness: 0.3, glow: 'amber', glowAlpha: 0.08 }, // 19:00 sunset
  { minute: 1200, color: 'violet', strength: 0.55, darkness: 0.65, glow: 'violet', glowAlpha: 0.08 }, // 20:00 dusk
  { minute: 1260, color: 'violet', strength: 0.66, darkness: 0.9, glow: 'deep', glowAlpha: 0.07 }, // 21:00 night
  { minute: 1380, color: 'violet', strength: 0.72, darkness: 1, glow: 'deep', glowAlpha: 0.07 },
  { minute: 1560, color: 'violet', strength: 0.76, darkness: 1, glow: 'deep', glowAlpha: 0.06 }, // 2:00
];

/** Time-of-day buckets used for music and ambience. */
export const TIME_OF_DAY_STARTS = {
  morning: 360,
  day: 600,
  evening: 1050,
  night: 1230,
} as const;
