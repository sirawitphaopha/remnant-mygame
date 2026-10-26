import * as THREE from 'three';
import type { QualityPreset } from '../config/quality';
import { hash2 } from '../world/noise';
import { DEBRIS_KINDS, PLANT_KINDS, scatterDebris, scatterLitter, scatterPlants, scatterTrees, type DebrisKind, type PlantKind, type Placed, type TreeSet } from '../world/scatter';
import { litterTexture, type LitterKind } from './models/litter';
import { ROCK_TYPES, scatterRocks } from '../world/rocks';
import type { ForcedTree } from '../world/ruins';
import { rockModel } from './models/rocks';
import { applyDetail } from './detail';
import type { Terrain } from '../world/Terrain';
import { assemble, jitter, type Part } from './models/build';
import { plantGeometry } from './models/plants';
import { shrubModel } from './models/shrubs';
import { SHRUB_IDS } from '../world/shrubs';
import { leafTexture, rootSize, treeModel, type LeafStyle, type TreeLod } from './models/trees';
import { WORLD } from '../config/game';
import { addWind } from './wind';

const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const up = new THREE.Vector3(0, 1, 0);
const pv = new THREE.Vector3();
const sv = new THREE.Vector3();

const tn = new THREE.Vector3();
const tq = new THREE.Quaternion();

function setInstance(mesh: THREE.InstancedMesh, i: number, p: Placed, sink = 0, grow = 1): void {
  q.setFromAxisAngle(up, p.rot);
  pv.set(p.x, p.y - sink * p.scale, p.z);
  sv.setScalar(p.scale * grow);
  m4.compose(pv, q, sv);
  mesh.setMatrixAt(i, m4);
}

const LODS: TreeLod[] = ['near', 'mid', 'far', 'distant'];

/** ชุดวาดต้นไม้หนึ่งชนิดหนึ่งระดับ (ลำต้น + แผ่นใบ) */
interface TreeLayer {
  wood: THREE.InstancedMesh;
  leaves: THREE.InstancedMesh | null;
  n: number;
}

/** ขอนไม้ล้ม ตอไม้ ต้นล้มทั้งราก มีมอสด้านบน (ปั้นยาว 1 หน่วยตาม scale) */
function debrisGeometry(kind: DebrisKind): THREE.BufferGeometry {
  const BARK = 0x4a3a2c;
  const MOSS = 0x4f6a2c;
  const parts: Part[] = [];
  if (kind === 'log') {
    parts.push({ geo: jitter(new THREE.CylinderGeometry(0.32, 0.4, 7, 9, 3).rotateZ(Math.PI / 2).translate(0, 0.33, 0), 0.05, 1.5, 2), color: BARK, vary: 0.15 });
    parts.push({ geo: jitter(new THREE.CylinderGeometry(0.34, 0.42, 5.5, 9, 1, true, -1.2, 2.4).rotateZ(Math.PI / 2).translate(0.4, 0.36, 0), 0.04, 2, 5), color: MOSS, vary: 0.2 });
    parts.push({ geo: new THREE.CylinderGeometry(0.06, 0.05, 1.2, 4).rotateZ(0.6).translate(1.6, 0.8, 0.1), color: BARK });
  } else if (kind === 'stump') {
    parts.push({ geo: jitter(new THREE.CylinderGeometry(0.42, 0.55, 0.75, 9, 2).translate(0, 0.37, 0), 0.06, 2, 4), color: BARK, vary: 0.15 });
    parts.push({ geo: new THREE.CylinderGeometry(0.4, 0.4, 0.04, 9).translate(0, 0.76, 0), color: 0x8a7458 });
    parts.push({ geo: jitter(new THREE.SphereGeometry(0.5, 7, 4, 0, Math.PI * 2, 0, 0.9).scale(1, 0.3, 1).translate(0.1, 0.62, 0), 0.06, 2, 1), color: MOSS, vary: 0.2 });
  } else {
    // ต้นล้มทั้งราก: ลำต้นนอนกับแผ่นรากตั้งพร้อมดิน
    parts.push({ geo: jitter(new THREE.CylinderGeometry(0.22, 0.38, 9, 8, 3).rotateZ(Math.PI / 2).translate(4.4, 0.4, 0), 0.05, 1.5, 7), color: BARK, vary: 0.15 });
    parts.push({ geo: jitter(new THREE.CylinderGeometry(1.5, 1.5, 0.5, 10).rotateZ(Math.PI / 2).translate(-0.3, 1.1, 0), 0.22, 1.2, 3), color: 0x4a3c2a, vary: 0.25 });
    parts.push({ geo: jitter(new THREE.CylinderGeometry(0.36, 0.4, 6, 8, 1, true, -1.1, 2.2).rotateZ(Math.PI / 2).translate(5, 0.45, 0), 0.04, 2, 9), color: MOSS, vary: 0.2 });
  }
  return assemble(parts);
}

/**
 * ต้นไม้ 19 ชนิด + ต้นตาย 4 ระดับตามระยะ · หิน · ขอนไม้ · พืชเล็ก
 * จัดใหม่เมื่อผู้เล่นเดินไปไกลพอ ไม่ใช่ทุกเฟรม
 */
export class Vegetation {
  readonly group = new THREE.Group();
  readonly trees: TreeSet[];
  readonly rocks: Placed[];
  readonly debris: Record<DebrisKind, Placed[]>;
  private layers = new Map<string, TreeLayer[]>();
  /**
   * ลำต้นแบบไม่มีรากแผ่ ระดับใกล้กับระดับกลาง (ใบใช้ชุดเดียวกับต้นปกติ)
   * ต้นที่มีน้ำในระยะราก หรือพื้นรอบโคนลาดลงชัน (เดิมรากยื่นลอยเหนือน้ำเหนือพื้นที่ต่ำลง พี่กันสั่งแก้ 26 ต.ค. 2569)
   */
  private bareLayers = new Map<string, (THREE.InstancedMesh | null)[]>();
  /** ต่อต้น: 1 = ใช้แบบไม่มีรากแผ่ · กดลงดินเพิ่ม (ม.) ให้รากฝั่งที่พื้นต่ำลงแตะพื้น */
  private rootFit = new Map<string, { bare: Uint8Array; sink: Float32Array }>();
  private rockMeshes: { mesh: THREE.InstancedMesh; items: Placed[] }[] = [];
  private debrisMeshes = new Map<DebrisKind, THREE.InstancedMesh>();
  private plantMeshes = new Map<PlantKind, THREE.InstancedMesh>();
  /** เศษใบไม้ร่วงบนพื้นป่า ใบกว้างกับใบเข็ม (แผ่นราบตามผิวดิน) */
  private litterMeshes = new Map<LitterKind, THREE.InstancedMesh>();
  /** พุ่มไม้ 6 ชนิด กิ่งกับใบแยกกัน (ใบเป็นแผ่นภาพโปร่งใส) */
  private shrubMeshes: { wood: THREE.InstancedMesh; leaves: THREE.InstancedMesh }[] = [];
  private lastX = Infinity;
  private lastZ = Infinity;
  private lastPlantX = Infinity;
  private lastPlantZ = Infinity;
  /** พืชเล็กรอบตัวตอนนี้ (ใช้หาเป้าสแกน) */
  plantsNow: Record<PlantKind, Placed[]> = { fern: [], flower: [], bush: [], mushroom: [], moss: [] };

  constructor(private terrain: Terrain, private q: QualityPreset, blocked: (x: number, z: number) => boolean = () => false, forced: ForcedTree[] = []) {
    this.trees = scatterTrees(terrain, blocked, forced);
    // หินไม่ขึ้นตรงที่ต้นไม้ขึ้นไม่ได้ (ในตึก บนเนินเหนืออุโมงค์ถ้ำ)
    this.rocks = scatterRocks(terrain).filter((r) => !blocked(r.x, r.z));
    this.debris = scatterDebris(terrain, blocked);

    // วัสดุ: ลำต้น · แผ่นใบแต่ละลาย (เงาไหวตามใบ) · รูปทึบระดับไกล
    const barkMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    addWind(barkMat, 0.25, 0, false, 3.2);
    // ลายเปลือกไม้เป็นร่องตามแนวตั้งกับผิวนูน (ใส่หลังลม ลมยังทำงาน)
    applyDetail(barkMat, 'bark');
    const solidMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    addWind(solidMat, 0.3, 0);
    const distantMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    const leafMats = new Map<LeafStyle, { mat: THREE.Material; depth: THREE.Material }>();
    const leafMat = (style: LeafStyle) => {
      let m = leafMats.get(style);
      if (!m) {
        const map = leafTexture(style);
        const mat = new THREE.MeshLambertMaterial({ vertexColors: true, map, alphaTest: 0.45, side: THREE.DoubleSide });
        addWind(mat, 0.35, 0.25, true, 3.2);
        // เงาของใบไหวตามใบ (เดิมใบไหวแต่เงานิ่ง) และเว้นช่องโปร่งของลายใบ
        const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest: 0.45, side: THREE.DoubleSide });
        addWind(depth, 0.35, 0.25);
        m = { mat, depth };
        leafMats.set(style, m);
      }
      return m;
    };

    for (const set of this.trees) {
      if (!set.items.length) continue;
      // พื้นรอบโคนรับรากได้ไหม (ดูจากขนาดรากของโมเดลชนิดนั้น คิดครั้งเดียวตอนเริ่ม)
      treeModel(set.kind, 'near');
      const rs = rootSize(set.kind);
      const bare = new Uint8Array(set.items.length);
      const sink = new Float32Array(set.items.length);
      let nBare = 0;
      if (rs.reach > 0) {
        set.items.forEach((p, i) => {
          const reach = rs.reach * p.scale;
          const r0 = rs.r0 * p.scale;
          let minH = Infinity;
          let wet = false;
          for (let k = 0; k < 8; k++) {
            const a = (k / 8) * Math.PI * 2;
            for (const f of [0.5, 0.95]) {
              const h = terrain.heightAt(p.x + Math.cos(a) * reach * f, p.z + Math.sin(a) * reach * f);
              if (h < WORLD.waterLevel + 0.2) wet = true;
              minH = Math.min(minH, h);
            }
          }
          const drop = Math.max(0, p.y - minH);
          // ริมน้ำ หรือลาดลงชันราว 30% ขึ้นไป = ไม่มีรากแผ่ · ลาดน้อยกว่านั้นกดต้นลงดินเพิ่มให้รากฝั่งต่ำแตะพื้น
          if (wet || drop > r0 * 1.2 + 0.5) { bare[i] = 1; nBare++; }
          else sink[i] = drop * 0.6;
        });
      }
      this.rootFit.set(set.kind, { bare, sink });
      const per: TreeLayer[] = [];
      for (const lod of LODS) {
        const model = treeModel(set.kind, lod);
        const cap = Math.min(set.items.length, lod === 'near' ? 2500 : lod === 'mid' ? 5000 : 20000);
        const wood = new THREE.InstancedMesh(model.wood, lod === 'far' ? solidMat : lod === 'distant' ? distantMat : barkMat, cap);
        wood.count = 0;
        wood.frustumCulled = false;
        wood.castShadow = lod === 'near';
        wood.receiveShadow = lod === 'near' || lod === 'mid';
        this.group.add(wood);
        let leaves: THREE.InstancedMesh | null = null;
        if (model.leaves) {
          const lm = leafMat(model.style);
          leaves = new THREE.InstancedMesh(model.leaves, lm.mat, cap);
          leaves.customDepthMaterial = lm.depth;
          leaves.count = 0;
          leaves.frustumCulled = false;
          leaves.castShadow = lod === 'near';
          leaves.receiveShadow = true;
          this.group.add(leaves);
        }
        per.push({ wood, leaves, n: cap });
      }
      this.layers.set(set.kind, per);
      // ลำต้นแบบไม่มีรากแผ่ เฉพาะชนิดที่มีต้นแบบนี้
      const bl: (THREE.InstancedMesh | null)[] = [null, null];
      if (nBare) {
        for (const li of [0, 1]) {
          const lod = LODS[li];
          const m = new THREE.InstancedMesh(treeModel(set.kind, lod, false).wood, barkMat, Math.min(nBare, li === 0 ? 2500 : 5000));
          m.count = 0;
          m.frustumCulled = false;
          m.castShadow = li === 0;
          m.receiveShadow = true;
          this.group.add(m);
          bl[li] = m;
        }
      }
      this.bareLayers.set(set.kind, bl);
    }

    // หิน 6 ชนิด ชนิดละ 2 แบบ ตามรูปจริง (world/rocks.ts) · ลายเนื้อหินกับผิวนูน
    const rockMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    applyDetail(rockMat, 'stone');
    for (let v = 0; v < ROCK_TYPES.length * 2; v++) {
      const items = this.rocks.filter((r) => (r.variant ?? 0) === v);
      if (!items.length) continue;
      const mesh = new THREE.InstancedMesh(rockModel(ROCK_TYPES[v >> 1], v & 1), rockMat, items.length);
      mesh.count = 0;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      this.rockMeshes.push({ mesh, items });
      this.group.add(mesh);
    }

    const debrisMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    applyDetail(debrisMat, 'bark');
    for (const kind of DEBRIS_KINDS) {
      const mesh = new THREE.InstancedMesh(debrisGeometry(kind), debrisMat, Math.max(1, this.debris[kind].length));
      mesh.count = 0;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      this.debrisMeshes.set(kind, mesh);
      this.group.add(mesh);
    }

    const plantMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    addWind(plantMat, 0.06, 0.4, true, 1.6);
    // พุ่มไม้หลายชนิด (เดิมก้อนกลมสามก้อนชนิดเดียว)
    for (const id of SHRUB_IDS) {
      const model = shrubModel(id);
      const wood = new THREE.InstancedMesh(model.wood, plantMat, 3000);
      const leaves = new THREE.InstancedMesh(model.leaves, leafMat(model.style).mat, 3000);
      for (const m of [wood, leaves]) {
        m.count = 0;
        m.frustumCulled = false;
        m.receiveShadow = true;
        this.group.add(m);
      }
      this.shrubMeshes.push({ wood, leaves });
    }
    // เศษใบไม้: แผ่นสี่เหลี่ยมราบ ลายโปร่งตัดขอบ เลื่อนความลึกนิดหน่อยไม่ให้กระพริบกับพื้น
    const litterGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    for (const kind of ['broad', 'needle'] as const) {
      const mat = new THREE.MeshLambertMaterial({ map: litterTexture(kind), alphaTest: 0.35, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      const mesh = new THREE.InstancedMesh(litterGeo, mat, 6000);
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.receiveShadow = true;
      this.litterMeshes.set(kind, mesh);
      this.group.add(mesh);
    }
    for (const kind of PLANT_KINDS) {
      if (kind === 'bush') continue;
      const mesh = new THREE.InstancedMesh(plantGeometry(kind), plantMat, 9000);
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.receiveShadow = true;
      this.plantMeshes.set(kind, mesh);
      this.group.add(mesh);
    }
  }

  setQuality(q: QualityPreset): void {
    this.q = q;
    this.lastX = this.lastZ = this.lastPlantX = this.lastPlantZ = Infinity;
  }

  /** ระยะของแต่ละระดับ (ตามระดับภาพ) · ไกลมากสุดราว 1.1 กม. ที่ระดับกลาง ต้นไม้ไม่โผล่เป็นวงใกล้ ๆ */
  get ranges(): number[] {
    return [this.q.treeNear, this.q.treeNear * 2.4, this.q.treeFar, this.q.treeFar * 2.6];
  }

  /** จำนวนต้นไม้ที่วาดอยู่ต่อระดับ (ไว้ดูตอนทดสอบ) */
  get visibleTrees(): Record<TreeLod, number> {
    const out: Record<TreeLod, number> = { near: 0, mid: 0, far: 0, distant: 0 };
    for (const per of this.layers.values()) per.forEach((l, i) => { out[LODS[i]] += l.wood.count; });
    return out;
  }

  update(x: number, z: number): void {
    if (Math.hypot(x - this.lastX, z - this.lastZ) > 10) {
      this.lastX = x;
      this.lastZ = z;
      const r2 = this.ranges.map((r) => r * r);
      const thinFrom = (this.q.treeFar * 1.5) ** 2;
      for (const set of this.trees) {
        const per = this.layers.get(set.kind);
        if (!per) continue;
        const fit = this.rootFit.get(set.kind)!;
        const bl = this.bareLayers.get(set.kind) ?? [null, null];
        const cnt = [0, 0, 0, 0];
        const mainCnt = [0, 0, 0, 0];
        const bareCnt = [0, 0];
        for (let i = 0; i < set.items.length; i++) {
          const p = set.items[i];
          const d2 = (p.x - x) ** 2 + (p.z - z) ** 2;
          let lod = 0;
          while (lod < 4 && d2 >= r2[lod]) lod++;
          if (lod === 4) continue;
          // ไกลมากวาดครึ่งเดียวแต่ใหญ่ขึ้นนิด เห็นป่าเต็มเท่าเดิมแต่การ์ดจอทำงานน้อยลง
          let grow = 1;
          if (lod === 3 && d2 > thinFrom) { if (hash2(i, set.kind.length, 77) < 0.5) continue; grow = 1.2; }
          const l = per[lod];
          if (cnt[lod] >= l.n) continue;
          // ระดับใกล้กับกลางมีราก: ต้นที่พื้นรอบโคนรับรากไม่ได้ใช้ลำต้นแบบไม่มีราก · ต้นบนลาดเล็กน้อยกดลงดินเพิ่ม
          const sinkK = 0.05 + (lod < 2 ? fit.sink[i] / p.scale : 0);
          const bareMesh = lod < 2 && fit.bare[i] ? bl[lod] : null;
          if (bareMesh) {
            if (bareCnt[lod] >= bareMesh.instanceMatrix.count) continue;
            setInstance(bareMesh, bareCnt[lod]++, p, sinkK, grow);
          } else setInstance(l.wood, mainCnt[lod]++, p, sinkK, grow);
          if (l.leaves) setInstance(l.leaves, cnt[lod], p, sinkK, grow);
          cnt[lod]++;
        }
        per.forEach((l, k) => {
          // ลำต้นปกตินับแยกจากลำต้นแบบไม่มีราก (ใบนับทุกต้น)
          l.wood.count = mainCnt[k];
          l.wood.instanceMatrix.needsUpdate = true;
          if (l.leaves) { l.leaves.count = cnt[k]; l.leaves.instanceMatrix.needsUpdate = true; }
        });
        bl.forEach((m, k) => { if (m) { m.count = bareCnt[k]; m.instanceMatrix.needsUpdate = true; } });
      }
      // หินกับขอนไม้วาดเฉพาะในระยะที่พื้นละเอียด ไกลกว่านั้นพื้นหยาบ จะลอย
      const rockR2 = Math.min(this.q.terrainNear * 0.75, 200) ** 2;
      for (const r of this.rockMeshes) {
        let n = 0;
        for (const p of r.items) if ((p.x - x) ** 2 + (p.z - z) ** 2 < rockR2) setInstance(r.mesh, n++, p, 0.04);
        r.mesh.count = n;
        r.mesh.instanceMatrix.needsUpdate = true;
      }
      for (const kind of DEBRIS_KINDS) {
        const mesh = this.debrisMeshes.get(kind)!;
        let n = 0;
        for (const p of this.debris[kind]) if ((p.x - x) ** 2 + (p.z - z) ** 2 < rockR2) setInstance(mesh, n++, p, 0.05);
        mesh.count = n;
        mesh.instanceMatrix.needsUpdate = true;
      }
    }
    if (Math.hypot(x - this.lastPlantX, z - this.lastPlantZ) > 8) {
      this.lastPlantX = x;
      this.lastPlantZ = z;
      const sets = scatterPlants(this.terrain, x, z, this.q.plantRadius);
      this.plantsNow = sets;
      const used = this.shrubMeshes.map(() => 0);
      for (const p of sets.bush) {
        const s = this.shrubMeshes[p.variant ?? 0];
        const k = used[p.variant ?? 0];
        if (!s || k >= s.wood.instanceMatrix.count) continue;
        setInstance(s.wood, k, p, 0.03);
        setInstance(s.leaves, k, p, 0.03);
        used[p.variant ?? 0]++;
      }
      this.shrubMeshes.forEach((s, i) => {
        s.wood.count = s.leaves.count = used[i];
        s.wood.instanceMatrix.needsUpdate = s.leaves.instanceMatrix.needsUpdate = true;
      });
      // เศษใบไม้: เอียงตามผิวดินตรงนั้น ยกขึ้นจากพื้นนิดเดียว
      const litter = scatterLitter(this.terrain, x, z, this.q.plantRadius);
      for (const kind of ['broad', 'needle'] as const) {
        const mesh = this.litterMeshes.get(kind)!;
        const items = litter[kind];
        const n = Math.min(items.length, mesh.instanceMatrix.count);
        for (let i = 0; i < n; i++) {
          const p = items[i];
          const nm = this.terrain.normalAt(p.x, p.z);
          tn.set(nm[0], nm[1], nm[2]);
          q.setFromUnitVectors(up, tn).multiply(tq.setFromAxisAngle(up, p.rot));
          pv.set(p.x, p.y + 0.03, p.z);
          sv.set(p.scale, 1, p.scale);
          m4.compose(pv, q, sv);
          mesh.setMatrixAt(i, m4);
        }
        mesh.count = n;
        mesh.instanceMatrix.needsUpdate = true;
      }
      for (const kind of PLANT_KINDS) {
        if (kind === 'bush') continue;
        const mesh = this.plantMeshes.get(kind)!;
        const items = sets[kind];
        const n = Math.min(items.length, mesh.instanceMatrix.count);
        for (let i = 0; i < n; i++) {
          setInstance(mesh, i, items[i], 0.02);
        }
        mesh.count = n;
        mesh.instanceMatrix.needsUpdate = true;
      }
    }
  }
}
