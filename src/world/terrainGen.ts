import { WORLD } from '../config/game';
import { townDist, townWest, townZone, TOWN_FOREST } from './townZone';
import { BRIDGE, CAVES, GORGE, LAKE, MOUNTAINS, REGIONS, RIVER, RIVER_WIDTH, ROADS, ROAD_WIDTH, SHIP, TOWN, distToPolyline, type RegionName } from './layout';
import { MesaMap, mesaAway } from './mesas';
import { Simplex2 } from './noise';

// ตัวสร้างภูมิประเทศ 3 × 3 กม. · กติกาล้วน ไม่แตะภาพ ไม่แตะหน้าเว็บ
// เรียกได้ทั้งจาก Web Worker (terrain.worker.ts ตอนเปิดเกม หน้าเว็บไม่ค้าง) และจากเทสตรง ๆ
// seed เดิม ผลเดิมทุกครั้ง

export const smooth = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** ตารางความสูงทุก 2 ม. */
export const HEIGHT_STEP = 2;
/** ตารางชนิดพื้นที่ทุก 8 ม. */
export const BIOME_STEP = 8;

/** ชนิดพื้นที่ · ทุกระบบ (สีพื้น ต้นไม้ หญ้า ดอกไม้ สัตว์) อ่านจากตารางนี้ที่เดียว */
export const BIOME = {
  water: 0,
  shore: 1,
  meadow: 2,
  flowers: 3,
  tallGrass: 4,
  farmland: 5,
  wetland: 6,
  town: 7,
  redwood: 8,
  rainforest: 9,
  deciduous: 10,
  orchard: 11,
  dense: 12,
  alpine: 13,
  rock: 14,
  snow: 15,
} as const;
export type BiomeId = (typeof BIOME)[keyof typeof BIOME];
export const BIOME_COUNT = 16;
/** ชื่อเรียกในโค้ดตามเลข (ใช้ในเทสกับตัวช่วยทดสอบ) */
export const BIOME_NAMES = Object.keys(BIOME) as (keyof typeof BIOME)[];

export interface TerrainData {
  /** จุดต่อแถวของตารางความสูง */
  n: number;
  heights: Float32Array;
  /** ช่องต่อแถวของตารางชนิดพื้นที่ */
  bn: number;
  biomes: Uint8Array;
}

/**
 * ระยะถึงแม่น้ำกับถนนแบบหยาบทุก 16 ม. · ใช้คัดก่อนว่าจุดนั้นใกล้พอจะต้องคิดระยะจริงไหม
 * (คิดระยะจริงทุกจุด 2.25 ล้านจุด ช้าเกินไป)
 */
class CoarseDistance {
  static readonly STEP = 16;
  readonly n = WORLD.size / CoarseDistance.STEP + 1;
  readonly river: Float32Array;
  readonly road: Float32Array;
  constructor() {
    const n = this.n;
    this.river = new Float32Array(n * n);
    this.road = new Float32Array(n * n);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x = -WORLD.half + i * CoarseDistance.STEP;
        const z = -WORLD.half + j * CoarseDistance.STEP;
        this.river[j * n + i] = distToPolyline(x, z, RIVER);
        let r = Infinity;
        for (const road of ROADS) r = Math.min(r, distToPolyline(x, z, road));
        this.road[j * n + i] = r;
      }
    }
  }
  /** ค่าหยาบที่จุดใกล้ที่สุด (คลาดได้ไม่เกินครึ่งเส้นทแยงช่อง ราว 11 ม.) */
  at(field: Float32Array, x: number, z: number): number {
    const i = Math.max(0, Math.min(this.n - 1, Math.round((x + WORLD.half) / CoarseDistance.STEP)));
    const j = Math.max(0, Math.min(this.n - 1, Math.round((z + WORLD.half) / CoarseDistance.STEP)));
    return field[j * this.n + i];
  }
}

/** สูตรรูปร่างภูมิประเทศ */
export class TerrainShaper {
  private noise = new Simplex2(WORLD.seed);
  private detail = new Simplex2(WORLD.seed + 7);
  private biomeNoise = new Simplex2(WORLD.seed + 303);
  private dist = new CoarseDistance();
  /** ภูเขายอดตัดทั้งแมพ แต่ละลูกหน้าตาของตัวเอง */
  readonly mesas = new MesaMap();
  /** ความสูงพื้นตรงปากถ้ำแต่ละแห่ง (คิดก่อนปั้นเนินถ้ำ) */
  private caveBase: number[];

  constructor() {
    this.bridgeY = Math.max(this.hills(BRIDGE.x, BRIDGE.z), WORLD.waterLevel + 5);
    this.caveBase = CAVES.map((c) => this.shapeBase(c.x, c.z));
  }

  /** ระยะถึงแม่น้ำ · ไกลกว่า 60 ม. ใช้ค่าหยาบ */
  riverDist(x: number, z: number): number {
    const d = this.dist.at(this.dist.river, x, z);
    return d > 60 ? d : distToPolyline(x, z, RIVER);
  }

  /** ระยะถึงถนนที่ใกล้ที่สุด · ไกลกว่า 60 ม. ใช้ค่าหยาบ */
  roadDist(x: number, z: number): number {
    const d = this.dist.at(this.dist.road, x, z);
    if (d > 60) return d;
    let r = Infinity;
    for (const road of ROADS) r = Math.min(r, distToPolyline(x, z, road));
    return r;
  }

  /** เนินพื้นฐาน ก่อนมีภูเขา (ราว 6 ถึง 34 ม.) */
  private hills(x: number, z: number): number {
    const nz = this.noise;
    let h = 20 + 13 * nz.fbm(x / 420, z / 420, 4);
    // ตะวันออกเป็นเนินคลื่นถี่กว่า (ทุ่งดอกไม้กับทุ่งหญ้า)
    h += 7 * smooth(250, 600, x) * nz.fbm(x / 170 + 4, z / 170 - 2, 3);
    // ตีนเขาตะวันตกยกสูง (ป่าสนยักษ์)
    h += 45 * smooth(-300, -900, x) * smooth(-150, -650, z) * (0.6 + 0.4 * nz.fbm(x / 260, z / 260, 3));
    return h;
  }

  /** ความสูงพื้นถนนตรงสะพาน · ถนนสองฝั่งค่อย ๆ ปรับเข้าหาระดับนี้ พื้นสะพานราบจึงแตะคันดินทั้งสองฝั่ง */
  private bridgeY = 0;

  /** ความสูงเนินแบบนุ่มสำหรับพื้นถนน (ไม่เอาภูเขาหรือรายละเอียด) */
  roadHeight(x: number, z: number): number {
    let h = Math.max(this.hills(x, z), WORLD.waterLevel + 3);
    h = lerp(this.bridgeY, h, smooth(30, 160, Math.hypot(x - BRIDGE.x, z - BRIDGE.z)));
    h = lerp(TOWN.height, h, smooth(TOWN.radius * 0.7, TOWN.radius + 90, Math.hypot(x - TOWN.x, z - TOWN.z)));
    return lerp(SHIP.height, h, smooth(SHIP.radius, SHIP.radius + 60, Math.hypot(x - SHIP.x, z - SHIP.z)));
  }

  /** ภูมิประเทศทั้งหมดยกเว้นเนินถ้ำ */
  shapeBase(x: number, z: number): number {
    const nz = this.noise;
    let h = this.hills(x, z);

    // เทือกเขาทิศเหนือ ยอดสูง 650 ถึง 800 ม. · ขอบแมพด้านอื่นเป็นสันเขาเตี้ยกว่า (ไม่เห็นขอบโลก)
    const north = smooth(MOUNTAINS.foot, MOUNTAINS.crest, z);
    const west = smooth(-1120, -1460, x);
    const east = smooth(1120, 1460, x);
    const south = smooth(1290, 1480, z);
    const edge = Math.max(west, east, south);
    if (north > 0 || edge > 0) {
      // สันเขา 4 ชั้นความถี่ (ชั้นถี่กว่านี้ทำให้ผาชันเกินจริงทั้งเทือก)
      const ridge = nz.ridged(x / 780 + 3.1, z / 780 - 1.7, 4);
      const wob = 0.92 + 0.08 * nz.fbm(x / 340 - 9, z / 340 + 2, 3);
      // ฐานเทือกสูงครึ่งหนึ่งของยอด แล้วสันเขาแหลมขึ้นไปอีก ยอดเหนือแนวหิมะจึงมีเป็นแนวยาว ไม่ใช่ยอดเดี่ยว
      const peaks = (0.5 + 0.5 * ridge) * MOUNTAINS.peak * wob;
      h += Math.max(north * peaks, edge * (50 + 260 * ridge) * wob);
      // ผิวหินขรุขระบนภูเขา
      h += 5 * Math.max(north, edge) * this.detail.fbm(x / 60, z / 60, 3);
    }

    // ภูเขายอดตัด (ที่ราบสูงขอบหน้าผา) ไว้ปีนขึ้นดูวิว ไม่ขึ้นบนเทือกเขา ใกล้เมือง ใกล้ยาน
    // แต่ละลูกมีชนิดหิน ความสูง หน้าตัดหน้าผาของตัวเอง (world/mesas.ts · เดิมยกพื้นขึ้นทีเดียว 14 ม. เป็นผนังดิ่งทุกลูก)
    const away = mesaAway(x, z);
    if (away > 0.001) h += this.mesas.heightAt(x, z) * away;

    // หุบป่าดิบชื้น: ยกที่ราบสองฝั่งแม่น้ำ แล้วแม่น้ำกัดเป็นหุบลึกผาชัน
    const dv = this.riverDist(x, z);
    const gz = smooth(GORGE.zFrom - 120, GORGE.zFrom + 80, z) * (1 - smooth(GORGE.zTo - 80, GORGE.zTo + 120, z));
    const gorge = gz * (1 - smooth(GORGE.halfWidth * 0.55, GORGE.halfWidth, dv));
    h += gorge * GORGE.depth * (0.85 + 0.15 * nz.noise(x / 80, z / 80));

    // หุบที่ตั้งเมือง ลาดเบา · พันปีที่ไม่มีคนดูแล ดินตะกอนกับซากพังทับถม พื้นเป็นลอนนูนต่ำไม่ราบเรียบ
    const dt = Math.hypot(x - TOWN.x, z - TOWN.z);
    const settle = 1.1 * nz.noise(x / 46, z / 46) + 0.35 * this.detail.noise(x / 13 + 4, z / 13 - 7);
    h = lerp(TOWN.height + settle, h, smooth(TOWN.radius * 0.7, TOWN.radius + 90, dt));

    // ทุ่งจอดยาน ราบ
    const ds = Math.hypot(x - SHIP.x, z - SHIP.z);
    h = lerp(SHIP.height, h, smooth(SHIP.radius, SHIP.radius + 60, ds));

    // ทุ่งนาเก่ารอบเมือง ยังลาดเบา (ป่าขึ้นทับฝั่งที่ไม่ใช่ทุ่งแล้ว ดูที่ biomeAt)
    const farm = smooth(TOWN.radius * 2.6, TOWN.radius * 1.2, dt) * (1 - smooth(0.3, 0.8, north + edge));
    h = lerp(h, TOWN.height + (h - TOWN.height) * 0.35, farm);

    // ที่ลุ่มน้ำรอบทะเลสาบ ต่ำเกือบเท่าระดับน้ำ มีแอ่งน้ำขัง
    const wr = REGIONS.wetland;
    const wet = 1 - smooth(0.55, 1, Math.hypot((x - wr.x) / wr.rx, (z - wr.z) / wr.rz));
    if (wet > 0) h = lerp(h, WORLD.waterLevel + 1.1 + 1.6 * this.detail.fbm(x / 35, z / 35, 3), wet);

    // ถนน ปาดให้เรียบตามแนว
    const dr = this.roadDist(x, z);
    if (dr < ROAD_WIDTH + 18) h = lerp(this.roadHeight(x, z), h, smooth(ROAD_WIDTH, ROAD_WIDTH + 18, dr));

    // รายละเอียดเล็ก ๆ ให้พื้นไม่เรียบเหมือนโต๊ะ
    h += 0.9 * this.detail.fbm(x / 14, z / 14, 2) * smooth(ROAD_WIDTH, ROAD_WIDTH + 6, dr);

    // แม่น้ำกัดหุบลงถึงระดับน้ำตลอดสาย · ริมฝั่งลาดเบา 12 ม. แรก (ไว้ให้พืชริมน้ำ) แล้วชันตามพื้นที่
    // ในหุบป่าดิบชื้นผาชันมาก · ในภูเขาหุบรูปตัววี
    const e = dv - RIVER_WIDTH * 0.55;
    const wall = lerp(lerp(0.55, 1.1, north), 2.8, gz);
    const bed = WORLD.waterLevel - 2.2 - 0.8 * smooth(0, -RIVER_WIDTH * 0.5, e);
    // หุบป่าดิบชื้นมีท้องหุบกว้างราว 75 ม. ต่อฝั่ง (ไว้ให้ป่าขึ้น) ก่อนถึงผาชัน · ที่อื่นริมฝั่ง 12 ม.
    const floorW = lerp(12, 75, gz);
    const carve = e <= 0 ? bed : bed + 0.3 * Math.min(e, 12) + 0.07 * Math.max(0, Math.min(e, floorW) - 12) + wall * Math.max(0, e - floorW);
    // ใต้สะพานเว้นร่องน้ำ แต่ถนนเป็นคันดินถึงหัวสะพาน
    if (dr < ROAD_WIDTH + 10 && dv > RIVER_WIDTH + 6) h = Math.max(Math.min(h, carve), this.roadHeight(x, z) - 0.2);
    else h = Math.min(h, carve);

    // ทะเลสาบ
    const dl = Math.hypot(x - LAKE.x, z - LAKE.z) * (1 + 0.14 * nz.noise(x / 90, z / 90));
    h = lerp(WORLD.waterLevel - 6, h, smooth(LAKE.radius * 0.55, LAKE.radius + 45, dl));
    return h;
  }

  /** รูปร่างเต็ม (รวมเนินหน้าผาหลังปากถ้ำ) */
  shape(x: number, z: number): number {
    let h = this.shapeBase(x, z);
    // ถ้ำ: เนินหน้าผาชันข้างหลังปากถ้ำ สูงกว่าเพดานอุโมงค์มาก อุโมงค์จึงอยู่ข้างในภูเขาจริง
    CAVES.forEach((c, i) => {
      const ox = -Math.sin(c.dir);
      const oz = -Math.cos(c.dir);
      const a = -((x - c.x) * ox + (z - c.z) * oz); // ระยะเข้าไปในเนิน (หลังปากถ้ำ)
      const w = Math.abs((x - c.x) * -oz + (z - c.z) * ox);
      if (a < -14 || a > c.depth + 40 || w > 55) return;
      // ลานหน้าปากถ้ำราบเท่าพื้นถ้ำ
      if (a < 0) {
        h = lerp(h, this.caveBase[i], smooth(-14, -4, a) * (1 - smooth(8, 20, w)));
        return;
      }
      const rise = 22 * smooth(-1, 5, a) * (1 - smooth(34, 55, w)) * (1 - smooth(c.depth + 15, c.depth + 40, a));
      h = Math.max(h, this.caveBase[i] + rise + 3 * this.detail.noise(x / 9, z / 9) * smooth(2, 8, a));
    });
    return h;
  }

  /** น้ำหนักของเขตป่าและทุ่ง 0 ถึง 1 (ขอบผสมสัญญาณรบกวน ไม่เป็นวงรีเรียบ) */
  regionWeight(name: RegionName, x: number, z: number): number {
    const r = REGIONS[name];
    const d = Math.hypot((x - r.x) / r.rx, (z - r.z) / r.rz);
    const wobble = 0.28 * this.biomeNoise.fbm(x / 260 + r.x * 0.001, z / 260 - r.z * 0.001, 3);
    return 1 - smooth(0.55, 1.05, d + wobble);
  }

  /** ชนิดพื้นที่ที่จุดนั้น จากความสูง ความชัน ระยะแม่น้ำ และผัง */
  biomeAt(x: number, z: number, h: number, slope: number): BiomeId {
    const bn = this.biomeNoise;
    const water = WORLD.waterLevel;
    if (h < water + 0.15) return BIOME.water;
    const dv = this.riverDist(x, z);
    const dl = Math.hypot(x - LAKE.x, z - LAKE.z);
    if (h < water + 1.4 && (dv < RIVER_WIDTH + 24 || dl < LAKE.radius + 25)) return BIOME.shore;
    // เมืองเก่าพันปี: ใจกลางกับย่านบ้านมีต้นไม้ขึ้นรก · ฝั่งตะวันตกเป็นทุ่งนาเก่า (ทางเดินจากยาน) · ฝั่งอื่นป่ากลืนบ้านรอบนอก
    const tz = townZone(x, z);
    if (tz === 'core' || tz === 'res') return BIOME.town;
    if (tz === 'field') return BIOME.farmland;
    if (tz === 'forest') return BIOME.dense;
    const n1 = bn.noise(x / 70, z / 70);
    if (h > MOUNTAINS.snowLine + 45 * n1 && slope < 0.75) return BIOME.snow;
    if (slope > 0.6 + 0.06 * n1 && h > 25) return BIOME.rock;
    if (h > 390 + 40 * n1) return slope > 0.42 ? BIOME.rock : BIOME.alpine;
    if (Math.hypot(x - SHIP.x, z - SHIP.z) < SHIP.radius + 70) return BIOME.meadow;
    // หุบป่าดิบชื้น
    const gz = smooth(GORGE.zFrom - 60, GORGE.zFrom + 40, z) * (1 - smooth(GORGE.zTo - 40, GORGE.zTo + 60, z));
    if (gz > 0.5 && dv < GORGE.halfWidth * 0.75 + 30 * n1) return BIOME.rainforest;
    // เขตตามผัง เลือกเขตที่น้ำหนักมากสุด
    let best: RegionName | null = null;
    let bw = 0.5;
    for (const name of Object.keys(REGIONS) as RegionName[]) {
      const w = this.regionWeight(name, x, z);
      if (w > bw) { bw = w; best = name; }
    }
    if (best === 'wetland') return h < water + 3.6 ? BIOME.wetland : BIOME.tallGrass;
    if (best) return BIOME[best];
    // ทุ่งนาเก่าต่อจากเมืองไปทางตะวันตก ป่ายังไม่กลับมาเต็ม
    if (townWest(x, z) > 0.6 && townDist(x, z) < TOWN_FOREST + 170 + 60 * n1 && dv > 35) return BIOME.farmland;
    // นอกเขต: ทุ่งหญ้าสลับดงป่า · ป่าทึบมากขึ้นทางตะวันตกและตีนเขา
    const forest = bn.fbm(x / 210 + 7, z / 210 - 3, 3) + 0.25 * smooth(-200, -700, x) + 0.3 * smooth(-200, -560, z);
    if (forest > 0.12) return BIOME.dense;
    if (bn.noise(x / 120 - 4, z / 120 + 6) > 0.55) return BIOME.flowers;
    return BIOME.meadow;
  }
}

/**
 * ถมแอ่งปิดบนบก (วิธี priority flood) · ทุกจุดมีทางไม่ขึ้นเนินไปถึงน้ำหรือขอบแมพ
 * เดิมมีหลุมบนภูเขาที่ไถลลงไปได้ แต่ผนังชันเกินเดินออก ติดตลอดไปถ้าไม่ถือที่ปีน (ข้อ 69 ในรายงานตรวจ)
 * เริ่มถมจากขอบแมพกับทุกจุดที่ต่ำกว่าระดับน้ำ (แม่น้ำ ทะเลสาบ แอ่งน้ำในที่ลุ่ม ไม่ถูกถม)
 */
export function fillPits(h: Float32Array, n: number, water: number): number {
  const total = n * n;
  const done = new Uint8Array(total);
  const heap = new Int32Array(total);
  let size = 0;
  const less = (a: number, b: number) => h[heap[a]] < h[heap[b]];
  const push = (k: number) => {
    let i = size++;
    heap[i] = k;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!less(i, p)) break;
      const t = heap[i]; heap[i] = heap[p]; heap[p] = t;
      i = p;
    }
  };
  const pop = (): number => {
    const top = heap[0];
    heap[0] = heap[--size];
    let i = 0;
    for (;;) {
      const l = i * 2 + 1;
      const r = l + 1;
      let m = i;
      if (l < size && less(l, m)) m = l;
      if (r < size && less(r, m)) m = r;
      if (m === i) break;
      const t = heap[i]; heap[i] = heap[m]; heap[m] = t;
      i = m;
    }
    return top;
  };
  for (let k = 0; k < total; k++) {
    const i = k % n;
    const j = (k - i) / n;
    if (i === 0 || j === 0 || i === n - 1 || j === n - 1 || h[k] < water) { done[k] = 1; push(k); }
  }
  let raised = 0;
  while (size > 0) {
    const k = pop();
    const i = k % n;
    const base = h[k];
    const nb = [k - 1, k + 1, k - n, k + n];
    for (let q = 0; q < 4; q++) {
      const m = nb[q];
      if (m < 0 || m >= total || done[m]) continue;
      if ((q === 0 && i === 0) || (q === 1 && i === n - 1)) continue;
      done[m] = 1;
      if (h[m] < base) { h[m] = base; raised++; }
      push(m);
    }
  }
  return raised;
}

/**
 * สร้างตารางความสูงกับตารางชนิดพื้นที่ทั้งแมพ
 * onProgress รับค่า 0 ถึง 1 (ส่งทุก 32 แถว) ไว้ทำแถบความคืบหน้าบนหน้าเริ่มเกม
 */
export function generateTerrain(onProgress?: (f: number) => void): TerrainData {
  const shaper = new TerrainShaper();
  const n = WORLD.size / HEIGHT_STEP + 1;
  const heights = new Float32Array(n * n);
  for (let j = 0; j < n; j++) {
    const z = -WORLD.half + j * HEIGHT_STEP;
    for (let i = 0; i < n; i++) heights[j * n + i] = shaper.shape(-WORLD.half + i * HEIGHT_STEP, z);
    if (onProgress && j % 32 === 0) onProgress((j / n) * 0.8);
  }
  fillPits(heights, n, WORLD.waterLevel);
  onProgress?.(0.88);
  const bn = WORLD.size / BIOME_STEP;
  const biomes = new Uint8Array(bn * bn);
  const per = BIOME_STEP / HEIGHT_STEP;
  for (let j = 0; j < bn; j++) {
    for (let i = 0; i < bn; i++) {
      // กลางช่อง 8 ม. ตรงกับจุดในตารางความสูง
      const gi = i * per + per / 2;
      const gj = j * per + per / 2;
      const h = heights[gj * n + gi];
      const dx = (heights[gj * n + gi + 1] - heights[gj * n + gi - 1]) / (2 * HEIGHT_STEP);
      const dz = (heights[(gj + 1) * n + gi] - heights[(gj - 1) * n + gi]) / (2 * HEIGHT_STEP);
      const slope = 1 - 1 / Math.sqrt(1 + dx * dx + dz * dz);
      biomes[j * bn + i] = shaper.biomeAt(-WORLD.half + gi * HEIGHT_STEP, -WORLD.half + gj * HEIGHT_STEP, h, slope);
    }
    if (onProgress && j % 32 === 0) onProgress(0.88 + (j / bn) * 0.12);
  }
  onProgress?.(1);
  return { n, heights, bn, biomes };
}
