// AudioManager: the only audio API the game uses.
// Owns the AudioContext, the bus graph (music / ambience / sfx -> master),
// a shared reverb, music crossfades, ambience levels and SFX playback.
// Music sources are either generative or file based, chosen by track data.

import { AUDIO } from '../config';
import { AMBIENCE_CURVES, sampleCurve, type AmbienceLayerId } from '../data/ambience';
import { TRACKS_BY_ID, type FileTrackDef, type TrackDef } from '../data/music';
import type { Surface } from '../data/terrain';
import { createAmbienceLayers, type AmbienceLayer } from './Ambience';
import { GenerativeTrack, type MusicSource } from './GenerativeTrack';
import { makeImpulse } from './instruments';
import { FOOTSTEPS, SFX } from './sfx';

export type Bus = 'music' | 'ambience' | 'sfx';

export interface AudioSettings {
  music: number;
  ambience: number;
  sfx: number;
  muted: boolean;
}

/** Looping file-based track, so recorded music can replace generative tracks. */
class FileTrack implements MusicSource {
  readonly output: GainNode;
  private src?: AudioBufferSourceNode;
  private _stopped = false;

  constructor(
    private readonly ctx: AudioContext,
    private readonly def: FileTrackDef,
    dest: AudioNode,
  ) {
    this.output = ctx.createGain();
    this.output.gain.value = 0.0001;
    this.output.connect(dest);
  }

  get stopped(): boolean {
    return this._stopped;
  }

  start(at: number): void {
    fetch(this.def.url)
      .then((r) => r.arrayBuffer())
      .then((b) => this.ctx.decodeAudioData(b))
      .then((buf) => {
        if (this._stopped) return;
        const s = this.ctx.createBufferSource();
        s.buffer = buf;
        s.loop = true;
        const g = this.ctx.createGain();
        g.gain.value = this.def.gain;
        s.connect(g).connect(this.output);
        s.start(Math.max(at, this.ctx.currentTime));
        this.src = s;
      })
      .catch((e) => console.warn('[audio] could not load', this.def.url, e));
  }

  scheduleUntil(): void {}

  stop(at: number): void {
    this.src?.stop(at);
    this._stopped = true;
  }
}

interface ActiveTrack {
  id: string;
  source: MusicSource;
}

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private buses!: Record<Bus, GainNode>;
  private reverbIn!: GainNode;
  private analyser!: AnalyserNode;
  private current: ActiveTrack | null = null;
  private fading: ActiveTrack[] = [];
  private ambience: AmbienceLayer[] = [];
  private timer: number | undefined;
  private pendingTrack: string | null = null;
  readonly settings: AudioSettings;

  constructor() {
    this.settings = this.loadSettings();
  }

  get started(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  get context(): AudioContext | null {
    return this.ctx;
  }

  /** Must be called from a user gesture (key press or click). */
  async unlock(): Promise<void> {
    if (this.ctx) {
      if (this.ctx.state !== 'running') await this.ctx.resume();
      return;
    }
    const ctx = new AudioContext({ latencyHint: 'playback' });
    this.ctx = ctx;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 12;
    comp.ratio.value = 3;
    comp.attack.value = 0.01;
    comp.release.value = 0.3;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.master = ctx.createGain();
    this.master.gain.value = AUDIO.masterVolume;
    this.master.connect(comp).connect(this.analyser).connect(ctx.destination);

    const mk = (v: number) => {
      const g = ctx.createGain();
      g.gain.value = v;
      g.connect(this.master);
      return g;
    };
    this.buses = { music: mk(0), ambience: mk(0), sfx: mk(0) };
    this.applyVolumes(0);

    const conv = ctx.createConvolver();
    conv.buffer = makeImpulse(ctx, AUDIO.reverbSeconds, AUDIO.reverbDecay);
    this.reverbIn = ctx.createGain();
    this.reverbIn.gain.value = 1;
    const wet = ctx.createGain();
    wet.gain.value = AUDIO.reverbWet;
    this.reverbIn.connect(conv).connect(wet);
    // The reverb return follows the music bus so the music slider controls it.
    wet.connect(this.buses.music);

    this.ambience = createAmbienceLayers(ctx, this.buses.ambience, this.reverbIn);

    this.timer = window.setInterval(() => this.tick(), AUDIO.schedulerIntervalMs);
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) void this.ctx.suspend();
      else void this.ctx.resume();
    });
    await ctx.resume();
    if (this.pendingTrack) {
      const id = this.pendingTrack;
      this.pendingTrack = null;
      this.playMusic(id);
    }
  }

  // -------------------------------------------------------------------------
  // Music

  /** Crossfade to a track. Requesting the playing track does nothing. */
  playMusic(id: string): void {
    if (!this.ctx) {
      this.pendingTrack = id;
      return;
    }
    if (this.current?.id === id) return;
    const def: TrackDef | undefined = TRACKS_BY_ID[id];
    if (!def) {
      console.warn('[audio] unknown track', id);
      return;
    }
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const fade = AUDIO.crossfadeSeconds;

    if (this.current) {
      const old = this.current;
      const g = old.source.output.gain;
      g.cancelScheduledValues(now);
      g.setValueAtTime(Math.max(0.0001, g.value), now);
      g.linearRampToValueAtTime(0.0001, now + fade);
      old.source.stop(now + fade + 0.1);
      this.fading.push(old);
    }

    const source: MusicSource =
      def.kind === 'generative'
        ? new GenerativeTrack(ctx, def, this.buses.music, this.reverbIn)
        : new FileTrack(ctx, def, this.buses.music);
    source.start(now);
    source.output.gain.setValueAtTime(0.0001, now);
    source.output.gain.linearRampToValueAtTime(1, now + fade);
    this.current = { id, source };
  }

  get currentTrack(): string | null {
    return this.current?.id ?? this.pendingTrack;
  }

  // -------------------------------------------------------------------------
  // Ambience

  /**
   * Set ambience for the current minute of the day. `mapLevels` comes from
   * map data; `overrides` lets the scene drive a layer directly (e.g. water
   * by distance to the pond).
   */
  updateAmbience(minute: number, mapLevels: Record<string, number>, overrides: Partial<Record<AmbienceLayerId, number>> = {}): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (const layer of this.ambience) {
      const base = sampleCurve(AMBIENCE_CURVES[layer.id], minute) * (mapLevels[layer.id] ?? 0);
      const v = overrides[layer.id] !== undefined ? base * overrides[layer.id]! : base;
      layer.setLevel(v, now, AUDIO.crossfadeSeconds);
    }
  }

  // -------------------------------------------------------------------------
  // SFX

  playSfx(name: string, gain = 1): void {
    const fn = SFX[name];
    if (!fn || !this.started) return;
    this.withGain(gain, (dest, t, p) => fn(this.ctx!, dest, t, p));
  }

  footstep(surface: Surface): void {
    if (!this.started) return;
    this.withGain(1, (dest, t, p) => FOOTSTEPS[surface](this.ctx!, dest, t, p));
  }

  private withGain(gain: number, play: (dest: AudioNode, t: number, pitch: number) => void): void {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.value = gain * (0.85 + Math.random() * 0.3);
    g.connect(this.buses.sfx);
    const semis = (Math.random() * 2 - 1) * AUDIO.sfxPitchJitter;
    play(g, ctx.currentTime + 0.005, Math.pow(2, semis / 12));
    window.setTimeout(() => g.disconnect(), 3000);
  }

  // -------------------------------------------------------------------------
  // Volume

  setVolume(bus: Bus, v: number): void {
    this.settings[bus] = Math.min(1, Math.max(0, v));
    this.applyVolumes();
    this.saveSettings();
  }

  toggleMute(): boolean {
    this.settings.muted = !this.settings.muted;
    this.applyVolumes();
    this.saveSettings();
    return this.settings.muted;
  }

  /** Current output peak (0..1), for meters and tests. */
  peak(): number {
    if (!this.ctx) return 0;
    const data = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(data);
    let p = 0;
    for (const v of data) p = Math.max(p, Math.abs(v));
    return p;
  }

  private applyVolumes(glide = 0.2): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const m = this.settings.muted ? 0 : 1;
    (['music', 'ambience', 'sfx'] as const).forEach((b) => {
      const g = this.buses[b].gain;
      g.cancelScheduledValues(now);
      if (glide > 0) g.setTargetAtTime(this.settings[b] * m, now, glide / 3);
      else g.setValueAtTime(this.settings[b] * m, now);
    });
  }

  private loadSettings(): AudioSettings {
    const defaults: AudioSettings = {
      music: AUDIO.defaultMusicVolume,
      ambience: AUDIO.defaultAmbienceVolume,
      sfx: AUDIO.defaultSfxVolume,
      muted: false,
    };
    try {
      const raw = localStorage.getItem(AUDIO.storageKey);
      if (raw) return { ...defaults, ...(JSON.parse(raw) as Partial<AudioSettings>) };
    } catch {
      // Storage may be unavailable (private mode); defaults are fine.
    }
    return defaults;
  }

  private saveSettings(): void {
    try {
      localStorage.setItem(AUDIO.storageKey, JSON.stringify(this.settings));
    } catch {
      // Ignore storage failures.
    }
  }

  // -------------------------------------------------------------------------

  private tick(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const horizon = now + AUDIO.scheduleAheadSeconds;
    this.current?.source.scheduleUntil(horizon);
    for (const f of this.fading) f.source.scheduleUntil(horizon);
    this.fading = this.fading.filter((f) => !f.source.stopped);
    for (const l of this.ambience) l.schedule(now, horizon);
  }

  dispose(): void {
    if (this.timer) window.clearInterval(this.timer);
    void this.ctx?.close();
  }
}

export const audio = new AudioManager();
