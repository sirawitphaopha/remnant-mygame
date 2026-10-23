import * as THREE from 'three';
import type { QualityPreset } from '../config/quality';
import { FLOWER_IDS, flowersInTile, grassHeightAt, type FlowerId, type FlowerSpot } from '../world/flowers';
import { hash2 } from '../world/noise';
import { grassDensity } from '../world/scatter';
import type { Terrain } from '../world/Terrain';
import { flowerGeometry } from './models/flowers';
import { assemble, type Part } from './models/build';
import type { TerrainMesh } from './TerrainMesh';
import { WIND } from './wind';

/** กอหญ้าหนึ่งกอ = ใบหญ้า 9 ใบ โคนเข้ม ปลายอ่อน (สูงเฉลี่ย 0.4 ม. ยืดตามความสูงหญ้าตรงนั้น) */
function clumpGeometry(): THREE.BufferGeometry {
  const parts: Part[] = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + i * 0.7;
    const r = 0.04 + (i % 4) * 0.06;
    const h = 0.26 + ((i * 37) % 10) * 0.03;
    const g = new THREE.PlaneGeometry(0.034, h, 1, 2).translate(0, h / 2, 0);
    const p = g.getAttribute('position') as THREE.BufferAttribute;
    for (let k = 0; k < p.count; k++) {
      const t = p.getY(k) / h;
      p.setX(k, p.getX(k) * (1 - t * 0.9));
      p.setZ(k, t * t * 0.12);
    }
    g.rotateY(a).translate(Math.cos(a) * r, 0, Math.sin(a) * r);
    parts.push({ geo: g, color: 0xffffff, vary: 0.1, sway: [0, 1] });
  }
  const geo = assemble(parts);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const col = geo.getAttribute('color') as THREE.BufferAttribute;
  const nor = geo.getAttribute('normal') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const t = Math.min(1, pos.getY(i) / 0.5);
    const s = 0.55 + 0.6 * t;
    col.setXYZ(i, col.getX(i) * s, col.getY(i) * s, col.getZ(i) * s);
    nor.setXYZ(i, 0, 1, 0);
  }
  return geo;
}

/** ตำแหน่งผู้เล่น ใช้ให้หญ้าลู่หลบตอนเดินผ่าน */
const PLAYER = { uPlayer: { value: new THREE.Vector3(0, -1e4, 0) } };

/**
 * ลมในทุ่งหญ้า: คลื่นลมเป็นแถบพัดข้ามทุ่ง (แถบที่ลมแรงหญ้าลู่และสว่างขึ้นเพราะเห็นด้านหลังใบ)
 * หญ้าที่ตัวละครเดินผ่านลู่หลบ · ไกลกล้องค่อย ๆ หดลงจนหายกลืนกับสีพื้น (ไม่โผล่เป็นวง)
 */
function grassWind(mat: THREE.Material, amount: number, far: { value: number }): void {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, WIND, PLAYER, { uFar: far });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float sway;
        uniform float uTime;
        uniform vec2 uWindDir;
        uniform float uWindStrength;
        uniform vec3 uPlayer;
        uniform float uFar;
        varying float vGust;`)
      .replace('#include <project_vertex>', `
        vec4 lp = vec4(transformed, 1.0);
        vec4 rootL = vec4(0.0, 0.0, 0.0, 1.0);
        #ifdef USE_INSTANCING
          lp = instanceMatrix * lp;
          rootL = instanceMatrix * rootL;
        #endif
        vec4 wpos = modelMatrix * lp;
        vec3 root = (modelMatrix * rootL).xyz;
        float h = wpos.y - root.y;
        float dcam = distance(root.xz, cameraPosition.xz);
        float fade = 1.0 - smoothstep(uFar * 0.7, uFar, dcam);
        wpos.y = root.y + h * fade;
        h *= fade;
        vec2 side = vec2(-uWindDir.y, uWindDir.x);
        float along = dot(root.xz, uWindDir);
        float band = sin(along * 0.07 - uTime * 1.25 + sin(dot(root.xz, side) * 0.021) * 2.2);
        band = smoothstep(0.15, 1.0, band);
        float base = 0.22 + 0.14 * sin(uTime * 1.8 + root.x * 0.31 + root.z * 0.23);
        float bend = (base + band * 0.95) * uWindStrength * sway;
        wpos.xz += (uWindDir * bend + side * sin(uTime * 3.1 + root.x * 1.7) * 0.08 * sway) * h * ${amount.toFixed(3)};
        wpos.y -= bend * bend * h * 0.12;
        vec2 dp = root.xz - uPlayer.xz;
        float push = (1.0 - smoothstep(0.25, 1.15, length(dp))) * step(abs(root.y - uPlayer.y), 2.5);
        wpos.xz += normalize(dp + vec2(1e-4)) * push * h * 0.75 * sway;
        wpos.y -= push * h * 0.4 * sway;
        vGust = band * sway;
        vec4 mvPosition = viewMatrix * wpos;
        gl_Position = projectionMatrix * mvPosition;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vGust;')
      .replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb *= 1.0 + vGust * 0.28;')
      .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n normal = normalize( vNormal );');
  };
  mat.customProgramCacheKey = () => `grass-wind-${amount}`;
}

const TILE = 16;

interface GrassTile {
  key: string;
  cx: number;
  cz: number;
  grass: THREE.InstancedMesh | null;
  flowers: THREE.InstancedMesh[];
  spots: FlowerSpot[];
}

/**
 * หญ้ากับดอกไม้รอบตัวผู้เล่น แบ่งเป็นช่อง 16 ม. ล็อกกับพิกัดโลก
 * สร้างช่องใหม่ทีละไม่กี่ช่องต่อเฟรม เก็บช่องเดิมไว้ (เดิมจัดใหม่ทั้งหมดทุก 6 ม. ในเฟรมเดียว กระตุกเป็นจังหวะตอนวิ่ง)
 * หญ้าสูงตามชนิดพื้นที่ ทุ่งหญ้าสูงถึงอกเอเลี่ยน · ดอกไม้ 13 ชนิด ทุ่งดอกไม้ขึ้นเป็นดงดงละชนิด
 */
export class Grass {
  readonly group = new THREE.Group();
  /** เก็บไว้ให้โค้ดเดิมที่อ้าง grass.mesh (เพิ่มเข้าฉาก) ใช้ได้ */
  get mesh(): THREE.Group { return this.group; }
  private tiles = new Map<string, GrassTile>();
  private grassGeo = clumpGeometry();
  private flowerGeos = new Map<FlowerId, THREE.BufferGeometry>();
  private grassMat: THREE.MeshLambertMaterial;
  private flowerMat: THREE.MeshLambertMaterial;
  private far = { value: 40 };

  constructor(private terrain: Terrain, private ground: TerrainMesh, private q: QualityPreset, private blocked: (x: number, z: number) => boolean = () => false) {
    this.grassMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    grassWind(this.grassMat, 0.5, this.far);
    this.flowerMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    grassWind(this.flowerMat, 0.3, this.far);
    for (const id of FLOWER_IDS) this.flowerGeos.set(id, flowerGeometry(id));
    this.setQuality(q);
  }

  setQuality(q: QualityPreset): void {
    this.q = q;
    this.far.value = q.grassRadius;
    // ระยะเปลี่ยน ทิ้งช่องเดิมทั้งหมด สร้างใหม่ตามความหนาแน่นใหม่
    for (const t of this.tiles.values()) this.drop(t);
    this.tiles.clear();
  }

  /** จำนวนกอหญ้ากับดอกไม้ที่วาดอยู่ (ตัวช่วยทดสอบดู) */
  get counts(): { tiles: number; grass: number; flowers: number } {
    let grass = 0;
    let flowers = 0;
    for (const t of this.tiles.values()) { grass += t.grass?.count ?? 0; for (const f of t.flowers) flowers += f.count; }
    return { tiles: this.tiles.size, grass, flowers };
  }

  /** ดอกไม้ในรัศมีรอบจุด (ใช้หาเป้าสแกน) */
  flowersNear(x: number, z: number, r: number): FlowerSpot[] {
    const out: FlowerSpot[] = [];
    for (const t of this.tiles.values()) {
      if (Math.abs(t.cx - x) > r + TILE || Math.abs(t.cz - z) > r + TILE) continue;
      for (const s of t.spots) if ((s.x - x) ** 2 + (s.z - z) ** 2 < r * r) out.push(s);
    }
    return out;
  }

  update(x: number, z: number, y = 0): void {
    PLAYER.uPlayer.value.set(x, y, z);
    const R = Math.max(this.q.grassRadius, this.q.plantRadius * 0.8);
    // ช่องที่ต้องมี เรียงใกล้ก่อน
    const want: { key: string; i: number; j: number; d: number }[] = [];
    const i0 = Math.floor((x - R) / TILE);
    const i1 = Math.floor((x + R) / TILE);
    const j0 = Math.floor((z - R) / TILE);
    const j1 = Math.floor((z + R) / TILE);
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const cx = (i + 0.5) * TILE;
        const cz = (j + 0.5) * TILE;
        const d = Math.hypot(cx - x, cz - z) - TILE * 0.7;
        if (d < R) want.push({ key: `${i},${j}`, i, j, d });
      }
    }
    want.sort((a, b) => a.d - b.d);
    let built = 0;
    for (const w of want) {
      if (this.tiles.has(w.key)) continue;
      if (built >= 3) break;
      this.tiles.set(w.key, this.build(w.key, w.i, w.j));
      built++;
    }
    // ทิ้งช่องที่ไกลเกิน
    for (const [k, t] of this.tiles) {
      if (Math.hypot(t.cx - x, t.cz - z) - TILE * 0.7 > R + TILE * 1.5) { this.drop(t); this.tiles.delete(k); }
    }
  }

  private drop(t: GrassTile): void {
    if (t.grass) { this.group.remove(t.grass); t.grass.dispose(); }
    for (const f of t.flowers) { this.group.remove(f); f.dispose(); }
  }

  private build(key: string, ti: number, tj: number): GrassTile {
    const s = this.q.grassSpacing;
    const x0 = ti * TILE;
    const z0 = tj * TILE;
    const m = new THREE.Matrix4();
    const quat = new THREE.Quaternion();
    const axis = new THREE.Vector3(0, 1, 0);
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    const col = new THREE.Color();
    const mats: THREE.Matrix4[] = [];
    const cols: THREE.Color[] = [];
    const n = Math.round(TILE / s);
    const gi0 = Math.round(x0 / s);
    const gj0 = Math.round(z0 / s);
    for (let j = gj0; j < gj0 + n; j++) {
      for (let i = gi0; i < gi0 + n; i++) {
        const gx = (i + hash2(i, j, 31)) * s;
        const gz = (j + hash2(i, j, 32)) * s;
        const dens = grassDensity(this.terrain, gx, gz);
        if (hash2(i, j, 33) > dens || this.blocked(gx, gz)) continue;
        const sc = (0.75 + 0.55 * hash2(i, j, 34)) * (0.6 + 0.4 * dens);
        const hgt = grassHeightAt(this.terrain, gx, gz, hash2(i, j, 36));
        quat.setFromAxisAngle(axis, hash2(i, j, 35) * Math.PI * 2);
        pos.set(gx, this.terrain.heightAt(gx, gz) - 0.03, gz);
        scl.set(sc, hgt / 0.4, sc);
        mats.push(m.compose(pos, quat, scl).clone());
        // ย้อมสีตามพื้นตรงนั้น หญ้าแห้งตรงที่พื้นแห้ง
        this.ground.colorAt(gx, gz, 1, col);
        cols.push(col.clone().multiplyScalar(1.08));
      }
    }
    let grass: THREE.InstancedMesh | null = null;
    if (mats.length) {
      grass = new THREE.InstancedMesh(this.grassGeo, this.grassMat, mats.length);
      mats.forEach((mm, k) => { grass!.setMatrixAt(k, mm); grass!.setColorAt(k, cols[k]); });
      grass.frustumCulled = false;
      grass.receiveShadow = true;
      this.group.add(grass);
    }
    // ดอกไม้ แยกชุดตามชนิด
    const spots = flowersInTile(this.terrain, x0, z0, TILE).filter((f) => !this.blocked(f.x, f.z));
    const byKind = new Map<FlowerId, FlowerSpot[]>();
    for (const f of spots) { let l = byKind.get(f.kind); if (!l) byKind.set(f.kind, (l = [])); l.push(f); }
    const flowers: THREE.InstancedMesh[] = [];
    for (const [kind, list] of byKind) {
      const mesh = new THREE.InstancedMesh(this.flowerGeos.get(kind)!, this.flowerMat, list.length);
      list.forEach((f, k) => {
        quat.setFromAxisAngle(axis, f.rot);
        pos.set(f.x, f.y - 0.02, f.z);
        scl.setScalar(f.scale);
        mesh.setMatrixAt(k, m.compose(pos, quat, scl));
      });
      mesh.frustumCulled = false;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      flowers.push(mesh);
    }
    return { key, cx: x0 + TILE / 2, cz: z0 + TILE / 2, grass, flowers, spots };
  }
}
