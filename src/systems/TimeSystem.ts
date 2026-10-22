// Advances the in-game clock, drains needs each minute, and announces minute
// and period changes. At 2:00 it stops and asks the scene to end the day.

import { TIME, WEEKDAYS } from '../config';
import { GRADE_KEYS, TIME_OF_DAY_STARTS, type GradeKey } from '../data/atmosphere';
import type { TimeOfDay } from '../data/maps/types';
import { EV, bus } from './events';
import type { GameState } from './GameState';
import { tickNeeds } from './needs';

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

  /** Co-op guests: step the clock up to the host's minute instead of keeping time. */
  follow(minute: number): void {
    while (this.state.minute < Math.min(minute, TIME.dayEndMinute - 1)) this.advanceMinute();
    // The host decides when the night ends (2:00 included).
    this.state.minute = minute;
  }

  private advanceMinute(): void {
    const s = this.state;
    if (s.minute >= TIME.dayEndMinute) return;
    s.minute++;
    tickNeeds(s);
    bus.emit(EV.minute, s.minute);
    if (s.minute >= TIME.dayEndMinute) {
      // 2:00: the player collapses wherever they are. The scene takes it from here.
      bus.emit(EV.passOut);
      return;
    }
    const p = timeOfDay(s.minute);
    if (p !== this.lastPeriod) {
      this.lastPeriod = p;
      bus.emit(EV.periodChanged, p);
    }
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
