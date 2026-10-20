// Advances the in-game clock and announces minute, period and day changes.

import { SEASONS, TIME, WEEKDAYS } from '../config';
import { GRADE_KEYS, TIME_OF_DAY_STARTS, type GradeKey } from '../data/atmosphere';
import type { TimeOfDay } from '../data/maps/types';
import { EV, bus } from './events';
import type { GameState } from './GameState';

export class TimeSystem {
  private acc = 0;
  private lastPeriod: TimeOfDay;
  paused = false;

  constructor(private readonly state: GameState) {
    this.lastPeriod = timeOfDay(state.minute);
  }

  update(deltaMs: number, multiplier = 1): void {
    if (this.paused) return;
    this.acc += deltaMs * multiplier;
    while (this.acc >= TIME.msPerGameMinute) {
      this.acc -= TIME.msPerGameMinute;
      this.advanceMinute();
    }
  }

  private advanceMinute(): void {
    const s = this.state;
    s.minute++;
    if (s.minute >= TIME.dayEndMinute) this.nextDay();
    bus.emit(EV.minute, s.minute);
    const p = timeOfDay(s.minute);
    if (p !== this.lastPeriod) {
      this.lastPeriod = p;
      bus.emit(EV.periodChanged, p);
    }
  }

  /** Placeholder until sleeping exists: at 2:00 the next day simply begins. */
  nextDay(): void {
    const s = this.state;
    s.minute = TIME.dayStartMinute;
    s.day++;
    if (s.day > TIME.daysPerSeason) {
      s.day = 1;
      s.season = (s.season + 1) % SEASONS.length;
      if (s.season === 0) s.year++;
    }
    bus.emit(EV.newDay, s.day);
  }
}

export function timeOfDay(minute: number): TimeOfDay {
  if (minute >= TIME_OF_DAY_STARTS.night || minute < TIME_OF_DAY_STARTS.morning) return 'night';
  if (minute >= TIME_OF_DAY_STARTS.evening) return 'evening';
  if (minute >= TIME_OF_DAY_STARTS.day) return 'day';
  return 'morning';
}

export function formatClock(minute: number): string {
  const m = minute % 1440;
  const h24 = Math.floor(m / 60);
  const mm = Math.floor(m % 60);
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${mm.toString().padStart(2, '0')} ${h24 < 12 ? 'am' : 'pm'}`;
}

export function weekday(day: number): string {
  return WEEKDAYS[(day - 1) % WEEKDAYS.length];
}

/** Interpolated grade for a minute of the day. */
export function sampleGrade(minute: number): { a: GradeKey; b: GradeKey; t: number } {
  const keys = GRADE_KEYS;
  if (minute <= keys[0].minute) return { a: keys[0], b: keys[0], t: 0 };
  for (let i = 1; i < keys.length; i++) {
    if (minute <= keys[i].minute) {
      const a = keys[i - 1];
      const b = keys[i];
      return { a, b, t: (minute - a.minute) / (b.minute - a.minute) };
    }
  }
  const last = keys[keys.length - 1];
  return { a: last, b: last, t: 0 };
}
