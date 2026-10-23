import * as THREE from 'three';
import type { QualityPreset } from '../config/quality';
import { PLANT_KINDS, scatterPlants, scatterRocks, scatterTrees, type PlantKind, type Placed, type TreeSet } from '../world/scatter';
import type { Terrain } from '../world/Terrain';
import { plantGeometry, rockGeometry, treeGeometry } from './models/plants';
import { addWind } from './wind';

const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const up = new THREE.Vector3(0, 1, 0);
const pv = new THREE.Vector3();
const sv = new THREE.Vector3();

function setInstance(mesh: THREE.InstancedMesh, i: number, p: Placed, sink = 0): void {
  q.setFromAxisAngle(up, p.rot);
  pv.set(p.x, p.y - sink * p.scale, p.z);
  sv.setScalar(p.scale);
  m4.compose(pv, q, sv);
  mesh.setMatrixAt(i, m4);
}

interface TreeLayer {
  set: TreeSet;
  near: THREE.InstancedMesh;
  far: THREE.InstancedMesh;
}

/** ต้นไม้ หิน และพืชเล็ก · จัดใหม่เมื่อผู้เล่นเดินไปไกลพอ ไม่ใช่ทุกเฟรม */
export class Vegetation {
  readonly group = new THREE.Group();
  readonly trees: TreeSet[];
  readonly rocks: Placed[];
  private layers: TreeLayer[] = [];
  private rockMeshes: { mesh: THREE.InstancedMesh; items: Placed[] }[] = [];
  private plantMeshes = new Map<PlantKind, THREE.InstancedMesh>();
  private lastX = Infinity;
  private lastZ = Infinity;
  private lastPlantX = Infinity;
  private lastPlantZ = Infinity;

  constructor(private terrain: Terrain, private q: QualityPreset) {
    this.trees = scatterTrees(terrain);
    this.rocks = scatterRocks(terrain);

    const leafMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    addWind(leafMat, 0.35, 0.2, false, 3.2);
    for (const set of this.trees) {
      const near = new THREE.InstancedMesh(treeGeometry(set.kind, 'near'), leafMat, set.items.length);
      const far = new THREE.InstancedMesh(treeGeometry(set.kind, 'far'), leafMat, set.items.length);
      near.castShadow = true;
      near.receiveShadow = true;
      near.frustumCulled = false;
      far.frustumCulled = false;
      near.count = 0;
      far.count = 0;
      this.group.add(near, far);
      this.layers.push({ set, near, far });
    }

    const rockMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    const perVariant = Math.ceil(this.rocks.length / 3);
    for (let v = 0; v < 3; v++) {
      const items = this.rocks.filter((_, i) => i % 3 === v);
      const mesh = new THREE.InstancedMesh(rockGeometry(v), rockMat, perVariant);
      mesh.count = 0;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      this.rockMeshes.push({ mesh, items });
      this.group.add(mesh);
    }

    const plantMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    addWind(plantMat, 0.06, 0.4, true, 1.6);
    for (const kind of PLANT_KINDS) {
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

  /** จำนวนต้นไม้ที่วาดอยู่ตอนนี้ (ไว้ดูตอนทดสอบ) */
  get visibleTrees(): { near: number; far: number } {
    let near = 0;
    let far = 0;
    for (const l of this.layers) { near += l.near.count; far += l.far.count; }
    return { near, far };
  }

  update(x: number, z: number): void {
    if (Math.hypot(x - this.lastX, z - this.lastZ) > 12) {
      this.lastX = x;
      this.lastZ = z;
      const nearR2 = this.q.treeNear ** 2;
      const farR2 = this.q.treeFar ** 2;
      for (const l of this.layers) {
        let n = 0;
        let f = 0;
        for (const p of l.set.items) {
          const d2 = (p.x - x) ** 2 + (p.z - z) ** 2;
          if (d2 < nearR2) setInstance(l.near, n++, p, 0.1);
          else if (d2 < farR2) setInstance(l.far, f++, p, 0.1);
        }
        l.near.count = n;
        l.far.count = f;
        l.near.instanceMatrix.needsUpdate = true;
        l.far.instanceMatrix.needsUpdate = true;
      }
      // หินวาดเฉพาะในระยะที่พื้นละเอียด ไกลกว่านั้นพื้นหยาบ หินจะลอย
      const rockR2 = (this.q.terrainNear * 0.85) ** 2;
      for (const r of this.rockMeshes) {
        let n = 0;
        for (const p of r.items) if ((p.x - x) ** 2 + (p.z - z) ** 2 < rockR2) setInstance(r.mesh, n++, p, 0.3);
        r.mesh.count = n;
        r.mesh.instanceMatrix.needsUpdate = true;
      }
    }
    if (Math.hypot(x - this.lastPlantX, z - this.lastPlantZ) > 8) {
      this.lastPlantX = x;
      this.lastPlantZ = z;
      const sets = scatterPlants(this.terrain, x, z, this.q.plantRadius);
      for (const kind of PLANT_KINDS) {
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
