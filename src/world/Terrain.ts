import { WORLD } from '../config/game';
import type { Ground } from './Ground';
import { CAVES, LAKE, RIVER, RIVER_WIDTH, ROAD, ROAD_WIDTH, SHIP, TOWN, distToPolyline } from './layout';
import { Simplex2 } from './noise';

export const smooth = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/**
 * ภูมิประเทศทั้งแมพ · คำนวณครั้งเดียวตอนเริ่มเป็นตารางความสูงทุก 2 เมตร
 * แล้วอ่านแบบเฉลี่ยระหว่างจุด (เร็วพอให้ตัวละคร กล้อง และการวางต้นไม้เรียกได้บ่อย ๆ)
 */
export class Terrain implements Ground {
  static readonly STEP = 2;
  readonly n: number;
  readonly heights: Float32Array;
  private noise = new Simplex2(WORLD.seed);
  private detail = new Simplex2(WORLD.seed + 7);

  constructor() {
    const step = Terrain.STEP;
    this.n = WORLD.size / step + 1;
    this.heights = new Float32Array(this.n * this.n);
    for (let j = 0; j < this.n; j++) {
      for (let i = 0; i < this.n; i++) {
        this.heights[j * this.n + i] = this.shape(-WORLD.half + i * step, -WORLD.half + j * step);
      }
    }
  }

  /** ความสูงเนินพื้นฐาน (ก่อนมีภูเขา เมือง ถนน แม่น้ำ) */
  private hills(x: number, z: number): number {
    return 9 + 9 * this.noise.fbm(x / 280, z / 280, 4);
  }

  /** รูปร่างภูมิประเทศแบบคำนวณเต็ม (ช้า ใช้ตอนสร้างตารางเท่านั้น) */
  shape(x: number, z: number): number {
    const nz = this.noise;
    let h = this.hills(x, z);

    // ภูเขาล้อมสามด้าน เหนือ ตะวันออก ตะวันตก · ใต้เป็นเนินเตี้ย
    const north = smooth(-110, -430, z);
    const east = smooth(250, 470, x);
    const west = smooth(-280, -480, x) * 0.75;
    const south = smooth(380, 490, z) * 0.45;
    const wobble = 0.75 + 0.25 * nz.noise(x / 210 + 11, z / 210 - 4);
    const mask = Math.max(north, east, west, south) * wobble;
    const ridge = nz.ridged(x / 200 + 3.1, z / 200 - 1.7, 5);
    h += mask * (30 + 80 * ridge + 40 * smooth(-0.3, 0.6, nz.fbm(x / 120, z / 120, 3)));

    // ที่ราบสูงขอบเป็นหน้าผาหิน กระจายบนเนิน ไว้ปีนขึ้นไปดูวิว (ไม่ขึ้นใกล้เมือง)
    const mesa = nz.fbm(x / 95 - 5, z / 95 + 9, 3);
    const away = (1 - smooth(0.2, 0.9, mask)) * smooth(70, 170, Math.hypot(x - TOWN.x, z - TOWN.z));
    h += (smooth(0.33, 0.4, mesa) * 9 + smooth(0.5, 0.56, mesa) * 7) * away;

    // ถ้ำ: ภูเขาตรงที่มีอุโมงค์ต้องสูงพอ
    for (const c of CAVES) {
      const d = Math.hypot(x - c.x, z - c.z);
      h = Math.max(h, lerp(h, 32, 1 - smooth(30, 95, d)));
    }

    // หุบเขาที่ตั้งเมือง ราบเรียบ
    const dt = Math.hypot(x - TOWN.x, z - TOWN.z);
    h = lerp(TOWN.height, h, smooth(TOWN.radius * 0.7, TOWN.radius + 70, dt));

    // ที่ราบจอดยาน
    const ds = Math.hypot(x - SHIP.x, z - SHIP.z);
    h = lerp(SHIP.height, h, smooth(SHIP.radius, SHIP.radius + 45, ds));

    // ถนนเก่า ปาดให้เรียบตามแนว
    const dr = distToPolyline(x, z, ROAD);
    if (dr < ROAD_WIDTH + 14) h = lerp(this.roadHeight(x, z), h, smooth(ROAD_WIDTH, ROAD_WIDTH + 14, dr));

    // รายละเอียดเล็ก ๆ ให้พื้นไม่เรียบเหมือนโต๊ะ
    h += 0.9 * this.detail.fbm(x / 14, z / 14, 2) * smooth(ROAD_WIDTH, ROAD_WIDTH + 6, dr);

    // แม่น้ำ กัดร่องลงต่ำกว่าระดับน้ำ
    const dv = distToPolyline(x, z, RIVER);
    h = lerp(WORLD.waterLevel - 1.8, h, smooth(RIVER_WIDTH * 0.6, RIVER_WIDTH + 22, dv));

    // ทะเลสาบ
    const dl = Math.hypot(x - LAKE.x, z - LAKE.z) * (1 + 0.12 * nz.noise(x / 60, z / 60));
    h = lerp(WORLD.waterLevel - 5, h, smooth(LAKE.radius * 0.55, LAKE.radius + 35, dl));
    return h;
  }

  /** ความสูงพื้นถนน · ใช้เนินพื้นฐานที่นุ่ม ไม่เอาภูเขาหรือรายละเอียด */
  private roadHeight(x: number, z: number): number {
    const dt = Math.hypot(x - TOWN.x, z - TOWN.z);
    const ds = Math.hypot(x - SHIP.x, z - SHIP.z);
    let h = Math.max(this.hills(x, z), WORLD.waterLevel + 2.5);
    h = lerp(TOWN.height, h, smooth(TOWN.radius * 0.7, TOWN.radius + 70, dt));
    return lerp(SHIP.height, h, smooth(SHIP.radius, SHIP.radius + 45, ds));
  }

  heightAt(x: number, z: number): number {
    const step = Terrain.STEP;
    const fx = (x + WORLD.half) / step;
    const fz = (z + WORLD.half) / step;
    const n = this.n;
    const i = Math.max(0, Math.min(n - 2, Math.floor(fx)));
    const j = Math.max(0, Math.min(n - 2, Math.floor(fz)));
    const tx = Math.max(0, Math.min(1, fx - i));
    const tz = Math.max(0, Math.min(1, fz - j));
    const hs = this.heights;
    const a = hs[j * n + i];
    const b = hs[j * n + i + 1];
    const c = hs[(j + 1) * n + i];
    const d = hs[(j + 1) * n + i + 1];
    return lerp(lerp(a, b, tx), lerp(c, d, tx), tz);
  }

  waterAt(x: number, z: number): number {
    return this.heightAt(x, z) < WORLD.waterLevel ? WORLD.waterLevel : -Infinity;
  }

  /** ความชัน 0 = ราบ 1 = ตั้งฉาก */
  slopeAt(x: number, z: number): number {
    const [, ny] = this.normalAt(x, z);
    return 1 - ny;
  }

  /** เวกเตอร์ตั้งฉากพื้น */
  normalAt(x: number, z: number): [number, number, number] {
    const e = 1;
    const dx = this.heightAt(x + e, z) - this.heightAt(x - e, z);
    const dz = this.heightAt(x, z + e) - this.heightAt(x, z - e);
    const l = Math.hypot(dx, 2 * e, dz);
    return [-dx / l, (2 * e) / l, -dz / l];
  }
}
