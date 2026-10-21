// The end of a day: shipping sale, calendar, crops (growth and season
// withering) and how rested the player wakes up. Plain state; the scene does
// the fade and the summary screen.

import { NEEDS, SEASONS, TIME, WEATHER } from '../config';
import { CROPS, inSeason } from '../data/crops';
import { LETTERS } from '../data/mail';
import { advanceFarms } from './farming';
import { hearts } from './friendship';
import { isWet, type GameState, type Weather } from './GameState';
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

function rollWeather(s: GameState, rand: () => number): Weather {
  if (s.daysPlayed < WEATHER.clearDays) return 'sun';
  const r = rand();
  const snow = WEATHER.snowChance[s.season];
  if (r < snow) return 'snow';
  if (r < snow + WEATHER.rainChance[s.season]) return rand() < WEATHER.stormShare[s.season] ? 'storm' : 'rain';
  return 'sun';
}

/** Letters for this morning go into the mailbox. */
function deliverMail(s: GameState, newSeason: boolean): void {
  const ctx = { newSeason, hearts: (npc: string) => hearts(s, npc) };
  for (const l of LETTERS) {
    const flag = `mail:${l.id}`;
    if ((!l.repeat && s.flags[flag]) || s.mail.includes(l.id) || !l.when(s, ctx)) continue;
    s.flags[flag] = true;
    s.mail.push(l.id);
  }
}

export function endDay(s: GameState, passedOut: boolean, rand: () => number = Math.random): DaySummary {
  const ended = { day: s.day, season: s.season };
  const { lines, total } = sellShipped(s);
  // Hours past midnight when the player went down.
  const lateHours = Math.max(0, (s.minute - 24 * 60) / 60);

  const newSeason = advanceCalendar(s);
  s.daysPlayed++;
  s.weather = s.tomorrow;
  s.tomorrow = rollWeather(s, rand);
  // Rain and storms water every field for the new day.
  advanceFarms(s, isWet(s.weather));
  const withered = newSeason ? witherOutOfSeason(s) : 0;
  deliverMail(s, newSeason);

  const n = s.needs;
  n.energy = passedOut ? NEEDS.passOutEnergy : Math.round(NEEDS.max - lateHours * NEEDS.lateBedEnergyPerHour);
  n.sleep = passedOut ? NEEDS.passOutSleep : NEEDS.max;
  n.hunger = Math.max(10, n.hunger + NEEDS.wakeHunger);
  n.thirst = Math.max(10, n.thirst + NEEDS.wakeThirst);
  s.minute = TIME.dayStartMinute;
  return { ...ended, sales: lines, total, passedOut, newSeason, withered };
}
