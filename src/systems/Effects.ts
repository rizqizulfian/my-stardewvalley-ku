// Small world effects: particle bits (clods, drops, chips, leaves, sparks)
// and item drops that pop out, rest, then fly to the player.

import Phaser from 'phaser';
import { DROPS, DEPTH } from '../config';
import { BIT, ITEM_TEXTURES, iconFrame } from '../art/items';
import { PROP_TEXTURES } from '../art/props';
import { itemDef } from './Inventory';
import { worldDepth } from './MapRenderer';

export type BitKind = keyof typeof BIT;

interface Bit {
  img: Phaser.GameObjects.Image;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  age: number;
  gravity: number;
  bounced: boolean;
}

export interface BurstOptions {
  count?: number;
  /** Ground-plane speed (px/s). */
  spread?: number;
  /** Upward launch speed (px/s). */
  up?: number;
  /** Starting height above the ground point. */
  z?: number;
  life?: number;
  gravity?: number;
  /** Bias the ground velocity in a direction. */
  dirX?: number;
  dirY?: number;
}

interface Drop {
  img: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  id: string;
  qty: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rest: number;
  phase: 'pop' | 'rest' | 'fly';
}

export class Effects {
  private bits: Bit[] = [];
  private drops: Drop[] = [];

  /** Called when a drop reaches the player; returns how many did not fit. */
  collect: (id: string, qty: number) => number = () => 0;

  constructor(private readonly scene: Phaser.Scene) {}

  burst(kind: BitKind, x: number, y: number, o: BurstOptions = {}): void {
    const n = o.count ?? 6;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (o.spread ?? 30) * (0.4 + Math.random() * 0.6);
      const img = this.scene.add.image(x, y, ITEM_TEXTURES.bits, BIT[kind]);
      this.bits.push({
        img,
        x,
        y,
        z: o.z ?? 2,
        vx: Math.cos(a) * sp + (o.dirX ?? 0),
        vy: Math.sin(a) * sp * 0.5 + (o.dirY ?? 0),
        vz: (o.up ?? 50) * (0.6 + Math.random() * 0.6),
        life: (o.life ?? 600) * (0.7 + Math.random() * 0.5),
        age: 0,
        gravity: o.gravity ?? 240,
        bounced: false,
      });
    }
  }

  /** Spawns items that pop out of a point and then fly to the player. */
  drop(id: string, qty: number, x: number, y: number): void {
    // Show stacks as a few separate pieces, like scattered debris.
    const pieces = Math.min(qty, 4);
    const per = Math.floor(qty / pieces);
    let rest = qty - per * pieces;
    for (let i = 0; i < pieces; i++) {
      const q = per + (rest-- > 0 ? 1 : 0);
      const a = Math.random() * Math.PI * 2;
      const sp = DROPS.popSpeed * (0.3 + Math.random() * 0.5);
      const shadow = this.scene.add.image(x, y, PROP_TEXTURES.shadowS).setAlpha(0.3).setDepth(DEPTH.groundDecor + 0.6);
      const img = this.scene.add.image(x, y, ITEM_TEXTURES.icons, iconFrame(itemDef(id).icon)).setOrigin(0.5, 1);
      this.drops.push({ img, shadow, id, qty: q, x, y, z: 4, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6, vz: 70 + Math.random() * 30, rest: 0, phase: 'pop' });
    }
  }

  update(deltaMs: number, playerX: number, playerY: number): void {
    const dt = deltaMs / 1000;
    for (let i = this.bits.length - 1; i >= 0; i--) {
      const b = this.bits[i];
      b.age += deltaMs;
      if (b.z > 0 || b.vz > 0) {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.vz -= b.gravity * dt;
        b.z += b.vz * dt;
        if (b.z <= 0) {
          b.z = 0;
          if (!b.bounced && b.vz < -40) {
            b.bounced = true;
            b.vz = -b.vz * 0.3;
            b.vx *= 0.5;
            b.vy *= 0.5;
          } else b.vz = 0;
        }
      }
      const t = b.age / b.life;
      if (t >= 1) {
        b.img.destroy();
        this.bits.splice(i, 1);
        continue;
      }
      b.img.setPosition(Math.round(b.x), Math.round(b.y - b.z));
      b.img.setDepth(worldDepth(b.y) + 0.5);
      b.img.setAlpha(t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1);
    }

    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      if (d.phase === 'pop') {
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.vz -= DROPS.gravity * dt;
        d.z += d.vz * dt;
        if (d.z <= 0) {
          d.z = 0;
          if (d.vz < -50) {
            d.vz = -d.vz * 0.35;
            d.vx *= 0.5;
            d.vy *= 0.5;
          } else {
            d.phase = 'rest';
            d.rest = DROPS.restMs;
          }
        }
      } else if (d.phase === 'rest') {
        d.rest -= deltaMs;
        if (d.rest <= 0) d.phase = 'fly';
      } else {
        const tx = playerX;
        const ty = playerY - 4;
        const dx = tx - d.x;
        const dy = ty - d.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= DROPS.pickupRadius) {
          const left = this.collect(d.id, d.qty);
          if (left <= 0) {
            d.img.destroy();
            d.shadow.destroy();
            this.drops.splice(i, 1);
            continue;
          }
          // Backpack full: wait on the ground and try again later.
          d.qty = left;
          d.phase = 'rest';
          d.rest = 2000;
          d.x -= (dx / (dist || 1)) * 14;
          d.y -= (dy / (dist || 1)) * 14;
        } else {
          const sp = DROPS.magnetSpeed * dt * (dist < 40 ? 1.6 : 1);
          d.x += (dx / dist) * Math.min(sp, dist);
          d.y += (dy / dist) * Math.min(sp, dist);
          d.z = Math.min(6, d.z + dt * 30);
        }
      }
      d.img.setPosition(Math.round(d.x), Math.round(d.y - d.z));
      d.img.setDepth(worldDepth(d.y) + 0.4);
      d.shadow.setPosition(Math.round(d.x), Math.round(d.y));
    }
  }

  destroy(): void {
    this.bits.forEach((b) => b.img.destroy());
    this.drops.forEach((d) => {
      d.img.destroy();
      d.shadow.destroy();
    });
    this.bits = [];
    this.drops = [];
  }
}
