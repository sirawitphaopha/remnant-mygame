import * as THREE from 'three';
import { WORLD } from '../config/game';
import { MOUNTAINS, RAILWAY, ROAD_WIDTH, TOWN, distToPolyline, distToRoads } from '../world/layout';
import { pavedLeft } from '../world/scatter';
import { Simplex2 } from '../world/noise';
import { BIOME, BIOME_COUNT, BIOME_STEP } from '../world/terrainGen';
import { smooth, type Terrain } from '../world/Terrain';
import { makeDetailTexture } from './textures';

/** ช่องต่อด้านของแผ่นสองชั้นเล็กสุด · แผ่นเล็กสุด 93.75 ม. จึงห่างจุดละ 1.95 ม. ใกล้ตารางความสูง 2 ม. */
const SEGS = 48;
/** แผ่นใหญ่ (ไกลกล้อง เห็นบนจอเล็ก) ใช้ช่องน้อยลง ลดจุดที่การ์ดจอต้องวาด */
const SEGS_FAR = 24;
/** แผ่นรองเล็กสุด (187.5 ม.) */
const SEGS_MID = 32;
/** แผ่นใหญ่สุดคลุมทั้งแมพ แตกได้ 5 ชั้น */
const ROOT = WORLD.size;
const MAX_LEVEL = 5;
/** สร้างแผ่นใหม่ได้กี่แผ่นต่อเฟรม (กันกระตุกตอนเดินเร็ว) */
const BUILD_PER_FRAME = 2;
/** เก็บแผ่นที่ไม่ได้ใช้ไว้ได้เท่านี้ เกินแล้วคืนหน่วยความจำแผ่นที่ไม่ได้ใช้นานที่สุด */
export const CACHE_LIMIT = 260;

/** ความเปียกของพื้น 0 ถึง 1 (ฝน) ใช้ร่วมกันทุกแผ่น */
export const WET = { value: 0 };

const C = {
  grassA: new THREE.Color(0.22, 0.31, 0.12),
  grassB: new THREE.Color(0.31, 0.37, 0.16),
  dry: new THREE.Color(0.42, 0.40, 0.24),
  mud: new THREE.Color(0.36, 0.32, 0.24),
  sand: new THREE.Color(0.52, 0.47, 0.36),
  rockA: new THREE.Color(0.30, 0.28, 0.25),
  rockB: new THREE.Color(0.38, 0.35, 0.31),
  snow: new THREE.Color(0.86, 0.88, 0.9),
  // ยางมะตอยเก่าสะท้อนแสงราว 1 ใน 10 (ค่าเดิม 0.22 กลางแดดดูขาวเหมือนลานปูน)
  asphalt: new THREE.Color(0.085, 0.085, 0.09),
  sidewalk: new THREE.Color(0.3, 0.29, 0.27),
  ballast: new THREE.Color(0.24, 0.22, 0.2),
  concrete: new THREE.Color(0.45, 0.44, 0.41),
};

/**
 * สีพื้นแต่ละชนิดพื้นที่ (สีหลัก กับสีแซมตามสัญญาณรบกวน) · ดูภาพอ้างอิงใน docs/REFERENCES-R2.md
 * ป่าสนยักษ์พื้นสีน้ำตาลแดงจากใบสนร่วง · ป่าดิบชื้นเขียวเข้มชื้นมอส · ป่าผลัดใบใบไม้ร่วงน้ำตาลเหลือง
 */
const BIOME_COLORS: [THREE.Color, THREE.Color][] = [];
BIOME_COLORS[BIOME.water] = [C.mud, C.mud];
BIOME_COLORS[BIOME.shore] = [C.sand, new THREE.Color(0.44, 0.41, 0.31)];
BIOME_COLORS[BIOME.meadow] = [C.grassA, C.grassB];
BIOME_COLORS[BIOME.flowers] = [new THREE.Color(0.27, 0.36, 0.14), new THREE.Color(0.34, 0.40, 0.17)];
BIOME_COLORS[BIOME.tallGrass] = [new THREE.Color(0.36, 0.38, 0.17), new THREE.Color(0.45, 0.43, 0.22)];
BIOME_COLORS[BIOME.farmland] = [new THREE.Color(0.40, 0.36, 0.22), new THREE.Color(0.33, 0.37, 0.17)];
BIOME_COLORS[BIOME.wetland] = [new THREE.Color(0.20, 0.25, 0.14), new THREE.Color(0.28, 0.27, 0.18)];
// เมืองเก่าพันปี ดินกับใบไม้ทับถมจนเป็นพื้นป่า เหลือลานปูนเป็นหย่อม ๆ (เดิมผสมสีปูนครึ่งหนึ่ง พื้นเมืองซีดขาว)
BIOME_COLORS[BIOME.town] = [new THREE.Color(0.21, 0.25, 0.12), new THREE.Color(0.28, 0.27, 0.16)];
BIOME_COLORS[BIOME.redwood] = [new THREE.Color(0.30, 0.20, 0.13), new THREE.Color(0.24, 0.22, 0.12)];
BIOME_COLORS[BIOME.rainforest] = [new THREE.Color(0.12, 0.21, 0.09), new THREE.Color(0.17, 0.25, 0.10)];
BIOME_COLORS[BIOME.deciduous] = [new THREE.Color(0.33, 0.28, 0.15), new THREE.Color(0.25, 0.29, 0.13)];
BIOME_COLORS[BIOME.orchard] = [new THREE.Color(0.25, 0.32, 0.13), new THREE.Color(0.32, 0.33, 0.17)];
BIOME_COLORS[BIOME.dense] = [new THREE.Color(0.17, 0.22, 0.11), new THREE.Color(0.22, 0.24, 0.13)];
BIOME_COLORS[BIOME.alpine] = [new THREE.Color(0.36, 0.38, 0.22), new THREE.Color(0.40, 0.37, 0.30)];
BIOME_COLORS[BIOME.rock] = [C.rockA, C.rockB];
BIOME_COLORS[BIOME.snow] = [C.snow, new THREE.Color(0.78, 0.81, 0.85)];
if (BIOME_COLORS.length !== BIOME_COUNT) throw new Error('สีพื้นไม่ครบทุกชนิดพื้นที่');

interface Tile {
  key: string;
  level: number;
  x0: number;
  z0: number;
  size: number;
  mesh: THREE.Mesh | null;
  lastUsed: number;
}

/**
 * พื้นดินแบบแผ่นหลายระดับ (ต้นไม้สี่แฉก) · แผ่นใหญ่ 3 กม. แตกเป็น 4 แผ่นเมื่อกล้องเข้าใกล้ จนเล็กสุด 93.75 ม.
 * ใกล้ละเอียด ไกลหยาบ มองเห็นภูเขาถึงขอบแมพ · สร้างแผ่นเมื่อต้องใช้ ขอบแผ่นมีกระโปรงห้อยลงปิดรอยต่อ
 * แผ่นลูกยังสร้างไม่ครบ 4 แผ่น วาดแผ่นแม่แทน (พื้นไม่มีรู)
 */
export class TerrainMesh {
  readonly group = new THREE.Group();
  readonly material: THREE.MeshLambertMaterial;
  private colorNoise = new Simplex2(WORLD.seed + 55);
  private tiles = new Map<string, Tile>();
  private queue: Tile[] = [];
  private frame = 0;
  /** ระยะที่ยังใช้แผ่นละเอียดสุด (ตั้งจากระดับภาพ) */
  nearDistance = 260;
  /** จำนวนแผ่นที่วาดอยู่ (ตัวช่วยทดสอบดู) */
  drawn = 0;

  constructor(private terrain: Terrain) {
    this.material = new THREE.MeshLambertMaterial({ vertexColors: true, map: makeDetailTexture() });
    // พื้นเปียก: สีเข้มขึ้น มีแสงสะท้อนฟ้าตอนมองเฉียง (แบบพื้นหลังฝน)
    this.material.onBeforeCompile = (sh) => {
      sh.uniforms.uWet = WET;
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uWet;')
        .replace('#include <opaque_fragment>', `
          float wetSheen = pow(1.0 - abs(dot(normalize(vViewPosition), normal)), 3.0);
          outgoingLight = outgoingLight * (1.0 - 0.38 * uWet) + uWet * 0.05 * wetSheen * vec3(0.75, 0.8, 0.85);
          #include <opaque_fragment>`);
    };
    this.material.customProgramCacheKey = () => 'terrain-wet';
    // แผ่นใหญ่สุดสร้างทันที ระหว่างรอแผ่นละเอียดจะได้มีพื้นให้เห็นเสมอ
    this.build(this.tile(0, 0, 0));
  }

  /** เลือกแผ่นที่ต้องวาดตามตำแหน่งกล้อง · immediate = สร้างทุกแผ่นที่ขาดเดี๋ยวนี้ (ตอนเริ่มเกม วาร์ป) */
  update(camX: number, camZ: number, immediate = false): void {
    this.frame++;
    for (const t of this.tiles.values()) if (t.mesh) t.mesh.visible = false;
    this.queue.length = 0;
    this.drawn = 0;
    // แตกแผ่นเมื่อกล้องห่างขอบแผ่นไม่ถึง factor เท่าของขนาดแผ่น · ระดับกลางแผ่นละเอียดสุดคลุมราว 190 ม. รอบตัว
    const factor = Math.max(0.4, this.nearDistance / 400);
    if (immediate) {
      // สร้างให้ครบทุกชั้นก่อนวาด
      for (let pass = 0; pass <= MAX_LEVEL; pass++) {
        this.queue.length = 0;
        this.select(this.tile(0, 0, 0), camX, camZ, factor);
        if (!this.queue.length) break;
        for (const t of this.queue) this.build(t);
        for (const t of this.tiles.values()) if (t.mesh) t.mesh.visible = false;
        this.drawn = 0;
      }
      this.queue.length = 0;
      this.drawn = 0;
      this.select(this.tile(0, 0, 0), camX, camZ, factor);
    } else {
      this.select(this.tile(0, 0, 0), camX, camZ, factor);
      // สร้างแผ่นที่ใกล้กล้องที่สุดก่อน
      this.queue.sort((a, b) => this.dist(a, camX, camZ) - this.dist(b, camX, camZ));
      for (let i = 0; i < Math.min(BUILD_PER_FRAME, this.queue.length); i++) this.build(this.queue[i]);
    }
    this.evict();
  }

  /** จำนวนแผ่นที่สร้างเก็บไว้ (ตัวช่วยทดสอบดู) */
  get cached(): number {
    let n = 0;
    for (const t of this.tiles.values()) if (t.mesh) n++;
    return n;
  }

  private tile(level: number, ix: number, iz: number): Tile {
    const key = `${level}:${ix}:${iz}`;
    let t = this.tiles.get(key);
    if (!t) {
      const size = ROOT / 2 ** level;
      t = { key, level, x0: -WORLD.half + ix * size, z0: -WORLD.half + iz * size, size, mesh: null, lastUsed: 0 };
      this.tiles.set(key, t);
    }
    return t;
  }

  private dist(t: Tile, x: number, z: number): number {
    const dx = Math.max(t.x0 - x, 0, x - (t.x0 + t.size));
    const dz = Math.max(t.z0 - z, 0, z - (t.z0 + t.size));
    return Math.hypot(dx, dz);
  }

  private select(t: Tile, x: number, z: number, factor: number): void {
    // แผ่นแม่ที่แตกเป็นลูกก็นับว่าใช้อยู่ ไม่ให้ตัวคืนหน่วยความจำทิ้ง (เดิมทิ้งแผ่นแม่ แล้วต้องสร้างใหม่วนไม่จบ)
    t.lastUsed = this.frame;
    const split = t.level < MAX_LEVEL && this.dist(t, x, z) < t.size * factor;
    if (split) {
      const ix = Math.round((t.x0 + WORLD.half) / t.size) * 2;
      const iz = Math.round((t.z0 + WORLD.half) / t.size) * 2;
      const kids = [this.tile(t.level + 1, ix, iz), this.tile(t.level + 1, ix + 1, iz), this.tile(t.level + 1, ix, iz + 1), this.tile(t.level + 1, ix + 1, iz + 1)];
      if (kids.every((k) => k.mesh)) {
        for (const k of kids) this.select(k, x, z, factor);
        return;
      }
      for (const k of kids) if (!k.mesh) this.queue.push(k);
    }
    if (t.mesh) {
      t.mesh.visible = true;
      this.drawn++;
    }
  }

  private evict(): void {
    const built = [...this.tiles.values()].filter((t) => t.mesh && t.level > 0);
    if (built.length <= CACHE_LIMIT) return;
    built.sort((a, b) => a.lastUsed - b.lastUsed);
    for (const t of built.slice(0, built.length - CACHE_LIMIT)) {
      if (t.lastUsed === this.frame) break;
      t.mesh!.geometry.dispose();
      this.group.remove(t.mesh!);
      t.mesh = null;
    }
  }

  private build(t: Tile): void {
    if (t.mesh) return;
    const segs = t.level === MAX_LEVEL ? SEGS : t.level === MAX_LEVEL - 1 ? SEGS_MID : SEGS_FAR;
    const skirt = (t.size / segs) * 2 + 0.6;
    const mesh = new THREE.Mesh(this.geometry(t.x0, t.z0, t.size, skirt, segs), this.material);
    mesh.receiveShadow = true;
    mesh.visible = false;
    mesh.matrixAutoUpdate = false;
    this.group.add(mesh);
    t.mesh = mesh;
  }

  private geometry(x0: number, z0: number, size: number, skirt: number, segs: number): THREE.BufferGeometry {
    const t = this.terrain;
    const step = size / segs;
    const row = segs + 1;
    const count = row * row + segs * 4 + 4;
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const uv = new Float32Array(count * 2);
    const nor = new Float32Array(count * 3);
    const tmp = new THREE.Color();
    const ne = Math.max(1, step * 0.5);
    let v = 0;
    const put = (x: number, y: number, z: number, nx: number, ny: number, nz: number, c: THREE.Color) => {
      pos[v * 3] = x;
      pos[v * 3 + 1] = y;
      pos[v * 3 + 2] = z;
      nor[v * 3] = nx;
      nor[v * 3 + 1] = ny;
      nor[v * 3 + 2] = nz;
      col[v * 3] = c.r;
      col[v * 3 + 1] = c.g;
      col[v * 3 + 2] = c.b;
      uv[v * 2] = x / 7;
      uv[v * 2 + 1] = z / 7;
      v++;
    };
    for (let j = 0; j <= segs; j++) {
      for (let i = 0; i <= segs; i++) {
        const x = x0 + i * step;
        const z = z0 + j * step;
        // แผ่นหยาบคิดเส้นตั้งฉากจากระยะกว้างขึ้น แสงเงาภูเขาไกลจะไม่เป็นจุด ๆ
        const dx = t.heightAt(x + ne, z) - t.heightAt(x - ne, z);
        const dz = t.heightAt(x, z + ne) - t.heightAt(x, z - ne);
        const l = Math.hypot(dx, 2 * ne, dz);
        const ny = (2 * ne) / l;
        this.colorAt(x, z, ny, tmp);
        put(x, t.heightAt(x, z), z, -dx / l, ny, -dz / l, tmp);
      }
    }
    const idx: number[] = [];
    for (let j = 0; j < segs; j++) {
      for (let i = 0; i < segs; i++) {
        const a = j * row + i;
        const b = a + 1;
        const c = a + row;
        const d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    // ขอบกระโปรงยื่นลงล่าง กันรอยแตกระหว่างแผ่นต่างระดับ
    const edge: number[] = [];
    for (let i = 0; i <= segs; i++) edge.push(i);
    for (let j = 1; j <= segs; j++) edge.push(j * row + segs);
    for (let i = segs - 1; i >= 0; i--) edge.push(segs * row + i);
    for (let j = segs - 1; j >= 0; j--) edge.push(j * row);
    const start = v;
    for (const e of edge) {
      tmp.setRGB(col[e * 3], col[e * 3 + 1], col[e * 3 + 2]);
      put(pos[e * 3], pos[e * 3 + 1] - skirt, pos[e * 3 + 2], nor[e * 3], nor[e * 3 + 1], nor[e * 3 + 2], tmp);
    }
    for (let k = 0; k < edge.length - 1; k++) {
      const a = edge[k];
      const b = edge[k + 1];
      const c = start + k;
      const d = start + k + 1;
      idx.push(a, b, c, b, d, c, a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos.subarray(0, v * 3), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor.subarray(0, v * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(col.subarray(0, v * 3), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv.subarray(0, v * 2), 2));
    g.setIndex(idx);
    g.computeBoundingSphere();
    return g;
  }

  /** สีพื้นตามชนิดพื้นที่ (ผสม 4 ช่องรอบตัว ขอบไม่เป็นขั้นบันได) แล้วซ้อนหน้าผา หิมะ ชายน้ำ ถนน ลานเมือง */
  colorAt(x: number, z: number, ny: number, out: THREE.Color): THREE.Color {
    const t = this.terrain;
    const h = t.heightAt(x, z);
    const nz = this.colorNoise;
    const n1 = nz.fbm(x / 60, z / 60, 3);
    const n2 = nz.noise(x / 9, z / 9);
    const mixK = smooth(-0.4, 0.5, n1);
    // ผสมสีชนิดพื้นที่ 4 ช่องรอบจุด
    const fx = (x + WORLD.half) / BIOME_STEP - 0.5;
    const fz = (z + WORLD.half) / BIOME_STEP - 0.5;
    const i0 = Math.floor(fx);
    const j0 = Math.floor(fz);
    const tx = fx - i0;
    const tz = fz - j0;
    let r = 0;
    let g = 0;
    let b = 0;
    for (let k = 0; k < 4; k++) {
      const di = k & 1;
      const dj = k >> 1;
      const w = (di ? tx : 1 - tx) * (dj ? tz : 1 - tz);
      if (w === 0) continue;
      const cx = -WORLD.half + (i0 + di + 0.5) * BIOME_STEP;
      const cz = -WORLD.half + (j0 + dj + 0.5) * BIOME_STEP;
      const [ca, cb] = BIOME_COLORS[t.biomeAt(cx, cz)];
      r += w * (ca.r + (cb.r - ca.r) * mixK);
      g += w * (ca.g + (cb.g - ca.g) * mixK);
      b += w * (ca.b + (cb.b - ca.b) * mixK);
    }
    out.setRGB(r, g, b);
    out.lerp(C.dry, smooth(0.35, 0.8, nz.noise(x / 140 + 7, z / 140)) * 0.35);
    // ริมน้ำเป็นโคลนกับทราย
    const wet = 1 - smooth(WORLD.waterLevel - 0.5, WORLD.waterLevel + 1.6, h);
    out.lerp(h < WORLD.waterLevel ? C.mud : C.sand, wet);
    // หน้าผาเป็นหิน
    const rock = smooth(0.82, 0.62, ny + n2 * 0.04);
    out.lerp(n2 > 0 ? C.rockA : C.rockB, rock);
    // หิมะเหนือแนวหิมะ ไม่เกาะหน้าผาชัน
    const snow = smooth(MOUNTAINS.snowLine - 30 + 25 * n1, MOUNTAINS.snowLine + 35, h) * smooth(0.45, 0.75, ny);
    out.lerp(C.snow, snow);
    // ถนนยางมะตอยแตก มีหญ้าขึ้นแทรก
    const dr = distToRoads(x, z);
    // พันปี ยางมะตอยเหลือเป็นแผ่นแตก ๆ ระหว่างแผ่นเป็นดินกับหญ้า (world/scatter.ts pavedLeft ใช้ร่วมกับหญ้า)
    const roadBed = 1 - smooth(ROAD_WIDTH * 0.75, ROAD_WIDTH + 0.6, dr);
    const left = roadBed > 0 ? pavedLeft(x, z) : 0;
    const asphalt = roadBed * left;
    // แนวถนนที่ดินกลบแล้ว ดินร่วนสีเข้มกว่าข้างทาง ยังพอเห็นเป็นแนว
    out.lerp(C.mud, roadBed * (1 - left) * 0.35);
    out.lerp(C.asphalt, asphalt);
    // หินโรยทางรถไฟร้าง ดินกลบไปบ้าง
    const rail = distToPolyline(x, z, RAILWAY);
    if (rail < 2.6) out.lerp(C.ballast, (1 - smooth(1.4, 2.6, rail)) * (0.35 + 0.5 * pavedLeft(x - 13, z + 7)));
    // ลานคอนกรีตในเมือง · ทางเท้าสองข้างถนนในเมือง (ขอบถนนถึงหน้าตึก)
    const dt = Math.hypot(x - TOWN.x, z - TOWN.z);
    const walk = dt < TOWN.radius * 1.2 ? smooth(ROAD_WIDTH + 0.2, ROAD_WIDTH + 0.7, dr) * (1 - smooth(6.2, 6.8, dr)) * pavedLeft(x + 31, z - 17) : 0;
    out.lerp(C.sidewalk, walk);
    const yard = (1 - smooth(TOWN.radius * 0.35, TOWN.radius * 0.6, dt)) * smooth(0.1, 0.5, n1) * (1 - asphalt);
    out.lerp(C.concrete, yard * 0.35);
    // แปรสีเล็กน้อยทุกจุด
    out.multiplyScalar(0.93 + 0.1 * n2);
    return out;
  }
}
