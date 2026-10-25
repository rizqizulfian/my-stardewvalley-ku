// The disco barn next to the kandang: a violet barn with a neon "DISKO"
// sign that cycles colours, and inside, the disco itself: a mirror ball,
// a DJ booth, speakers that thump, and a doodle puppy dancing under the ball.

import { PLAYER } from '../config';
import { CHAR_FRAMES, buildCharacterFrames, type CharacterLook } from './characters';
import { PixelGrid, hash2, outline, shade, type ShadeOptions, type TextureSink } from './pixel';
import { RAMPS, type ColorName, type Ramp } from './palette';
import { textGrid } from './font';
import { dogFrame, type DogPose } from './extras';

export const DISCO_TEXTURES = {
  barn: 'disco-barn',
  ball: 'disco-ball',
  puppy: 'disco-puppy',
  booth: 'disco-booth',
  speaker: 'disco-speaker',
  sign: 'disco-sign',
  speck: 'disco-speck',
} as const;

/** The disco song runs at about 165 bpm. */
export const DISCO_BEAT_MS = 60000 / 165;

export const crowdTexture = (i: number) => `disco-crowd-${i}`;

// ---------------------------------------------------------------------------
// The crowd: party-goers mixed from a few hair, skin and outfit choices.

const HAIRS: Array<CharacterLook['hair']> = [
  ['ink', 'night', 'plum'],
  ['bark', 'umber', 'clay'],
  ['umber', 'clay', 'tan'],
  ['violet', 'lilac', 'rose'],
  ['clay', 'amber', 'gold'],
  ['deep', 'sea', 'sky'],
];
const SKINS: Array<CharacterLook['skin']> = [
  ['umber', 'skinShade', 'skin', 'peach'],
  ['bark', 'umber', 'skinShade', 'skin'],
  ['umber', 'skinShade', 'skin', 'cream'],
];
const SHIRTS: Array<CharacterLook['shirt']> = [
  ['wine', 'brick', 'coral', 'peach'],
  ['night', 'violet', 'lilac', 'rose'],
  ['deep', 'sea', 'sky', 'foam'],
  ['clay', 'amber', 'gold', 'cream'],
  ['pine', 'moss', 'leaf', 'lime'],
  ['ink', 'night', 'plum', 'mauve'],
  ['wine', 'rose', 'peach', 'cream'],
];
const PANTS: Array<CharacterLook['pants']> = [
  ['ink', 'night', 'plum'],
  ['deep', 'sea', 'sky'],
  ['bark', 'umber', 'clay'],
  ['plum', 'mauve', 'haze'],
];
const HATS: Array<CharacterLook['hat']> = [
  undefined,
  undefined,
  undefined,
  { style: 'cap', ramp: ['wine', 'brick', 'coral', 'peach'] },
  { style: 'hijab', ramp: ['night', 'violet', 'lilac', 'rose'] },
  { style: 'cap', ramp: ['ink', 'night', 'plum', 'mauve'] },
  { style: 'hijab', ramp: ['deep', 'sea', 'sky', 'foam'] },
];
const STYLES: Array<CharacterLook['hairStyle']> = ['short', 'long', 'bun', 'short', 'long'];
const OUTFITS: Array<CharacterLook['outfit']> = ['shirt', 'shirt', 'dress', 'coat', 'shirt', 'dress'];

export const CROWD_SIZE = 18;

function crowdLook(i: number): CharacterLook {
  const pick = <T>(list: T[], salt: number) => list[Math.floor(hash2(i, salt, 404) * list.length)];
  const outfit = pick(OUTFITS, 5);
  return {
    hair: pick(HAIRS, 1),
    skin: pick(SKINS, 2),
    eye: 'night',
    shirt: pick(SHIRTS, 3),
    pants: pick(PANTS, 4),
    shoes: ['ink', 'night'],
    outfit,
    inner: outfit === 'coat' ? ['cream', 'mist'] : undefined,
    hairStyle: pick(STYLES, 6),
    hat: pick(HATS, 7),
    scarf: NEON[i % NEON.length],
    small: i % 7 === 5,
  };
}

/** Neon colours the sign, lights and floor cycle through. */
export const NEON: ColorName[] = ['rose', 'sky', 'gold', 'lime', 'lilac', 'coral'];

export const DISCO_BARN = { w: 112, h: 92, frames: 6 } as const;
export const DISCO_BALL = { w: 20, h: 38, frames: 4 } as const;

/** Puppy sheet: the dog's frame size; the dance is one frame per beat. */
export const PUPPY = {
  w: 30,
  h: 32,
  /** Front, lean left, squash, lean right, point up, point low, arms up, back. */
  dance: [0, 1, 0, 3, 4, 5, 4, 5, 1, 3, 1, 3, 6, 2, 6, 2, 0, 1, 0, 3, 7, 7, 4, 4],
} as const;

const PUPPY_POSES: DogPose[] = [
  { dx: 0, head: 0, armL: 'down', armR: 'down' },
  { dx: -1, head: -2, armL: 'out', armR: 'down' },
  { dx: 0, head: 0, armL: 'out', armR: 'out', squash: true },
  { dx: 1, head: 2, armL: 'down', armR: 'out' },
  { dx: 1, head: 1, armL: 'low', armR: 'point' },
  { dx: -1, head: -1, armL: 'low', armR: 'low' },
  { dx: 0, head: 0, armL: 'up', armR: 'up' },
  { dx: 0, head: 0, back: true, armL: 'out', armR: 'out' },
];

function block(g: PixelGrid, x: number, y: number, w: number, h: number, ramp: Ramp, o: ShadeOptions = {}): void {
  g.stamp(shade(new PixelGrid(g.w, g.h).fillRect(x, y, w, h, 'ink'), ramp, { rim: 0.3, gradient: 0.5, ...o }));
}

// ---------------------------------------------------------------------------
// Outside: the kandang's gambrel shape in deep violet, neon on the front.

function discoBarn(frame: number): PixelGrid {
  const { w: W, h: H } = DISCO_BARN;
  const g = new PixelGrid(W, H);
  const cx = W / 2;
  const neon = (i: number) => NEON[(frame + i) % NEON.length];
  const half = (y: number) => (y < 8 ? -1 : y < 20 ? Math.round((32 * (y - 8)) / 12) : y < 46 ? Math.round(32 + (18 * (y - 20)) / 26) : 50);
  const roof = new PixelGrid(W, H);
  for (let y = 4; y < 50; y++) {
    const h = half(y + 4) + 4;
    if (h > 3) roof.fillRect(cx - h, y, h * 2, 1, 'ink');
  }
  g.stamp(shade(roof, ['ink', 'night', 'plum'], { rim: 0.3, gradient: 0.5 }));
  const front = new PixelGrid(W, H);
  for (let y = 8; y < H - 6; y++) {
    const h = half(y);
    if (h > 0) front.fillRect(cx - h, y, h * 2, 1, 'ink');
  }
  const body = shade(front, ['night', 'violet', 'lilac'], { rim: 0.2, gradient: 0.5, dither: 0.3, bias: -0.15 });
  body.forEachFilled((x, y) => {
    if ((x - 6) % 6 === 0) body.set(x, y, 'night');
  });
  g.stamp(body);
  // Neon tube trim along the gable and the eaves; each run its own colour.
  for (let y = 8; y < 46; y++) {
    const h = half(y);
    if (h <= 0) continue;
    g.fillRect(cx - h, y, 2, 1, neon(0)).fillRect(cx + h - 2, y, 2, 1, neon(0));
  }
  g.fillRect(cx - 50, 46, 3, H - 52, neon(1)).fillRect(cx + 47, 46, 3, H - 52, neon(1));
  g.fillRect(cx - 50, 46, 100, 2, neon(2));
  block(g, 5, H - 7, W - 10, 6, RAMPS.stone, { noise: 0.3, seed: 191 });
  // Sign board: "DISKO", the letters one neon colour each.
  g.fillRect(cx - 24, 38, 48, 11, 'ink').fillRect(cx - 24, 38, 48, 1, 'plum');
  let lx = cx - 17;
  ['D', 'I', 'S', 'K', 'O'].forEach((ch, i) => {
    const t = textGrid(ch, neon(i + 3));
    g.stamp(t, lx, 40);
    lx += t.w + 3;
  });
  // A mirror ball hanging in the loft opening.
  g.fillRect(cx - 9, 18, 18, 18, 'cream');
  g.fillRect(cx - 7, 20, 14, 15, 'ink');
  g.line(cx, 20, cx, 24, 'haze');
  g.fillEllipse(cx - 4, 24, 8, 8, 'haze');
  for (let y = 24; y < 32; y++)
    for (let x = cx - 4; x < cx + 4; x++) if (g.colorAt(x, y) === 'haze') g.set(x, y, (x + y + frame) % 3 === 0 ? 'cream' : (x * 2 + y) % 4 === 0 ? 'mauve' : 'haze');
  for (let i = 0; i < 4; i++) {
    const a = frame * 0.8 + i * 1.6;
    g.set(cx + Math.round(Math.cos(a) * 6), 28 + Math.round(Math.sin(a) * 4), neon(i));
  }
  // Double doors with light spilling out of the gap.
  g.fillRect(cx - 19, 52, 38, H - 59, 'cream');
  for (const dx of [cx - 17, cx + 1]) {
    block(g, dx, 54, 16, H - 61, ['night', 'violet', 'lilac'], { gradient: 0.4 });
    g.line(dx, 54, dx + 15, H - 8, 'cream').line(dx + 15, 54, dx, H - 8, 'cream');
    g.fillRect(dx, 54, 16, 1, 'cream').fillRect(dx, H - 8, 16, 1, 'cream');
  }
  g.fillRect(cx - 1, 54, 2, H - 61, neon(2));
  // Windows flashing party colours.
  for (const [k, wx] of [14, W - 26].entries()) {
    g.fillRect(wx - 1, 55, 14, 13, 'cream');
    g.fillRect(wx + 1, 57, 10, 9, neon(k * 2 + 1));
    g.fillRect(wx + 6, 57, 1, 9, 'cream').fillRect(wx + 1, 61, 10, 1, 'cream');
    g.set(wx + 2, 58, 'cream').set(wx + 3, 58, 'cream');
  }
  // Music notes floating over the roof.
  const notes: Array<[number, number]> = [
    [cx - 26, 10],
    [cx + 22, 6],
  ];
  notes.forEach(([nx, ny], i) => {
    const y = ny - ((frame + i * 2) % 4);
    g.fillRect(nx, y, 1, 5, neon(i + 4)).fillRect(nx - 2, y + 4, 2, 2, neon(i + 4)).fillRect(nx + 1, y, 2, 1, neon(i + 4));
  });
  return outline(g, { steps: 2 });
}

// ---------------------------------------------------------------------------
// Inside.

/** The mirror ball on its chain; the facets roll round over the frames. */
function discoBall(frame: number): PixelGrid {
  const { w: W, h: H } = DISCO_BALL;
  const g = new PixelGrid(W, H);
  const cx = 10;
  const cy = 29;
  g.fillRect(cx - 1, 0, 1, 20, 'mauve');
  for (let y = 1; y < 20; y += 3) g.set(cx - 1, y, 'haze');
  g.fillRect(cx - 3, 19, 5, 2, 'plum');
  const r = 7.5;
  for (let y = cy - 8; y <= cy + 8; y++)
    for (let x = cx - 9; x <= cx + 8; x++) {
      const dx = (x + 0.5 - cx) / r;
      const dy = (y + 0.5 - cy) / r;
      const d = dx * dx + dy * dy;
      if (d > 1) continue;
      // Facet grid: columns slide sideways with the frame, like a turning ball.
      const lon = Math.floor((Math.asin(Math.max(-1, Math.min(1, dx / Math.sqrt(1 - Math.min(0.99, dy * dy))))) * 4) / Math.PI * 2 + frame);
      const lat = Math.floor((y - cy + 8) / 2.5);
      const seam = (x + frame) % 3 === 0 || (y - cy + 9) % 3 === 0;
      const light = -dx - dy * 1.2 + (hash2(lon, lat, 7) - 0.5) * 1.2;
      let c: ColorName = light > 0.9 ? 'cream' : light > 0.2 ? 'mist' : light > -0.5 ? 'haze' : 'mauve';
      if (seam) c = light > 0.4 ? 'haze' : 'plum';
      if (d > 0.8 && !seam) c = light > 0 ? 'haze' : 'plum';
      g.set(x, y, c);
    }
  // Two glints that move with the turn.
  const gx = cx - 4 + (frame % 2);
  g.set(gx, cy - 4, 'cream').set(gx + 1, cy - 4, 'cream').set(gx, cy - 5, 'cream');
  g.set(cx + 3 - frame, cy + 2, 'cream');
  return outline(g, { color: 'ink' });
}

/** A DJ booth: turntables on a glowing desk, a laptop sticker. Two frames: the records turn. */
function booth(frame: number): PixelGrid {
  const W = 48;
  const H = 30;
  const g = new PixelGrid(W, H);
  block(g, 2, 13, W - 4, 15, ['ink', 'night', 'plum'], { gradient: 0.6 });
  g.fillRect(2, 13, W - 4, 3, 'mauve').fillRect(2, 13, W - 4, 1, 'haze');
  // Neon strip along the front panel.
  for (let x = 4; x < W - 4; x++) g.set(x, 21, NEON[Math.floor((x + frame * 4) / 6) % NEON.length]);
  g.fillRect(4, 24, W - 8, 1, 'night');
  // Two turntables with records.
  for (const tx of [6, 28]) {
    g.fillRect(tx, 7, 14, 8, 'plum').fillRect(tx, 7, 14, 1, 'haze');
    g.fillEllipse(tx + 1, 6, 10, 7, 'ink');
    g.set(tx + 5, 9, 'brick').set(tx + 6, 9, 'brick');
    const a = frame ? [tx + 3, 7] : [tx + 8, 11];
    g.set(a[0], a[1], 'mauve');
    g.line(tx + 12, 7, tx + 10, 11, 'haze');
  }
  // Mixer in the middle with tiny lit faders.
  g.fillRect(20, 8, 8, 6, 'night');
  for (let i = 0; i < 3; i++) g.set(21 + i * 2, 10 + ((i + frame) % 2) * 2, NEON[i]);
  return outline(g, { steps: 2 });
}

/** A big speaker; frame 1 is the thump, the cone pushed out. */
function speaker(frame: number): PixelGrid {
  const W = 18;
  const H = 30;
  const g = new PixelGrid(W, H);
  block(g, 1, 2, 16, 27, ['ink', 'night', 'plum'], { gradient: 0.5 });
  const cone = (cy: number, r: number) => {
    const s = r + frame;
    g.fillEllipse(9 - s, cy - s, s * 2, s * 2, 'ink');
    g.fillEllipse(9 - s + 1, cy - s + 1, s * 2 - 2, s * 2 - 2, 'plum');
    g.fillEllipse(9 - 2, cy - 2, 4, 4, frame ? 'haze' : 'mauve');
  };
  cone(9, 4);
  cone(21, 5);
  g.set(3, 4, 'haze').set(14, 4, frame ? 'lime' : 'brick');
  return outline(g, { steps: 1 });
}

/** A neon "DISKO" sign for the back wall, letters cycling colour. */
function wallSign(frame: number): PixelGrid {
  const W = 48;
  const H = 16;
  const g = new PixelGrid(W, H);
  g.fillRect(1, 2, W - 2, 12, 'ink').fillRect(1, 2, W - 2, 1, 'plum');
  let x = 6;
  ['D', 'I', 'S', 'K', 'O'].forEach((ch, i) => {
    const t = textGrid(ch, NEON[(frame + i) % NEON.length]);
    g.stamp(t, x, 5);
    x += t.w + 3;
  });
  g.fillRect(3, 4, 2, 2, NEON[(frame + 5) % NEON.length]).fillRect(W - 5, 10, 2, 2, NEON[(frame + 2) % NEON.length]);
  return g;
}

/** A light speck from the mirror ball: a small plus. Tinted per speck. */
function speck(): PixelGrid {
  const g = new PixelGrid(3, 3);
  g.set(1, 0, 'cream').set(0, 1, 'cream').set(1, 1, 'cream').set(2, 1, 'cream').set(1, 2, 'cream');
  return g;
}

export function registerDisco(sink: TextureSink): void {
  sink.sheet(DISCO_TEXTURES.barn, Array.from({ length: DISCO_BARN.frames }, (_, f) => discoBarn(f)), DISCO_BARN.w, DISCO_BARN.h);
  sink.sheet(DISCO_TEXTURES.ball, Array.from({ length: DISCO_BALL.frames }, (_, f) => discoBall(f)), DISCO_BALL.w, DISCO_BALL.h);
  // A pale rim so the pen-line arms still read on the dark floor.
  sink.sheet(DISCO_TEXTURES.puppy, PUPPY_POSES.map((p) => outline(dogFrame(p), { color: 'mist' })), PUPPY.w, PUPPY.h);
  sink.sheet(DISCO_TEXTURES.booth, [booth(0), booth(1)], 48, 30);
  sink.sheet(DISCO_TEXTURES.speaker, [speaker(0), speaker(1)], 18, 30);
  sink.sheet(DISCO_TEXTURES.sign, Array.from({ length: NEON.length }, (_, f) => wallSign(f)), 48, 16);
  sink.image(DISCO_TEXTURES.speck, speck());
  for (let i = 0; i < CROWD_SIZE; i++)
    sink.sheet(crowdTexture(i), buildCharacterFrames(crowdLook(i)), PLAYER.frameWidth, PLAYER.frameHeight, CHAR_FRAMES.perFacing);
}
