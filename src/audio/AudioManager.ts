// AudioManager: the only audio API the game uses.
// Owns the AudioContext, the bus graph (music / ambience / sfx -> master),
// a shared reverb, music crossfades, ambience levels and SFX playback.
// Music sources are either generative or file based, chosen by track data.

import { AUDIO } from '../config';
import { AMBIENCE_CURVES, sampleCurve, type AmbienceLayerId } from '../data/ambience';
import { TRACKS, TRACKS_BY_ID, type FileTrackDef, type TrackDef } from '../data/music';
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
/** Decoded files, shared by every play of the same url. */
const decoded = new Map<string, Promise<AudioBuffer>>();
/** Where each file was when it last faded out, so coming back resumes the song. */
const resumeAt = new Map<string, number>();
/** A file that arrives after its crossfade began fades in over this long (s). */
const LATE_FADE_SECONDS = 1.5;

function loadFile(ctx: BaseAudioContext, url: string): Promise<AudioBuffer> {
  let p = decoded.get(url);
  if (!p) {
    p = fetch(url)
      .then((r) => r.arrayBuffer())
      .then((b) => ctx.decodeAudioData(b));
    decoded.set(url, p);
    p.catch(() => decoded.delete(url));
  }
  return p;
}

class FileTrack implements MusicSource {
  readonly output: GainNode;
  private src?: AudioBufferSourceNode;
  private startedAt = 0;
  private offset = 0;
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
    loadFile(this.ctx, this.def.url)
      .then((buf) => {
        if (this._stopped) return;
        const s = this.ctx.createBufferSource();
        s.buffer = buf;
        s.loop = true;
        const g = this.ctx.createGain();
        const when = Math.max(at, this.ctx.currentTime);
        const late = when - at > 0.25;
        g.gain.setValueAtTime(late ? 0.0001 : this.def.gain, when);
        if (late) g.gain.linearRampToValueAtTime(this.def.gain, when + LATE_FADE_SECONDS);
        s.connect(g).connect(this.output);
        this.offset = (resumeAt.get(this.def.url) ?? 0) % buf.duration;
        this.startedAt = when;
        s.start(when, this.offset);
        this.src = s;
      })
      .catch((e) => console.warn('[audio] could not load', this.def.url, e));
  }

  scheduleUntil(): void {}

  stop(at: number): void {
    if (this.src?.buffer) {
      const played = Math.max(0, at - this.startedAt);
      resumeAt.set(this.def.url, (this.offset + played) % this.src.buffer.duration);
    }
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
  /**
   * The opening song: it plays first whatever the map or hour, and holds the
   * music until it has played through once (or the player leaves the map).
   * `wanted` is the track the game asked for meanwhile; it takes over after.
   */
  private opening: { id: string; wanted: string | null; endsAt: number | null } | null = null;
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

  /**
   * Must be called from a user gesture (key press or tap). On phones the tap
   * that calls this may land on touchstart, which browsers do not count as a
   * gesture for audio, so the context can stay suspended until a later input:
   * every later key, tap or touch end resumes it (see resumeOnGesture).
   */
  async unlock(): Promise<void> {
    if (this.ctx) {
      if (this.ctx.state !== 'running') await this.ctx.resume();
      return;
    }
    // iOS: play through the ring/silent switch like a music app.
    const session = (navigator as { audioSession?: { type: string } }).audioSession;
    if (session) session.type = 'playback';
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
    // Decode recorded tracks early so the first crossfade into them is not late.
    for (const t of TRACKS) if (t.kind === 'file') void loadFile(ctx, t.url).catch(() => undefined);

    this.timer = window.setInterval(() => this.tick(), AUDIO.schedulerIntervalMs);
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) void this.ctx.suspend();
      else void this.ctx.resume();
    });
    // Start the music now, not after resume(): on phones resume() may wait
    // for the next gesture, and the track should simply begin when it does.
    if (this.pendingTrack) {
      const id = this.pendingTrack;
      this.pendingTrack = null;
      this.switchTo(id);
    }
    await ctx.resume();
  }

  /**
   * Resume a suspended context on any real gesture. Touch end and click count
   * as gestures on iOS and Android where touchstart does not; capture phase so
   * the on-screen controls cannot swallow it.
   */
  resumeOnGesture(): void {
    const kick = () => {
      const ctx = this.ctx;
      if (!ctx || ctx.state === 'running' || document.hidden) return;
      void ctx.resume();
      // Old iOS only unlocks once a sound starts inside the gesture.
      const s = ctx.createBufferSource();
      s.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      s.connect(ctx.destination);
      s.start();
    };
    for (const type of ['pointerup', 'touchend', 'click', 'keydown'])
      window.addEventListener(type, kick, { capture: true, passive: true });
  }

  // -------------------------------------------------------------------------
  // Music

  /**
   * Start the opening song from its beginning. Call it on the first key press
   * or tap, before the world asks for its own music.
   */
  startOpening(id: string): void {
    const def = TRACKS_BY_ID[id];
    if (!def) return;
    this.opening = { id, wanted: this.current?.id ?? this.pendingTrack, endsAt: null };
    if (def.kind === 'file') resumeAt.delete(def.url);
    this.switchTo(id);
  }

  /**
   * Let situational music take over from the opening song. With `follow`, the
   * track the game asked for meanwhile fades in now; without it, the caller is
   * about to ask for one itself (e.g. a map change).
   */
  endOpening(follow = true): void {
    const o = this.opening;
    if (!o) return;
    this.opening = null;
    if (follow && o.wanted) this.switchTo(o.wanted);
  }

  get openingPlaying(): boolean {
    return this.opening !== null;
  }

  /** Crossfade to a track. Requesting the playing track does nothing. */
  playMusic(id: string): void {
    if (this.opening) {
      this.opening.wanted = id;
      return;
    }
    this.switchTo(id);
  }

  private switchTo(id: string): void {
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
    if (this.opening?.id === id && def.kind === 'file') {
      const o = this.opening;
      // Hand over one crossfade before the song's end, so it plays through once.
      void loadFile(ctx, def.url)
        .then((buf) => {
          if (this.opening === o) o.endsAt = ctx.currentTime + buf.duration - fade;
        })
        .catch(() => this.endOpening());
    }
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

  /** `pitch` scales the sound's frequencies (each NPC's voice blips at its own pitch). */
  playSfx(name: string, gain = 1, pitch = 1): void {
    const fn = SFX[name];
    if (!fn || !this.started) return;
    this.withGain(gain, (dest, t, p) => fn(this.ctx!, dest, t, p * pitch));
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
    if (this.opening?.endsAt != null && now >= this.opening.endsAt) this.endOpening();
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
audio.resumeOnGesture();
