import * as THREE from 'three';
import { hash2, Simplex2 } from '../world/noise';
import { faceOffset, sharedMesaMap, type FacePoint, type Mesa, type MesaRock } from '../world/mesas';
import { applyDetail } from './detail';
import { disposeObject } from './dispose';

// ผนังหินของภูเขายอดตัด (พี่กันขอ 26 ต.ค. 2569 *"ภูเขาตำแหน่งนี้ ขอสมจริงกว่านี้"* · *"ภูเขาทรงๆนี้ในเเมทพ เเก้ด้วยนะ วาดทีละภูเขาได้"*)
// พื้นเก็บความสูงทุก 2 ม. ผนังที่ชันเกือบดิ่งจึงถูกเกลี่ยเป็นโดมมนเสมอ (ลองแล้ว ลายชั้นบนพื้นดูเหมือนเค้กหรือหม้อดิน)
// จึงปั้นผนังหินเป็นโมเดลวางทับแนวผาของแต่ละลูก: ชั้นหินแนวนอนยื่นเว้าทีละชั้น รอยต่อชั้นสีเข้ม เพิงหิน (หินปูน)
// หินยอดยื่นเป็นชายคา (หินทราย หินปูน) แผ่นหินปิดขอบบนมีมอส · หินแกรนิตไม่มีชั้น ผิวเป็นก้อนมน · หินดินดานชั้นบางถี่ ยื่นเว้านิดเดียว เอนตามลาด
// ตัวชนยังเป็นพื้น (ผนังอยู่หน้าพื้นไม่เกินราวครึ่งเมตร) · ปั้นเฉพาะลูกที่อยู่ใกล้ ลูกไกลคืนหน่วยความจำ

/** ปั้นผนังของลูกที่ขอบกรอบห่างตัวไม่เกินเท่านี้ · ไกลเกินอีกระยะคืนหน่วยความจำ (ม.) */
const NEAR = 450;
const FAR = 620;
/** ความหนาชั้นหิน (ม.) · หินดินดานแตกเป็นแผ่นบางถี่ */
const BED: Record<MesaRock, number> = { sandstone: 2.4, limestone: 1.8, granite: 2.4, shale: 0.9 };

/** สีหินตามชนิด (สีหลัก สีแซม) ตรงกับสีพื้นใน TerrainMesh */
const TINT: Record<MesaRock, [THREE.Color, THREE.Color]> = {
  sandstone: [new THREE.Color(0.45, 0.33, 0.22), new THREE.Color(0.55, 0.41, 0.27)],
  limestone: [new THREE.Color(0.52, 0.5, 0.45), new THREE.Color(0.6, 0.58, 0.52)],
  granite: [new THREE.Color(0.42, 0.4, 0.39), new THREE.Color(0.5, 0.46, 0.44)],
  shale: [new THREE.Color(0.27, 0.25, 0.23), new THREE.Color(0.33, 0.3, 0.27)],
};
const MOSS = new THREE.Color(0.22, 0.29, 0.12);
const LICHEN = new THREE.Color(0.48, 0.5, 0.42);
/** สีหญ้าบนยอด (ใกล้สีพื้นทุ่งหญ้าใน TerrainMesh) */
const GRASS = new THREE.Color(0.25, 0.33, 0.13);
/** หินยอดยื่นเป็นชายคา (ม.) · ชั้นหินยื่นเว้าได้มากสุด (ม.) */
const LIP: Record<MesaRock, number> = { sandstone: 0.7, limestone: 0.4, granite: 0, shale: 0 };
const RELIEF: Record<MesaRock, number> = { sandstone: 0.7, limestone: 0.45, granite: 0, shale: 0.2 };
/** คราบน้ำฝนไหลเป็นทางสีเข้มลงจากขอบบน (หินทรายชัดสุด) */
const STREAK: Record<MesaRock, number> = { sandstone: 0.38, limestone: 0.28, granite: 0.2, shale: 0.1 };

interface Ground {
  heightAt(x: number, z: number): number;
}

export class Cliffs {
  readonly group = new THREE.Group();
  private mesas = sharedMesaMap();
  /** ลูกที่ปั้นแล้ว (null = ลองแล้วไม่มีผนัง) */
  private built = new Map<number, THREE.Mesh | null>();
  private material = new THREE.MeshLambertMaterial({ vertexColors: true });
  private noise = new Simplex2(4242);

  constructor(private ground: Ground) {
    applyDetail(this.material, 'stone');
    // วัสดุใช้ร่วมกันทุกลูก ตอนคืนหน่วยความจำห้ามทิ้ง
    this.material.userData.shared = true;
  }

  /** จำนวนลูกที่ปั้นผนังอยู่ตอนนี้ (ตัวช่วยทดสอบ) */
  get shown(): number {
    let n = 0;
    for (const m of this.built.values()) if (m) n++;
    return n;
  }

  /** ปั้นลูกที่เข้าใกล้ทีละลูกต่อเฟรม (immediate = ปั้นทุกลูกในระยะเดี๋ยวนี้ ตอนเริ่มเกม วาร์ป) · คืนหน่วยความจำลูกที่ไกลแล้ว */
  update(x: number, z: number, immediate = false): void {
    const dist = (m: Mesa) => Math.hypot(Math.max(m.box[0] - x, 0, x - m.box[2]), Math.max(m.box[1] - z, 0, z - m.box[3]));
    for (const [id, mesh] of this.built) {
      if (dist(this.mesas.mesas[id]) > FAR) {
        if (mesh) disposeObject(mesh);
        this.built.delete(id);
      }
    }
    const want = this.mesas.mesas.filter((m) => !this.built.has(m.id) && dist(m) < NEAR).sort((a, b) => dist(a) - dist(b));
    for (const m of immediate ? want : want.slice(0, 1)) this.build(m);
  }

  private build(m: Mesa): void {
    const pos: number[] = [];
    const col: number[] = [];
    const idx: number[] = [];
    for (const tier of [0, 1]) for (const line of this.mesas.faceLines(m, tier)) this.strip(m, line, pos, col, idx);
    if (!idx.length) {
      this.built.set(m.id, null);
      return;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, this.material);
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    this.group.add(mesh);
    this.built.set(m.id, mesh);
  }

  /**
   * ผนังหนึ่งแถบตามแนวตีนผนัง: แถวความสูงตรงกันทั้งแถบ (ชั้นหินเป็นแนวราบตลอดผนัง) แต่ละเสาบีบแถวที่เกินตีนหรือขอบบนของตัวเองลงมา
   * แต่ละชั้นหิน 3 แถว: รอยต่อชั้น (เว้าเข้า สีเข้ม) · ต้นชั้น · กลางชั้น (ยื่นออกตามความแข็งของชั้นนั้น)
   * บนสุดเป็นหินยอดยื่นเป็นชายคา แล้วแผ่นหินปิดขอบบนเข้าไปบนยอด 1.4 ม.
   */
  private strip(m: Mesa, line: FacePoint[], pos: number[], col: number[], idx: number[]): void {
    const g = this.ground;
    const rock = m.rock;
    const bedH = BED[rock];
    const phase = hash2(m.id, 3, 91) * bedH;
    // ตีนกับขอบบนของแต่ละเสา (จากพื้นจริง ซึ่งรวมถนน แม่น้ำ ที่กดภูเขาลงแล้ว)
    const cols = line.map((p) => {
      const inX = -p.nx;
      const inZ = -p.nz;
      const yb = g.heightAt(p.x + p.nx * 0.8, p.z + p.nz * 0.8) - 0.5;
      const yt = Math.max(g.heightAt(p.x + inX * (p.fw + 0.3), p.z + inZ * (p.fw + 0.3)), g.heightAt(p.x + inX * (p.fw + 1.2), p.z + inZ * (p.fw + 1.2))) + 0.12;
      return { p, yb, yt, ok: yt - yb > 2.5 };
    });
    let lo = Infinity;
    let hi = -Infinity;
    for (const c of cols) if (c.ok) { lo = Math.min(lo, c.yb); hi = Math.max(hi, c.yt); }
    if (!(hi > lo)) return;
    // แถวความสูงตามชั้นหิน
    const rows: { y: number; kind: 'seam' | 'base' | 'body' }[] = [];
    for (let b = Math.floor((lo - phase) / bedH); phase + b * bedH < hi; b++) {
      const y0 = phase + b * bedH;
      rows.push({ y: y0, kind: 'seam' }, { y: y0 + 0.125 * bedH, kind: 'base' }, { y: y0 + 0.54 * bedH, kind: 'body' });
    }
    const R = rows.length;
    // ทุกเสามี R แถวผนัง + แถวชายคา + แถวปิดขอบบน
    const per = R + 2;
    const closed = Math.hypot(line[0].x - line[line.length - 1].x, line[0].z - line[line.length - 1].z) < 2.6;
    const c = new THREE.Color();
    let along = 0;
    const start = pos.length / 3;
    const usable: boolean[] = [];
    /** ต่อจุด: −1 แถวต่ำกว่าตีนผนังถูกบีบลงตีน · 1 แถวสูงกว่าขอบบนถูกบีบลงขอบ · 0 ปกติ (ช่องที่ถูกบีบทั้งสี่มุมไม่ต้องวาด) */
    const squeezed: number[] = [];
    cols.forEach((cl, i) => {
      if (i > 0) along += Math.hypot(cl.p.x - cols[i - 1].p.x, cl.p.z - cols[i - 1].p.z);
      usable.push(cl.ok);
      const { p, yb, yt } = cl;
      const span = Math.max(0.01, yt - yb);
      const shade = 0.9 + 0.2 * this.noise.noise(along / 9, m.id);
      for (let r = 0; r < per; r++) {
        let y: number;
        let d: number;
        let out = 0;
        squeezed.push(r < R ? (rows[r].y < yb ? -1 : rows[r].y > yt ? 1 : 0) : 0);
        if (r < R) {
          const row = rows[r];
          y = Math.min(yt, Math.max(yb, row.y));
          const w = (y - yb) / span;
          d = faceOffset(w, p.H, p.shape);
          const bed = Math.floor((row.y - phase) / bedH + 1e-6);
          const hard = hash2(m.id, bed, 92) - 0.5;
          if (rock === 'granite') {
            // หินแกรนิต: ผิวเป็นก้อนมนใหญ่ ไม่มีชั้น
            out = 0.55 * this.noise.noise(along / 7, y / 5);
          } else {
            out = row.kind === 'seam' ? -0.5 * RELIEF[rock] : hard * 2 * RELIEF[rock] * (row.kind === 'body' ? 1 : 0.7);
            out += 0.25 * this.noise.noise(along / 6, bed * 1.7);
          }
          // ใกล้ขอบบนยื่นเป็นชายคาหินยอด
          if (y > yt - 0.9) out += LIP[rock] * (1 - (yt - y) / 0.9);
          const [ta, tb] = TINT[rock];
          c.copy(hard > 0 ? ta : tb).multiplyScalar(shade * (1 + 0.24 * hard));
          if (row.kind === 'seam' && rock !== 'granite') c.multiplyScalar(0.72);
          // คราบน้ำไหลเป็นทางลงจากขอบบน เข้มที่บน จางลงล่าง
          const streak = Math.max(0, this.noise.noise(along / 2.6 + m.id, 0.3) - 0.15) * STREAK[rock] * (0.4 + 0.6 * w);
          c.multiplyScalar(1 - streak);
          // ตีนผนังชื้นเข้มกว่า มีมอส · ไลเคนเป็นหย่อม
          c.lerp(MOSS, 0.25 * (1 - Math.min(1, (y - yb) / 2.5)));
          c.lerp(LICHEN, 0.3 * Math.max(0, this.noise.noise(along / 13 + 50, y / 9)));
        } else if (r === R) {
          // ขอบชายคา
          y = yt;
          d = p.fw - LIP[rock] * 0.5;
          c.copy(TINT[rock][0]).multiplyScalar(shade * 0.92).lerp(MOSS, 0.4);
        } else {
          // แผ่นหินปิดขอบบน เข้าไปบนยอด ขอบในเป็นสีหญ้ากลืนกับพื้นบนยอด (เดิมสีหินอ่อน เห็นเป็นแถบเหมือนทางเดินรอบขอบผา)
          y = yt + 0.04;
          d = p.fw + 1.4;
          c.copy(GRASS).multiplyScalar(shade);
        }
        const k = d - out - 0.35;
        pos.push(p.x - p.nx * k, y, p.z - p.nz * k);
        col.push(c.r, c.g, c.b);
      }
    });
    const n = cols.length;
    const segs = closed ? n : n - 1;
    const first = idx.length;
    for (let i = 0; i < segs; i++) {
      const j = (i + 1) % n;
      if (!usable[i] || !usable[j]) continue;
      for (let r = 0; r < per - 1; r++) {
        const a = start + i * per + r;
        const b = start + j * per + r;
        const s = squeezed[a - start];
        if (s !== 0 && s === squeezed[a + 1 - start] && s === squeezed[b - start] && s === squeezed[b + 1 - start]) continue;
        // หน้าผาหันออกนอกภูเขา: เรียงจุดตามทิศเส้น (เส้นชั้นเดินทวนหรือตามเข็มก็ได้ จึงเช็กทิศจริงด้านล่าง)
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    // เช็กว่าหน้าสามเหลี่ยมหันออกนอกภูเขา ถ้ากลับด้านให้สลับทั้งแถบ
    const p0 = line[0];
    const p1 = line[1];
    const tx = p1.x - p0.x;
    const tz = p1.z - p0.z;
    // หน้าที่สร้าง (a, b, a+1): เส้นตาม t แล้วขึ้นตามแกน y → ทิศหน้า = t × y
    const fx = -tz;
    const fz = tx;
    if (fx * p0.nx + fz * p0.nz < 0) {
      for (let q = first; q < idx.length; q += 3) {
        const t = idx[q + 1];
        idx[q + 1] = idx[q + 2];
        idx[q + 2] = t;
      }
    }
  }
}
