import { WORLD } from '../config/game';
import { ROAD, ROAD_WIDTH, SHIP, TOWN, distToPolyline, type P2 } from './layout';
import { rng } from './noise';

// ของมนุษย์ที่วางในโลก · ของใหญ่ (รถ เสาไฟ ป้าย) สแกนได้อย่างเดียว · ของชิ้นเล็กเก็บได้
// วางด้วยตัวสุ่มที่ตั้งเลขไว้ ผลเดิมทุกครั้ง

export interface Prop {
  /** รหัสไม่ซ้ำทั้งโลก */
  key: string;
  kind: string;
  x: number;
  z: number;
  rot: number;
  /** ชิ้นพิเศษ ปลดล็อกบันทึกส่วนตัว */
  special?: boolean;
  /** ข้อความบนป้าย (ภาษาอังกฤษ ป้ายเป็นของในโลกมนุษย์) */
  text?: string;
}

const SMALL_KINDS = ['teddy', 'phone', 'bottle', 'watch', 'glasses', 'frame', 'toycar', 'book', 'keys', 'coin'];

/** จุดบนถนนที่ระยะ t (0 ถึง 1) พร้อมทิศถนน */
function alongRoad(t: number): P2 & { dir: number } {
  const segs: number[] = [];
  let total = 0;
  for (let i = 0; i < ROAD.length - 1; i++) {
    const l = Math.hypot(ROAD[i + 1].x - ROAD[i].x, ROAD[i + 1].z - ROAD[i].z);
    segs.push(l);
    total += l;
  }
  let d = t * total;
  for (let i = 0; i < segs.length; i++) {
    if (d <= segs[i] || i === segs.length - 1) {
      const a = ROAD[i];
      const b = ROAD[i + 1];
      const f = Math.min(1, d / segs[i]);
      return { x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f, dir: Math.atan2(-(b.x - a.x), -(b.z - a.z)) };
    }
    d -= segs[i];
  }
  return { x: ROAD[0].x, z: ROAD[0].z, dir: 0 };
}

export const SIGN_TEXTS = [
  'PINE VALLEY  3 km',
  'HOSPITAL  2 km  →',
  'EVACUATION ROUTE  →',
  'LAST GAS  80 km',
  'BRIDGE OUT AHEAD',
  'CITY CENTER  ←',
  'SCHOOL ZONE  SLOW',
];

export function placeProps(): Prop[] {
  const r = rng(WORLD.seed + 404);
  const out: Prop[] = [];
  const side = (p: P2 & { dir: number }, off: number): P2 => ({ x: p.x + Math.cos(p.dir) * off, z: p.z - Math.sin(p.dir) * off });

  // รถร้างตามถนน · คันที่ 3 มีตุ๊กตาที่เบาะหลัง (ชิ้นพิเศษ)
  const carTs = [0.08, 0.17, 0.27, 0.38, 0.47, 0.6, 0.74, 0.88];
  carTs.forEach((t, i) => {
    const p = alongRoad(t);
    const s = side(p, (i % 2 ? 1 : -1) * (ROAD_WIDTH * 0.4 + r() * 1.5));
    out.push({ key: `car-${i}`, kind: 'car', x: s.x, z: s.z, rot: p.dir + (r() - 0.5) * 0.9, special: i === 2 });
  });
  // รถบัสในเมือง
  out.push({ key: 'bus-0', kind: 'bus', x: TOWN.x - 22, z: TOWN.z + 18, rot: 0.6 });
  // เสาไฟตามถนนช่วงใกล้เมือง
  for (let i = 0; i < 12; i++) {
    const p = alongRoad(0.3 + i * 0.035);
    const s = side(p, ROAD_WIDTH + 1.4);
    out.push({ key: `lamp-${i}`, kind: 'lamp', x: s.x, z: s.z, rot: p.dir + (r() - 0.5) * 0.25 });
  }
  // ตู้ไปรษณีย์ในเมือง · ใบแรกยังมีจดหมาย (ชิ้นพิเศษ)
  [[12, -6], [55, 20], [-8, 30]].forEach(([dx, dz], i) => out.push({ key: `mailbox-${i}`, kind: 'mailbox', x: TOWN.x + dx, z: TOWN.z + dz, rot: r() * 6.28, special: i === 0 }));
  // ป้ายถนนภาษาอังกฤษ บางป้ายชี้ผิดทาง
  const signTs = [0.04, 0.2, 0.33, 0.52, 0.64, 0.8, 0.95];
  signTs.forEach((t, i) => {
    const p = alongRoad(t);
    const s = side(p, ROAD_WIDTH + 2.2);
    out.push({ key: `sign-${i}`, kind: 'sign', x: s.x, z: s.z, rot: p.dir + (i === 1 ? 2.2 : 0), text: SIGN_TEXTS[i % SIGN_TEXTS.length] });
  });

  // ของชิ้นเล็ก: ข้างรถ ในเมือง ตามทาง
  let n = 0;
  const addSmall = (x: number, z: number, kind?: string, special = false) => {
    if (Math.hypot(x - SHIP.x, z - SHIP.z) < 20) return;
    const k = kind ?? SMALL_KINDS[Math.floor(r() * SMALL_KINDS.length)];
    out.push({ key: `item-${n++}`, kind: k, x, z, rot: r() * 6.28, special });
  };
  // ตุ๊กตาพิเศษในรถคันที่ 3 · โทรศัพท์พิเศษกับกรอบรูปพิเศษในเมือง
  const car3 = out.find((p) => p.key === 'car-2')!;
  addSmall(car3.x + 1.6, car3.z + 0.8, 'teddy', true);
  addSmall(TOWN.x + 6, TOWN.z - 14, 'phone', true);
  addSmall(TOWN.x - 18, TOWN.z - 4, 'frame', true);
  for (const c of out.filter((p) => p.kind === 'car')) for (let j = 0; j < 2; j++) addSmall(c.x + (r() - 0.5) * 6, c.z + (r() - 0.5) * 6);
  for (let j = 0; j < 32; j++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * TOWN.radius * 0.7;
    addSmall(TOWN.x + Math.cos(a) * d, TOWN.z + Math.sin(a) * d);
  }
  for (let j = 0; j < 12; j++) {
    const p = alongRoad(r());
    const s = side(p, (r() - 0.5) * 16);
    if (distToPolyline(s.x, s.z, ROAD) > 1) addSmall(s.x, s.z);
  }
  return out;
}

export const SMALL_PROP_KINDS = SMALL_KINDS;
