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
  frameHeight: 32,
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
  leafSpawnEveryMs: 900,
  leafMaxAlive: 14,
  fireflyMaxAlive: 10,
  fireflySpawnEveryMs: 700,
  smokeEveryMs: 650,
  smokeMaxAlive: 12,
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

export const DEBUG = {
  /** Hold this key to fast-forward the clock. */
  fastForwardKey: 'T',
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
