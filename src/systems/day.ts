// The end of a day: shipping sale, calendar, crops (growth and season
// withering) and how rested the player wakes up. Plain state; the scene does
// the fade and the summary screen.

import { NEEDS, SEASONS, TIME } from '../config';
import { CROPS, inSeason } from '../data/crops';
import { advanceFarms } from './farming';
import type { GameState } from './GameState';
import { sellShipped, type SaleLine } from './shipping';

export interface DaySummary {
  /** The day that just ended. */
  day: number;
  season: number;
  sales: SaleLine[];
  total: number;
  passedOut: boolean;
  /** The new day starts a new season. */
  newSeason: boolean;
  /** Crops that withered because their season ended. */
  withered: number;
}

function advanceCalendar(s: GameState): boolean {
  s.day++;
  if (s.day <= TIME.daysPerSeason) return false;
  s.day = 1;
  s.season = (s.season + 1) % SEASONS.length;
  if (s.season === 0) s.year++;
  return true;
}

function witherOutOfSeason(s: GameState): number {
  let n = 0;
  for (const soil of Object.values(s.soil))
    for (const t of Object.values(soil)) {
      if (t.crop && !inSeason(CROPS[t.crop.id], s.season)) {
        delete t.crop;
        n++;
      }
    }
  return n;
}

export function endDay(s: GameState, passedOut: boolean): DaySummary {
  const ended = { day: s.day, season: s.season };
  const { lines, total } = sellShipped(s);
  // Hours past midnight when the player went down.
  const lateHours = Math.max(0, (s.minute - 24 * 60) / 60);

  advanceFarms(s);
  const newSeason = advanceCalendar(s);
  const withered = newSeason ? witherOutOfSeason(s) : 0;

  const n = s.needs;
  n.energy = passedOut ? NEEDS.passOutEnergy : Math.round(NEEDS.max - lateHours * NEEDS.lateBedEnergyPerHour);
  n.sleep = passedOut ? NEEDS.passOutSleep : NEEDS.max;
  n.hunger = Math.max(10, n.hunger + NEEDS.wakeHunger);
  n.thirst = Math.max(10, n.thirst + NEEDS.wakeThirst);
  s.minute = TIME.dayStartMinute;
  return { ...ended, sales: lines, total, passedOut, newSeason, withered };
}
