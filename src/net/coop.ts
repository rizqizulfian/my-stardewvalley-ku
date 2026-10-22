// Co-op for 2-4 players over WebRTC (PeerJS). One player hosts: their browser
// owns the world (clock, weather, fields, the shared purse) and relays
// everything between guests. Guests join with a short room code; nothing runs
// on a server of ours, PeerJS's free public broker only introduces the peers.

import Peer, { type DataConnection, type PeerOptions } from 'peerjs';
import type { DaySummary } from '../systems/day';
import { EV, bus } from '../systems/events';
import { state } from '../systems/GameState';
import { WorldSync, snapshot, type Change, type Touched, type WorldSnapshot } from './worldSync';

export const COOP = {
  maxPlayers: 4,
  /** Peer ids on the public broker are global, so ours carry a prefix. */
  idPrefix: 'lembah-padi-',
  codeLength: 5,
  /** No 0/O or 1/I/L, so a code read out loud survives. */
  alphabet: 'ABCDEFGHJKMNPQRSTUVWXYZ23456789',
  poseMs: 80,
  /** A still player is re-sent this often, so late joiners see them. */
  poseIdleMs: 1000,
  syncMs: 200,
  connectTimeoutMs: 15000,
  nameMax: 12,
} as const;

export type Role = 'solo' | 'host' | 'guest';

/** How a player looks this instant: enough to redraw them exactly elsewhere. */
export interface Pose {
  /** Map id. */
  m: string;
  /** Sprite position (px) and the feet y used for depth sorting. */
  x: number;
  y: number;
  fy: number;
  /** Body frame, and the tool sprite (texture '' when hidden). */
  f: string;
  tk: string;
  tf: string;
  fl: boolean;
  tb: boolean;
  /** Shadow shown (hidden while seated). */
  sh: boolean;
}

export interface PlayerInfo {
  id: string;
  name: string;
  /** 0..3, picks the name tag colour. */
  slot: number;
}

type Msg =
  | { t: 'hello'; name: string }
  | { t: 'welcome'; you: PlayerInfo; players: PlayerInfo[]; world: WorldSnapshot; at: Pose | null }
  | { t: 'full' }
  | { t: 'roster'; players: PlayerInfo[] }
  | { t: 'pose'; id: string; p: Pose }
  | { t: 'patch'; ch: Change[] }
  | { t: 'day'; summary: DaySummary }
  | { t: 'bed'; id: string };

/** Events on the game bus (see EV for the rest). */
export const NET = {
  /** Role, roster or room changed. */
  changed: 'net:changed',
  /** (id, Pose) another player moved. */
  pose: 'net:pose',
  /** (Touched) remote world changes were applied to `state`. */
  touched: 'net:touched',
  /** (WelcomeInfo) we joined a room: the scene moves next to the host. */
  joined: 'net:joined',
  /** (DaySummary) the host went to bed; everyone wakes up to the new day. */
  day: 'net:day',
  /** (reason) the connection to the host is gone. */
  lost: 'net:lost',
} as const;

export interface WelcomeInfo {
  at: Pose | null;
}

function makeCode(): string {
  let s = '';
  for (let i = 0; i < COOP.codeLength; i++) s += COOP.alphabet[Math.floor(Math.random() * COOP.alphabet.length)];
  return s;
}

export function cleanCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, COOP.codeLength);
}

/** `?peer=localhost:9000` points at a self-run PeerJS server (handy for testing offline). */
function peerOptions(): PeerOptions {
  const q = new URLSearchParams(window.location.search).get('peer');
  if (!q) return { debug: 1 };
  const [host, port] = q.split(':');
  return { host, port: Number(port) || 9000, path: '/', secure: false, debug: 1 };
}

class Coop {
  role: Role = 'solo';
  code = '';
  me: PlayerInfo = { id: 'h', name: 'Host', slot: 0 };
  players: PlayerInfo[] = [];
  /** A short status line for the panel ("Connecting...", errors). */
  status = '';
  private peer: Peer | null = null;
  /** Host: one connection per guest id. Guest: just the host under 'h'. */
  private conns = new Map<string, DataConnection>();
  /** Host: which player each guest connection belongs to. */
  private connIds = new WeakMap<DataConnection, string>();
  private readonly sync = new WorldSync();
  private pose: Pose | null = null;
  private sentPose = '';
  private sentPoseAt = 0;
  private timers: number[] = [];
  /** Steps the clock to the host's minute; the World scene installs it. */
  followMinute: (minute: number) => void = (m) => (state.minute = m);

  get active(): boolean {
    return this.role !== 'solo';
  }

  get isHost(): boolean {
    return this.role === 'host';
  }

  get isGuest(): boolean {
    return this.role === 'guest';
  }

  /** Others in the room. */
  get others(): PlayerInfo[] {
    return this.players.filter((p) => p.id !== this.me.id);
  }

  nameOf(id: string): string {
    return this.players.find((p) => p.id === id)?.name ?? 'Someone';
  }

  setPose(p: Pose): void {
    this.pose = p;
  }

  private changed(status?: string): void {
    if (status !== undefined) this.status = status;
    bus.emit(NET.changed);
  }

  /** Open a room. Resolves with its code once the broker has registered it. */
  host(name: string): Promise<string> {
    this.leave();
    this.me = { id: 'h', name, slot: 0 };
    this.players = [this.me];
    this.changed('Opening a room...');
    return new Promise((resolve, reject) => {
      const tryOpen = (attempt: number) => {
        const code = makeCode();
        const peer = new Peer(COOP.idPrefix + code, peerOptions());
        this.peer = peer;
        peer.on('open', () => {
          this.role = 'host';
          this.code = code;
          this.sync.reset(state);
          this.startLoops();
          this.changed('');
          resolve(code);
        });
        peer.on('connection', (c) => this.onGuestConnection(c));
        peer.on('error', (e) => {
          if (e.type === 'unavailable-id' && attempt < 3) {
            peer.destroy();
            tryOpen(attempt + 1);
            return;
          }
          if (this.role === 'host' && e.type !== 'peer-unavailable') {
            this.changed(`Network trouble: ${e.type}`);
            return;
          }
          if (this.role !== 'host') {
            this.leave();
            this.changed(errorText(e.type));
            reject(new Error(e.type));
          }
        });
        peer.on('disconnected', () => {
          // Lost the broker only; guests already joined stay connected. Re-register so new ones can.
          if (this.role === 'host' && !peer.destroyed) peer.reconnect();
        });
      };
      tryOpen(0);
    });
  }

  /** Join a room by code. Resolves once the host has sent the world. */
  join(rawCode: string, name: string): Promise<void> {
    this.leave();
    const code = cleanCode(rawCode);
    this.changed('Connecting...');
    return new Promise((resolve, reject) => {
      let settled = false;
      const fail = (why: string) => {
        if (settled) return;
        settled = true;
        this.leave();
        this.changed(why);
        reject(new Error(why));
      };
      const peer = new Peer(peerOptions());
      this.peer = peer;
      const timer = window.setTimeout(() => fail('No answer from that room. Check the code, or try another network.'), COOP.connectTimeoutMs);
      peer.on('error', (e) => {
        if (!settled) {
          window.clearTimeout(timer);
          fail(errorText(e.type));
        }
      });
      peer.on('open', () => {
        const c = peer.connect(COOP.idPrefix + code, { reliable: true, serialization: 'json' });
        this.conns.set('h', c);
        c.on('open', () => c.send({ t: 'hello', name } satisfies Msg));
        c.on('data', (raw) => {
          const msg = raw as Msg;
          if (msg.t === 'full') {
            window.clearTimeout(timer);
            fail(`That room is full (${COOP.maxPlayers} players).`);
            return;
          }
          if (msg.t === 'welcome') {
            window.clearTimeout(timer);
            settled = true;
            this.role = 'guest';
            this.code = code;
            this.me = msg.you;
            this.players = msg.players;
            Object.assign(state, msg.world);
            this.sync.reset(state);
            this.startLoops();
            this.changed('');
            bus.emit(NET.joined, { at: msg.at } satisfies WelcomeInfo);
            resolve();
            return;
          }
          this.onMessage('h', msg);
        });
        c.on('close', () => {
          if (settled && this.role === 'guest') {
            this.leave();
            this.changed('The host left the room.');
            bus.emit(NET.lost, 'The host closed the room.');
          }
        });
      });
    });
  }

  /** Close the room or leave it. Solo play carries on from here. */
  leave(): void {
    for (const t of this.timers) window.clearInterval(t);
    this.timers = [];
    for (const c of this.conns.values()) c.close();
    this.conns.clear();
    this.peer?.destroy();
    this.peer = null;
    const was = this.role;
    this.role = 'solo';
    this.code = '';
    this.players = [];
    this.pose = null;
    this.sentPose = '';
    if (was !== 'solo') this.changed('');
  }

  // ---------------------------------------------------------------------------
  // Host side

  private onGuestConnection(c: DataConnection): void {
    c.on('data', (raw) => {
      const msg = raw as Msg;
      const id = this.connIds.get(c);
      if (msg.t === 'hello') {
        if (id) return;
        if (this.players.length >= COOP.maxPlayers) {
          c.send({ t: 'full' } satisfies Msg);
          window.setTimeout(() => c.close(), 500);
          return;
        }
        const used = new Set(this.players.map((p) => p.slot));
        const slot = [1, 2, 3].find((s) => !used.has(s)) ?? 1;
        const you: PlayerInfo = { id: `g${slot}`, name: cleanName(msg.name) || `Friend ${slot}`, slot };
        this.connIds.set(c, you.id);
        // Hand over everything pending first, so the snapshot and later patches line up.
        this.flush();
        this.conns.set(you.id, c);
        this.players.push(you);
        c.send({ t: 'welcome', you, players: this.players, world: snapshot(state), at: this.pose } satisfies Msg);
        this.broadcast({ t: 'roster', players: this.players }, you.id);
        for (const [pid, p] of this.lastPoses) c.send({ t: 'pose', id: pid, p } satisfies Msg);
        bus.emit(EV.notice, `${you.name} joined the farm!`);
        this.changed();
        return;
      }
      if (id) this.onMessage(id, msg);
    });
    c.on('close', () => this.dropGuest(c));
    c.on('error', () => this.dropGuest(c));
  }

  private dropGuest(c: DataConnection): void {
    const id = this.connIds.get(c);
    if (!id || this.conns.get(id) !== c) return;
    this.conns.delete(id);
    this.lastPoses.delete(id);
    const name = this.nameOf(id);
    this.players = this.players.filter((p) => p.id !== id);
    this.broadcast({ t: 'roster', players: this.players });
    bus.emit(NET.pose, id, null);
    bus.emit(EV.notice, `${name} left the farm.`);
    this.changed();
  }

  /** The host's bed ended the day: guests wake up to it too. */
  newDay(summary: DaySummary): void {
    if (!this.isHost) return;
    this.flush();
    this.broadcast({ t: 'day', summary });
  }

  /** A guest got into bed. */
  inBed(): void {
    if (this.isGuest) this.send({ t: 'bed', id: this.me.id });
  }

  // ---------------------------------------------------------------------------
  // Both sides

  private lastPoses = new Map<string, Pose>();

  private onMessage(from: string, msg: Msg): void {
    switch (msg.t) {
      case 'pose':
        this.lastPoses.set(msg.id, msg.p);
        bus.emit(NET.pose, msg.id, msg.p);
        if (this.isHost) this.broadcast(msg, from);
        break;
      case 'patch': {
        const touched = this.sync.apply(state, msg.ch);
        if (this.isHost) {
          // Everyone else gets it; the sender gets it back (minus gold) so all end up equal.
          this.broadcast(msg, from);
          const echo = msg.ch.filter(([k]) => k !== 'gold');
          if (echo.length) this.conns.get(from)?.send({ t: 'patch', ch: echo } satisfies Msg);
        }
        this.onTouched(touched);
        break;
      }
      case 'roster': {
        const before = new Set(this.players.map((p) => p.id));
        const now = new Set(msg.players.map((p) => p.id));
        for (const p of msg.players) if (!before.has(p.id)) bus.emit(EV.notice, `${p.name} joined the farm!`);
        for (const p of this.players)
          if (!now.has(p.id)) {
            bus.emit(EV.notice, `${p.name} left the farm.`);
            bus.emit(NET.pose, p.id, null);
          }
        this.players = msg.players;
        this.changed();
        break;
      }
      case 'day':
        bus.emit(NET.day, msg.summary);
        break;
      case 'bed':
        if (this.isHost) bus.emit(EV.notice, `${this.nameOf(msg.id)} is in bed. Sleep when you are ready.`);
        break;
      default:
        break;
    }
  }

  private onTouched(t: Touched): void {
    if (t.minute !== undefined) {
      if (t.minute < state.minute) state.minute = t.minute;
      else this.followMinute(t.minute);
    }
    if (t.gold) bus.emit(EV.goldChanged, state.gold);
    bus.emit(NET.touched, t);
  }

  private send(msg: Msg): void {
    const c = this.conns.get('h');
    if (c?.open) c.send(msg);
  }

  /** Host: to every guest but `except`. */
  private broadcast(msg: Msg, except?: string): void {
    for (const [id, c] of this.conns) if (id !== except && c.open) c.send(msg);
  }

  /** Send world changes now. */
  flush(): void {
    if (!this.active) return;
    const ch = this.sync.collect(state);
    if (!ch.length) return;
    const msg: Msg = { t: 'patch', ch };
    if (this.isHost) this.broadcast(msg);
    else this.send(msg);
  }

  private sendPose(): void {
    const p = this.pose;
    if (!p) return;
    const key = JSON.stringify(p);
    const now = performance.now();
    if (key === this.sentPose && now - this.sentPoseAt < COOP.poseIdleMs) return;
    this.sentPose = key;
    this.sentPoseAt = now;
    const msg: Msg = { t: 'pose', id: this.me.id, p };
    if (this.isHost) this.broadcast(msg);
    else this.send(msg);
  }

  private startLoops(): void {
    this.timers.push(window.setInterval(() => this.sendPose(), COOP.poseMs));
    this.timers.push(window.setInterval(() => this.flush(), COOP.syncMs));
  }
}

export function cleanName(raw: string): string {
  return raw.replace(/[^\w .'-]/g, '').trim().slice(0, COOP.nameMax);
}

function errorText(type: string): string {
  switch (type) {
    case 'peer-unavailable':
      return 'No room with that code. Check it with the host.';
    case 'network':
    case 'server-error':
    case 'socket-error':
    case 'socket-closed':
      return 'Could not reach the co-op service. Check your internet.';
    case 'browser-incompatible':
      return 'This browser cannot do co-op. Try Chrome, Safari or Firefox.';
    case 'webrtc':
      return 'Could not connect to the other player (the network may block it).';
    default:
      return `Could not connect (${type}).`;
  }
}

export const coop = new Coop();

// Closing the tab says goodbye at once instead of leaving the others to time out.
window.addEventListener('pagehide', () => coop.leave());
