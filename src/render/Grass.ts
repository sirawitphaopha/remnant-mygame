import * as THREE from 'three';
import type { QualityPreset } from '../config/quality';
import { hash2 } from '../world/noise';
import { grassDensity } from '../world/scatter';
import type { Terrain } from '../world/Terrain';
import { assemble, type Part } from './models/build';
import type { TerrainMesh } from './TerrainMesh';
import { addWind } from './wind';

/** กอหญ้าหนึ่งกอ = ใบหญ้า 9 ใบ โคนเข้ม ปลายอ่อน */
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
  // ไล่สีจากโคนเข้มไปปลายอ่อน · ตั้งเวกเตอร์ตั้งฉากชี้ขึ้น หญ้าจะสว่างนุ่มเหมือนรับแสงจากฟ้า
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

/** หญ้ารอบตัวผู้เล่น ล็อกกับพิกัดโลก ไหวตามลม · จัดใหม่ทุกครั้งที่เดินไป 6 เมตร */
export class Grass {
  readonly mesh: THREE.InstancedMesh;
  private lastX = Infinity;
  private lastZ = Infinity;
  private capacity = 60000;

  constructor(private terrain: Terrain, private ground: TerrainMesh, private q: QualityPreset) {
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    addWind(mat, 0.12, 0.15, true);
    this.mesh = new THREE.InstancedMesh(clumpGeometry(), mat, this.capacity);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.receiveShadow = true;
    this.mesh.setColorAt(0, new THREE.Color());
  }

  setQuality(q: QualityPreset): void {
    this.q = q;
    this.lastX = this.lastZ = Infinity;
  }

  update(x: number, z: number): void {
    if (Math.hypot(x - this.lastX, z - this.lastZ) < 6) return;
    this.lastX = x;
    this.lastZ = z;
    const R = this.q.grassRadius;
    const s = this.q.grassSpacing;
    const m = new THREE.Matrix4();
    const quat = new THREE.Quaternion();
    const axis = new THREE.Vector3(0, 1, 0);
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    const col = new THREE.Color();
    let n = 0;
    const i0 = Math.floor((x - R) / s);
    const i1 = Math.floor((x + R) / s);
    const j0 = Math.floor((z - R) / s);
    const j1 = Math.floor((z + R) / s);
    for (let j = j0; j <= j1 && n < this.capacity; j++) {
      for (let i = i0; i <= i1 && n < this.capacity; i++) {
        const gx = (i + hash2(i, j, 31)) * s;
        const gz = (j + hash2(i, j, 32)) * s;
        const d = Math.hypot(gx - x, gz - z);
        if (d > R) continue;
        const dens = grassDensity(this.terrain, gx, gz);
        if (hash2(i, j, 33) > dens) continue;
        const edge = 1 - Math.max(0, (d - R * 0.7) / (R * 0.3));
        const sc = (0.7 + 0.7 * hash2(i, j, 34)) * (0.35 + 0.65 * edge) * (0.6 + 0.4 * dens);
        quat.setFromAxisAngle(axis, hash2(i, j, 35) * Math.PI * 2);
        pos.set(gx, this.terrain.heightAt(gx, gz) - 0.03, gz);
        scl.set(sc, sc * (0.85 + 0.5 * hash2(i, j, 36)), sc);
        m.compose(pos, quat, scl);
        this.mesh.setMatrixAt(n, m);
        // ย้อมสีตามพื้นตรงนั้น หญ้าแห้งตรงที่พื้นแห้ง
        this.ground.colorAt(gx, gz, 1, col);
        col.multiplyScalar(1.08);
        this.mesh.setColorAt(n, col);
        n++;
      }
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
