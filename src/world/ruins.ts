import { FOREST_ROADS, PYLON_LINE, RAILWAY, SITES, distToRoads, type P2 } from './layout';
import { rng } from './noise';
import { lineLength, pointAlong, rectsOverlap, toWorld, type Building, type BuildingType, type TownBox, type TownExtra } from './townPlan';

// อารยธรรมที่ถูกป่ากลืน (รอบสอง ช่วง 10) · โลกหลังมนุษย์หายไปราวพันปี (docs/DESIGN.md ส่วน 0.1)
// หมู่บ้านกลางป่า · ทางรถไฟร้างกับขบวนรถที่ต้นไม้ขึ้นทะลุ · สถานีรถไฟ · ปั๊มน้ำมันริมถนนหลวง · โรงเลื่อย
// ที่ทำการอุทยานกับลานกางเต็นท์ · หอดูไฟป่าคอนกรีตเดินบันไดขึ้นได้ · แนวเสาไฟฟ้าแรงสูงล้ม · ซากรถในป่า
// กติกาล้วน ไม่แตะภาพ · ผลเดิมทุกครั้ง · ตึกใช้ตัวสร้างตึกของเมือง (เข้าได้ทุกหลัง) · ที่เหลือเป็นกล่องชุดเดียวกับตัวชน

type Extra = Omit<TownExtra, 'y'>;
type Plan = Omit<Building, 'y'>;

/** ต้นไม้ที่ต้องขึ้นตรงจุดนั้นจริง ๆ (ทะลุตู้รถไฟ ทะลุหลังคารถ) · ใส่เพิ่มหลังโปรยต้นไม้ปกติ */
export interface ForcedTree { x: number; z: number; kind: string; height: number }

export interface RuinsPlan {
  buildings: Plan[];
  extras: Extra[];
  trees: ForcedTree[];
  /** ซากรถในป่า (world/props.ts วาง) */
  wrecks: { x: number; z: number; rot: number; tree: boolean }[];
}

const RUST = 0x5a3a28;
const RUST_DARK = 0x3e2a1e;
const CONCRETE = 0x8a867c;
const STONE = [0x77736a, 0x6e6a62, 0x847f76];

let cached: RuinsPlan | null = null;

export function planRuins(): RuinsPlan {
  if (cached) return cached;
  const r = rng(77321);
  const buildings: Plan[] = [];
  const extras: Extra[] = [];
  const trees: ForcedTree[] = [];
  const wrecks: RuinsPlan['wrecks'] = [];
  let n = 500;
  const taken: { x: number; z: number; w: number; d: number; rot: number }[] = [];
  const clearOfRoads = (rc: { x: number; z: number; w: number; d: number; rot: number }, gap = 5.6) =>
    [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]].every(([a, b]) => {
      const p = toWorld(rc, (a * rc.w) / 2, (b * rc.d) / 2);
      return distToRoads(p.x, p.z) > gap;
    });
  const building = (type: BuildingType, x0: number, z0: number, w: number, d: number, rot: number, floors: number, decay: 0 | 1 | 2, sign?: string, storey = 3) => {
    // ล้ำถนนหรือชนของอื่น ขยับไปตามแนวกว้างของตึกทีละ 6 ม. (ลองสามครั้ง)
    let rc = { x: x0, z: z0, w, d, rot };
    for (let k = 0; k < 4; k++) {
      const shift = [0, 6, -6, 12][k];
      rc = { x: x0 + Math.cos(rot) * shift, z: z0 - Math.sin(rot) * shift, w, d, rot };
      if (clearOfRoads(rc, 4.5) && !taken.some((o) => rectsOverlap(o, rc, 2))) break;
      if (k === 3) return false;
    }
    const { x, z } = rc;
    taken.push(rc);
    buildings.push({
      key: `building-${n++}`, type, x, z, w, d, rot, floors: decay === 2 ? 1 : floors, storey, ruined: decay > 0, sign, tone: r(), decay, zone: 'forest', street: true,
      h: decay === 2 ? 2.6 : floors * storey + 0.3, style: decay > 0 ? 'ruin' : 'shelter',
    });
    return true;
  };
  const extra = (kind: Extra['kind'], key: string, x: number, z: number, w: number, d: number, rot: number, boxes: TownBox[], sign?: Extra['sign']) => {
    extras.push({ key, kind, x, z, w, d, rot, boxes, sign });
    if (kind !== 'railway' && kind !== 'pylon') taken.push({ x, z, w, d, rot });
  };
  const B = (list: TownBox[]) => (x: number, z: number, hx: number, hz: number, y0: number, y1: number, color: number, kind: TownBox['kind'] = 'furn') => {
    if (hx > 0.01 && hz > 0.01 && y1 > y0 + 0.01) list.push({ x, z, hx, hz, y0, y1, kind, color });
  };

  // ---------- หมู่บ้านกลางป่า: บ้านเรียงสองฝั่งถนนป่าเก่า เกือบทั้งหมดเหลือแต่ตอผนัง ----------
  const lane = FOREST_ROADS[0].slice(3);
  const L = lineLength(lane);
  for (const side of [-1, 1]) {
    for (let s = 6 + r() * 6; s < L - 8; s += 14 + r() * 12) {
      const w = 8 + r() * 3;
      const d = 8.5 + r() * 2.5;
      const p = pointAlong(lane, s + w / 2);
      const nx = side * -p.dz;
      const nz = side * p.dx;
      const back = 6.5 + r() * 5 + d / 2;
      const rc = { x: p.x + nx * back, z: p.z + nz * back, w, d, rot: Math.atan2(nx, nz) + (r() - 0.5) * 0.12 };
      if (!clearOfRoads(rc)) continue;
      building('house', rc.x, rc.z, w, d, rc.rot, r() < 0.3 ? 2 : 1, r() < 0.7 ? 2 : 1);
    }
  }
  // โบสถ์เล็กปลายหมู่บ้าน (หินหนา ยังยืนอยู่ หลังคาหาย)
  {
    // ตั้งต่อจากปลายถนน หันประตูกลับมาทางถนน
    const p = pointAlong(lane, L - 4);
    const rc = { x: p.x + p.dx * 16, z: p.z + p.dz * 16, w: 10, d: 18, rot: Math.atan2(p.dx, p.dz) };
    if (clearOfRoads(rc)) building('church', rc.x, rc.z, 10, 18, rc.rot, 1, 1, undefined, 6.5);
  }

  // ---------- ปั๊มน้ำมันริมถนนหลวง ----------
  {
    const g = SITES.gasStation;
    const boxes: TownBox[] = [];
    const box = B(boxes);
    for (const sx of [-4.2, 4.2]) for (const sz of [-2.6, 2.6]) box(sx, sz, 0.22, 0.22, 0, 4.6, CONCRETE, 'wall');
    // หลังคาสี่แผ่น แผ่นหนึ่งพังลงมากองข้างล่าง
    for (const [tx, tz] of [[-2.5, -1.5], [2.5, -1.5], [-2.5, 1.5], [2.5, 1.5]] as const) {
      if (tx > 0 && tz > 0) { box(tx, tz, 2.2, 1.3, 0, 0.6, 0x77736a, 'rubble'); continue; }
      box(tx, tz, 2.5, 1.5, 4.6, 4.95, 0x7a776e, 'roof');
    }
    box(0, 0, 3.2, 0.5, 0, 0.2, CONCRETE, 'floor');
    for (const px of [-1.6, 1.6]) box(px, 0, 0.32, 0.24, 0.2, 0.2 + 1.2 + r() * 0.3, RUST);
    extra('gasCanopy', 'gasCanopy-0', g.x, g.z + 7, 10, 6, 0, boxes);
    building('gasStation', g.x, g.z - 9, 11, 11, Math.PI, 1, 1, 'GAS');
  }

  // ---------- โรงเลื่อย: โรงใหญ่หลังคาหาย ออฟฟิศเหลือแต่ตอ ลานไม้ซุงผุเป็นเนิน ----------
  {
    const m = SITES.sawmill;
    building('warehouse', m.x, m.z, 22, 28, Math.PI, 1, 1, 'PINE VALLEY LUMBER', 6);
    building('house', m.x + 26, m.z + 28, 8, 7, Math.PI, 1, 2);
    const boxes: TownBox[] = [];
    const box = B(boxes);
    for (let k = 0; k < 6; k++) box(-4 + (k % 3) * 4.2, -3 + Math.floor(k / 3) * 4, 1.6 + r() * 0.6, 0.55, 0, 0.5 + r() * 0.6, 0x5e4a32, 'rubble');
    box(4.5, 3, 2.2, 0.6, 0, 1.0, RUST);
    box(4.5, 3, 0.05, 0.9, 1.0, 1.9, RUST_DARK);
    extra('sawyard', 'sawyard-0', m.x - 22, m.z + 18, 16, 12, 0, boxes);
  }

  // ---------- ที่ทำการอุทยาน ห้องน้ำ ลานกางเต็นท์ ----------
  {
    const g = SITES.ranger;
    building('house', g.x, g.z, 12, 9, Math.PI, 1, 0, 'RANGER STATION');
    building('house', g.x + 24, g.z - 14, 5, 4, Math.PI, 1, 1);
    const c = SITES.camp;
    const boxes: TownBox[] = [];
    const box = B(boxes);
    // วงหินก่อไฟ
    for (const [fx, fz] of [[-7, -3], [-1, 4], [6, -2], [9, 5]] as const) {
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * Math.PI * 2;
        box(fx + Math.cos(a) * 0.75, fz + Math.sin(a) * 0.75, 0.16, 0.14, 0, 0.18 + r() * 0.08, STONE[k % 3]);
      }
    }
    // โต๊ะปิกนิกปูน (ไม้ผุหาย เหลือขาปูนกับหน้าโต๊ะปูนบางตัว)
    for (const [tx, tz] of [[-4, 1], [3, 1.5], [0, -5]] as const) {
      for (const s2 of [-0.7, 0.7]) box(tx + s2, tz, 0.12, 0.35, 0, 0.72, CONCRETE);
      if (r() < 0.6) box(tx, tz, 0.95, 0.4, 0.72, 0.8, CONCRETE);
    }
    // ป้ายแผนที่อุทยานล้มนอนกับพื้น
    box(-10, -6, 0.75, 0.05, 0, 0.12, RUST);
    box(-10, -5.2, 0.06, 0.06, 0, 0.5, RUST_DARK);
    extra('campsite', 'campsite-0', c.x, c.z, 24, 16, 0, boxes);
  }

  // ---------- หอดูไฟป่าคอนกรีต: บันไดพันรอบแกนกลาง 9 ช่วง ห้องดูไฟบนยอด ราว 30 ม. ----------
  {
    const t = SITES.lookout;
    const boxes: TownBox[] = [];
    const box = B(boxes);
    const CORE = 1.8;
    const LANE = 1.2;
    const OUT = CORE + LANE;
    const FLIGHTS = 9;
    const RISE = 3;
    const TOP = FLIGHTS * RISE;
    box(0, 0, CORE, CORE, 0, TOP, CONCRETE, 'wall');
    const mid = CORE + LANE / 2;
    for (let f = 0; f < FLIGHTS; f++) {
      const side = f % 4;
      const base = f * RISE;
      for (let i = 0; i < 12; i++) {
        const along = -CORE + 0.15 + i * 0.3;
        const top = base + (i + 1) * 0.25;
        // ขั้นเป็นแผ่นหนา 0.3 ม. (ใต้บันไดโล่ง เดินลอดช่วงบนได้)
        const [x, z, hx, hz, rx, rz, rhx, rhz] =
          side === 0 ? [along, -mid, 0.15, LANE / 2, along, -OUT + 0.04, 0.15, 0.04]
          : side === 1 ? [mid, along, LANE / 2, 0.15, OUT - 0.04, along, 0.04, 0.15]
          : side === 2 ? [-along, mid, 0.15, LANE / 2, -along, OUT - 0.04, 0.15, 0.04]
          : [-mid, -along, LANE / 2, 0.15, -OUT + 0.04, -along, 0.04, 0.15];
        box(x, z, hx, hz, top - 0.3, top, CONCRETE, 'stair');
        // ราวกันตกปูนเตี้ยตามขอบนอกของขั้น (ขั้นบันไดแบบผนังทึบ)
        box(rx, rz, rhx, rhz, top, top + 1.0, 0x7e7a70, 'wall');
      }
      // ชานพักที่มุมหลังบันไดช่วงนี้
      const top = base + RISE;
      const cx = side === 0 || side === 1 ? mid : -mid;
      const cz = side === 1 || side === 2 ? mid : -mid;
      box(cx, cz, LANE / 2, LANE / 2, top - 0.3, top, CONCRETE, 'floor');
      if (f < FLIGHTS - 1) {
        box(cx + Math.sign(cx) * (LANE / 2 - 0.04), cz, 0.04, LANE / 2, top, top + 1.0, 0x7e7a70, 'wall');
        box(cx, cz + Math.sign(cz) * (LANE / 2 - 0.04), LANE / 2, 0.04, top, top + 1.0, 0x7e7a70, 'wall');
      }
    }
    // ห้องดูไฟบนยอด: พื้นรอบแกน เว้นช่องบันไดช่วงสุดท้าย ผนังเตี้ยรอบขอบ เสาสี่มุม หลังคา
    const lastSide = (FLIGHTS - 1) % 4;
    const ring: [number, number, number, number][] = [[0, -mid, CORE, LANE / 2], [mid, 0, LANE / 2, CORE], [0, mid, CORE, LANE / 2], [-mid, 0, LANE / 2, CORE]];
    ring.forEach(([x, z, hx, hz], s2) => { if (s2 !== lastSide) box(x, z, hx, hz, TOP - 0.3, TOP, CONCRETE, 'floor'); });
    for (const [x, z] of [[-mid, -mid], [mid, -mid], [-mid, mid], [mid, mid]] as const) box(x, z, LANE / 2, LANE / 2, TOP - 0.3, TOP, CONCRETE, 'floor');
    for (const [x, z, hx, hz] of [[0, -OUT + 0.06, OUT, 0.06], [0, OUT - 0.06, OUT, 0.06], [-OUT + 0.06, 0, 0.06, OUT], [OUT - 0.06, 0, 0.06, OUT]] as const) box(x, z, hx, hz, TOP, TOP + 1.05, 0x7e7a70, 'wall');
    for (const [x, z] of [[-OUT, -OUT], [OUT, -OUT], [-OUT, OUT], [OUT, OUT]] as const) box(x * 0.97, z * 0.97, 0.14, 0.14, TOP, TOP + 2.6, CONCRETE, 'wall');
    box(0, 0, OUT + 0.4, OUT + 0.4, TOP + 2.6, TOP + 2.9, 0x6e6a62, 'roof');
    extra('lookout', 'lookout-0', t.x, t.z, OUT * 2 + 1, OUT * 2 + 1, 0.3, boxes);
  }

  // ---------- ทางรถไฟร้าง: รางสนิมขาดเป็นช่วง หมอนปูนจมดินบ้าง ----------
  {
    const RL = lineLength(RAILWAY);
    let k = 0;
    for (let s = 0; s < RL - 4; s += 8, k++) {
      const p = pointAlong(RAILWAY, s + 4);
      const rot = Math.atan2(-p.dz, p.dx);
      const boxes: TownBox[] = [];
      const box = B(boxes);
      for (const rz of [-0.72, 0.72]) if (r() > 0.1) box(0, rz, 4 * (0.6 + r() * 0.4), 0.035, 0.1, 0.24, RUST, 'wall');
      for (let q = -3.6; q <= 3.6; q += 0.8) if (r() > 0.18) box(q, 0, 0.11, 1.25, 0, 0.13, 0x7a766c, 'floor');
      extra('railway', `railway-${k}`, p.x, p.z, 8, 2.6, rot, boxes);
    }
  }

  // ---------- ขบวนรถไฟร้างกลางป่า: หัวรถจักรกับตู้สินค้า 4 ตู้ ตู้ที่ 2 กับ 4 มีต้นไม้ขึ้นทะลุหลังคา ----------
  {
    // หาระยะบนรางที่ใกล้จุดตั้งขบวนที่สุด
    const RL = lineLength(RAILWAY);
    let s0 = 0;
    let best = Infinity;
    for (let s = 0; s < RL; s += 2) {
      const p = pointAlong(RAILWAY, s);
      const d = Math.hypot(p.x - SITES.train.x, p.z - SITES.train.z);
      if (d < best) { best = d; s0 = s; }
    }
    const cars = [{ len: 16, loco: true }, { len: 14 }, { len: 14 }, { len: 14 }, { len: 14 }];
    let s = s0 - 38;
    cars.forEach((car, i) => {
      const p = pointAlong(RAILWAY, s + car.len / 2);
      const off = i === 3 ? 0.9 : 0; // ตู้ที่ 4 ตกรางเยื้องออกไป
      const rot = Math.atan2(-p.dz, p.dx) + (i === 3 ? 0.08 : 0);
      const x = p.x - p.dz * off;
      const z = p.z + p.dx * off;
      const boxes: TownBox[] = [];
      const box = B(boxes);
      const hl = car.len / 2;
      // แคร่ล้อสองชุด
      for (const bx of [-hl + 2.2, hl - 2.2]) box(bx, 0, 1.4, 1.25, 0, 0.95, RUST_DARK, 'wall');
      box(0, 0, hl, 1.5, 0.95, 1.2, RUST, 'floor');
      if (car.loco) {
        box(-1.5, 0, hl - 3, 1.25, 1.2, 3.6, RUST, 'wall');
        // ห้องคนขับท้ายรถ ผนังมีช่องหน้าต่าง
        for (const sz of [-1.5, 1.5]) {
          box(hl - 2.2, sz, 1.6, 0.06, 1.2, 2.4, RUST, 'wall');
          box(hl - 2.2, sz, 1.6, 0.06, 3.4, 4.3, RUST, 'wall');
        }
        box(hl - 0.62, 0, 0.06, 1.5, 1.2, 4.3, RUST, 'wall');
        box(hl - 2.2, 0, 1.7, 1.6, 4.3, 4.45, RUST_DARK, 'roof');
        box(-hl + 3, 0, 0.3, 0.3, 3.6, 4.3, RUST_DARK, 'wall');
      } else {
        const treeHere = i === 1 || i === 4;
        for (const sz of [-1.45, 1.45]) {
          // ประตูเลื่อนเปิดค้างกลางตู้ด้านหนึ่ง
          if (sz > 0) {
            box(-hl / 2 - 0.5, sz, hl / 2 - 0.5, 0.05, 1.2, 3.8, RUST, 'wall');
            box(hl / 2 + 0.5, sz, hl / 2 - 0.5, 0.05, 1.2, 3.8, RUST, 'wall');
          } else box(0, sz, hl, 0.05, 1.2, 3.8, RUST, 'wall');
        }
        for (const ex of [-hl + 0.05, hl - 0.05]) box(ex, 0, 0.05, 1.45, 1.2, 3.8, RUST, 'wall');
        // หลังคา ตู้ที่มีต้นไม้ขึ้นทะลุ หลังคากลางตู้พังหาย
        if (treeHere) {
          box(-hl * 0.65, 0, hl * 0.35, 1.5, 3.8, 3.92, RUST_DARK, 'roof');
          box(hl * 0.65, 0, hl * 0.35, 1.5, 3.8, 3.92, RUST_DARK, 'roof');
          trees.push({ x, z, kind: r() < 0.5 ? 'birch' : 'oak', height: 13 + r() * 6 });
        } else box(0, 0, hl, 1.5, 3.8, 3.92, RUST_DARK, 'roof');
      }
      extra('train', `train-${i}`, x, z, car.len, 3.1, rot, boxes);
      s += car.len + 1.2;
    });
  }

  // ---------- สถานีรถไฟร้างปลายราง ชานชาลาปูน ----------
  {
    const st = SITES.station;
    building('house', st.x - 14, st.z - 10, 14, 8, -Math.PI / 2, 1, 1, 'PINE VALLEY STATION');
    const boxes: TownBox[] = [];
    const box = B(boxes);
    box(0, 0, 20, 1.75, 0, 0.9, CONCRETE, 'floor');
    for (let k = 0; k < 4; k++) box(-15 + k * 10, -1.2, 0.12, 0.12, 0.9, 1.4 + r(), RUST);
    // ชานชาลาอยู่ข้างราง (ห่างรางราว 1 ม.) ระหว่างรางกับตัวสถานี
    extra('platform', 'platform-0', st.x - 6.3, st.z - 22, 40, 3.5, -Math.PI / 2, boxes);
  }

  // ---------- แนวเสาไฟฟ้าแรงสูง: เหล็กโครงล้มนอนกับพื้นทุกต้น เหลือฐานปูนสี่ก้อน ----------
  {
    const line = PYLON_LINE;
    const len = Math.hypot(line[1].x - line[0].x, line[1].z - line[0].z);
    const dx = (line[1].x - line[0].x) / len;
    const dz = (line[1].z - line[0].z) / len;
    let k = 0;
    for (let s = 60; s < len - 40; s += 150, k++) {
      const x = line[0].x + dx * s;
      const z = line[0].z + dz * s;
      if (distToRoads(x, z) < 22) continue;
      const boxes: TownBox[] = [];
      const box = B(boxes);
      // ฐานปูนสี่ก้อน
      for (const sx of [-2.6, 2.6]) for (const sz of [-2.6, 2.6]) box(sx, sz, 0.45, 0.45, 0, 0.5, CONCRETE, 'wall');
      // โครงเหล็กล้มไปทางแกน x ของจุดนี้ ยาว 30 ม. กรอบสี่เหลี่ยมเล็กลงไปทางยอด
      const LEN = 30;
      for (let f = 0; f <= 10; f++) {
        const at = 1 + (f / 10) * LEN;
        const half = 2.4 * (1 - f / 13);
        const y0 = 0.1;
        box(at, -half, 0.06, 0.06, y0, y0 + half * 2, RUST, 'wall');
        box(at, half, 0.06, 0.06, y0, y0 + half * 2, RUST, 'wall');
        box(at, 0, 0.06, half, y0, y0 + 0.12, RUST, 'wall');
        box(at, 0, 0.06, half, y0 + half * 2 - 0.12, y0 + half * 2, RUST, 'wall');
        if (f < 10) {
          const nh = 2.4 * (1 - (f + 1) / 13);
          const mh = (half + nh) / 2;
          for (const [cz, cy] of [[-mh, y0], [mh, y0], [-mh, y0 + mh * 2], [mh, y0 + mh * 2]] as const) box(at + LEN / 20, cz, LEN / 20, 0.05, cy, cy + 0.1, RUST_DARK, 'wall');
        }
      }
      extra('pylon', `pylon-${k}`, x, z, 34, 6, r() * Math.PI * 2, boxes);
    }
  }

  // ---------- ซากรถในป่า: ตามถนนป่าเก่ากับกลางป่า บางคันต้นไม้ขึ้นทะลุหลังคา ----------
  for (const line of FOREST_ROADS) {
    const LL = lineLength(line);
    for (let s = 40 + r() * 30; s < LL - 20; s += 110 + r() * 70) {
      const p = pointAlong(line, s);
      const off = (r() < 0.5 ? -1 : 1) * (2 + r() * 2.5);
      const x = p.x - p.dz * off;
      const z = p.z + p.dx * off;
      const tree = r() < 0.3;
      wrecks.push({ x, z, rot: Math.atan2(-p.dx, -p.dz) + (r() - 0.5) * 1.2, tree });
      if (tree) trees.push({ x, z, kind: 'birch', height: 12 + r() * 6 });
    }
  }
  cached = { buildings, extras, trees, wrecks };
  return cached;
}

/** จุดสำคัญของซากนอกเมือง (แผนที่ใหญ่ใช้ติดชื่อ) */
export const RUIN_PLACES: { key: string; at: P2 }[] = [
  { key: 'placeVillage', at: SITES.village },
  { key: 'placeGas', at: SITES.gasStation },
  { key: 'placeSawmill', at: SITES.sawmill },
  { key: 'placeRanger', at: SITES.ranger },
  { key: 'placeLookout', at: SITES.lookout },
  { key: 'placeTrain', at: SITES.train },
  { key: 'placeStation', at: SITES.station },
];
