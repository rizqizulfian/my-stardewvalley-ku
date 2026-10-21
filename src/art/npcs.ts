// NPC art: character sheets from each NPC's look, dialogue portraits, and the
// extra layers for Jotaro (Star Platinum behind him and a purple aura).

import { PLAYER } from '../config';
import { NPCS, type NpcDef } from '../data/npcs';
import { CHAR_FRAMES, FACINGS, buildCharacterFrames } from './characters';
import { PixelGrid, blobMask, ditherPick, hash2, outline, shade, type TextureSink } from './pixel';
import type { ColorName } from './palette';

export const npcTexture = (id: string) => `npc-${id}`;
export const portraitTexture = (id: string) => `portrait-${id}`;
export const auraTexture = (id: string) => `aura-${id}`;

export const STAND_TEXTURES = { starPlatinum: 'stand-star-platinum' } as const;
/** Star Platinum sheet: front idle x2, back idle x2, rush (punch flurry) x2. */
export const STAND_FRAMES = { front: [0, 1], back: [2, 3], rush: [4, 5], w: 28, h: 38 } as const;
/** Aura sheet: per facing (FACINGS order), this many flicker frames. */
export const AURA = { frames: 3, w: 28, h: 40, padX: 6, padY: 15 } as const;
export const PORTRAIT_SIZE = 40;

// ---------------------------------------------------------------------------

function scale2(g: PixelGrid): PixelGrid {
  const out = new PixelGrid(g.w * 2, g.h * 2);
  g.forEachFilled((x, y, c) => out.fillRect(x * 2, y * 2, 2, 2, c));
  return out;
}

function portrait(def: NpcDef, front: PixelGrid): PixelGrid {
  const S = PORTRAIT_SIZE;
  const g = new PixelGrid(S, S);
  const [top, bottom] = def.portraitBg;
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const t = y / S;
      g.set(x, y, t < 0.45 ? top : t > 0.65 ? bottom : ditherPick(x, y, (t - 0.45) / 0.2) ? bottom : top);
    }
  // Head and shoulders at 2x. Children are drawn lower in their frame.
  const y0 = def.look.small ? 3 : 0;
  const bust = scale2(front.crop(0, y0, 16, 20));
  g.stampClipped(bust, 4, 3);
  return g;
}

// ---------------------------------------------------------------------------
// Star Platinum: a towering purple spirit with wild hair, a gold headband,
// gold shoulder guards, a red scarf, crossed-at-rest arms and gold wristbands.

const SKIN: ColorName[] = ['night', 'plum', 'violet', 'lilac'];
const HAIR: ColorName[] = ['ink', 'night', 'plum', 'violet'];
const GOLD: ColorName[] = ['clay', 'amber', 'gold', 'cream'];

function hairMass(w: number, h: number, back: boolean, sway: number): PixelGrid {
  const cx = w / 2;
  const circles: Array<[number, number, number, number?]> = [
    [cx, 7, 8, 6],
    [cx - 7 + sway, 10, 4.5, 5],
    [cx + 7 + sway, 10, 4.5, 5],
    [cx - 9 + sway, 15, 3, 4],
    [cx + 9 + sway, 15, 3, 4],
    [cx - 4, 3, 4, 3],
    [cx + 4, 3, 4, 3],
  ];
  if (back) circles.push([cx, 13, 8, 6], [cx + sway, 18, 6, 4]);
  const m = blobMask(w, h, circles);
  // Spiky tips flying up and out.
  for (const [x, y, dx, dy, n] of [
    [cx - 6, 2, -1, -1, 3],
    [cx + 6, 2, 1, -1, 3],
    [cx, 1, 0, -1, 2],
    [cx - 11, 11, -1, 0, 3],
    [cx + 11, 11, 1, 0, 3],
    [cx - 10, 18, -1, 1, 2],
    [cx + 10, 18, 1, 1, 2],
  ])
    for (let i = 0; i < n; i++) m.set(Math.round(x + dx * i + sway * 0.5), y + dy * i, 'ink');
  return shade(m, HAIR, { rim: 0.35, gradient: 0.6, noise: 0.35, seed: 31 + sway });
}

function starPlatinum(pose: 'front' | 'back' | 'rush', frame: number): PixelGrid {
  const W = STAND_FRAMES.w;
  const H = STAND_FRAMES.h;
  const cx = W / 2;
  const g = new PixelGrid(W, H);
  const sway = frame === 0 ? 0 : 1;
  const back = pose === 'back';

  // Legs (mostly hidden behind the trainer) and a cloth sash.
  for (const lx of [cx - 5, cx + 1]) g.stamp(shade(new PixelGrid(W, H).fillRect(lx, 29, 4, 8, 'ink'), SKIN, { rim: 0.3 }));
  // Torso: broad shoulders tapering to the waist.
  const torso = new PixelGrid(W, H);
  for (let y = 16; y < 30; y++) {
    const half = Math.round(8 - (y - 16) * 0.32);
    torso.fillRect(cx - half, y, half * 2, 1, 'ink');
  }
  g.stamp(shade(torso, SKIN, { rim: 0.3, gradient: 0.6 }));
  if (!back) {
    // Chest and abs.
    g.line(cx - 4, 20, cx - 1, 21, 'plum').line(cx + 3, 20, cx, 21, 'plum');
    for (const y of [23, 25, 27]) g.set(cx - 1, y, 'plum').set(cx, y, 'plum');
  } else g.line(cx, 18, cx, 28, 'plum');
  // Belt and loincloth.
  g.fillRect(cx - 5, 28, 10, 2, 'amber').fillRect(cx - 5, 28, 10, 1, 'gold');
  if (!back) g.fillRect(cx - 2, 30, 4, 4, 'cream').fillRect(cx + 1, 30, 1, 4, 'mist');

  // Arms at the sides, or a flurry of fists in the rush frames.
  const arm = (x: number) => {
    g.stamp(shade(new PixelGrid(W, H).fillRect(x, 19, 4, 10, 'ink'), SKIN, { rim: 0.3, gradient: 0.5 }));
    g.fillRect(x, 27, 4, 2, 'gold').set(x, 27, 'cream');
    g.stamp(shade(blobMask(W, H, [[x + 2, 31, 2.4, 2.2]]), SKIN, { rim: 0.4 }));
  };
  if (pose === 'rush') {
    const spots: Array<[number, number]> =
      frame === 0
        ? [
            [4, 21],
            [24, 19],
            [7, 27],
            [21, 26],
            [cx, 24],
            [2, 15],
          ]
        : [
            [5, 18],
            [23, 23],
            [9, 23],
            [19, 21],
            [3, 27],
            [25, 14],
          ];
    for (const [x, y] of spots) {
      g.stamp(shade(blobMask(W, H, [[x, y, 2.6, 2.4]]), SKIN, { rim: 0.4 }));
      g.set(x - 2, y + 2, 'gold').set(x - 1, y + 2, 'gold');
      // Speed lines trailing back toward the body.
      g.set(x + (x < cx ? 3 : -3), y - 1, 'cream').set(x + (x < cx ? 4 : -4), y - 1, 'mist');
    }
  } else {
    arm(cx - 12);
    arm(cx + 8);
  }

  // Shoulder guards.
  for (const sx of [cx - 13, cx + 6]) g.stamp(shade(blobMask(W, H, [[sx + 3.5, 18, 4, 3]]), GOLD, { rim: 0.35, gradient: 0.7 }));

  // Head, then the hair around (or over) it.
  const hair = hairMass(W, H, back, sway);
  if (back) g.stamp(hair);
  else {
    g.stamp(hair);
    g.stamp(shade(blobMask(W, H, [[cx, 10, 3.8, 4.4]]), SKIN, { rim: 0.35, gradient: 0.6 }));
    // Headband with a gold stud, glowing eyes, a stern mouth.
    g.fillRect(cx - 4, 6, 8, 2, 'amber').fillRect(cx - 4, 6, 8, 1, 'gold').set(cx, 6, 'cream');
    g.fillRect(cx - 3, 9, 2, 1, 'foam').fillRect(cx + 1, 9, 2, 1, 'foam');
    g.set(cx - 3, 8, 'night').set(cx + 2, 8, 'night');
    g.fillRect(cx - 1, 12, 2, 1, 'plum');
    // Neck and red scarf with a tail blowing to the side.
    g.fillRect(cx - 1, 14, 2, 2, 'violet');
    g.fillRect(cx - 4, 15, 8, 2, 'brick').fillRect(cx - 4, 15, 8, 1, 'coral');
    for (let i = 0; i < 4; i++) g.set(cx + 4 + i, 16 + i + sway, 'brick').set(cx + 4 + i, 17 + i + sway, 'wine');
  }
  return outline(g, { color: 'ink' });
}

// ---------------------------------------------------------------------------
// Aura: the character's silhouette grown by two pixels, with flame tongues
// licking upward. Three flicker frames per facing.

function auraFrame(body: PixelGrid, f: number): PixelGrid {
  const { w: W, h: H, padX, padY } = AURA;
  const base = new PixelGrid(W, H).stamp(body, padX, padY);
  const glow = new PixelGrid(W, H);
  base.forEachFilled((x, y) => {
    for (let dy = -3; dy <= 2; dy++)
      for (let dx = -3; dx <= 3; dx++) {
        const d = Math.abs(dx) + Math.abs(dy);
        if (d <= 3 && (d < 3 || hash2(x + dx, y + dy, 70 + f) < 0.55)) glow.set(x + dx, y + dy, d >= 2 ? 'violet' : 'lilac');
      }
  });
  // Wisps: curling flame tongues rising from the shoulders and head, tapering to sparks.
  const b = base.bounds();
  if (b) {
    for (let k = 0; k < 6; k++) {
      const x0 = b.x0 + 1 + Math.floor(((k + 0.5) / 6) * (b.x1 - b.x0 - 1));
      let top = b.y0;
      for (let y = 0; y < H; y++)
        if (glow.filled(x0, y)) {
          top = y;
          break;
        }
      const len = 6 + Math.floor(hash2(k, f, 76) * 8);
      const phase = f * 2.1 + k * 1.3;
      for (let i = 0; i < len; i++) {
        const t = i / len;
        const x = Math.round(x0 + Math.sin(phase + t * 4) * 2 * t);
        const y = top - i;
        const c: ColorName = t > 0.75 ? 'rose' : t > 0.4 ? 'lilac' : 'violet';
        glow.set(x, y, c);
        if (t < 0.5) glow.set(x + 1, y, 'violet');
      }
    }
  }
  // The body itself is drawn on top; leave its pixels clear.
  base.forEachFilled((x, y) => glow.set(x, y, null));
  for (let i = 0; i < 7; i++) {
    const x = Math.floor(hash2(i, f, 74) * W);
    const y = Math.floor(hash2(i, f, 75) * padY);
    glow.set(x, y, i % 2 ? 'rose' : 'lilac');
  }
  return glow;
}

// ---------------------------------------------------------------------------

export function registerNpcArt(sink: TextureSink): void {
  for (const def of NPCS) {
    const frames = buildCharacterFrames(def.look);
    sink.sheet(npcTexture(def.id), frames, PLAYER.frameWidth, PLAYER.frameHeight, CHAR_FRAMES.perFacing);
    sink.image(portraitTexture(def.id), portrait(def, frames[CHAR_FRAMES.idle[0]]));
    if (def.aura) {
      const aura: PixelGrid[] = [];
      FACINGS.forEach((_, fi) => {
        const body = frames[fi * CHAR_FRAMES.perFacing + CHAR_FRAMES.idle[0]];
        for (let f = 0; f < AURA.frames; f++) aura.push(auraFrame(body, f));
      });
      sink.sheet(auraTexture(def.id), aura, AURA.w, AURA.h, AURA.frames);
    }
  }
  sink.sheet(
    STAND_TEXTURES.starPlatinum,
    [starPlatinum('front', 0), starPlatinum('front', 1), starPlatinum('back', 0), starPlatinum('back', 1), starPlatinum('rush', 0), starPlatinum('rush', 1)],
    STAND_FRAMES.w,
    STAND_FRAMES.h,
  );
}
