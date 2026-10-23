import { WORLD } from '../config/game';
import type { BiomeName, Eco } from '../core/ecology';
import { DEEP_FOREST, type P2 } from './layout';
import { BIOME, type BiomeId } from './terrainGen';
import type { Terrain } from './Terrain';
import type { WaterfallSpot } from './water';

// ถิ่นของสัตว์บนแมพจริง (รอบสอง ช่วง 12) · กติกาล้วน ไม่แตะภาพ
// แปลงชื่อชนิดพื้นที่ในระบบนิเวศ (core/ecology.ts) เป็นตารางชนิดพื้นที่ของภูมิประเทศ · หาที่กินน้ำ ที่หลบพัก จุดจับปลา

const ID: Record<BiomeName, BiomeId> = BIOME;

/** ชุดชนิดพื้นที่เป็นเลข เร็วกว่าเทียบชื่อทุกครั้ง */
export function biomeSet(names: BiomeName[]): Set<BiomeId> {
  return new Set(names.map((n) => ID[n]));
}

/**
 * เขตป่าลึกที่สัตว์ดุอยู่ (พี่กันเคาะ: มีตัวดุไม่กี่ชนิดอยู่ป่าลึก)
 * 1) ป่าทึบตะวันตก (DEEP_FOREST เดิม) · 2) หุบป่าดิบชื้นรอบน้ำตก ที่หมีลงจับปลา (รอบสอง ช่วง 12 แคลร์ตัดสินเอง ตามแผน "หมีจับปลาที่น้ำตก")
 */
export class WildZones {
  readonly zones: (P2 & { r: number })[];
  /** จุดที่หมียืนจับปลา (น้ำตื้นตีนน้ำตก) */
  readonly fishing: P2 & { y: number };

  constructor(t: Terrain, fall: WaterfallSpot) {
    const end = fall.profile[fall.profile.length - 1] ?? [fall.x, WORLD.waterLevel];
    // น้ำตกตกลงแม่น้ำจากผาฝั่งตะวันออก · เดินจากตีนน้ำตกลงไปทางแม่น้ำจนถึงน้ำตื้นริมตลิ่ง แล้วยืนตรงนั้น
    let fx = end[0];
    const fz = fall.z + 4;
    for (let k = 0; k < 120 && t.heightAt(fx, fz) > WORLD.waterLevel + 0.3; k++) fx -= 0.5;
    for (let k = 0; k < 30 && t.heightAt(fx, fz) < WORLD.waterLevel - 0.35; k++) fx += 0.5;
    this.fishing = { x: fx, z: fz, y: Math.max(WORLD.waterLevel - 0.3, t.heightAt(fx, fz)) };
    this.zones = [
      { x: DEEP_FOREST.x, z: DEEP_FOREST.z, r: DEEP_FOREST.radius * 0.85 },
      { x: this.fishing.x, z: this.fishing.z, r: 150 },
    ];
  }

  inside(x: number, z: number): boolean {
    for (const w of this.zones) if ((x - w.x) ** 2 + (z - w.z) ** 2 < w.r * w.r) return true;
    return false;
  }

  /** เขตที่จุดนี้อยู่ (-1 = ไม่อยู่) */
  zoneOf(x: number, z: number): number {
    return this.zones.findIndex((w) => (x - w.x) ** 2 + (z - w.z) ** 2 < w.r * w.r);
  }
}

/** ตรงนี้ไม่ใช่น้ำลึก ไม่ชันเกินยืน */
export function landOk(t: Terrain, x: number, z: number): boolean {
  return t.heightAt(x, z) > WORLD.waterLevel - 0.3 && t.slopeAt(x, z) < 0.28;
}

/** สัตว์ชนิดนี้อยู่ตรงนี้ได้ไหม (ที่หากิน หรือที่หลบพัก) */
export function habitatFits(t: Terrain, feed: Set<BiomeId>, x: number, z: number, wild: WildZones | null, e: Eco): boolean {
  if (Math.abs(x) > WORLD.half - 30 || Math.abs(z) > WORLD.half - 30) return false;
  if (e.wild && !(wild?.inside(x, z) ?? false)) return false;
  if (!feed.has(t.biomeAt(x, z))) return false;
  // กบอยู่ริมน้ำ ยืนในน้ำตื้นได้ · สัตว์บกอื่นต้องอยู่บนบกที่ไม่ชัน
  if (e.id === 'frog') { const h = t.heightAt(x, z); return h > WORLD.waterLevel - 0.25 && h < WORLD.waterLevel + 1.6; }
  return landOk(t, x, z);
}

/**
 * ที่กินน้ำใกล้สุด · ริมตลิ่งที่พื้นสูงกว่าผิวน้ำนิดเดียว (ยืนบนบก ก้มลงกินน้ำได้)
 * ค้นเป็นวงรอบตัว 32 ทิศ ทุก 5 ม. · ไม่เจอในระยะ = null
 */
export function drinkSpot(t: Terrain, x: number, z: number, maxR: number): P2 | null {
  for (let d = 5; d <= maxR; d += 5) {
    let best: P2 | null = null;
    let bh = Infinity;
    for (let k = 0; k < 32; k++) {
      const a = (k / 32) * Math.PI * 2;
      const px = x + Math.cos(a) * d;
      const pz = z + Math.sin(a) * d;
      const h = t.heightAt(px, pz);
      if (h < WORLD.waterLevel + 0.08 || h > WORLD.waterLevel + 0.7 || t.slopeAt(px, pz) > 0.3) continue;
      if (h < bh) { bh = h; best = { x: px, z: pz }; }
    }
    if (best) return best;
  }
  return null;
}

/** จุดใกล้สุดที่เป็นชนิดพื้นที่ในชุดนี้ (หาที่หลบพัก เช่นชายป่าใกล้ทุ่ง) · ค้น 16 ทิศ ทุก 8 ม. */
export function nearestBiome(t: Terrain, set: Set<BiomeId>, x: number, z: number, maxR: number): P2 | null {
  if (set.has(t.biomeAt(x, z))) return { x, z };
  for (let d = 8; d <= maxR; d += 8) {
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2 + d * 0.13;
      const px = x + Math.cos(a) * d;
      const pz = z + Math.sin(a) * d;
      if (set.has(t.biomeAt(px, pz)) && landOk(t, px, pz)) return { x: px, z: pz };
    }
  }
  return null;
}
