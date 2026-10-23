import { WORLD } from '../config/game';
import { BRIDGE, RIVER, RIVER_WIDTH, ROAD, ROADS, ROAD_WIDTH, SHIP, TOWN, TOWN_STREETS, distToPolyline, type P2 } from './layout';
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
  /** แบบของโมเดล (สีรถ) */
  variant?: number;
  /** ความสูงที่วาง (ของในตึกวางบนพื้นชั้นนั้น) · ไม่ใส่ = วางบนพื้นดิน */
  y?: number;
}

/**
 * รหัสของในโลกผูกกับชนิดและตำแหน่งปัดเป็นเมตร ไม่ผูกกับลำดับการสุ่ม
 * (เดิม item-12 car-3 · เปลี่ยนผังโลกแล้วรหัสเดิมชี้ไปของคนละชิ้น ของที่เก็บแล้วงอกคืน)
 */
export const propKey = (kind: string, x: number, z: number): string => `${kind}@${Math.round(x)},${Math.round(z)}`;

const SMALL_KINDS = ['teddy', 'phone', 'bottle', 'watch', 'glasses', 'frame', 'toycar', 'book', 'keys', 'coin'];

/** จุดบนถนนที่ระยะ t (0 ถึง 1) พร้อมทิศถนน */
function alongRoad(t: number, road: P2[] = ROAD): P2 & { dir: number } {
  const segs: number[] = [];
  let total = 0;
  for (let i = 0; i < road.length - 1; i++) {
    const l = Math.hypot(road[i + 1].x - road[i].x, road[i + 1].z - road[i].z);
    segs.push(l);
    total += l;
  }
  let d = t * total;
  for (let i = 0; i < segs.length; i++) {
    if (d <= segs[i] || i === segs.length - 1) {
      const a = road[i];
      const b = road[i + 1];
      const f = Math.min(1, d / segs[i]);
      return { x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f, dir: Math.atan2(-(b.x - a.x), -(b.z - a.z)) };
    }
    d -= segs[i];
  }
  return { x: road[0].x, z: road[0].z, dir: 0 };
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
  const put = (kind: string, at: P2, rot: number, extra: Partial<Prop> = {}) => {
    const key = propKey(kind, at.x, at.z);
    if (out.some((o) => o.key === key)) return null;
    const p: Prop = { key, kind, x: at.x, z: at.z, rot, ...extra };
    out.push(p);
    return p;
  };
  const nearBridge = (q: P2) => Math.hypot(q.x - BRIDGE.x, q.z - BRIDGE.z) < 40 || distToPolyline(q.x, q.z, RIVER) < RIVER_WIDTH + 16;

  // รถร้างตามถนนหลวง 3 กม. กับถนนเข้าเมือง · คันที่ 3 มีตุ๊กตาที่เบาะหลัง (ชิ้นพิเศษ) · ไม่จอดบนสะพานหรือในแม่น้ำ
  const cars: Prop[] = [];
  const carTs = [0.05, 0.11, 0.16, 0.23, 0.29, 0.34, 0.38, 0.43, 0.47, 0.52, 0.58, 0.63, 0.69, 0.75, 0.82, 0.9, 0.96];
  carTs.forEach((t, i) => {
    let p = alongRoad(t);
    if (nearBridge(p)) p = alongRoad(t + 0.025);
    const s = side(p, (i % 2 ? 1 : -1) * (ROAD_WIDTH * 0.4 + r() * 1.5));
    const c = put('car', s, p.dir + (r() - 0.5) * 0.9, { variant: i, special: i === 2 });
    if (c) cars.push(c);
  });
  [0.35, 0.7].forEach((t, i) => {
    const p = alongRoad(t, ROADS[1]);
    const c = put('car', side(p, ROAD_WIDTH * 0.5), p.dir + (r() - 0.5) * 0.6, { variant: 20 + i });
    if (c) cars.push(c);
  });
  // ถนนในเมืองคดเคี้ยว (layout.ts TOWN_STREETS) · ไม่จอดรถหรือปักเสาไฟตรงทางแยก
  const offCross = (q: P2, si: number) => TOWN_STREETS.every((l, k) => k === si || distToPolyline(q.x, q.z, l) > 9);
  // รถบัสจอดริมถนนสายหลักกลางเมือง หันตามถนน
  const bp = alongRoad(0.45, TOWN_STREETS[0]);
  put('bus', side(bp, 3.0), bp.dir + 0.05);
  // รถเก๋งจอดริมถนนในเมือง บางคันจอดเบี้ยว
  TOWN_STREETS.forEach((line, si) => {
    for (const t of si < 3 ? [0.18, 0.52, 0.8] : [0.5]) {
      const p = alongRoad((t + si * 0.07) % 1, line);
      if (!offCross(p, si)) continue;
      const off = (si + Math.round(t * 10)) % 2 ? 3.3 : -3.3;
      const c = put('car', side(p, off), p.dir + (off < 0 ? Math.PI : 0) + (r() - 0.5) * 0.6, { variant: 30 + si * 3 + Math.round(t * 3) });
      if (c) cars.push(c);
    }
  });
  // เสาไฟริมถนนในเมือง ราว 36 ม. ต้น สลับฝั่ง
  TOWN_STREETS.forEach((line, si) => {
    let L = 0;
    for (let i = 0; i < line.length - 1; i++) L += Math.hypot(line[i + 1].x - line[i].x, line[i + 1].z - line[i].z);
    for (let d = 14, k = 0; d < L - 6; d += 36, k++) {
      const p = alongRoad(d / L, line);
      if (offCross(p, si)) put('lamp', side(p, (k + si) % 2 ? 5 : -5), p.dir + ((k + si) % 2 ? Math.PI / 2 : -Math.PI / 2));
    }
  });
  // เสาไฟตามถนนเข้าเมือง กับถนนหลวงช่วงแยกเข้าเมือง
  for (let i = 0; i < 9; i++) {
    const p = alongRoad(0.08 + i * 0.11, ROADS[1]);
    put('lamp', side(p, (i % 2 ? 1 : -1) * (ROAD_WIDTH + 1.4)), p.dir + (r() - 0.5) * 0.25);
  }
  for (let i = 0; i < 8; i++) {
    const p = alongRoad(0.44 + i * 0.012);
    if (!nearBridge(p)) put('lamp', side(p, ROAD_WIDTH + 1.4), p.dir + (r() - 0.5) * 0.25);
  }
  // ตู้ไปรษณีย์ริมถนนสายหลัก · ใบแรกยังมีจดหมาย (ชิ้นพิเศษ)
  [0.36, 0.5, 0.63].forEach((t, i) => {
    const p = alongRoad(t, TOWN_STREETS[0]);
    put('mailbox', side(p, i % 2 ? 5 : -5), p.dir + (i % 2 ? Math.PI / 2 : -Math.PI / 2), { special: i === 0 });
  });
  // ป้ายถนนภาษาอังกฤษ บางป้ายชี้ผิดทาง
  const signTs = [0.04, 0.2, 0.33, 0.47, 0.64, 0.8, 0.95];
  signTs.forEach((t, i) => {
    let p = alongRoad(t);
    if (nearBridge(p) && i !== 3) p = alongRoad(t + 0.02);
    put('sign', side(p, ROAD_WIDTH + 2.2), p.dir + (i === 1 ? 2.2 : 0), { text: SIGN_TEXTS[i % SIGN_TEXTS.length] });
  });

  // ของชิ้นเล็ก: ข้างรถ ในเมือง ตามทาง
  const addSmall = (x: number, z: number, kind?: string, special = false) => {
    if (Math.hypot(x - SHIP.x, z - SHIP.z) < 20) return;
    const k = kind ?? SMALL_KINDS[Math.floor(r() * SMALL_KINDS.length)];
    put(k, { x, z }, r() * 6.28, { special });
  };
  // ตุ๊กตาพิเศษในรถคันที่ 3 · ของในเมืองย้ายเข้าไปอยู่ในห้องของตึก (world/town.ts) รวมโทรศัพท์กับกรอบรูปพิเศษ
  const car3 = cars.find((c) => c.special)!;
  addSmall(car3.x + 1.6, car3.z + 0.8, 'teddy', true);
  // ของตกข้างรถ (รถในเมืองวางข้างรถฝั่งถนน ไม่ตกในตึก)
  for (const c of cars) for (let j = 0; j < 2; j++) {
    const inTown = Math.hypot(c.x - TOWN.x, c.z - TOWN.z) < TOWN.radius * 1.3;
    addSmall(c.x + (r() - 0.5) * 6, inTown ? c.z + (r() - 0.5) * 2 : c.z + (r() - 0.5) * 6);
  }
  for (let j = 0; j < 24; j++) {
    const p = alongRoad(r());
    const s = side(p, (r() - 0.5) * 16);
    if (distToPolyline(s.x, s.z, ROAD) > 1 && !nearBridge(s)) addSmall(s.x, s.z);
  }
  // พันปีผ่านไป เสาไฟเหล็กส่วนใหญ่ผุล้มลงนอนกับพื้น (variant 1 = ล้ม) ที่ยังยืนก็เอียง
  for (const o of out) if (o.kind === 'lamp') o.variant = r() < 0.7 ? 1 : 0;
  return out;
}

export const SMALL_PROP_KINDS = SMALL_KINDS;
