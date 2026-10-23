import * as THREE from 'three';
import { WORLD } from '../config/game';
import { ROAD, ROAD_WIDTH, TOWN, distToPolyline } from '../world/layout';
import { Simplex2 } from '../world/noise';
import { smooth, type Terrain } from '../world/Terrain';
import { makeDetailTexture } from './textures';

const CHUNK = 100;
const HI = 50;
const LO = 20;

const C = {
  grassA: new THREE.Color(0.22, 0.31, 0.12),
  grassB: new THREE.Color(0.31, 0.37, 0.16),
  dry: new THREE.Color(0.42, 0.40, 0.24),
  forest: new THREE.Color(0.17, 0.22, 0.11),
  mud: new THREE.Color(0.36, 0.32, 0.24),
  sand: new THREE.Color(0.52, 0.47, 0.36),
  rockA: new THREE.Color(0.30, 0.28, 0.25),
  rockB: new THREE.Color(0.38, 0.35, 0.31),
  asphalt: new THREE.Color(0.22, 0.22, 0.22),
  concrete: new THREE.Color(0.45, 0.44, 0.41),
};

interface Chunk {
  hi: THREE.Mesh;
  lo: THREE.Mesh;
  cx: number;
  cz: number;
}

/** พื้นดินแบ่งเป็นแผ่น 100 × 100 เมตร · ใกล้ใช้แผ่นละเอียด ไกลใช้แผ่นหยาบ */
export class TerrainMesh {
  readonly group = new THREE.Group();
  readonly material: THREE.MeshLambertMaterial;
  private chunks: Chunk[] = [];
  private colorNoise = new Simplex2(WORLD.seed + 55);
  nearDistance = 260;

  constructor(private terrain: Terrain) {
    this.material = new THREE.MeshLambertMaterial({ vertexColors: true, map: makeDetailTexture() });
    const per = WORLD.size / CHUNK;
    for (let j = 0; j < per; j++) {
      for (let i = 0; i < per; i++) {
        const x0 = -WORLD.half + i * CHUNK;
        const z0 = -WORLD.half + j * CHUNK;
        const hi = new THREE.Mesh(this.build(x0, z0, HI, 0), this.material);
        const lo = new THREE.Mesh(this.build(x0, z0, LO, 4), this.material);
        hi.receiveShadow = true;
        lo.receiveShadow = true;
        lo.visible = false;
        this.group.add(hi, lo);
        this.chunks.push({ hi, lo, cx: x0 + CHUNK / 2, cz: z0 + CHUNK / 2 });
      }
    }
  }

  /** สลับแผ่นละเอียดกับแผ่นหยาบตามระยะจากกล้อง */
  update(camX: number, camZ: number): void {
    for (const c of this.chunks) {
      const d = Math.hypot(c.cx - camX, c.cz - camZ) - CHUNK * 0.7;
      const near = d < this.nearDistance;
      c.hi.visible = near;
      c.lo.visible = !near;
    }
  }

  private build(x0: number, z0: number, segs: number, skirt: number): THREE.BufferGeometry {
    const t = this.terrain;
    const step = CHUNK / segs;
    const row = segs + 1;
    const count = row * row + (skirt > 0 ? segs * 4 + 4 : 0);
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const uv = new Float32Array(count * 2);
    const nor = new Float32Array(count * 3);
    const tmp = new THREE.Color();
    let v = 0;
    const put = (x: number, y: number, z: number) => {
      pos[v * 3] = x;
      pos[v * 3 + 1] = y;
      pos[v * 3 + 2] = z;
      const n = t.normalAt(x, z);
      nor[v * 3] = n[0];
      nor[v * 3 + 1] = n[1];
      nor[v * 3 + 2] = n[2];
      this.colorAt(x, z, n[1], tmp);
      col[v * 3] = tmp.r;
      col[v * 3 + 1] = tmp.g;
      col[v * 3 + 2] = tmp.b;
      uv[v * 2] = x / 7;
      uv[v * 2 + 1] = z / 7;
      v++;
    };
    for (let j = 0; j <= segs; j++) {
      for (let i = 0; i <= segs; i++) {
        const x = x0 + i * step;
        const z = z0 + j * step;
        put(x, t.heightAt(x, z), z);
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
    // ขอบกระโปรงยื่นลงล่าง กันรอยแตกระหว่างแผ่นละเอียดกับแผ่นหยาบ
    if (skirt > 0) {
      const edge: number[] = [];
      for (let i = 0; i <= segs; i++) edge.push(i);
      for (let j = 1; j <= segs; j++) edge.push(j * row + segs);
      for (let i = segs - 1; i >= 0; i--) edge.push(segs * row + i);
      for (let j = segs - 1; j >= 0; j--) edge.push(j * row);
      const start = v;
      for (const e of edge) put(pos[e * 3], pos[e * 3 + 1] - skirt, pos[e * 3 + 2]);
      for (let k = 0; k < edge.length - 1; k++) {
        const a = edge[k];
        const b = edge[k + 1];
        const c = start + k;
        const d = start + k + 1;
        idx.push(a, b, c, b, d, c, a, c, b, b, c, d);
      }
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

  /** สีพื้นตามความสูง ความชัน ถนน เมือง และป่า */
  colorAt(x: number, z: number, ny: number, out: THREE.Color): THREE.Color {
    const t = this.terrain;
    const h = t.heightAt(x, z);
    const nz = this.colorNoise;
    const n1 = nz.fbm(x / 60, z / 60, 3);
    const n2 = nz.noise(x / 9, z / 9);
    out.copy(C.grassA).lerp(C.grassB, smooth(-0.4, 0.5, n1));
    out.lerp(C.dry, smooth(0.25, 0.7, nz.noise(x / 140 + 7, z / 140)) * 0.6);
    out.lerp(C.forest, smooth(0.0, 0.5, nz.fbm(x / 160 + 3, z / 160, 2)) * 0.5);
    // ริมน้ำเป็นโคลนกับทราย
    const wet = 1 - smooth(WORLD.waterLevel - 0.5, WORLD.waterLevel + 1.6, h);
    out.lerp(h < WORLD.waterLevel ? C.mud : C.sand, wet);
    // หน้าผาเป็นหิน
    const rock = smooth(0.82, 0.68, ny + n2 * 0.04);
    out.lerp(n2 > 0 ? C.rockA : C.rockB, rock);
    out.lerp(C.rockA, smooth(75, 110, h) * 0.7);
    // ถนนยางมะตอยแตก มีหญ้าขึ้นแทรก
    const dr = distToPolyline(x, z, ROAD);
    const asphalt = (1 - smooth(ROAD_WIDTH * 0.75, ROAD_WIDTH + 0.6, dr)) * (n2 > 0.55 ? 0.35 : 1);
    out.lerp(C.asphalt, asphalt);
    // ลานคอนกรีตในเมือง
    const dt = Math.hypot(x - TOWN.x, z - TOWN.z);
    const yard = (1 - smooth(TOWN.radius * 0.35, TOWN.radius * 0.6, dt)) * smooth(-0.2, 0.3, n1) * (1 - asphalt);
    out.lerp(C.concrete, yard * 0.7);
    // แปรสีเล็กน้อยทุกจุด
    out.multiplyScalar(0.93 + 0.1 * n2);
    return out;
  }
}
