// Co-op for 2-4 players. One player hosts: their browser owns the world
// (clock, weather, fields, the shared purse) and relays everything between
// guests. Messages travel through a free public MQTT broker over a secure
// WebSocket (the same kind of link a web chat uses), so it works on mobile
// data and strict Wi-Fi where direct player-to-player links get blocked. No
// server or account of ours; a room is just a set of topics named by its code.

import mqtt, { type IClientOptions, type MqttClient } from 'mqtt';
import type { DaySummary } from '../systems/day';
import { EV, bus } from '../systems/events';
import { state } from '../systems/GameState';
import { WorldSync, snapshot, type Change, type Touched, type WorldSnapshot } from './worldSync';

export const COOP = {
  maxPlayers: 4,
  /** Topics on the public brokers are global, so ours carry a prefix. */
  topicPrefix: 'lembah-padi/v1/',
  codeLength: 5,
  /** No 0/O or 1/I/L, so a code read out loud survives. */
  alphabet: 'ABCDEFGHJKMNPQRSTUVWXYZ23456789',
  poseMs: 80,
  /** A still player is re-sent this often, so late joiners see them. */
  poseIdleMs: 1000,
  syncMs: 200,
  /** Reaching a broker. */
  brokerTimeoutMs: 10000,
  /** A room that exists answers at once (its marker is kept by the broker). */
  roomCheckMs: 6000,
  /** Then the host's game sends the world. */
  welcomeMs: 15000,
  /** A host that drops off this long (not just a hiccup) has left. */
  hostGoneMs: 12000,
  keepaliveS: 15,
  nameMax: 12,
} as const;

export type Role = 'solo' | 'host' | 'guest';

/** How a player looks this instant: enough to redraw them exactly elsewhere. */
export interface Pose {
  /** Map id. */
  m: string;
  /** Body texture: which farmer they chose. */
  b?: string;
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
  | { t: 'bed'; id: string }
  | { t: 'closed' };

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

/**
 * Free public brokers, tried in this order when hosting. The room code's first
 * letter says which one the room lives on, so friends land on the same one.
 * `?mqtt=ws://localhost:8888` points everyone at a self-run broker (testing).
 */
function brokers(): string[] {
  const own = new URLSearchParams(window.location.search).get('mqtt');
  if (own) return [own];
  return ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt', 'wss://test.mosquitto.org:8081/mqtt'];
}

function brokerOf(code: string): number {
  return Math.max(0, COOP.alphabet.indexOf(code[0])) % brokers().length;
}

function codeOn(broker: number): string {
  for (;;) {
    const c = makeCode();
    if (brokerOf(c) === broker) return c;
  }
}

function connect(url: string, opts: IClientOptions): Promise<MqttClient> {
  return new Promise((resolve, reject) => {
    const client = mqtt.connect(url, { keepalive: COOP.keepaliveS, reconnectPeriod: 2000, connectTimeout: COOP.brokerTimeoutMs, clean: true, ...opts });
    const timer = window.setTimeout(() => {
      client.end(true);
      reject(new Error('timeout'));
    }, COOP.brokerTimeoutMs);
    client.once('connect', () => {
      window.clearTimeout(timer);
      resolve(client);
    });
  });
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

/** What travels to the host: who sent it, and the message. */
interface Envelope {
  f: string;
  m: Msg | { t: 'bye' };
}

class Coop {
  role: Role = 'solo';
  code = '';
  me: PlayerInfo = { id: 'h', name: 'Host', slot: 0 };
  players: PlayerInfo[] = [];
  /** A short status line for the panel ("Connecting...", errors). */
  status = '';
  private client: MqttClient | null = null;
  /** Topic root of the room. */
  private base = '';
  /** This browser's id on the broker. */
  private cid = '';
  /** Host: player id -> that guest's broker id. */
  private guests = new Map<string, string>();
  private hostGoneTimer = 0;
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

  /** Open a room. Resolves with its code once a broker has it. */
  async host(name: string): Promise<string> {
    this.leave();
    this.me = { id: 'h', name, slot: 0 };
    this.players = [this.me];
    this.changed('Opening a room...');
    const urls = brokers();
    for (let i = 0; i < urls.length; i++) {
      const code = codeOn(i);
      const base = COOP.topicPrefix + code;
      this.cid = randomId();
      let client: MqttClient;
      try {
        // If this browser vanishes, the broker itself takes the room marker down.
        client = await connect(urls[i], { clientId: `lp-${this.cid}`, will: { topic: `${base}/room`, payload: '', retain: true, qos: 1 } });
      } catch {
        continue;
      }
      this.client = client;
      this.base = base;
      this.role = 'host';
      this.code = code;
      client.on('message', (topic, raw) => {
        if (topic !== `${base}/h`) return;
        const env = parse<Envelope>(raw);
        if (env) this.onGuestMessage(env);
      });
      // Back after a dropped link: put the room marker up again.
      client.on('connect', () => this.openRoom());
      this.openRoom();
      this.sync.reset(state);
      this.startLoops();
      this.changed('');
      return code;
    }
    this.leave();
    this.changed(STUCK.service);
    throw new Error('no broker');
  }

  private openRoom(): void {
    if (!this.isHost || !this.client) return;
    this.client.subscribe(`${this.base}/h`);
    this.client.publish(`${this.base}/room`, '1', { retain: true, qos: 1 });
  }

  /** Join a room by code. Resolves once the host has sent the world. */
  async join(rawCode: string, name: string): Promise<void> {
    this.leave();
    const code = cleanCode(rawCode);
    const base = COOP.topicPrefix + code;
    this.changed('Connecting...');
    this.cid = randomId();
    const bye: Envelope = { f: this.cid, m: { t: 'bye' } };
    let client: MqttClient;
    try {
      client = await connect(brokers()[brokerOf(code)], { clientId: `lp-${this.cid}`, will: { topic: `${base}/h`, payload: JSON.stringify(bye), qos: 1, retain: false } });
    } catch {
      this.leave();
      this.changed(STUCK.service);
      throw new Error('no broker');
    }
    this.client = client;
    this.base = base;
    this.changed('Looking for the room...');
    return new Promise((resolve, reject) => {
      let stage: 'room' | 'welcome' | 'in' = 'room';
      let timer = window.setTimeout(() => fail(STUCK.room), COOP.roomCheckMs);
      const fail = (why: string) => {
        if (stage === 'in') return;
        window.clearTimeout(timer);
        stage = 'in';
        this.leave();
        this.changed(why);
        reject(new Error(why));
      };
      client.on('message', (topic, raw) => {
        if (topic === `${base}/room`) {
          const up = raw.toString() === '1';
          if (stage === 'room' && up) {
            stage = 'welcome';
            window.clearTimeout(timer);
            timer = window.setTimeout(() => fail(STUCK.welcome), COOP.welcomeMs);
            this.changed('Found the room, saying hello...');
            this.send({ t: 'hello', name });
          } else if (this.isGuest) this.hostSeen(up);
          return;
        }
        const msg = parse<Msg>(raw);
        if (!msg) return;
        if (stage === 'welcome' && msg.t === 'full') return fail(`That room is full (${COOP.maxPlayers} players).`);
        if (stage === 'welcome' && msg.t === 'welcome') {
          window.clearTimeout(timer);
          stage = 'in';
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
        if (this.isGuest) this.onMessage('h', msg);
      });
      // Inbox first, then the room marker (its kept copy arrives right after subscribing).
      client.subscribe(`${base}/g/${this.cid}`, () => client.subscribe(`${base}/room`));
    });
  }

  /** Guests: the host's room marker went down (or came back up). */
  private hostSeen(up: boolean): void {
    window.clearTimeout(this.hostGoneTimer);
    this.hostGoneTimer = 0;
    if (up) return;
    this.hostGoneTimer = window.setTimeout(() => {
      if (!this.isGuest) return;
      this.leave();
      this.changed('The host left the room.');
      bus.emit(NET.lost, 'The host closed the room.');
    }, COOP.hostGoneMs);
  }

  /** Close the room or leave it. Solo play carries on from here. */
  leave(): void {
    for (const t of this.timers) window.clearInterval(t);
    this.timers = [];
    window.clearTimeout(this.hostGoneTimer);
    const c = this.client;
    if (c) {
      if (this.isHost) {
        this.broadcast({ t: 'closed' });
        c.publish(`${this.base}/room`, '', { retain: true, qos: 1 });
      }
      else c.publish(`${this.base}/h`, JSON.stringify({ f: this.cid, m: { t: 'bye' } } satisfies Envelope));
      c.end(false);
    }
    this.client = null;
    this.guests.clear();
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

  private idOf(cid: string): string | undefined {
    for (const [id, c] of this.guests) if (c === cid) return id;
    return undefined;
  }

  private onGuestMessage({ f: cid, m: msg }: Envelope): void {
    const id = this.idOf(cid);
    if (msg.t === 'bye') {
      if (id) this.dropGuest(id);
      return;
    }
    if (msg.t !== 'hello') {
      if (id) this.onMessage(id, msg);
      return;
    }
    if (id) return;
    if (this.players.length >= COOP.maxPlayers) {
      this.publishTo(cid, { t: 'full' });
      return;
    }
    const used = new Set(this.players.map((p) => p.slot));
    const slot = [1, 2, 3].find((s) => !used.has(s)) ?? 1;
    const you: PlayerInfo = { id: `g${slot}`, name: cleanName(msg.name) || `Friend ${slot}`, slot };
    // Hand over everything pending first, so the snapshot and later patches line up.
    this.flush();
    this.guests.set(you.id, cid);
    this.players.push(you);
    this.publishTo(cid, { t: 'welcome', you, players: this.players, world: snapshot(state), at: this.pose });
    this.broadcast({ t: 'roster', players: this.players }, you.id);
    for (const [pid, p] of this.lastPoses) this.publishTo(cid, { t: 'pose', id: pid, p });
    bus.emit(EV.notice, `${you.name} joined the farm!`);
    this.changed();
  }

  private dropGuest(id: string): void {
    if (!this.guests.delete(id)) return;
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
          const cid = this.guests.get(from);
          if (echo.length && cid) this.publishTo(cid, { t: 'patch', ch: echo });
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
      case 'closed':
        if (this.isGuest) {
          this.leave();
          this.changed('The host left the room.');
          bus.emit(NET.lost, 'The host closed the room.');
        }
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

  /** Guest: to the host. */
  private send(msg: Msg): void {
    this.client?.publish(`${this.base}/h`, JSON.stringify({ f: this.cid, m: msg } satisfies Envelope));
  }

  /** Host: to one guest's inbox. */
  private publishTo(cid: string, msg: Msg): void {
    this.client?.publish(`${this.base}/g/${cid}`, JSON.stringify(msg));
  }

  /** Host: to every guest but `except`. */
  private broadcast(msg: Msg, except?: string): void {
    if (!this.client) return;
    const raw = JSON.stringify(msg);
    for (const [id, cid] of this.guests) if (id !== except) this.client.publish(`${this.base}/g/${cid}`, raw);
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

function parse<T>(raw: Uint8Array): T | null {
  try {
    return JSON.parse(new TextDecoder().decode(raw)) as T;
  } catch {
    return null;
  }
}

/** Why a join gave up, by how far it got. */
const STUCK = {
  service: 'Could not reach the co-op service. Check your internet and try again.',
  room: 'No room with that code. Check it with the host, and that their game is still open.',
  welcome: "Found the room, but the host's game did not reply. Ask the host to keep the game in front and try again.",
} as const;

export const coop = new Coop();

// Closing the tab says goodbye at once instead of leaving the others to time out.
window.addEventListener('pagehide', () => coop.leave());
