// All gameplay, rendering, and audio tunables live here.
// Scenes and systems read from this file instead of using inline numbers.

export const GAME_TITLE = 'Lembah Padi';

export const RENDER = {
  /**
   * The view shows about this many tiles across (Stardew-like framing). The
   * native resolution is derived from the window: zoom = round(window / view),
   * always a whole number, and the native size fills the window at that zoom.
   */
  viewTilesWide: 30,
  /** Fallback native size, also used for generated full-screen textures. */
  width: 480,
  height: 270,
  tileSize: 16,
  minZoom: 1,
  maxZoom: 8,
} as const;

export const PLAYER = {
  /** Walk speed in native pixels per second. */
  walkSpeed: 62,
  /** Feet collision box, relative to the sprite's bottom-center anchor. */
  feetWidth: 10,
  feetHeight: 5,
  frameWidth: 16,
  frameHeight: 24,
  /** Milliseconds per walk-cycle frame. */
  walkFrameMs: 140,
  /** Milliseconds per idle (breathing) frame. */
  idleFrameMs: 650,
} as const;

export const CAMERA = {
  /** 0..1 smoothing factor applied per 1/60 s; positions are rounded after smoothing. */
  followLerp: 0.18,
} as const;

export const TIME = {
  /** Real milliseconds per in-game minute. 10 game minutes ~ 7 real seconds. */
  msPerGameMinute: 700,
  /** Debug fast-forward multiplier while holding the fast-forward key. */
  fastForwardMultiplier: 40,
  dayStartMinute: 6 * 60,
  /** 2:00 the next morning, expressed as minutes after the previous midnight. */
  dayEndMinute: 26 * 60,
  daysPerSeason: 28,
  startingGold: 500,
} as const;

export const SEASONS = ['Spring', 'Summer', 'Fall', 'Winter'] as const;

export const WEATHER = {
  /** Chance that a day is rainy, per season. */
  rainChance: [0.25, 0.2, 0.3, 0.15],
  /** The first days are always clear, so the farm can get started. */
  clearDays: 2,
} as const;

/**
 * Body needs, all on a 0..100 scale where 100 is good. Drains are per game
 * minute; costs are per tool swing. "sleep" is alertness: it falls through the
 * day and resets in bed.
 */
export const NEEDS = {
  max: 100,
  drain: { hunger: 0.06, thirst: 0.08, sleep: 0.07 },
  /** After midnight alertness falls this much faster. */
  lateSleepMultiplier: 2.5,
  toolEnergy: { hoe: 2, can: 1, axe: 2, pickaxe: 2, scythe: 1, rod: 3 },
  /** Hard work makes you thirsty. */
  toolThirst: 0.4,
  /** Below this a need counts as low (warning, blinking bar). */
  low: 25,
  /** Each empty need (0) drains this much energy per game minute. */
  emptyEnergyDrain: 0.06,
  /** Walking speed while exhausted, starving or very sleepy. */
  slowWalk: 0.75,
  /** Energy per game minute while sitting on a bench. */
  benchEnergy: 0.35,
  /** Waking up: hunger and thirst after a night's sleep. */
  wakeHunger: -15,
  wakeThirst: -20,
  /** Energy after passing out at 2:00 instead of going to bed. */
  passOutEnergy: 50,
  passOutSleep: 70,
  /** Going to bed after midnight costs this much morning energy per hour late. */
  lateBedEnergyPerHour: 12,
} as const;

export const SHOPS = {
  /** Shops pay this share of an item's value. The shipping box pays full price. */
  sellRatio: 0.5,
  /** Shift-click buys this many. */
  bulk: 5,
} as const;

export const SAVE = {
  key: 'lembah-padi-save-v1',
} as const;
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export const ATMOSPHERE = {
  /** Vignette alpha in full daylight. */
  vignetteStrength: 0.22,
  /** Extra vignette added at full darkness. */
  vignetteNight: 0.45,
  /** Maximum alpha of additive light sprites at full darkness. */
  lightMaxAlpha: 0.85,
  /** Darkness level (0..1) above which windows and lamps switch on. */
  lightsOnThreshold: 0.25,
  /** Indoors the day/night grade is this much weaker (0 = none, 1 = same as outside). */
  indoorGrade: 0.35,
  leafSpawnEveryMs: 900,
  leafMaxAlive: 14,
  fireflyMaxAlive: 10,
  fireflySpawnEveryMs: 700,
  /** Milliseconds per sway frame for grass and trees. */
  swayFrameMs: 420,
  waterFrameMs: 260,
} as const;

export const AUDIO = {
  masterVolume: 0.9,
  /** Defaults, 0..1. Music starts low on purpose. */
  defaultMusicVolume: 0.32,
  defaultAmbienceVolume: 0.45,
  defaultSfxVolume: 0.6,
  crossfadeSeconds: 2.5,
  /** How far ahead (s) the sequencer schedules notes. */
  scheduleAheadSeconds: 0.25,
  schedulerIntervalMs: 50,
  reverbSeconds: 2.8,
  reverbDecay: 2.6,
  /** Wet mix of the shared reverb send. */
  reverbWet: 0.32,
  /** Gentle master low-pass for the lo-fi feel (Hz). */
  musicLowpassHz: 5200,
  /** Random pitch variation for SFX, in semitones (+/-). */
  sfxPitchJitter: 1.2,
  storageKey: 'lembah-padi.audio',
} as const;

export const FARM = {
  inventorySlots: 30,
  hotbarSlots: 10,
  /** Watering can capacity, in uses. */
  canCapacity: 40,
  /** Tool reach in cells around the player (mouse targeting). */
  reach: 1,
  /** How far ahead of the feet (px) the keyboard target point sits. */
  facingReach: 12,
} as const;

/** Tool swing timing: milliseconds per frame, and the frame where the tool lands. */
export const TOOL_TIMING = {
  swing: { frames: [110, 70, 170], impact: 2 },
  scythe: { frames: [70, 60, 140], impact: 1 },
  can: { frames: [110, 220, 220], impact: 1 },
  /** Fishing cast: wind-up, throw; the hold pose stays until the line comes back. */
  rod: { frames: [260, 180], impact: 1 },
} as const;

export const DROPS = {
  /** Pop-out arc of dropped items. */
  popSpeed: 55,
  gravity: 260,
  /** Rest on the ground for this long before flying to the player (ms). */
  restMs: 280,
  /** Magnet flight speed (px/s) and pickup radius (px). */
  magnetSpeed: 150,
  pickupRadius: 6,
} as const;

export const DEBUG = {
  /** Hold this key to fast-forward the clock. */
  fastForwardKey: 'T',
  /** Press to skip to the next morning. */
  nextDayKey: 'N',
  showCollision: false,
} as const;

export const DEPTH = {
  ground: 0,
  path: 1,
  water: 2,
  cliff: 3,
  groundDecor: 4,
  /** Y-sorted world objects use depth = WORLD_BASE + bottomY. */
  worldBase: 100,
  grade: 100000,
  lights: 100001,
  particlesAbove: 100002,
  vignette: 100003,
  ui: 200000,
} as const;
