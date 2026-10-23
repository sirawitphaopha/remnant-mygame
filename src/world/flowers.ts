import { WORLD } from '../config/game';
import { RIVER_WIDTH, distToRoads, ROAD_WIDTH } from './layout';
import { riverDistance } from './water';
import { Simplex2, hash2 } from './noise';
import { BIOME, type BiomeId } from './terrainGen';
import type { Terrain } from './Terrain';

// ดอกไม้ 13 ชนิด (รอบสอง ช่วง 5) · ข้อมูลจาก docs/REFERENCES-R2.md หัวข้อ 4 · กติกาล้วน ไม่แตะภาพ
// ทุ่งดอกไม้ขึ้นเป็นดง ดงละชนิด แบบทุ่งจริง (ทุ่งป๊อปปี้ ทุ่งลูพิน ทุ่งทานตะวัน) · ทุ่งหญ้าทั่วไปมีดอกเล็กกระจาย

export type FlowerId =
  | 'poppy' | 'lupin' | 'sunflower' | 'daisy' | 'cornflower' | 'lavender' | 'foxglove'
  | 'bluebell' | 'dogRose' | 'dandelion' | 'buttercup' | 'orchid' | 'waterLily';

export const FLOWER_IDS: FlowerId[] = ['poppy', 'lupin', 'sunflower', 'daisy', 'cornflower', 'lavender', 'foxglove', 'bluebell', 'dogRose', 'dandelion', 'buttercup', 'orchid', 'waterLily'];

/** พืชริมน้ำกับหินท้องน้ำ (ช่วง 6) วาดแบบเดียวกับดอกไม้ · ธูปฤาษี อ้อ หญ้าหางม้า ตามแหล่งอ้างอิงหัวข้อ 3 */
export type RiverPlantId = 'cattail' | 'reed' | 'horsetail' | 'stone';
export const RIVER_PLANT_IDS: RiverPlantId[] = ['cattail', 'reed', 'horsetail', 'stone'];
export type TilePlantId = FlowerId | RiverPlantId;

/** ความสูงในเกม (เมตร) · ทานตะวันในแหล่งอ้างอิงราว 3 ม. ในเกมใช้ 1.8 ถึง 2.6 ไม่ให้บังทุ่งทั้งหมด (แคลร์ตัดสินเอง) */
export const FLOWER_HEIGHT: Record<FlowerId, [number, number]> = {
  poppy: [0.4, 0.7], lupin: [0.6, 1.0], sunflower: [1.8, 2.6], daisy: [0.15, 0.3], cornflower: [0.4, 0.7],
  lavender: [0.4, 0.6], foxglove: [0.9, 1.5], bluebell: [0.2, 0.4], dogRose: [0.9, 1.6], dandelion: [0.12, 0.25],
  buttercup: [0.2, 0.4], orchid: [0.3, 0.5], waterLily: [0.05, 0.1],
};
/** ธูปฤาษี 0.8 ถึง 2.4 · อ้อในเกม 1.5 ถึง 3 (แหล่งอ้างอิงถึง 4) · หญ้าหางม้า 0.3 ถึง 0.9 · หิน = ขนาด */
/** ชนิดในคอลเลกชันของดอกไม้และพืชริมน้ำ (หินกรวดริมน้ำเป็นหินกลมริมน้ำ) · รอบสอง ช่วง 12 */
export function plantScanKind(kind: TilePlantId): string {
  return kind === 'stone' ? 'riverStone' : kind;
}
export const RIVER_PLANT_SIZE: Record<RiverPlantId, [number, number]> = { cattail: [0.8, 2.4], reed: [1.5, 3], horsetail: [0.3, 0.9], stone: [0.15, 0.5] };

export interface FlowerSpot { kind: TilePlantId; x: number; y: number; z: number; rot: number; scale: number }

const patchNoise = new Simplex2(WORLD.seed + 515);
/** ดงดอกไม้ในทุ่งดอกไม้ (ดงละชนิด) */
const FIELD: FlowerId[] = ['poppy', 'lupin', 'sunflower', 'cornflower', 'lavender', 'daisy', 'buttercup'];
/** ดอกเล็กกระจายในทุ่งหญ้า */
const MEADOW: FlowerId[] = ['daisy', 'dandelion', 'buttercup', 'cornflower', 'poppy'];

/** ดอกไม้ชนิดไหนขึ้นที่จุดนี้ (ไม่ขึ้นคืน null) · r = เลขสุ่มของช่อง */
export function flowerAt(t: Terrain, x: number, z: number, r: number, r2: number): FlowerId | null {
  const b: BiomeId = t.biomeAt(x, z);
  const patch = patchNoise.noise(x / 38, z / 38);
  if (b === BIOME.flowers) {
    if (patch < -0.15) return r < 0.06 ? MEADOW[Math.floor(r2 * MEADOW.length)] : null;
    // แบ่งทุ่งเป็นแปลงราว 60 ม. ขอบไม่เรียบ (บิดพิกัดด้วยสัญญาณรบกวน) แปลงละชนิดแบบทุ่งจริง
    const wx = x + 14 * patchNoise.noise(x / 31 + 3, z / 31);
    const wz = z + 14 * patchNoise.noise(x / 31, z / 31 - 5);
    const kind = FIELD[Math.floor(hash2(Math.floor(wx / 60), Math.floor(wz / 60), 77) * FIELD.length)];
    const dens = kind === 'sunflower' ? 0.4 : 0.6;
    return r < dens * Math.min(1, (patch + 0.15) * 3) ? kind : null;
  }
  if (b === BIOME.meadow || b === BIOME.tallGrass || b === BIOME.alpine) return r < 0.05 + 0.08 * Math.max(0, patch) ? MEADOW[Math.floor(r2 * MEADOW.length)] : null;
  if (b === BIOME.farmland) return r < 0.04 ? (r2 < 0.5 ? 'poppy' : 'cornflower') : null;
  if (b === BIOME.orchard) return r < 0.035 ? (r2 < 0.6 ? 'dogRose' : 'foxglove') : null;
  if (b === BIOME.deciduous) return r < 0.09 * Math.max(0, patch + 0.4) ? (r2 < 0.7 ? 'bluebell' : 'foxglove') : null;
  if (b === BIOME.dense) return r < 0.015 ? 'foxglove' : null;
  if (b === BIOME.rainforest) return r < 0.03 ? 'orchid' : null;
  return null;
}

/** ดอกไม้ในช่อง 16 ม. หนึ่งช่อง (ผลเดิมทุกครั้ง) · step ระยะห่างตาราง */
export function flowersInTile(t: Terrain, x0: number, z0: number, size: number, step = 1.05): FlowerSpot[] {
  const out: FlowerSpot[] = [];
  const i0 = Math.round(x0 / step);
  const j0 = Math.round(z0 / step);
  const n = Math.round(size / step);
  for (let j = j0; j < j0 + n; j++) {
    for (let i = i0; i < i0 + n; i++) {
      const x = (i + 0.15 + 0.7 * hash2(i, j, 61)) * step;
      const z = (j + 0.15 + 0.7 * hash2(i, j, 62)) * step;
      const h = t.heightAt(x, z);
      // ริมน้ำ: ธูปฤาษีกับอ้อขึ้นในน้ำตื้น หญ้าหางม้าบนตลิ่ง หินกลมท้องน้ำ · น้ำนิ่งมีบัวสาย
      const wl = WORLD.waterLevel;
      if (h < wl + 1.1 && h > wl - 1.7) {
        const r = hash2(i, j, 63);
        const dv = riverDistance(x, z);
        const still = dv > RIVER_WIDTH + 30;
        let kind: TilePlantId | null = null;
        if (h < wl - 0.35) kind = still && r < 0.16 ? 'waterLily' : null;
        else if (h < wl + 0.05) kind = r < 0.42 ? (hash2(i, j, 64) < 0.55 ? 'cattail' : 'reed') : null;
        else if (r < 0.2) kind = 'horsetail';
        else if (!still && r < 0.3) kind = 'stone';
        if (kind) {
          const [a, b] = kind === 'waterLily' ? FLOWER_HEIGHT.waterLily : RIVER_PLANT_SIZE[kind as RiverPlantId] ?? FLOWER_HEIGHT[kind as FlowerId];
          out.push({ kind, x, y: kind === 'waterLily' ? wl : h, z, rot: hash2(i, j, 65) * Math.PI * 2, scale: a + (b - a) * hash2(i, j, 66) });
          continue;
        }
        if (h < wl + 0.3) continue;
      }
      const kind = flowerAt(t, x, z, hash2(i, j, 63), hash2(i, j, 64));
      if (!kind || kind === 'waterLily') continue;
      if (h < WORLD.waterLevel + 0.3 || t.slopeAt(x, z) > 0.4 || distToRoads(x, z) < ROAD_WIDTH + 0.5) continue;
      const [a, b] = FLOWER_HEIGHT[kind];
      // ทานตะวันดอกแก่หันทิศตะวันออก (REFERENCES-R2 หัวข้อ 4) · ชนิดอื่นหันสุ่ม
      const rot = kind === 'sunflower' ? -Math.PI / 2 + (hash2(i, j, 65) - 0.5) * 0.5 : hash2(i, j, 65) * Math.PI * 2;
      out.push({ kind, x, y: h, z, rot, scale: a + (b - a) * hash2(i, j, 66) });
    }
  }
  return out;
}

/** ความสูงหญ้าที่จุดนั้น (เมตร) · ทุ่งหญ้าสูงถึงอกเอเลี่ยน 1.5 ม. */
export function grassHeightAt(t: Terrain, x: number, z: number, r: number): number {
  const b = t.biomeAt(x, z);
  const n = patchNoise.noise(x / 22 + 40, z / 22);
  if (b === BIOME.tallGrass) return 0.75 + 0.45 * r + 0.15 * n;
  if (b === BIOME.farmland) return n > 0 ? 0.6 + 0.35 * r : 0.3 + 0.2 * r; // ไร่ร้าง บางแปลงหญ้าขึ้นสูง
  // ทุ่งดอกไม้หญ้าเตี้ยกว่าดอก ดอกจะไม่จมหญ้า
  if (b === BIOME.flowers) return 0.16 + 0.18 * r;
  if (b === BIOME.meadow) return n > 0.35 ? 0.55 + 0.4 * r : 0.28 + 0.22 * r;
  if (b === BIOME.wetland || b === BIOME.shore) return 0.5 + 0.4 * r;
  if (b === BIOME.alpine) return 0.12 + 0.12 * r;
  return 0.25 + 0.2 * r;
}
