import { WORLD } from '../config/game';
import type { Ground } from './Ground';
import { BIOME_STEP, HEIGHT_STEP, generateTerrain, smooth, type BiomeId, type TerrainData } from './terrainGen';

export { smooth };
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/**
 * ภูมิประเทศทั้งแมพ · ตารางความสูงทุก 2 เมตร กับตารางชนิดพื้นที่ทุก 8 เมตร
 * ตอนเปิดเกมสร้างใน Web Worker (terrain.worker.ts) แล้วส่งตารางเข้ามา · เทสสร้างตรงในเธรดเดียวกัน
 * อ่านแบบเฉลี่ยระหว่างจุด (เร็วพอให้ตัวละคร กล้อง และการวางต้นไม้เรียกได้บ่อย ๆ)
 */
export class Terrain implements Ground {
  static readonly STEP = HEIGHT_STEP;
  readonly n: number;
  readonly heights: Float32Array;
  readonly bn: number;
  readonly biomes: Uint8Array;

  constructor(data: TerrainData = generateTerrain()) {
    this.n = data.n;
    this.heights = data.heights;
    this.bn = data.bn;
    this.biomes = data.biomes;
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

  /** ชนิดพื้นที่ของช่อง 8 ม. ที่จุดนั้นอยู่ (BIOME ใน terrainGen.ts) */
  biomeAt(x: number, z: number): BiomeId {
    const i = Math.max(0, Math.min(this.bn - 1, Math.floor((x + WORLD.half) / BIOME_STEP)));
    const j = Math.max(0, Math.min(this.bn - 1, Math.floor((z + WORLD.half) / BIOME_STEP)));
    return this.biomes[j * this.bn + i] as BiomeId;
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
