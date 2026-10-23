import { CAVES } from './layout';
import type { Terrain } from './Terrain';

// ถ้ำ 2 แห่ง · อุโมงค์คดเคี้ยวเจาะเข้าไปในภูเขา พื้นค่อย ๆ ลาดลง ห้องปลายถ้ำมีภาพวาดบนผนัง
// ถ้ำแรกลึกสุดมีก๊าซพิษ · กติกาล้วน ไม่แตะภาพ

export interface CavePoint { x: number; z: number; y: number; r: number }

export interface Cave {
  id: number;
  points: CavePoint[];
  /** ระยะจากปากถ้ำที่เริ่มมีก๊าซพิษ (สัดส่วน 0 ถึง 1) · 2 = ไม่มี */
  gasFrom: number;
}

export function buildCaves(t: Terrain): Cave[] {
  return CAVES.map((c, id) => {
    const pts: CavePoint[] = [];
    const n = 16;
    const outX = -Math.sin(c.dir);
    const outZ = -Math.cos(c.dir);
    // พื้นอุโมงค์เริ่มที่ระดับพื้นหน้าปากถ้ำ
    const y0 = t.heightAt(c.x + outX * 6, c.z + outZ * 6);
    for (let i = 0; i <= n; i++) {
      const f = i / n;
      const along = 4 - f * (c.depth + 4);
      const wiggle = Math.sin(f * 7 + id) * 6 * f;
      const x = c.x + outX * along + outZ * wiggle;
      const z = c.z + outZ * along - outX * wiggle;
      const r = f > 0.85 ? 4.6 : 2.8 + Math.sin(f * 11) * 0.4;
      pts.push({ x, z, y: y0 - f * 7, r });
    }
    return { id, points: pts, gasFrom: id === 0 ? 0.62 : 2 };
  });
}

/** ตำแหน่งในถ้ำ: สัดส่วนจากปากถ้ำ 0 ถึง 1 และพื้นตรงนั้น · null = ไม่อยู่ในถ้ำ */
export function caveAt(caves: Cave[], x: number, z: number): { cave: Cave; f: number; floor: number; r: number; ceil: number } | null {
  let best: { cave: Cave; f: number; floor: number; r: number; ceil: number; d: number } | null = null;
  for (const cave of caves) {
    const p = cave.points;
    for (let i = 0; i < p.length - 1; i++) {
      const a = p[i];
      const b = p[i + 1];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const l2 = dx * dx + dz * dz;
      let s = ((x - a.x) * dx + (z - a.z) * dz) / l2;
      s = Math.max(0, Math.min(1, s));
      const px = a.x + dx * s;
      const pz = a.z + dz * s;
      const d = Math.hypot(x - px, z - pz);
      const r = a.r + (b.r - a.r) * s;
      if (d < r * 0.92 && (!best || d < best.d)) {
        const floor = a.y + (b.y - a.y) * s;
        best = { cave, f: (i + s) / (p.length - 1), floor, r, ceil: floor + r * 1.6, d };
      }
    }
  }
  return best;
}
