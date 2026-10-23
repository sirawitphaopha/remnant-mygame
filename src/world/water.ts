import { WORLD } from '../config/game';
import { GORGE, LAKE, RIVER, RIVER_WIDTH, distToPolyline, type P2 } from './layout';
import type { Terrain } from './Terrain';

// แม่น้ำมีชีวิต (รอบสอง ช่วง 6) · ทิศน้ำไหล น้ำตก จุดฝูงปลา · กติกาล้วน ไม่แตะภาพ

/**
 * แผนที่ทิศน้ำไหลทั้งแมพ (n × n ช่อง) · ค่าต่อช่อง [dx, dz, แรง 0 ถึง 1]
 * ในแม่น้ำไหลตามสายจากเหนือลงใต้ · ทะเลสาบกับแอ่งน้ำนิ่ง
 */
export function flowField(n = 192): Float32Array {
  const out = new Float32Array(n * n * 3);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = -WORLD.half + ((i + 0.5) / n) * WORLD.size;
      const z = -WORLD.half + ((j + 0.5) / n) * WORLD.size;
      let best = Infinity;
      let dx = 0;
      let dz = 0;
      for (let k = 0; k < RIVER.length - 1; k++) {
        const a = RIVER[k];
        const b = RIVER[k + 1];
        const sx = b.x - a.x;
        const sz = b.z - a.z;
        const l2 = sx * sx + sz * sz;
        const t = Math.max(0, Math.min(1, ((x - a.x) * sx + (z - a.z) * sz) / l2));
        const d = Math.hypot(a.x + sx * t - x, a.z + sz * t - z);
        if (d < best) { best = d; const l = Math.sqrt(l2); dx = sx / l; dz = sz / l; }
      }
      // ใกล้ทะเลสาบน้ำช้าลงจนนิ่ง · ในหุบผาชันไหลแรงกว่า
      const lake = Math.max(0, Math.min(1, (Math.hypot(x - LAKE.x, z - LAKE.z) - LAKE.radius * 0.6) / (LAKE.radius * 0.6)));
      const gorge = z > GORGE.zFrom && z < GORGE.zTo ? 1.3 : 1;
      const s = Math.max(0, 1 - best / (RIVER_WIDTH + 14)) * lake * gorge;
      const o = (j * n + i) * 3;
      out[o] = dx;
      out[o + 1] = dz;
      out[o + 2] = Math.min(1, s);
    }
  }
  return out;
}

/** น้ำตก: ลำธารสาขาตกจากที่ราบสูงลงหุบป่าดิบชื้น · หาขอบผาจริงจากความสูงพื้น */
export interface WaterfallSpot { x: number; z: number; top: number; bottom: number; dirX: number; dirZ: number; /** แนวหน้าผาจากขอบบนลงตีนผา [x, y] */ profile: [number, number][] }

export function waterfallSpot(t: Terrain): WaterfallSpot {
  const z = (GORGE.zFrom + GORGE.zTo) / 2 - 60;
  // จุดบนแม่น้ำที่ระดับ z นี้
  let rx = 0;
  for (let k = 0; k < RIVER.length - 1; k++) {
    const a = RIVER[k];
    const b = RIVER[k + 1];
    if ((a.z - z) * (b.z - z) <= 0) { rx = a.x + ((z - a.z) / (b.z - a.z)) * (b.x - a.x); break; }
  }
  // เดินไปทางตะวันออกจนถึงขอบผา (พื้นสูงขึ้นทันทีเกิน 25 ม.)
  let x = rx + RIVER_WIDTH;
  let prev = t.heightAt(x, z);
  for (let s = 0; s < 220; s += 1) {
    const h = t.heightAt(x + 1, z);
    if (h - prev > 1.2 && h > WORLD.waterLevel + 25) break;
    prev = h;
    x += 1;
  }
  let top = t.heightAt(x, z);
  let xt = x;
  for (let s = 0; s < 40; s++) { const h = t.heightAt(xt + 1, z); if (h <= top + 0.3) break; top = h; xt += 1; }
  // แนวหน้าผาทีละ 1 ม. จากขอบบนลงมาถึงผิวน้ำ (สายน้ำไหลแนบผา ห่างผิวผาเล็กน้อย)
  const profile: [number, number][] = [];
  // ไหลลงจนถึงท้องหุบใกล้ระดับน้ำ (ผาบางช่วงมีชั้นหินกลางผา น้ำตกไหลผ่านชั้นลงต่อ)
  for (let px = xt; px >= x - 60; px -= 1) {
    const h = t.heightAt(px, z);
    profile.push([px - 0.6, Math.max(WORLD.waterLevel, h) + 0.5]);
    if (h < WORLD.waterLevel + 8 && px < x - 2) break;
  }
  return { x: x - 1, z, top, bottom: WORLD.waterLevel, dirX: -1, dirZ: 0, profile };
}

export type FishKind = 'trout' | 'carp';
export interface SchoolSpot extends P2 { kind: FishKind }

/** จุดเริ่มของฝูงปลา · เทราต์ในแม่น้ำที่น้ำไหล · ปลาไนในทะเลสาบกับแอ่งน้ำนิ่ง */
export function schoolSpots(t: Terrain): SchoolSpot[] {
  const out: SchoolSpot[] = [];
  for (let k = 1; k < RIVER.length - 1; k++) {
    const p = RIVER[k];
    if (t.heightAt(p.x, p.z) < WORLD.waterLevel - 0.8) out.push({ x: p.x, z: p.z, kind: 'trout' });
  }
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + 0.4;
    const x = LAKE.x + Math.cos(a) * LAKE.radius * 0.45;
    const z = LAKE.z + Math.sin(a) * LAKE.radius * 0.4;
    if (t.heightAt(x, z) < WORLD.waterLevel - 1) out.push({ x, z, kind: 'carp' });
  }
  return out;
}

/** น้ำลึกพอให้ปลาว่ายไหม (ห่างพื้นอย่างน้อย 0.6 ม.) */
export function fishCanSwim(t: Terrain, x: number, z: number): boolean {
  return t.heightAt(x, z) < WORLD.waterLevel - 0.6 && Math.abs(x) < WORLD.half - 5 && Math.abs(z) < WORLD.half - 5;
}

/** ใกล้แม่น้ำแค่ไหน (ใช้วางพืชริมน้ำ) */
export const riverDistance = (x: number, z: number): number => distToPolyline(x, z, RIVER);
