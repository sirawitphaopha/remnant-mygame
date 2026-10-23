import { WORLD } from '../config/game';
import { LAKE, RIVER, RIVER_WIDTH, distToPolyline } from './layout';
import { hash2 } from './noise';
import { canPlace, forestDensity, type Placed } from './scatter';
import { BIOME } from './terrainGen';
import type { Terrain } from './Terrain';

// ก้อนหินในธรรมชาติ (พี่กันขอ 23 ต.ค. 2569 ให้ไปดูรูปจริงว่าหินควรอยู่แบบไหน · docs/REFERENCES-R2.md หัวข้อ 10)
// กติกาล้วน ไม่แตะภาพ · ผลเดิมทุกครั้ง · วางเป็นกลุ่มตามที่เกิดจริง ไม่โปรยเท่า ๆ กันทั้งแมพ
// ลานหินร่วงตีนผา (คัดขนาด ก้อนใหญ่กลิ้งไปไกล) · กองหินโผล่บนยอดเนินกับลานก้อนหินไหลลงลาด
// ก้อนกลมเกลี้ยงริมน้ำ · ก้อนโดดเดี่ยวกลางทุ่ง · ก้อนมอสในป่า · แผ่นหินชั้นบนภูเขา

export const ROCK_TYPES = ['granite', 'slab', 'river', 'scree', 'outcrop', 'mossy'] as const;
export type RockType = (typeof ROCK_TYPES)[number];

/** ตัวชนต่อขนาด 1 เท่า: รัศมี ความสูงยอดเหนือพื้น (ตรงกับโมเดลใน render/models/rocks.ts) */
export const ROCK_SHAPE: Record<RockType, { r: number; top: number }> = {
  granite: { r: 0.95, top: 1.1 },
  slab: { r: 1.1, top: 0.55 },
  river: { r: 0.9, top: 0.45 },
  scree: { r: 0.6, top: 0.5 },
  outcrop: { r: 1.5, top: 3.1 },
  mossy: { r: 0.95, top: 0.85 },
};

/** ชนิดของหินจากเลขแบบ (variant = ชนิด × 2 + แบบย่อย) */
export const rockTypeOf = (variant: number | undefined): RockType => ROCK_TYPES[Math.floor((variant ?? 0) / 2)] ?? 'granite';

export function scatterRocks(t: Terrain): Placed[] {
  const cell = 11;
  const out: Placed[] = [];
  const n = Math.floor(WORLD.size / cell);
  const put = (type: RockType, x: number, z: number, scale: number, seed: number) => {
    if (!canPlace(t, x, z, type === 'outcrop' ? 0.5 : 0.62, 2)) return;
    // ก้อนในกลุ่มวางเยื้องจากจุดกลาง ตรวจที่ตั้งจริงอีกครั้ง (ไม่ลงในเมืองหรือบนหิมะ)
    const b = t.biomeAt(x, z);
    if (b === BIOME.town || b === BIOME.snow) return;
    out.push({ x, y: t.heightAt(x, z), z, rot: hash2(seed, 7, 41) * Math.PI * 2, scale, variant: ROCK_TYPES.indexOf(type) * 2 + (hash2(seed, 3, 42) < 0.5 ? 0 : 1) });
  };
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = -WORLD.half + (i + hash2(i, j, 11)) * cell;
      const z = -WORLD.half + (j + hash2(i, j, 12)) * cell;
      const h = t.heightAt(x, z);
      if (h < WORLD.waterLevel + 0.2) continue;
      const b = t.biomeAt(x, z);
      if (b === BIOME.town || b === BIOME.snow) continue;
      const slope = t.slopeAt(x, z);
      if (slope > 0.62) continue; // หน้าผาชันเกิน หินค้างไม่อยู่
      const r = hash2(i, j, 13);
      const seed = i * 7919 + j;
      // ทิศขึ้นเนิน (ไว้หาหน้าผาข้างบน และวางลานก้อนหินลงลาด)
      const nrm = t.normalAt(x, z);
      const hl = Math.hypot(nrm[0], nrm[2]) || 1;
      const ux = -nrm[0] / hl;
      const uz = -nrm[2] / hl;
      // 1) ตีนผา: เหนือขึ้นไปตามลาดเป็นหน้าผา → ลานหินร่วง หลายก้อนต่อช่อง ก้อนใหญ่อยู่ห่างผา
      const steepAt = (d: number) => t.slopeAt(x + ux * d, z + uz * d) > 0.7;
      const dist = slope < 0.1 ? 0 : steepAt(8) ? 1 : steepAt(17) ? 2 : steepAt(27) ? 3 : 0;
      if (dist) {
        // ลานหินแน่น ชิดผาก้อนเล็ก ห่างผาก้อนใหญ่ขึ้น (ก้อนใหญ่กลิ้งไปไกล) · ปลายลานมีก้อนแกรนิตใหญ่ปน
        const k = 4 + Math.floor(hash2(i, j, 14) * 6);
        for (let q = 0; q < k; q++) {
          const px = x + (hash2(seed, q, 15) - 0.5) * cell;
          const pz = z + (hash2(seed, q, 16) - 0.5) * cell;
          const sz = hash2(seed, q, 17);
          if (dist === 3 && sz > 0.75) put('granite', px, pz, 0.9 + sz * 1.6, seed + q);
          else put('scree', px, pz, 0.2 + sz * sz * (0.35 + dist * 0.4), seed + q);
        }
        continue;
      }
      // 2) ริมแม่น้ำและทะเลสาบ: ก้อนกลมเกลี้ยงเป็นกลุ่มตามตลิ่ง
      const dv = distToPolyline(x, z, RIVER);
      const dl = Math.hypot(x - LAKE.x, z - LAKE.z);
      if ((dv < RIVER_WIDTH + 7 || (dl > LAKE.radius * 0.8 && dl < LAKE.radius + 30)) && h < WORLD.waterLevel + 2.6) {
        if (r < 0.55) {
          const k = 1 + Math.floor(hash2(i, j, 18) * 4);
          for (let q = 0; q < k; q++) put('river', x + (hash2(seed, q, 19) - 0.5) * 6, z + (hash2(seed, q, 20) - 0.5) * 6, 0.3 + hash2(seed, q, 21) ** 2 * 1.3, seed + q);
        }
        continue;
      }
      // 3) ยอดเนินกับสันเขา: กองหินโผล่ (หายาก) ลานก้อนหินไหลลงลาดใต้กอง
      const around = (t.heightAt(x + 35, z) + t.heightAt(x - 35, z) + t.heightAt(x, z + 35) + t.heightAt(x, z - 35)) / 4;
      if (h - around > 4 && h > 45 && r < 0.05) {
        put('outcrop', x, z, 1.1 + hash2(i, j, 22) * 0.9, seed);
        const k = 3 + Math.floor(hash2(i, j, 23) * 5);
        for (let q = 0; q < k; q++) {
          const d = 4 + hash2(seed, q, 24) * 16;
          const side = (hash2(seed, q, 25) - 0.5) * 12;
          put('granite', x - ux * d + uz * side, z - uz * d - ux * side, 0.5 + hash2(seed, q, 26) * (1.4 - d / 30), seed + q + 50);
        }
        continue;
      }
      // 4) ภูเขาสูง: แผ่นหินชั้นกับก้อนเหลี่ยม
      if (h > 260 || b === BIOME.rock || b === BIOME.alpine) {
        if (r < 0.12 + slope * 0.35) put(r < 0.07 ? 'slab' : 'granite', x, z, 0.4 + hash2(i, j, 27) ** 2 * 2.0, seed);
        continue;
      }
      // 5) ในป่า: ก้อนมอสโคนจมดิน
      const dens = forestDensity(t, x, z);
      if (dens > 0.45) {
        if (r < 0.045) put('mossy', x, z, 0.5 + hash2(i, j, 28) ** 2 * 1.8, seed);
        continue;
      }
      // 6) ทุ่ง: ก้อนใหญ่โดดเดี่ยว (หายาก) กับก้อนเล็กประปราย
      if (r < 0.01) put('granite', x, z, 1.8 + hash2(i, j, 29) * 1.6, seed);
      else if (r < 0.03 + slope * 0.2) put(slope > 0.25 ? 'scree' : 'granite', x, z, 0.3 + hash2(i, j, 30) ** 2 * 0.8, seed);
    }
  }
  return out;
}
