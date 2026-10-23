import * as THREE from 'three';
import { WORLD } from '../config/game';
import { rng } from '../world/noise';
import type { Terrain } from '../world/Terrain';
import { fishCanSwim, schoolSpots, type FishKind } from '../world/water';
import { assemble, type Part } from './models/build';

// ปลา 2 ชนิดเป็นฝูง กับแมลงปอริมน้ำ (รอบสอง ช่วง 6) · ปลาถ้ำไม่มีตาทำในช่วง 11
// เทราต์สีน้ำตาลในแม่น้ำ หันหัวทวนน้ำ · ปลาไนในทะเลสาบ ว่ายช้า · บางตัวกระโดดพ้นน้ำ · เข้าใกล้แล้วฝูงหนี

function fishGeometry(kind: FishKind): THREE.BufferGeometry {
  const trout = kind === 'trout';
  const len = trout ? 0.42 : 0.5;
  const deep = trout ? 0.09 : 0.16;
  const body = trout ? 0x6a6a42 : 0xa07a3a;
  const belly = trout ? 0xc8bc94 : 0xd8b878;
  const p: Part[] = [
    { geo: new THREE.SphereGeometry(1, 10, 6).scale(deep * 0.6, deep, len * 0.5), color: body, vary: 0.25 },
    { geo: new THREE.SphereGeometry(1, 8, 4, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45).scale(deep * 0.55, deep * 0.9, len * 0.47), color: belly, vary: 0.15 },
    // หาง
    { geo: new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, len * 0.45), new THREE.Vector3(0, deep * 1.1, len * 0.75), new THREE.Vector3(0, -deep * 1.1, len * 0.75)]), color: body },
    // ครีบหลัง
    { geo: new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, deep * 0.9, -len * 0.05), new THREE.Vector3(0, deep * 1.5, len * 0.08), new THREE.Vector3(0, deep * 0.9, len * 0.18)]), color: body },
  ];
  for (const part of p) if (!part.geo.getAttribute('normal')) part.geo.computeVertexNormals();
  return assemble(p);
}

function dragonflyGeometry(): THREE.BufferGeometry {
  const wing = (x: number, z: number, a: number) => new THREE.PlaneGeometry(0.16, 0.035).rotateX(-Math.PI / 2).rotateY(a).translate(x, 0.01, z);
  return assemble([
    { geo: new THREE.CylinderGeometry(0.008, 0.005, 0.18, 4).rotateX(Math.PI / 2), color: 0x2a6a8a },
    { geo: new THREE.SphereGeometry(0.016, 6, 4).translate(0, 0, -0.09), color: 0x1a4a5a },
    { geo: wing(0.08, -0.04, 0.1), color: 0xd8e8f0 },
    { geo: wing(-0.08, -0.04, -0.1), color: 0xd8e8f0 },
    { geo: wing(0.07, -0.01, -0.15), color: 0xd8e8f0 },
    { geo: wing(-0.07, -0.01, 0.15), color: 0xd8e8f0 },
  ]);
}

interface School {
  kind: FishKind;
  x: number;
  z: number;
  tx: number;
  tz: number;
  heading: number;
  members: { ox: number; oz: number; depth: number; phase: number }[];
  jumpAt: number;
  jumping: number;
  jumper: number;
}

interface Fly { x: number; y: number; z: number; tx: number; ty: number; tz: number; wait: number; heading: number }

export class Fish {
  readonly group = new THREE.Group();
  private schools: School[] = [];
  private meshes: Record<FishKind, THREE.InstancedMesh>;
  private flies: Fly[] = [];
  private flyMesh: THREE.InstancedMesh;
  private rand = rng(WORLD.seed + 606);
  private m4 = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private v = new THREE.Vector3();
  private s = new THREE.Vector3(1, 1, 1);
  /** ทิศน้ำไหลที่จุดหนึ่ง (เทราต์หันหัวทวนน้ำ) */
  flowAt: (x: number, z: number) => [number, number] = () => [0, 1];

  constructor(private terrain: Terrain) {
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    this.meshes = {
      trout: new THREE.InstancedMesh(fishGeometry('trout'), mat, 200),
      carp: new THREE.InstancedMesh(fishGeometry('carp'), mat, 200),
    };
    for (const m of Object.values(this.meshes)) { m.count = 0; m.frustumCulled = false; this.group.add(m); }
    this.flyMesh = new THREE.InstancedMesh(dragonflyGeometry(), mat, 24);
    this.flyMesh.count = 0;
    this.flyMesh.frustumCulled = false;
    this.group.add(this.flyMesh);
    for (const sp of schoolSpots(terrain)) {
      const n = sp.kind === 'trout' ? 6 : 8;
      const members = Array.from({ length: n }, () => ({ ox: (this.rand() - 0.5) * 3, oz: (this.rand() - 0.5) * 3, depth: 0.35 + this.rand() * 0.6, phase: this.rand() * 6.28 }));
      this.schools.push({ kind: sp.kind, x: sp.x, z: sp.z, tx: sp.x, tz: sp.z, heading: 0, members, jumpAt: 8 + this.rand() * 20, jumping: -1, jumper: 0 });
    }
  }

  /** ปลาที่อยู่ใกล้ (ใช้หาเป้าสแกน) */
  targets(x: number, z: number, r: number): { key: string; x: number; y: number; z: number }[] {
    const out: { key: string; x: number; y: number; z: number }[] = [];
    this.schools.forEach((s, si) => {
      if ((s.x - x) ** 2 + (s.z - z) ** 2 > (r + 4) ** 2) return;
      s.members.forEach((m, mi) => out.push({ key: `fish-${s.kind}-${si}-${mi}`, x: s.x + m.ox, y: WORLD.waterLevel - m.depth, z: s.z + m.oz }));
    });
    return out;
  }

  update(dt: number, time: number, px: number, pz: number, day: boolean): void {
    const counts: Record<FishKind, number> = { trout: 0, carp: 0 };
    for (const s of this.schools) {
      const d2 = (s.x - px) ** 2 + (s.z - pz) ** 2;
      if (d2 > 110 * 110) continue;
      // หนีเมื่อเข้าใกล้ · ไม่งั้นค่อย ๆ ย้ายที่ในน้ำลึก
      if (d2 < 36) {
        const d = Math.sqrt(d2) + 0.01;
        s.tx = s.x + ((s.x - px) / d) * 9;
        s.tz = s.z + ((s.z - pz) / d) * 9;
      } else if (Math.hypot(s.tx - s.x, s.tz - s.z) < 0.5 || !fishCanSwim(this.terrain, s.tx, s.tz)) {
        const a = this.rand() * Math.PI * 2;
        const r = s.kind === 'trout' ? 4 : 10;
        s.tx = s.x + Math.cos(a) * r;
        s.tz = s.z + Math.sin(a) * r;
      }
      if (!fishCanSwim(this.terrain, s.tx, s.tz)) { s.tx = s.x; s.tz = s.z; }
      const speed = d2 < 36 ? 2.6 : s.kind === 'trout' ? 0.35 : 0.5;
      const dx = s.tx - s.x;
      const dz = s.tz - s.z;
      const dl = Math.hypot(dx, dz);
      if (dl > 0.05) {
        const step = Math.min(dl, speed * dt);
        const nx = s.x + (dx / dl) * step;
        const nz = s.z + (dz / dl) * step;
        if (fishCanSwim(this.terrain, nx, nz)) { s.x = nx; s.z = nz; }
      }
      // หันหัว: เทราต์ทวนน้ำ (ยกเว้นตอนหนี) · ปลาไนหันตามทางที่ว่าย
      let want = Math.atan2(dx, dz);
      if (s.kind === 'trout' && d2 >= 36) { const [fx, fz] = this.flowAt(s.x, s.z); want = Math.atan2(-fx, -fz); }
      let dh = want - s.heading;
      dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      s.heading += dh * Math.min(1, dt * 2);
      // กระโดดพ้นน้ำบางครั้ง
      s.jumpAt -= dt;
      if (s.jumpAt <= 0 && s.jumping < 0) { s.jumping = 0; s.jumper = Math.floor(this.rand() * s.members.length); s.jumpAt = 12 + this.rand() * 25; }
      if (s.jumping >= 0) { s.jumping += dt / 1.1; if (s.jumping >= 1) s.jumping = -1; }
      const mesh = this.meshes[s.kind];
      s.members.forEach((m, mi) => {
        if (counts[s.kind] >= mesh.instanceMatrix.count) return;
        const wig = Math.sin(time * (s.kind === 'trout' ? 9 : 5) + m.phase) * 0.18;
        let y = WORLD.waterLevel - m.depth;
        let pitch = 0;
        const cs = Math.cos(s.heading);
        const sn = Math.sin(s.heading);
        let x = s.x + m.ox * cs + m.oz * sn;
        let z = s.z - m.ox * sn + m.oz * cs;
        if (mi === s.jumper && s.jumping >= 0) {
          const t = s.jumping;
          y = WORLD.waterLevel - 0.2 + Math.sin(t * Math.PI) * 0.75;
          pitch = (0.5 - t) * 2.2;
          x += Math.sin(s.heading) * t * 1.2;
          z += Math.cos(s.heading) * t * 1.2;
        }
        this.e.set(pitch, s.heading + wig, 0, 'YXZ');
        this.q.setFromEuler(this.e);
        this.m4.compose(this.v.set(x, y, z), this.q, this.s);
        mesh.setMatrixAt(counts[s.kind]++, this.m4);
      });
    }
    for (const k of Object.keys(counts) as FishKind[]) { this.meshes[k].count = counts[k]; this.meshes[k].instanceMatrix.needsUpdate = true; }
    this.updateFlies(dt, time, px, pz, day);
  }

  /** แมลงปอ: บินเร็วเป็นช่วง ๆ แล้วหยุดลอยนิ่ง เหนือผิวน้ำกับตลิ่งรอบตัว · กลางวันเท่านั้น */
  private updateFlies(dt: number, time: number, px: number, pz: number, day: boolean): void {
    const near = (x: number, z: number) => this.terrain.heightAt(x, z) < WORLD.waterLevel + 0.8;
    if (!day) { this.flyMesh.count = 0; return; }
    if (this.flies.length < 16 && this.rand() < dt * 3) {
      const a = this.rand() * Math.PI * 2;
      const r = 8 + this.rand() * 28;
      const x = px + Math.cos(a) * r;
      const z = pz + Math.sin(a) * r;
      if (near(x, z)) this.flies.push({ x, y: WORLD.waterLevel + 0.6, z, tx: x, ty: WORLD.waterLevel + 0.6, tz: z, wait: 0, heading: 0 });
    }
    this.flies = this.flies.filter((f) => (f.x - px) ** 2 + (f.z - pz) ** 2 < 45 * 45);
    let n = 0;
    for (const f of this.flies) {
      if (f.wait > 0) f.wait -= dt;
      else {
        const dx = f.tx - f.x;
        const dy = f.ty - f.y;
        const dz = f.tz - f.z;
        const dl = Math.hypot(dx, dy, dz);
        if (dl < 0.1) {
          f.wait = 0.4 + this.rand() * 1.8;
          const a = this.rand() * Math.PI * 2;
          const r = 1 + this.rand() * 4;
          const nx = f.x + Math.cos(a) * r;
          const nz = f.z + Math.sin(a) * r;
          if (near(nx, nz)) { f.tx = nx; f.tz = nz; f.ty = Math.max(WORLD.waterLevel, this.terrain.heightAt(nx, nz)) + 0.3 + this.rand() * 1.2; }
        } else {
          const step = Math.min(dl, 5.5 * dt);
          f.x += (dx / dl) * step;
          f.y += (dy / dl) * step;
          f.z += (dz / dl) * step;
          f.heading = Math.atan2(dx, dz);
        }
      }
      if (n >= 24) break;
      this.e.set(0, f.heading, Math.sin(time * 40 + f.x) * 0.06, 'YXZ');
      this.q.setFromEuler(this.e);
      this.m4.compose(this.v.set(f.x, f.y + Math.sin(time * 3 + f.z) * 0.04, f.z), this.q, this.s);
      this.flyMesh.setMatrixAt(n++, this.m4);
    }
    this.flyMesh.count = n;
    this.flyMesh.instanceMatrix.needsUpdate = true;
  }
}
