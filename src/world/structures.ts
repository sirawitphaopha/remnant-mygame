// สิ่งก่อสร้างทรงกล่อง (ผนังตึก หลังคา พื้นสะพาน ซากปูน) · ชน ยืนบน ปีน หลบหนาว กล้องไม่ทะลุ
// กติกาล้วน ไม่แตะภาพ
import { HERO } from '../config/scale';

export interface Box {
  x: number;
  z: number;
  /** ครึ่งความกว้างตามแกน x และ z ของกล่องเอง */
  hx: number;
  hz: number;
  /** หมุนรอบแกนตั้ง */
  rot: number;
  y0: number;
  y1: number;
  /** ชนิดไว้แยกตอนสแกนและตอนวาด */
  tag?: string;
}

const CELL = 20;

export class Structures {
  readonly boxes: Box[] = [];
  private grid = new Map<number, Box[]>();

  private key(i: number, j: number): number {
    return (i + 500) * 2048 + (j + 500);
  }

  add(b: Box): Box {
    this.boxes.push(b);
    const r = Math.hypot(b.hx, b.hz);
    for (let j = Math.floor((b.z - r) / CELL); j <= Math.floor((b.z + r) / CELL); j++) {
      for (let i = Math.floor((b.x - r) / CELL); i <= Math.floor((b.x + r) / CELL); i++) {
        const k = this.key(i, j);
        let l = this.grid.get(k);
        if (!l) this.grid.set(k, (l = []));
        l.push(b);
      }
    }
    return b;
  }

  near(x: number, z: number): Box[] {
    return this.grid.get(this.key(Math.floor(x / CELL), Math.floor(z / CELL))) ?? [];
  }

  /** แปลงจุดเป็นพิกัดในกล่อง */
  static local(b: Box, x: number, z: number): [number, number] {
    const dx = x - b.x;
    const dz = z - b.z;
    const c = Math.cos(b.rot);
    const s = Math.sin(b.rot);
    return [dx * c - dz * s, dx * s + dz * c];
  }

  static inside(b: Box, x: number, z: number, pad = 0): boolean {
    const [lx, lz] = Structures.local(b, x, z);
    return Math.abs(lx) <= b.hx + pad && Math.abs(lz) <= b.hz + pad;
  }

  /** พื้นที่ยืนได้สูงสุดตรงนั้นที่ไม่สูงกว่าเท้าเกินระยะก้าวขึ้น (ยืนบนหลังคา พื้นสะพาน ซากปูน) */
  floorAt(x: number, z: number, feetY: number): number {
    let best = -Infinity;
    for (const b of this.near(x, z)) if (b.y1 <= feetY + HERO.stepUp && b.y1 > best && Structures.inside(b, x, z)) best = b.y1;
    return best;
  }

  /**
   * ดันวงกลมรัศมี r ออกจากผนัง · คืนตำแหน่งใหม่และกล่องที่ชน (ไว้เริ่มปีน)
   * ชนเฉพาะกล่องที่ตัวละครอยู่ในช่วงความสูงของมัน
   */
  push(x: number, z: number, r: number, feetY: number): { x: number; z: number; hit: Box | null } {
    let hit: Box | null = null;
    for (let pass = 0; pass < 2; pass++) {
      for (const b of this.near(x, z)) {
        if (feetY >= b.y1 - 0.3 || feetY + HERO.bodyHeight <= b.y0) continue;
        const [lx, lz] = Structures.local(b, x, z);
        const px = b.hx + r - Math.abs(lx);
        const pz = b.hz + r - Math.abs(lz);
        if (px <= 0 || pz <= 0) continue;
        let nlx = lx;
        let nlz = lz;
        if (px < pz) nlx = Math.sign(lx || 1) * (b.hx + r);
        else nlz = Math.sign(lz || 1) * (b.hz + r);
        const c = Math.cos(b.rot);
        const s = Math.sin(b.rot);
        x = b.x + nlx * c + nlz * s;
        z = b.z - nlx * s + nlz * c;
        hit = b;
      }
    }
    return { x, z, hit };
  }

  /** มีหลังคาอยู่เหนือหัวไหม (หลบหนาว) */
  roofOver(x: number, y: number, z: number): boolean {
    for (const b of this.near(x, z)) if (b.y0 > y + HERO.roofClear && b.y0 < y + 8 && Structures.inside(b, x, z)) return true;
    return false;
  }

  /** เส้นตรงจาก a ไป b ชนกล่องไหม คืนสัดส่วนระยะที่ชนแรก (1 = ไม่ชน) ใช้กับกล้อง */
  segment(ax: number, ay: number, az: number, bx: number, by: number, bz: number, pad = 0.25): number {
    let best = 1;
    const seen = new Set<Box>();
    const steps = 4;
    for (let k = 0; k <= steps; k++) {
      const f = k / steps;
      for (const b of this.near(ax + (bx - ax) * f, az + (bz - az) * f)) {
        if (seen.has(b)) continue;
        seen.add(b);
        // ตัดเส้นกับกล่องในพิกัดของกล่อง (slab) · จุดเริ่มอยู่ในกล่องอยู่แล้ว ข้ามกล่องนี้
        const [lax, laz] = Structures.local(b, ax, az);
        if (Math.abs(lax) < b.hx && Math.abs(laz) < b.hz && ay > b.y0 && ay < b.y1) continue;
        const [lbx, lbz] = Structures.local(b, bx, bz);
        let t0 = 0;
        let t1 = 1;
        const slab = (p: number, q: number, lo: number, hi: number) => {
          const d = q - p;
          if (Math.abs(d) < 1e-9) return p >= lo && p <= hi;
          let ta = (lo - p) / d;
          let tb = (hi - p) / d;
          if (ta > tb) [ta, tb] = [tb, ta];
          t0 = Math.max(t0, ta);
          t1 = Math.min(t1, tb);
          return t0 <= t1;
        };
        if (!slab(lax, lbx, -b.hx - pad, b.hx + pad)) continue;
        if (!slab(laz, lbz, -b.hz - pad, b.hz + pad)) continue;
        if (!slab(ay, by, b.y0 - pad, b.y1 + pad)) continue;
        if (t0 < best) best = t0;
      }
    }
    return best;
  }
}
