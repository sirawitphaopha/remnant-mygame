import { WORLD } from '../config/game';
import { CAVES, REGIONS, RIVER, ROAD_WIDTH, SHIP, distToPolyline, distToRoads } from './layout';
import { BIOME, type BiomeId } from './terrainGen';
import { ALL_TREE_KINDS, ORCHARD_ROWS, SPECIES_BY_ID, deadKindOf, pickSpecies, type TreeKind } from './trees';
import { Simplex2, hash2 } from './noise';
import { smooth, type Terrain } from './Terrain';

export type { TreeKind } from './trees';

export interface Placed {
  x: number;
  y: number;
  z: number;
  /** หมุนรอบแกนตั้ง */
  rot: number;
  scale: number;
}

export interface TreeSet {
  kind: TreeKind;
  items: Placed[];
}

const forestNoise = new Simplex2(WORLD.seed + 101);

/**
 * ความหนาแน่นป่าพื้นฐานของแต่ละชนิดพื้นที่ (BIOME) · ป่าดิบชื้นกับป่าทึบแน่นสุด ทุ่งโล่งมีไม้เดี่ยวประปราย
 * ช่วง 4 ปลูกต้นไม้ 19 ชนิดตามป่าแต่ละแบบแทนชุดนี้
 */
const BIOME_FOREST: number[] = [];
BIOME_FOREST[BIOME.water] = 0;
BIOME_FOREST[BIOME.shore] = 0.06;
BIOME_FOREST[BIOME.meadow] = 0.07;
BIOME_FOREST[BIOME.flowers] = 0.03;
BIOME_FOREST[BIOME.tallGrass] = 0.04;
BIOME_FOREST[BIOME.farmland] = 0.02;
BIOME_FOREST[BIOME.wetland] = 0.12;
BIOME_FOREST[BIOME.town] = 0.1;
BIOME_FOREST[BIOME.redwood] = 0.7;
BIOME_FOREST[BIOME.rainforest] = 0.95;
BIOME_FOREST[BIOME.deciduous] = 0.72;
BIOME_FOREST[BIOME.orchard] = 0.6;
BIOME_FOREST[BIOME.dense] = 0.88;
BIOME_FOREST[BIOME.alpine] = 0.12;
BIOME_FOREST[BIOME.rock] = 0.04;
BIOME_FOREST[BIOME.snow] = 0;

/** ความหนาแน่นป่าที่จุดนั้น 0 ถึง 1 (ใช้ทั้งต้นไม้ พืชเล็ก หญ้า เสียง และสัตว์) */
export function forestDensity(t: Terrain, x: number, z: number): number {
  const h = t.heightAt(x, z);
  if (h < WORLD.waterLevel + 0.4) return 0;
  const base = BIOME_FOREST[t.biomeAt(x, z)];
  // ช่องว่างกลางป่า ดงหนาสลับโปร่ง
  return base * (0.6 + 0.4 * smooth(-0.5, 0.35, forestNoise.fbm(x / 160, z / 160, 3)));
}

/** ตรงนี้วางของได้ไหม (ไม่อยู่บนถนน น้ำ หน้าผา ที่จอดยาน ปากถ้ำ) */
export function canPlace(t: Terrain, x: number, z: number, maxSlope: number, roadGap: number): boolean {
  if (t.heightAt(x, z) < WORLD.waterLevel + 0.3) return false;
  if (t.slopeAt(x, z) > maxSlope) return false;
  if (distToRoads(x, z) < ROAD_WIDTH + roadGap) return false;
  if (Math.hypot(x - SHIP.x, z - SHIP.z) < SHIP.radius + 8) return false;
  for (const c of CAVES) if (Math.hypot(x - c.x, z - c.z) < 14) return false;
  return true;
}

/**
 * ต้นไม้ทั้งแมพ 19 ชนิด + ต้นตาย · คำนวณครั้งเดียว ผลเดิมทุกครั้ง
 * scale = ความสูงจริง ÷ 10 (โมเดลทุกชนิดปั้นสูง 10 ม.) · ชนิดตามชนิดพื้นที่ (ป่า 5 แบบ) · ป่าที่เคยเป็นไร่ปลูกเป็นแถว
 * blocked = ที่ห้ามขึ้น (ในตึก) ส่งมาจากผู้เรียก
 */
export function scatterTrees(t: Terrain, blocked: (x: number, z: number) => boolean = () => false): TreeSet[] {
  const cell = 7;
  const sets = new Map<TreeKind, Placed[]>(ALL_TREE_KINDS.map((k) => [k, []]));
  const add = (kind: TreeKind, x: number, z: number, height: number, rot: number) => {
    sets.get(kind)!.push({ x, y: t.heightAt(x, z), z, rot, scale: height / 10 });
  };
  const pick = (b: BiomeId, x: number, z: number, r: number) => pickSpecies(b, r, distToPolyline(x, z, RIVER) < 30);
  const deadChance = (b: BiomeId) => (b === BIOME.dense || b === BIOME.redwood ? 0.08 : b === BIOME.orchard ? 0.1 : 0.05);
  const n = Math.floor(WORLD.size / cell);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const r1 = hash2(i, j, 1);
      const x = -WORLD.half + (i + 0.15 + 0.7 * hash2(i, j, 2)) * cell;
      const z = -WORLD.half + (j + 0.15 + 0.7 * hash2(i, j, 3)) * cell;
      const b = t.biomeAt(x, z);
      if (b === BIOME.orchard) continue; // ปลูกเป็นแถวข้างล่าง
      const dens = forestDensity(t, x, z);
      if (r1 > dens * 0.85) continue;
      if (!canPlace(t, x, z, 0.32, 3) || blocked(x, z)) continue;
      const sp = pick(b, x, z, hash2(i, j, 4));
      const height = sp.height[0] + (sp.height[1] - sp.height[0]) * hash2(i, j, 6);
      const kind = hash2(i, j, 7) < deadChance(b) ? deadKindOf(sp) : sp.id;
      add(kind, x, z, kind === sp.id ? height : height * 0.75, hash2(i, j, 5) * Math.PI * 2);
    }
  }
  // ป่าที่เคยเป็นไร่: แถวแอปเปิลกับมะม่วงตามแนวปลูกเดิม บางต้นตาย บางช่องว่าง ไม้ป่าขึ้นแทรกระหว่างแถว
  const { angle, along, across } = ORCHARD_ROWS;
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  const o = REGIONS.orchard;
  const reach = Math.max(o.rx, o.rz) * 1.3;
  // แถวเริ่มที่จุดศูนย์กลางสวนพอดี (ทุกแถวห่างเท่ากันจากกลางสวน)
  for (let a = -Math.ceil(reach / along) * along; a <= reach; a += along) {
    for (let c = -Math.ceil(reach / across) * across; c <= reach; c += across) {
      const x = o.x + a * ca - c * sa;
      const z = o.z + a * sa + c * ca;
      if (t.biomeAt(x, z) !== BIOME.orchard) continue;
      const ia = Math.round(a / along);
      const ic = Math.round(c / across);
      if (!canPlace(t, x, z, 0.32, 3) || blocked(x, z)) continue;
      const r = hash2(ia, ic, 31);
      if (r < 0.12) continue; // ต้นที่หายไปจากแถว
      const sp = SPECIES_BY_ID.get(hash2(ia, ic, 32) < 0.75 ? 'apple' : 'mango')!;
      // ต้นที่ปล่อยร้างสูงกว่าต้นปลูก กิ่งรก
      const height = sp.height[0] + (sp.height[1] - sp.height[0]) * hash2(ia, ic, 33);
      const kind = r < 0.2 ? deadKindOf(sp) : sp.id;
      add(kind, x + (hash2(ia, ic, 34) - 0.5) * 0.8, z + (hash2(ia, ic, 35) - 0.5) * 0.8, height, hash2(ia, ic, 36) * Math.PI * 2);
      // ไม้ป่าขึ้นแทรกกลางแถว (เบิร์ชเป็นไม้เบิกนำ)
      if (hash2(ia, ic, 37) < 0.3) {
        const mx = x - sa * across * 0.5;
        const mz = z + ca * across * 0.5;
        if (t.biomeAt(mx, mz) === BIOME.orchard && canPlace(t, mx, mz, 0.32, 3) && !blocked(mx, mz)) {
          const w = pickSpecies(BIOME.orchard, hash2(ia, ic, 38), false);
          add(w.id, mx, mz, w.height[0] + (w.height[1] - w.height[0]) * hash2(ia, ic, 39), hash2(ia, ic, 40) * 6.28);
        }
      }
    }
  }
  return ALL_TREE_KINDS.map((kind) => ({ kind, items: sets.get(kind)! }));
}

/** ขอนไม้ล้ม ตอไม้ ต้นล้มทั้งราก (มีมอส) · ในป่าเท่านั้น */
export type DebrisKind = 'log' | 'stump' | 'uprooted';
export const DEBRIS_KINDS: DebrisKind[] = ['log', 'stump', 'uprooted'];
export function scatterDebris(t: Terrain, blocked: (x: number, z: number) => boolean = () => false): Record<DebrisKind, Placed[]> {
  const out: Record<DebrisKind, Placed[]> = { log: [], stump: [], uprooted: [] };
  const cell = 16;
  const n = Math.floor(WORLD.size / cell);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = -WORLD.half + (i + hash2(i, j, 51)) * cell;
      const z = -WORLD.half + (j + hash2(i, j, 52)) * cell;
      const dens = forestDensity(t, x, z);
      if (dens < 0.45 || hash2(i, j, 53) > dens * 0.5) continue;
      if (!canPlace(t, x, z, 0.25, 3) || blocked(x, z)) continue;
      const r = hash2(i, j, 54);
      const kind: DebrisKind = r < 0.55 ? 'log' : r < 0.85 ? 'stump' : 'uprooted';
      out[kind].push({ x, y: t.heightAt(x, z), z, rot: hash2(i, j, 55) * Math.PI * 2, scale: 0.7 + 0.6 * hash2(i, j, 56) });
    }
  }
  return out;
}

/** ก้อนหินทั้งแมพ · มากบนเนินชันกับภูเขา */
export function scatterRocks(t: Terrain): Placed[] {
  const cell = 13;
  const out: Placed[] = [];
  const n = Math.floor(WORLD.size / cell);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = -WORLD.half + (i + hash2(i, j, 11)) * cell;
      const z = -WORLD.half + (j + hash2(i, j, 12)) * cell;
      const slope = t.slopeAt(x, z);
      const b = t.biomeAt(x, z);
      if (b === BIOME.snow || b === BIOME.town) continue;
      const chance = 0.08 + slope * 0.9 + smooth(60, 300, t.heightAt(x, z)) * 0.15 + (b === BIOME.rock ? 0.25 : 0);
      if (hash2(i, j, 13) > chance) continue;
      if (!canPlace(t, x, z, 0.75, 2)) continue;
      out.push({ x, y: t.heightAt(x, z), z, rot: hash2(i, j, 14) * Math.PI * 2, scale: 0.5 + 2.2 * Math.pow(hash2(i, j, 15), 2) });
    }
  }
  return out;
}

export type PlantKind = 'fern' | 'flower' | 'bush' | 'mushroom' | 'moss';
export const PLANT_KINDS: PlantKind[] = ['fern', 'flower', 'bush', 'mushroom', 'moss'];

/** พืชเล็กในรัศมีรอบตัว · ใช้ตารางที่ล็อกกับพิกัดโลก เดินไปมาแล้วต้นเดิมอยู่ที่เดิม */
export function scatterPlants(t: Terrain, cx: number, cz: number, radius: number): Record<PlantKind, Placed[]> {
  const cell = 2.6;
  const out: Record<PlantKind, Placed[]> = { fern: [], flower: [], bush: [], mushroom: [], moss: [] };
  const i0 = Math.floor((cx - radius) / cell);
  const i1 = Math.floor((cx + radius) / cell);
  const j0 = Math.floor((cz - radius) / cell);
  const j1 = Math.floor((cz + radius) / cell);
  const r2 = radius * radius;
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const x = (i + hash2(i, j, 21)) * cell;
      const z = (j + hash2(i, j, 22)) * cell;
      if ((x - cx) ** 2 + (z - cz) ** 2 > r2) continue;
      const r = hash2(i, j, 23);
      if (r > 0.42) continue;
      if (!canPlace(t, x, z, 0.5, 0.5)) continue;
      // บนหิมะกับหน้าผาไม่มีพืช · ทุ่งหญ้าบนเขาบางลง
      const b = t.biomeAt(x, z);
      if (b === BIOME.snow || b === BIOME.rock || b === BIOME.town) continue;
      if (b === BIOME.alpine && r > 0.12) continue;
      const dens = forestDensity(t, x, z);
      const pick = hash2(i, j, 24);
      let kind: PlantKind;
      if (dens > 0.55) kind = pick < 0.55 ? 'fern' : pick < 0.63 ? 'moss' : pick < 0.78 ? 'mushroom' : 'bush';
      else kind = pick < 0.5 ? 'flower' : pick < 0.75 ? 'bush' : pick < 0.97 ? 'fern' : 'moss';
      out[kind].push({ x, y: t.heightAt(x, z), z, rot: hash2(i, j, 25) * Math.PI * 2, scale: 0.6 + 0.8 * hash2(i, j, 26) });
    }
  }
  return out;
}

/** กอหญ้าในรัศมีรอบตัว · ความหนาแน่นลดในป่าทึบ บนถนน และบนหิน */
export function grassDensity(t: Terrain, x: number, z: number): number {
  const h = t.heightAt(x, z);
  if (h < WORLD.waterLevel + 0.15) return 0;
  const slope = t.slopeAt(x, z);
  if (slope > 0.38) return 0;
  const road = distToRoads(x, z);
  let d = 1 - smooth(0.2, 0.38, slope);
  d *= 0.15 + 0.85 * smooth(ROAD_WIDTH * 0.55, ROAD_WIDTH + 1.5, road); // หญ้าขึ้นแทรกถนนพังบ้าง
  d *= 1 - 0.55 * forestDensity(t, x, z);
  // บนเขาหญ้าเตี้ยบางลงจนหมดที่แนวหิมะ
  d *= 1 - smooth(350, 560, h) * 0.85;
  const b = t.biomeAt(x, z);
  if (b === BIOME.snow) return 0;
  if (b === BIOME.rock) d *= 0.15;
  return d;
}
