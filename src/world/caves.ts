import { CAVES } from './layout';
import { rng } from './noise';
import type { Terrain } from './Terrain';

// ถ้ำ 2 แห่ง (รอบสอง ช่วง 11) · กติกาล้วน ไม่แตะภาพ · ผลเดิมทุกครั้ง
// แห่งแรก ถ้ำหินปูนที่ตีนเทือกเขาเหนือ: หินย้อย หินงอก มอสกับรากไม้ห้อยใกล้ปากถ้ำ หลุมยุบเปิดฟ้ามีลำแสง
//   แอ่งน้ำใต้ดินมีปลาไม่มีตา ค้างคาวในห้องลึก ภาพวาดรอยมือห้องปลายถ้ำ (ของเดิม)
// แห่งสอง ถ้ำเหมืองเก่าในหน้าผากลางป่าตะวันตก: ค้ำยันไม้ ราง รถเข็นแร่ ตะเกียง ช่วงถล่ม ค่ายพักเก่าปลายเหมือง
//   เห็ดเรืองแสง ก๊าซพิษในส่วนลึก (ของเดิม ย้ายมาอยู่ที่เหมือง) · พันปีผ่านไป ไม้ผุ เหล็กสนิม
// เดินได้เฉพาะในอุโมงค์ (ระยะเดินได้ แคบกว่าผนังที่เห็น ตัวละครกับกล้องไม่จมผนัง)

/** จุดบนแนวกลางอุโมงค์ · y = พื้นถ้ำ · top = ผิวดินข้างบน */
export interface CavePoint { x: number; z: number; y: number; r: number; top: number }

export interface Cave {
  id: number;
  kind: 'limestone' | 'mine';
  points: CavePoint[];
  /** ระยะจากปากถ้ำที่เริ่มมีก๊าซพิษ (สัดส่วน 0 ถึง 1) · 2 = ไม่มี */
  gasFrom: number;
}

/** ของในถ้ำ (ไว้วาดกับใส่ตัวชน) · กล่องตั้งตรง หมุนรอบแกนตั้ง */
export interface CaveFeature {
  kind: 'stalagmite' | 'stalactite' | 'column' | 'root' | 'pool' | 'sinkhole' | 'bat' | 'timber' | 'beam' | 'rail' | 'cart' | 'lantern' | 'collapse' | 'stove' | 'cot' | 'crate' | 'moss' | 'fern';
  x: number;
  y: number;
  z: number;
  /** ขนาดหลัก (รัศมี ความยาว) · ความสูง · มุมหันรอบแกนตั้ง */
  size: number;
  h: number;
  rot: number;
  /** ตัวชน: รัศมีวงกลม (0 = ไม่ชน) */
  solid: number;
}

/** รัศมีที่เดินได้ เทียบกับรัศมีอุโมงค์ (ผนังที่เห็นบางจุดยุบเข้ามาถึง 0.9 เท่า หักตัวละครกว้าง 0.3 ม.) */
const WALK = 0.8;

export function buildCaves(t: Terrain): Cave[] {
  return CAVES.map((c, id) => {
    const kind = id === 0 ? 'limestone' : 'mine';
    const pts: CavePoint[] = [];
    const n = 16;
    const outX = -Math.sin(c.dir);
    const outZ = -Math.cos(c.dir);
    // พื้นอุโมงค์เริ่มที่ระดับพื้นหน้าปากถ้ำ · อุโมงค์เริ่มเลยปากถ้ำออกมาแค่ 1 ม. (เดิม 4 ม. ยื่นออกนอกหน้าผา)
    const y0 = t.heightAt(c.x + outX * 6, c.z + outZ * 6);
    for (let i = 0; i <= n; i++) {
      const f = i / n;
      const along = 1 - f * (c.depth + 1);
      const wiggle = Math.sin(f * 7 + id) * 6 * f;
      const x = c.x + outX * along + outZ * wiggle;
      const z = c.z + outZ * along - outX * wiggle;
      let r: number;
      if (kind === 'limestone') {
        // ห้องหลุมยุบราว 40% ห้องแอ่งน้ำราว 70% กว้างกว่าทางเดิน ห้องปลายถ้ำกว้างสุด
        r = f > 0.85 ? 4.8 : Math.abs(f - 0.4) < 0.05 ? 4.2 : Math.abs(f - 0.7) < 0.06 ? 4.6 : 2.9 + Math.sin(f * 11) * 0.4;
      } else {
        // ทางเหมืองกว้างเท่า ๆ กัน ห้องค่ายพักปลายเหมือง
        r = f > 0.86 ? 4.2 : 2.5;
      }
      pts.push({ x, z, y: y0 - f * (kind === 'mine' ? 5 : 8), r, top: t.heightAt(x, z) });
    }
    return { id, kind, points: pts, gasFrom: kind === 'mine' ? 0.62 : 2 };
  });
}

/** จุดบนแนวกลางอุโมงค์ที่สัดส่วน f (0 ถึง 1) พร้อมทิศตามอุโมงค์กับรัศมี */
export function caveCenter(cave: Cave, f: number): { x: number; y: number; z: number; dx: number; dz: number; r: number; top: number } {
  const p = cave.points;
  const u = Math.max(0, Math.min(0.9999, f)) * (p.length - 1);
  const i = Math.floor(u);
  const s = u - i;
  const a = p[i];
  const b = p[i + 1];
  const l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
  return { x: a.x + (b.x - a.x) * s, y: a.y + (b.y - a.y) * s, z: a.z + (b.z - a.z) * s, dx: (b.x - a.x) / l, dz: (b.z - a.z) / l, r: a.r + (b.r - a.r) * s, top: a.top + (b.top - a.top) * s };
}

/** ตำแหน่งในถ้ำ: สัดส่วนจากปากถ้ำ 0 ถึง 1 และพื้นตรงนั้น · null = ไม่อยู่ในส่วนที่เดินได้ */
export function caveAt(caves: Cave[], x: number, z: number, widen = 0): { cave: Cave; f: number; floor: number; r: number; ceil: number; d: number } | null {
  let best: { cave: Cave; f: number; floor: number; r: number; ceil: number; d: number } | null = null;
  for (const cave of caves) {
    const p = cave.points;
    // ตรวจกรอบถ้ำก่อน (ถ้ำอยู่ห่างกันมาก ไม่ต้องวนทุกช่วง)
    const c0 = p[0];
    if (Math.abs(x - c0.x) > 120 || Math.abs(z - c0.z) > 120) continue;
    for (let i = 0; i < p.length - 1; i++) {
      const a = p[i];
      const b = p[i + 1];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const l2 = dx * dx + dz * dz;
      let s = ((x - a.x) * dx + (z - a.z) * dz) / l2;
      s = Math.max(0, Math.min(1, s));
      const px = a.x + dx * s;
      const pz = a.z + dz * s;
      const d = Math.hypot(x - px, z - pz);
      const r = a.r + (b.r - a.r) * s;
      if (d < r * WALK - 0.2 + widen && (!best || d < best.d)) {
        const floor = a.y + (b.y - a.y) * s;
        best = { cave, f: (i + s) / (p.length - 1), floor, r, ceil: floor + r * 1.6, d };
      }
    }
  }
  return best;
}

/**
 * จุดสูง y ที่ระยะห่างแกน d ยังอยู่ในโพรงที่มองเห็นไหม (ใช้กันกล้องทะลุผนัง)
 * ใช้รูปตัดเดียวกับตอนสร้างอุโมงค์ใน render/Caves.ts · หินปูนวงรี ผนังขรุขระยุบเข้ามาถึง 0.82 เท่า · เหมืองทรงเหลี่ยม
 */
export function insideTunnel(c: { cave: Cave; floor: number; r: number; d: number }, y: number): boolean {
  const lime = c.cave.kind === 'limestone';
  if (y < c.floor + 0.2) return false;
  const lat = c.d / (c.r * 1.1);
  const up = (y - c.floor - c.r * (lime ? 0.55 : 0.5)) / (c.r * (lime ? 1.25 : 1.05));
  return lat * lat + up * up < (lime ? 0.62 : 0.78);
}

/** อยู่เหนืออุโมงค์หรือใกล้ปากถ้ำไหม (ต้นไม้ หิน หญ้า ไม่ขึ้นตรงนี้ · เดิมต้นไม้บนเนินเหนืออุโมงค์กลายเป็นเสาล่องหนในอุโมงค์) */
export function overCave(caves: Cave[], x: number, z: number): boolean {
  return !!caveAt(caves, x, z, 4);
}

/** ของในถ้ำทั้งหมด · ทางเดินกลางอุโมงค์โล่งเสมอ */
export function caveFeatures(cave: Cave): CaveFeature[] {
  const r = rng(6151 + cave.id * 97);
  const out: CaveFeature[] = [];
  const at = (f: number, side: number, up: number) => {
    const c = caveCenter(cave, f);
    const sx = -c.dz;
    const sz = c.dx;
    return { x: c.x + sx * side * c.r, y: c.y + up, z: c.z + sz * side * c.r, c };
  };
  const add = (kind: CaveFeature['kind'], p: { x: number; y: number; z: number }, size: number, h: number, rot: number, solid = 0) =>
    out.push({ kind, x: p.x, y: p.y, z: p.z, size, h, rot, solid });
  if (cave.kind === 'limestone') {
    // หินงอกจากพื้นชิดผนัง หินย้อยจากเพดาน เสาหินที่ย้อยกับงอกมาชนกัน
    for (let k = 0; k < 70; k++) {
      const f = 0.12 + r() * 0.86;
      if (Math.abs(f - 0.4) < 0.05) continue;
      const side = (r() < 0.5 ? -1 : 1) * (0.45 + r() * 0.35);
      const p = at(f, side, 0);
      const ceil = p.c.r * 1.6 * (1 - Math.abs(side) * 0.45);
      const kind = r();
      const size = r();
      if (kind < 0.45) add('stalactite', { x: p.x, y: p.y + ceil, z: p.z }, 0.08 + size * 0.22, 0.4 + r() * 1.6, r() * 6.28);
      else if (Math.abs(f - 0.7) < 0.07) continue; // ห้องแอ่งน้ำ พื้นโล่ง
      else if (kind < 0.9) add('stalagmite', p, 0.12 + size * 0.3, 0.3 + r() * 1.4, r() * 6.28, 0.14 + size * 0.3);
      else add('column', p, 0.35 + size * 0.3, ceil, r() * 6.28, 0.4 + size * 0.3);
    }
    // มอสกับเฟิร์นช่วงปากถ้ำที่ยังได้แสง · รากไม้ห้อยจากเพดาน
    for (let k = 0; k < 26; k++) add('moss', at(r() * 0.2, (r() - 0.5) * 1.6, 0.02), 0.6 + r() * 1.2, 0.05, r() * 6.28);
    for (let k = 0; k < 10; k++) add('fern', at(0.02 + r() * 0.12, (r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.3), 0), 0.8 + r() * 0.5, 0.8, r() * 6.28);
    for (let k = 0; k < 22; k++) {
      const f = 0.04 + r() * 0.24;
      const side = (r() - 0.5) * 1.2;
      const p = at(f, side, 0);
      add('root', { x: p.x, y: p.y + p.c.r * 1.6 * (1 - Math.abs(side) * 0.4), z: p.z }, 0.04 + r() * 0.04, 1.2 + r() * 2.6, r() * 6.28);
    }
    // หลุมยุบเปิดฟ้า: ลำแสงลงมาที่พื้น ต้นไม้เล็กกับเฟิร์นขึ้นตรงที่แสงตก
    const sk = caveCenter(cave, 0.4);
    add('sinkhole', sk, 2.2, sk.top - sk.y, 0);
    for (let k = 0; k < 6; k++) add('fern', { x: sk.x + (r() - 0.5) * 3, y: sk.y, z: sk.z + (r() - 0.5) * 3 }, 0.9 + r() * 0.6, 0.9, r() * 6.28);
    for (let k = 0; k < 8; k++) add('moss', { x: sk.x + (r() - 0.5) * 4, y: sk.y + 0.02, z: sk.z + (r() - 0.5) * 4 }, 0.5 + r() * 0.8, 0.05, r() * 6.28);
    // แอ่งน้ำใต้ดิน ห้องราว 70% · ปลาไม่มีตาว่ายในแอ่ง (render/Caves.ts)
    const pl = caveCenter(cave, 0.7);
    // แอ่งน้ำลงไปไม่ได้ (ไม่มีน้ำให้ว่ายใต้ดิน) มีขอบหินกั้น เดินอ้อมได้อีกฝั่ง
    add('pool', { x: pl.x - pl.dz * 1.2, y: pl.y, z: pl.z + pl.dx * 1.2 }, 2.6, 0.9, Math.atan2(pl.dx, pl.dz), 2.4);
    // ค้างคาวเกาะเพดานห้องลึก บินวนเมื่อเข้าใกล้
    for (let k = 0; k < 16; k++) {
      const p = at(0.8 + r() * 0.18, (r() - 0.5) * 1.2, 0);
      add('bat', { x: p.x, y: p.y + p.c.r * 1.45, z: p.z }, 0.18, 0, r() * 6.28);
    }
  } else {
    // ค้ำยันไม้ทุกราว 3 ม.: เสาสองข้างกับคานบน ไม้ผุดำ บางชุดคานหักร่วงลงพื้น
    const len = Math.hypot(cave.points[cave.points.length - 1].x - cave.points[0].x, cave.points[cave.points.length - 1].z - cave.points[0].z);
    const step = 3 / Math.max(20, len);
    for (let f = 0.06; f < 0.86; f += step) {
      const c = caveCenter(cave, f);
      const rot = Math.atan2(c.dx, c.dz);
      const broken = r() < 0.18;
      for (const s of [-1, 1]) add('timber', { x: c.x - c.dz * s * c.r * 0.72, y: c.y, z: c.z + c.dx * s * c.r * 0.72 }, 0.14, broken && s > 0 ? 1.2 + r() : 2.6, rot, 0.2);
      if (!broken) add('beam', { x: c.x, y: c.y + 2.6, z: c.z }, c.r * 0.82, 0.22, rot);
      else add('beam', { x: c.x + c.dx * 0.8, y: c.y, z: c.z + c.dz * 0.8 }, c.r * 0.7, 0.2, rot + 0.5);
      // ตะเกียงสนิมแขวนบนเสา (พันปีแล้ว ไม่มีไฟ)
      if (r() < 0.3) add('lantern', { x: c.x - c.dz * c.r * 0.62, y: c.y + 2.1, z: c.z + c.dx * c.r * 0.62 }, 0.12, 0.25, rot);
    }
    // รางรถเข็นตามพื้น · รถเข็นแร่สองคัน คันหนึ่งคว่ำ
    add('rail', caveCenter(cave, 0), 0, 0, 0);
    for (const [f, tipped] of [[0.3, false], [0.68, true]] as const) {
      const c = caveCenter(cave, f);
      const off = tipped ? 0.9 : 0;
      add('cart', { x: c.x - c.dz * off, y: c.y, z: c.z + c.dx * off }, 0.7, tipped ? 1 : 0, Math.atan2(c.dx, c.dz), 0.85);
    }
    // ช่วงถล่ม: กองหินกับคานหักกองชิดผนังข้างหนึ่ง เหลือช่องให้ลอดผ่าน
    for (let k = 0; k < 7; k++) {
      const p = at(0.5 + r() * 0.06, -0.4 - r() * 0.45, 0);
      const size = 0.6 + r() * 0.7;
      add('collapse', p, size, 0.4 + r() * 1.1, r() * 6.28, size * 0.85);
    }
    // ค่ายพักเก่าปลายเหมือง: เตาเหล็ก โครงเตียง ลังไม้ผุเป็นกอง
    const camp = caveCenter(cave, 0.93);
    const cx = -camp.dz;
    const cz = camp.dx;
    add('stove', { x: camp.x + cx * 2.4, y: camp.y, z: camp.z + cz * 2.4 }, 0.4, 0.9, 0, 0.45);
    for (const s of [-1.2, 1.3]) add('cot', { x: camp.x - cx * 2.6 + camp.dx * s, y: camp.y, z: camp.z - cz * 2.6 + camp.dz * s }, 0.9, 0.35, Math.atan2(camp.dx, camp.dz));
    for (let k = 0; k < 4; k++) add('crate', { x: camp.x + cx * (r() - 0.5) * 4 + camp.dx * 2.6, y: camp.y, z: camp.z + cz * (r() - 0.5) * 4 + camp.dz * 2.6 }, 0.35 + r() * 0.2, 0.25 + r() * 0.3, r() * 6.28, 0.4);
  }
  return out;
}
