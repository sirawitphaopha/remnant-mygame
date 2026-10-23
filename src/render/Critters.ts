import * as THREE from 'three';
import { WORLD } from '../config/game';
import { ECO_BY_ID, flockStep, groupsWanted, herdSize, outOfView, type DayPart, type FlockParams } from '../core/ecology';
import { biomeSet, habitatFits } from '../world/habitat';
import type { FlowerSpot } from '../world/flowers';
import type { Terrain } from '../world/Terrain';
import type { BiomeId } from '../world/terrainGen';
import { assemble } from './models/build';

// สัตว์เล็กเป็นกลุ่ม (รอบสอง ช่วง 12) · วาดแบบ InstancedMesh ชนิดละไม่กี่ครั้งวาด · คิดทุก 2 เฟรม
// นกกิ้งโครง: ฝูงบินเหนือทุ่ง ไร่ เมือง ลงหากินบนหญ้า ตัวท้ายบินข้ามไปหน้าฝูง เห็นคนแล้วบินขึ้นพร้อมกัน พลบค่ำฝูงใหญ่ขึ้นบินวนเป็นรูปร่าง
// ผีเสื้อ: บินกระพือไปเกาะดอกไม้ทีละดอก · ผึ้ง: บินเร็วจากดอกไปดอกใกล้ ๆ หยุดลอยที่ดอก
// กลางวันเท่านั้น ฝนตกไม่ออก (ข้อเท็จจริงกับที่มา docs/REFERENCES-R2.md หัวข้อ 11)

const BIRD_MAX = 60;
const FLY_MAX = 16;
const BEE_MAX = 20;
/** นกกิ้งโครงยาวราว 20 ซม. ปีกกว้างราว 38 ซม. */
const BIRD = { len: 0.2, span: 0.38 };

function birdGeometry(wing: 'up' | 'down' | 'fold'): THREE.BufferGeometry {
  const half = BIRD.span / 2;
  const y = wing === 'up' ? 0.07 : wing === 'down' ? -0.06 : 0;
  const reach = wing === 'fold' ? 0.05 : half;
  const w = (s: number) => new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(s * 0.02, 0.01, -0.03), new THREE.Vector3(s * reach, y, 0.02), new THREE.Vector3(s * 0.02, 0.01, 0.05),
  ]);
  const parts = [
    { geo: new THREE.SphereGeometry(1, 7, 5).scale(0.03, 0.028, BIRD.len * 0.42), color: 0x1e1c26 },
    { geo: new THREE.SphereGeometry(0.022, 6, 4).translate(0, 0.015, -0.085), color: 0x1e1c26 },
    { geo: new THREE.ConeGeometry(0.007, 0.03, 4).rotateX(-Math.PI / 2).translate(0, 0.012, -0.115), color: wing === 'fold' ? 0xd8c040 : 0x3a3020 },
    { geo: new THREE.ConeGeometry(0.03, 0.06, 3).rotateX(Math.PI / 2).scale(1, 0.25, 1).translate(0, 0, 0.1), color: 0x16141c },
    { geo: w(1), color: 0x222030 },
    { geo: w(-1), color: 0x222030 },
  ];
  for (const p of parts) if (!p.geo.getAttribute('normal')) p.geo.computeVertexNormals();
  return assemble(parts);
}

function butterflyGeometry(open: boolean): THREE.BufferGeometry {
  // ปีกคู่หน้าใหญ่ คู่หลังเล็ก · ปีกหุบ = ตั้งขึ้นชิดกัน
  const tilt = open ? 0.15 : 1.35;
  const wing = (s: number, z: number, r: number) => new THREE.CircleGeometry(r, 7).scale(1, 0.75, 1).rotateX(-Math.PI / 2).translate(s * r * 0.9, 0, z).rotateZ(s * tilt);
  const parts = [
    { geo: wing(1, -0.01, 0.028), color: 0xffffff },
    { geo: wing(-1, -0.01, 0.028), color: 0xffffff },
    { geo: wing(1, 0.018, 0.02), color: 0xe8e8e8 },
    { geo: wing(-1, 0.018, 0.02), color: 0xe8e8e8 },
    { geo: new THREE.CylinderGeometry(0.003, 0.003, 0.045, 4).rotateX(Math.PI / 2), color: 0x2a2620 },
  ];
  for (const p of parts) if (!p.geo.getAttribute('normal')) p.geo.computeVertexNormals();
  return assemble(parts);
}

function beeGeometry(): THREE.BufferGeometry {
  // ผึ้งงานยาวราว 1.3 ซม. ลายเหลืองดำ ปีกใสเป็นเงาจาง ๆ
  const parts = [
    { geo: new THREE.SphereGeometry(1, 6, 4).scale(0.0045, 0.0045, 0.008).translate(0, 0, 0.004), color: 0xd8a020 },
    { geo: new THREE.CylinderGeometry(0.0047, 0.0047, 0.0025, 6).rotateX(Math.PI / 2).translate(0, 0, 0.004), color: 0x20180a },
    { geo: new THREE.CylinderGeometry(0.004, 0.004, 0.002, 6).rotateX(Math.PI / 2).translate(0, 0, 0.008), color: 0x20180a },
    { geo: new THREE.SphereGeometry(0.0038, 6, 4).translate(0, 0, -0.004), color: 0x3a2a10 },
    { geo: new THREE.SphereGeometry(0.003, 5, 4).translate(0, 0, -0.009), color: 0x1a1408 },
    { geo: new THREE.CircleGeometry(0.0065, 6).scale(1, 0.6, 1).rotateX(-Math.PI / 2).translate(0.006, 0.004, -0.001), color: 0xc8d4dc },
    { geo: new THREE.CircleGeometry(0.0065, 6).scale(1, 0.6, 1).rotateX(-Math.PI / 2).translate(-0.006, 0.004, -0.001), color: 0xc8d4dc },
  ];
  for (const p of parts) if (!p.geo.getAttribute('normal')) p.geo.computeVertexNormals();
  return assemble(parts);
}

interface Insect { x: number; y: number; z: number; tx: number; ty: number; tz: number; wait: number; heading: number; phase: number; color: number }

/** สีปีกผีเสื้อ (ส้ม ขาว ฟ้า เหลือง น้ำตาลส้ม) */
const WING_COLORS = [0xf2a03c, 0xf0f0f4, 0x7fb0e8, 0xf2d24b, 0xc0702a];

export class Critters {
  readonly group = new THREE.Group();
  private birds: Record<'up' | 'down' | 'fold', THREE.InstancedMesh>;
  private flyOpen: THREE.InstancedMesh;
  private flyShut: THREE.InstancedMesh;
  private bees: THREE.InstancedMesh;
  // ฝูงนก
  private n = 0;
  private pos = new Float32Array(BIRD_MAX * 3);
  private vel = new Float32Array(BIRD_MAX * 3);
  private phase = new Float32Array(BIRD_MAX);
  private flock: { hx: number; hz: number; tx: number; ty: number; tz: number; mode: 'fly' | 'land'; timer: number; retarget: number } | null = null;
  private feed: Set<BiomeId>;
  private butterflies: Insect[] = [];
  private beeList: Insect[] = [];
  private m4 = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private v = new THREE.Vector3();
  private one = new THREE.Vector3(1, 1, 1);
  private big = new THREE.Vector3(1.5, 1.5, 1.5);
  private col = new THREE.Color();
  private tick = 0;
  private acc = 0;

  constructor(private terrain: Terrain) {
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    const mk = (g: THREE.BufferGeometry, n: number, m: THREE.Material = mat) => {
      const im = new THREE.InstancedMesh(g, m, n);
      im.count = 0;
      im.frustumCulled = false;
      this.group.add(im);
      return im;
    };
    this.birds = { up: mk(birdGeometry('up'), BIRD_MAX), down: mk(birdGeometry('down'), BIRD_MAX), fold: mk(birdGeometry('fold'), BIRD_MAX) };
    // ผีเสื้อสีต่อตัว (ใส่สีต่อชิ้น คูณกับสีปีก)
    this.flyOpen = mk(butterflyGeometry(true), FLY_MAX);
    this.flyShut = mk(butterflyGeometry(false), FLY_MAX);
    // สร้างช่องสีต่อตัวไว้ก่อน เชดเดอร์จะได้รู้ตั้งแต่แรกว่าใช้สีต่อตัว
    for (const m of [this.flyOpen, this.flyShut]) m.setColorAt(0, this.col.setHex(0xffffff));
    this.bees = mk(beeGeometry(), BEE_MAX);
    this.feed = biomeSet(ECO_BY_ID.get('starling')!.feed);
  }

  /** ตัวที่สแกนได้ (นก ผีเสื้อ ผึ้ง ใกล้ตัว) */
  targets(px: number, pz: number, r: number): { key: string; kind: string; x: number; y: number; z: number }[] {
    const out: { key: string; kind: string; x: number; y: number; z: number }[] = [];
    for (let i = 0; i < this.n; i++) {
      const x = this.pos[i * 3];
      const z = this.pos[i * 3 + 2];
      if ((x - px) ** 2 + (z - pz) ** 2 < r * r) out.push({ key: `starling-${i}`, kind: 'starling', x, y: this.pos[i * 3 + 1], z });
    }
    this.butterflies.forEach((b, i) => { if ((b.x - px) ** 2 + (b.z - pz) ** 2 < r * r) out.push({ key: `butterfly-${i}`, kind: 'butterfly', x: b.x, y: b.y, z: b.z }); });
    this.beeList.forEach((b, i) => { if ((b.x - px) ** 2 + (b.z - pz) ** 2 < r * r) out.push({ key: `bee-${i}`, kind: 'bee', x: b.x, y: b.y, z: b.z }); });
    return out;
  }

  /** จำนวนตัวที่อยู่ตอนนี้ (ตัวช่วยทดสอบ) */
  census(): { starling: number; mode: string; butterfly: number; bee: number } {
    return { starling: this.n, mode: this.flock?.mode ?? '-', butterfly: this.butterflies.length, bee: this.beeList.length };
  }

  update(dt: number, time: number, px: number, pz: number, part: DayPart, rain: number, flowers: FlowerSpot[], fx: number, fz: number): void {
    // คิดทุก 2 เฟรม (เวลาสะสม)
    this.acc += dt;
    if (++this.tick % 2) { this.draw(time); return; }
    const step = Math.min(0.1, this.acc);
    this.acc = 0;
    this.updateFlock(step, time, px, pz, part, rain, fx, fz);
    const blooms = flowers.filter((f) => f.kind !== 'waterLily' && f.kind !== 'cattail' && f.kind !== 'reed' && f.kind !== 'horsetail' && f.kind !== 'stone');
    this.updateInsects(this.butterflies, step, px, pz, groupsWanted(ECO_BY_ID.get('butterfly')!, part, rain) > 0 && rain < 0.3 ? Math.min(FLY_MAX, Math.floor(blooms.length / 6)) : 0, blooms, 'butterfly');
    this.updateInsects(this.beeList, step, px, pz, groupsWanted(ECO_BY_ID.get('bee')!, part, rain) > 0 && rain < 0.3 ? Math.min(BEE_MAX, Math.floor(blooms.length / 4)) : 0, blooms, 'bee');
    this.draw(time);
  }

  private updateFlock(dt: number, time: number, px: number, pz: number, part: DayPart, rain: number, fx: number, fz: number): void {
    const e = ECO_BY_ID.get('starling')!;
    const want = groupsWanted(e, part, rain) > 0;
    const t = this.terrain;
    if (!this.flock) {
      if (!want || Math.random() > dt * 0.5) return;
      // เกิดนอกสายตาในทุ่ง ไร่ เมือง
      for (let k = 0; k < 8; k++) {
        const a = Math.random() * Math.PI * 2;
        const d = 90 + Math.random() * 70;
        const x = px + Math.cos(a) * d;
        const z = pz + Math.sin(a) * d;
        if (!outOfView(x - px, z - pz, fx, fz) || !habitatFits(t, this.feed, x, z, null, e)) continue;
        this.n = Math.min(BIRD_MAX, herdSize(e, Math.random(), part));
        const gy = t.heightAt(x, z);
        for (let i = 0; i < this.n; i++) {
          this.pos[i * 3] = x + (Math.random() - 0.5) * 8;
          this.pos[i * 3 + 1] = gy + 18 + (Math.random() - 0.5) * 4;
          this.pos[i * 3 + 2] = z + (Math.random() - 0.5) * 8;
          this.vel[i * 3] = 6;
          this.vel[i * 3 + 1] = 0;
          this.vel[i * 3 + 2] = 0;
          this.phase[i] = Math.random() * 6.28;
        }
        this.flock = { hx: x, hz: z, tx: x, ty: gy + 20, tz: z, mode: 'fly', timer: 0, retarget: 0 };
        return;
      }
      return;
    }
    const f = this.flock;
    let cx = 0;
    let cz = 0;
    for (let i = 0; i < this.n; i++) { cx += this.pos[i * 3]; cz += this.pos[i * 3 + 2]; }
    cx /= this.n || 1;
    cz /= this.n || 1;
    const dPlayer = Math.hypot(cx - px, cz - pz);
    // หมดเวลาหรือไกลเกิน หายไปตอนอยู่นอกสายตา
    if ((dPlayer > 260 || (!want && dPlayer > 60)) && outOfView(cx - px, cz - pz, fx, fz, 140)) { this.flock = null; this.n = 0; return; }
    f.timer += dt;
    f.retarget -= dt;
    if (f.mode === 'fly') {
      const dusk = part === 'dusk';
      if (f.retarget <= 0) {
        f.retarget = dusk ? 3 : 7 + Math.random() * 8;
        // พลบค่ำบินวนเป็นวงรอบที่อยู่ · ปกติบินไปมาเหนือที่หากิน
        for (let k = 0; k < 6; k++) {
          const a = dusk ? time * 0.25 + k : Math.random() * Math.PI * 2;
          const r = dusk ? 35 : 25 + Math.random() * 70;
          const x = f.hx + Math.cos(a) * r;
          const z = f.hz + Math.sin(a) * r;
          if (dusk || habitatFits(t, this.feed, x, z, null, e)) {
            f.tx = x;
            f.tz = z;
            f.ty = t.heightAt(x, z) + (dusk ? 28 + Math.sin(time * 0.4) * 8 : 14 + Math.random() * 12);
            break;
          }
        }
        // กลางวันลงหากินบนพื้นหญ้าเป็นพัก ๆ
        if (!dusk && want && f.timer > 25 && Math.random() < 0.35 && habitatFits(t, this.feed, f.tx, f.tz, null, e) && Math.hypot(f.tx - px, f.tz - pz) > 30) {
          f.mode = 'land';
          f.timer = 0;
        }
      }
      const p: FlockParams = { sep: 0.7, see: 6, minSpeed: 7, maxSpeed: dusk ? 13 : 11, pull: dusk ? 0.12 : 0.05, cohesion: dusk ? 1.2 : 0.6 };
      flockStep(this.pos, this.vel, this.n, f.tx, f.ty, f.tz, dt, p);
      // ไม่บินมุดดิน
      for (let i = 0; i < this.n; i++) {
        const g = t.heightAt(this.pos[i * 3], this.pos[i * 3 + 2]) + 3;
        if (this.pos[i * 3 + 1] < g) { this.pos[i * 3 + 1] = g; this.vel[i * 3 + 1] = Math.abs(this.vel[i * 3 + 1]); }
      }
      return;
    }
    // ลงหากินบนพื้น: บินลงไปที่จุดหมาย แล้วเดินจิกหญ้าไปทางเดียวกัน ตัวท้ายบินข้ามไปหน้าฝูง
    const dirX = Math.cos(f.timer * 0.05 + f.hx);
    const dirZ = Math.sin(f.timer * 0.05 + f.hx);
    let back = -1;
    let backD = Infinity;
    for (let i = 0; i < this.n; i++) {
      const ix = i * 3;
      const gx = f.tx + Math.cos(this.phase[i] * 7) * (2 + (i % 7));
      const gz = f.tz + Math.sin(this.phase[i] * 7) * (2 + (i % 5));
      const dx = gx - this.pos[ix];
      const dz = gz - this.pos[ix + 2];
      const dl = Math.hypot(dx, dz, this.pos[ix + 1] - t.heightAt(this.pos[ix], this.pos[ix + 2]));
      if (dl > 0.4) {
        const s = Math.min(dl, 9 * dt) / dl;
        this.pos[ix] += dx * s;
        this.pos[ix + 2] += dz * s;
        // พื้นตรงจุดใหม่ (ไม่ใช่จุดเดิม) นกไม่จมดินตอนบินลงบนเนิน
        const gy = t.heightAt(this.pos[ix], this.pos[ix + 2]);
        this.pos[ix + 1] = Math.max(gy, this.pos[ix + 1] + (gy - this.pos[ix + 1]) * s);
        this.vel[ix] = dx;
        this.vel[ix + 2] = dz;
        this.vel[ix + 1] = 1;
      } else {
        this.pos[ix + 1] = t.heightAt(this.pos[ix], this.pos[ix + 2]);
        this.vel[ix] = dirX * 0.3;
        this.vel[ix + 1] = 0;
        this.vel[ix + 2] = dirZ * 0.3;
      }
      const along = (this.pos[ix] - f.tx) * dirX + (this.pos[ix + 2] - f.tz) * dirZ;
      if (along < backD) { backD = along; back = i; }
    }
    // ฝูงค่อย ๆ เดินหน้าไปทางเดียวกัน
    f.tx += dirX * 0.3 * dt;
    f.tz += dirZ * 0.3 * dt;
    if (back >= 0 && Math.random() < dt * 0.8) this.phase[back] = (this.phase[back] + 2.1) % 6.28;
    // เห็นคนใกล้ ฝนตก หรือหากินนานพอ บินขึ้นพร้อมกัน
    if (dPlayer < (e.id === 'starling' ? 14 : 10) || !want || f.timer > 40) {
      f.mode = 'fly';
      f.timer = 0;
      f.retarget = 0;
      const away = Math.atan2(cz - pz, cx - px);
      f.hx = cx + Math.cos(away) * 40;
      f.hz = cz + Math.sin(away) * 40;
      for (let i = 0; i < this.n; i++) {
        this.vel[i * 3] = Math.cos(away) * 6 + (Math.random() - 0.5) * 2;
        this.vel[i * 3 + 1] = 4 + Math.random() * 2;
        this.vel[i * 3 + 2] = Math.sin(away) * 6 + (Math.random() - 0.5) * 2;
      }
    }
  }

  private updateInsects(list: Insect[], dt: number, px: number, pz: number, want: number, blooms: FlowerSpot[], kind: 'butterfly' | 'bee'): void {
    const bee = kind === 'bee';
    // เกิดที่ดอกไม้ห่างตัว 8 ถึง 30 ม. (ตัวเล็กจนมองไม่เห็นจากระยะนั้นอยู่แล้ว)
    if (list.length < want && blooms.length && Math.random() < dt * 4) {
      const f = blooms[Math.floor(Math.random() * blooms.length)];
      const d = Math.hypot(f.x - px, f.z - pz);
      if (d > 8) list.push({ x: f.x, y: f.y + f.scale * 0.9, z: f.z, tx: f.x, ty: f.y + f.scale * 0.9, tz: f.z, wait: Math.random() * 2, heading: Math.random() * 6.28, phase: Math.random() * 6.28, color: WING_COLORS[Math.floor(Math.random() * WING_COLORS.length)] });
    }
    for (let i = list.length - 1; i >= 0; i--) {
      const b = list[i];
      if ((b.x - px) ** 2 + (b.z - pz) ** 2 > 45 * 45 || list.length > want + 2 || (want === 0 && Math.random() < dt)) { list.splice(i, 1); continue; }
      if (b.wait > 0) { b.wait -= dt; continue; }
      const dx = b.tx - b.x;
      const dy = b.ty - b.y;
      const dz = b.tz - b.z;
      const dl = Math.hypot(dx, dy, dz);
      if (dl < 0.05) {
        // ถึงดอกแล้ว เกาะสักพัก แล้วเลือกดอกใหม่ใกล้ ๆ
        b.wait = bee ? 0.8 + Math.random() * 2 : 2 + Math.random() * 5;
        const range = bee ? 3 : 8;
        let best: FlowerSpot | null = null;
        for (let k = 0; k < 8; k++) {
          const f = blooms[Math.floor(Math.random() * blooms.length)];
          if (f && Math.hypot(f.x - b.x, f.z - b.z) < range && (f.x !== b.x || f.z !== b.z)) { best = f; break; }
        }
        if (best) { b.tx = best.x; b.tz = best.z; b.ty = best.y + best.scale * 0.9; }
        else { b.tx = b.x + (Math.random() - 0.5) * range; b.tz = b.z + (Math.random() - 0.5) * range; b.ty = Math.max(WORLD.waterLevel, this.terrain.heightAt(b.tx, b.tz)) + 0.5; }
        continue;
      }
      const speed = bee ? 3 : 1.4;
      const s = Math.min(dl, speed * dt) / dl;
      b.x += dx * s;
      b.z += dz * s;
      // ผีเสื้อบินขึ้นลงเป็นคลื่น ผึ้งบินตรงกว่า
      b.y += dy * s + (bee ? 0 : Math.sin(b.phase + b.x * 3) * dt * 0.8);
      b.heading = Math.atan2(dx, dz);
      b.phase += dt * 6;
    }
  }

  private draw(time: number): void {
    // นก: แบ่งตามท่าปีก (ขึ้น ลง พับตอนอยู่บนพื้น)
    const cnt = { up: 0, down: 0, fold: 0 };
    for (let i = 0; i < this.n; i++) {
      const ix = i * 3;
      const vx = this.vel[ix];
      const vy = this.vel[ix + 1];
      const vz = this.vel[ix + 2];
      const ground = this.flock?.mode === 'land' && Math.abs(vy) < 0.01;
      const k = ground ? 'fold' : Math.sin(time * 14 + this.phase[i]) > 0 ? 'up' : 'down';
      const hz = Math.hypot(vx, vz) || 1;
      this.e.set(ground ? Math.sin(time * 6 + this.phase[i]) * 0.3 : -Math.atan2(vy, hz) * 0.6, Math.atan2(-vx, -vz), 0, 'YXZ');
      this.q.setFromEuler(this.e);
      this.m4.compose(this.v.set(this.pos[ix], this.pos[ix + 1] + (ground ? 0.03 : 0), this.pos[ix + 2]), this.q, this.one);
      this.birds[k].setMatrixAt(cnt[k]++, this.m4);
    }
    for (const k of ['up', 'down', 'fold'] as const) { this.birds[k].count = cnt[k]; this.birds[k].instanceMatrix.needsUpdate = true; }
    // ผีเสื้อ: ปีกกางหุบสลับเร็วตอนบิน ช้าตอนเกาะ
    let no = 0;
    let ns = 0;
    for (const b of this.butterflies) {
      const sitting = b.wait > 0;
      const open = Math.sin(time * (sitting ? 2.5 : 24) + b.phase) > 0;
      this.e.set(0, b.heading + Math.PI, 0, 'YXZ');
      this.q.setFromEuler(this.e);
      this.m4.compose(this.v.set(b.x, b.y, b.z), this.q, this.one);
      this.col.setHex(b.color);
      if (open) { this.flyOpen.setMatrixAt(no, this.m4); this.flyOpen.setColorAt(no++, this.col); }
      else { this.flyShut.setMatrixAt(ns, this.m4); this.flyShut.setColorAt(ns++, this.col); }
    }
    this.flyOpen.count = no;
    this.flyShut.count = ns;
    for (const m of [this.flyOpen, this.flyShut]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    // ผึ้ง: ตัวจริงยาวราว 1.3 ซม. วาดใหญ่ขึ้นครึ่งหนึ่งให้พอเห็น
    let nb = 0;
    for (const b of this.beeList) {
      this.e.set(0, b.heading + Math.PI, 0, 'YXZ');
      this.q.setFromEuler(this.e);
      this.m4.compose(this.v.set(b.x + Math.sin(time * 9 + b.phase) * 0.02, b.y + Math.sin(time * 13 + b.phase) * 0.015, b.z), this.q, this.big);
      this.bees.setMatrixAt(nb++, this.m4);
    }
    this.bees.count = nb;
    this.bees.instanceMatrix.needsUpdate = true;
  }
}
