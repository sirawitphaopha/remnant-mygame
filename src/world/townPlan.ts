import { BUILDING } from '../config/scale';
import { WORLD } from '../config/game';
import { RIVER, TOWN, TOWN_STREETS, distToPolyline, distToRoads, type P2 } from './layout';
import { rng } from './noise';
import { TOWN_FOREST, TOWN_RES, townZone, type TownZone } from './townZone';

// เมืองเก่าหลังมนุษย์หายไปราวพันปี (รอบสอง ช่วง 8 และ 9) · กติกาล้วน ไม่แตะภาพ · ผลเดิมทุกครั้ง
// เมืองโตเองตามถนนคดเคี้ยว (layout.ts TOWN_STREETS) ไม่ใช่ตาราง · ตึกขนาดไม่เท่ากัน ระยะถอยร่นไม่เท่ากัน มีที่ดินว่าง
// ใจกลางเมืองร้านค้ากับตึกราชการ · ย่านบ้านรอบนอก · ถัดออกไปเป็นป่าที่กลืนบ้านไปแล้ว ซากบ้านกระจายอยู่ในป่า (townZone.ts)
// ทุกตึกเดินเข้าได้ ผุพังสามระดับ: ยังมีหลังคาแต่รั่ว · หลังคาหายชั้นบนพัง · เหลือแต่ตอผนังกับกองซาก
// ของที่เป็นไม้ ผ้า กระดาษผุหายไปเกือบหมด เหลือของเหล็กสนิมเขรอะกับของปูน
// ตัวชนกับภาพใช้กล่องชุดเดียวกัน (TownBox) จึงตรงกันเสมอ

export type BuildingType =
  | 'house' | 'townhouse' | 'shop' | 'diner' | 'grocery' | 'hardware' | 'postOffice' | 'clinic'
  | 'police' | 'fireStation' | 'school' | 'church' | 'warehouse' | 'motel' | 'gasStation';

/** ขนาดตึกแต่ละชนิด (กว้างตามถนน × ลึก) จำนวนชั้น ป้ายภาษาอังกฤษ */
const TYPE: Record<BuildingType, { w: [number, number]; d: [number, number]; floors: [number, number]; sign?: string; tall?: number }> = {
  house: { w: [8, 11], d: [9, 11], floors: [1, 2] },
  townhouse: { w: [6, 7], d: [11, 13], floors: [2, 3] },
  shop: { w: [10, 14], d: [14, 18], floors: [1, 2], sign: 'GENERAL STORE' },
  diner: { w: [12, 14], d: [12, 14], floors: [1, 1], sign: 'DINER' },
  grocery: { w: [16, 20], d: [18, 22], floors: [1, 1], sign: 'GROCERY' },
  hardware: { w: [12, 16], d: [16, 20], floors: [1, 1], sign: 'HARDWARE' },
  postOffice: { w: [14, 16], d: [14, 18], floors: [1, 2], sign: 'POST OFFICE' },
  clinic: { w: [14, 18], d: [16, 20], floors: [2, 2], sign: 'CLINIC' },
  police: { w: [14, 16], d: [16, 18], floors: [2, 2], sign: 'POLICE' },
  fireStation: { w: [16, 18], d: [18, 20], floors: [2, 2], sign: 'FIRE DEPT', tall: 4.2 },
  school: { w: [28, 32], d: [16, 20], floors: [2, 2], sign: 'PINE VALLEY SCHOOL' },
  church: { w: [11, 13], d: [22, 26], floors: [1, 1], sign: 'ST. MARY CHURCH', tall: 6.5 },
  warehouse: { w: [22, 26], d: [26, 30], floors: [1, 1], sign: 'STORAGE', tall: 6 },
  motel: { w: [28, 32], d: [10, 11], floors: [2, 2], sign: 'MOTEL' },
  gasStation: { w: [10, 12], d: [10, 12], floors: [1, 1], sign: 'GAS' },
};

export interface Building {
  key: string;
  type: BuildingType;
  x: number;
  z: number;
  /** ความกว้าง (แกนตามถนน) ความลึก ความสูงรวม */
  w: number;
  d: number;
  h: number;
  /** หมุนรอบแกนตั้ง · ด้านหน้า (ประตู) หันไปทาง -z ของตึก */
  rot: number;
  /** ความสูงพื้นชั้นล่าง */
  y: number;
  floors: number;
  /** ความสูงต่อชั้น */
  storey: number;
  /** ตึกพัง หลังคากับชั้นบนพังบางส่วน */
  ruined: boolean;
  sign?: string;
  /** โทนสีผนัง 0 ถึง 1 */
  tone: number;
  /** ชนิดเดิมที่ภาพเดิมใช้ (ทึบ พัง หลบหนาว) ยังมีไว้ให้โค้ดเดิมอ่าน */
  style: 'solid' | 'ruin' | 'shelter';
  /** ความผุพัง 0 = ยังมีหลังคาแต่รั่ว · 1 = หลังคาหาย ชั้นบนสุดพัง · 2 = เหลือแต่ตอผนังกับกองซาก */
  decay: 0 | 1 | 2;
  /** เขตของเมืองที่ตึกตั้งอยู่ */
  zone: TownZone;
  /** ตั้งเรียงตามแนวถนน (false = ซากบ้านกลางป่า ถนนเก่าจมดินไปแล้ว หันไปทางไหนก็ได้) */
  street: boolean;
}

/** กล่องหนึ่งชิ้นของตึก ในพิกัดของตึก (x ตามความกว้าง z ตามความลึก y จากพื้นชั้นล่าง) */
export interface TownBox {
  x: number;
  z: number;
  y0: number;
  y1: number;
  hx: number;
  hz: number;
  kind: 'wall' | 'inner' | 'floor' | 'roof' | 'stair' | 'furn' | 'glass' | 'rubble';
  color: number;
}

/** ของชิ้นเล็กในห้อง (เก็บได้) พิกัดในตึก */
export interface RoomItem { x: number; z: number; y: number; kind: string; special?: boolean }

// ---------- วางตึก ----------

/** ที่ว่างในเมืองที่ไม่ใช่ตึก (สวนกลางเมือง สุสาน สนามเด็กเล่น หอส่งน้ำ) */
export type ExtraKind = 'park' | 'cemetery' | 'playground' | 'waterTower'
  // อารยธรรมนอกเมือง (world/ruins.ts)
  | 'gasCanopy' | 'pylon' | 'lookout' | 'train' | 'campsite' | 'railway' | 'platform' | 'sawyard';

export interface TownExtra {
  key: string;
  kind: ExtraKind;
  x: number;
  z: number;
  w: number;
  d: number;
  rot: number;
  /** ความสูงพื้น (ผู้เรียกใส่เอง) */
  y: number;
  /** กล่องในพิกัดของที่ดิน (ด้านหน้าติดถนนอยู่ทาง -z) */
  boxes: TownBox[];
  /** ป้าย (ชื่อเมืองบนถังน้ำ) */
  sign?: { text: string; x: number; y: number; z: number; w: number };
}

/** ความยาวเส้นถนน */
export function lineLength(line: P2[]): number {
  let L = 0;
  for (let i = 0; i < line.length - 1; i++) L += Math.hypot(line[i + 1].x - line[i].x, line[i + 1].z - line[i].z);
  return L;
}

/** จุดบนเส้นถนนที่ระยะ s เมตรจากต้นเส้น พร้อมทิศถนน (หน่วย) */
export function pointAlong(line: P2[], s: number): { x: number; z: number; dx: number; dz: number } {
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i];
    const b = line[i + 1];
    const l = Math.hypot(b.x - a.x, b.z - a.z);
    if (s <= l || i === line.length - 2) {
      const f = Math.max(0, Math.min(1, s / l));
      return { x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f, dx: (b.x - a.x) / l, dz: (b.z - a.z) / l };
    }
    s -= l;
  }
  return { x: line[0].x, z: line[0].z, dx: 1, dz: 0 };
}

interface Rect { x: number; z: number; w: number; d: number; rot: number }

/** สี่เหลี่ยมหมุนได้สองอันทับกันไหม (เผื่อระยะห่าง gap) · แยกแกน 4 แกน */
export function rectsOverlap(a: Rect, b: Rect, gap: number): boolean {
  const ax = [Math.cos(a.rot), -Math.sin(a.rot)];
  const az = [Math.sin(a.rot), Math.cos(a.rot)];
  const bx = [Math.cos(b.rot), -Math.sin(b.rot)];
  const bz = [Math.sin(b.rot), Math.cos(b.rot)];
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  for (const u of [ax, az, bx, bz]) {
    const ra = (a.w / 2 + gap / 2) * Math.abs(ax[0] * u[0] + ax[1] * u[1]) + (a.d / 2 + gap / 2) * Math.abs(az[0] * u[0] + az[1] * u[1]);
    const rb = (b.w / 2 + gap / 2) * Math.abs(bx[0] * u[0] + bx[1] * u[1]) + (b.d / 2 + gap / 2) * Math.abs(bz[0] * u[0] + bz[1] * u[1]);
    if (Math.abs(dx * u[0] + dz * u[1]) > ra + rb) return false;
  }
  return true;
}

/** มุมกับกึ่งกลางขอบของสี่เหลี่ยม (ไว้ตรวจว่าล้ำถนนไหม) */
function rim(rc: Rect): { x: number; z: number }[] {
  const out: { x: number; z: number }[] = [];
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]]) out.push(toWorld(rc, (a * rc.w) / 2, (b * rc.d) / 2));
  return out;
}

/** ห่างกลางถนนถึงหน้าตึกอย่างน้อยเท่านี้ (ครึ่งถนน 4.5 + ทางเท้า) */
const SETBACK = 5.9;
/** ขอบตึกห่างกลางถนนทุกเส้นอย่างน้อยเท่านี้ */
const ROAD_CLEAR = 5.6;

/** ตำแหน่งที่ดินบนแนวถนนตามระยะจากต้นถนนกับฝั่ง · ด้านหน้า (-z ในพิกัดที่ดิน) หันเข้าถนน */
function lotAt(line: P2[], s: number, side: number, w: number, d: number, setback: number): Rect {
  const p = pointAlong(line, s + w / 2);
  const nx = side * -p.dz;
  const nz = side * p.dx;
  return { x: p.x + nx * (setback + d / 2), z: p.z + nz * (setback + d / 2), w, d, rot: Math.atan2(nx, nz) };
}

/** ที่ดินนี้ไม่ล้ำถนน ไม่ลงแม่น้ำ อยู่ในเขตเมือง */
function landOk(rc: Rect): boolean {
  if (rim(rc).some((p) => distToRoads(p.x, p.z) < ROAD_CLEAR)) return false;
  if (distToPolyline(rc.x, rc.z, RIVER) < 30 + Math.hypot(rc.w, rc.d) / 2) return false;
  return townZone(rc.x, rc.z) !== 'out';
}

/** ที่ว่างในเมือง: ถนนเส้นไหน เริ่มหาจากระยะเท่าไร ฝั่งไหน ขนาดเท่าไร */
const EXTRA_SPOTS: { kind: ExtraKind; street: number; s: number; side: -1 | 1; w: number; d: number }[] = [
  { kind: 'park', street: 0, s: 150, side: 1, w: 30, d: 22 },
  { kind: 'playground', street: 2, s: 18, side: -1, w: 24, d: 18 },
  { kind: 'waterTower', street: 5, s: 6, side: 1, w: 11, d: 11 },
  { kind: 'cemetery', street: 4, s: 55, side: 1, w: 34, d: 24 },
];

/** ผังที่ว่างทั้งหมดในเมือง (ยังไม่รู้ความสูงพื้น ผู้เรียกใส่ y เอง) */
export function planExtras(): Omit<TownExtra, 'y'>[] {
  const out: Omit<TownExtra, 'y'>[] = [];
  EXTRA_SPOTS.forEach((sp, i) => {
    const line = TOWN_STREETS[sp.street];
    const L = lineLength(line);
    for (const side of [sp.side, -sp.side]) {
      for (let s = sp.s; s < L - sp.w; s += 4) {
        const rc = lotAt(line, s, side, sp.w, sp.d, SETBACK + 1);
        if (!landOk(rc) || out.some((o) => rectsOverlap(o, rc, 3))) continue;
        const e: Omit<TownExtra, 'y'> = { key: `${sp.kind}-${i}`, kind: sp.kind, ...rc, boxes: [] };
        extraParts(e, rng(5501 + i * 97));
        out.push(e);
        return;
      }
    }
  });
  return out;
}

/** ตึกที่ทนกว่า (ปูน หิน อิฐหนา) */
const STURDY = new Set<BuildingType>(['church', 'school', 'police', 'postOffice', 'clinic', 'fireStation', 'warehouse']);

/** ผังตึกทั้งเมือง (ยังไม่รู้ความสูงพื้น ผู้เรียกใส่ y เอง) */
export function planTown(): Omit<Building, 'y'>[] {
  const r = rng(WORLD.seed + 818);
  const out: Omit<Building, 'y'>[] = [];
  const taken: Rect[] = planExtras().map((e) => ({ x: e.x, z: e.z, w: e.w, d: e.d, rot: e.rot }));
  // ตึกพิเศษที่มีอย่างละหนึ่ง วางในใจกลางเมืองก่อน ที่เหลือวางย่านบ้าน
  const civic: BuildingType[] = ['postOffice', 'clinic', 'police', 'fireStation', 'diner', 'grocery', 'hardware', 'gasStation', 'church', 'school', 'warehouse', 'motel'];
  let n = 0;
  const fits = (rc: Rect) => landOk(rc) && !taken.some((o) => rectsOverlap(o, rc, 2));
  const add = (type: BuildingType, rc: Rect, zone: TownZone, street = true) => {
    const t = TYPE[type];
    let floors = t.floors[0] + Math.floor(r() * (t.floors[1] - t.floors[0] + 1));
    const storey = t.tall ?? BUILDING.storey;
    // ความผุพังตามเขตกับความทนของตึก · ป่ารอบนอกเหลือแต่ซาก
    const roll = r();
    const decay: 0 | 1 | 2 = zone === 'forest' || zone === 'field' ? (roll < 0.72 ? 2 : 1)
      : STURDY.has(type) ? (roll < 0.42 ? 0 : roll < 0.86 ? 1 : 2)
      : roll < 0.2 ? 0 : roll < 0.6 ? 1 : 2;
    if (decay === 2) floors = 1;
    out.push({
      key: `building-${n++}`, type, x: rc.x, z: rc.z, w: rc.w, d: rc.d, rot: rc.rot, floors, storey,
      ruined: decay > 0, sign: t.sign, tone: r(), decay, zone, street,
      h: decay === 2 ? 2.6 : floors * storey + 0.3, style: decay > 0 ? 'ruin' : 'shelter',
    });
    taken.push(rc);
  };
  // 1) ตึกเรียงสองฝั่งถนนทุกเส้น ระยะห่างไม่เท่ากัน ที่ดินว่างมากขึ้นเมื่อห่างใจกลาง
  for (const line of TOWN_STREETS) {
    const L = lineLength(line);
    for (const side of [-1, 1]) {
      let s = 3 + r() * 9;
      while (s < L - 6) {
        const p = pointAlong(line, s);
        const zone = townZone(p.x, p.z);
        if (zone === 'out') { s += 10; continue; }
        const wantCivic = civic.length > 0 && (zone === 'core' ? r() < 0.55 : zone === 'res' && r() < 0.3);
        let type: BuildingType;
        if (wantCivic) type = civic[0];
        else if (zone === 'core') type = r() < 0.55 ? 'shop' : 'townhouse';
        else if (zone === 'res') type = r() < 0.72 ? 'house' : 'townhouse';
        else type = 'house';
        const t = TYPE[type];
        const w = t.w[0] + r() * (t.w[1] - t.w[0]);
        const d = t.d[0] + r() * (t.d[1] - t.d[0]);
        const empty = zone === 'core' ? 0.1 : zone === 'res' ? 0.3 : zone === 'field' ? 0.8 : 0.5;
        const setback = SETBACK + r() * (zone === 'core' ? 1.2 : zone === 'res' ? 3.5 : 7);
        const rc = lotAt(line, s, side, w, d, setback);
        // คนสร้างแต่ละหลังวางเบี้ยวจากแนวถนนไม่เท่ากัน
        rc.rot += (r() - 0.5) * 0.06;
        if ((wantCivic || r() >= empty) && fits(rc)) {
          add(type, rc, zone);
          if (wantCivic) civic.shift();
        }
        s += w + (zone === 'core' ? 1.5 + r() * 5 : zone === 'res' ? 3 + r() * 9 : 6 + r() * 18);
      }
    }
  }
  // 2) ซากบ้านกระจายในป่ารอบนอก ถนนเก่าจมดินหมดแล้ว หันไปคนละทาง
  for (let k = 0, tries = 0; k < 28 && tries < 900; tries++) {
    const a = r() * Math.PI * 2;
    const dist = TOWN_RES * 0.95 + r() * (TOWN_FOREST - TOWN_RES * 0.95);
    const x = TOWN.x + Math.cos(a) * dist;
    const z = TOWN.z + Math.sin(a) * dist * 1.2;
    const zone = townZone(x, z);
    if (zone !== 'forest' && !(zone === 'field' && r() < 0.2)) continue;
    const t = TYPE.house;
    const rc = { x, z, w: t.w[0] + r() * (t.w[1] - t.w[0]), d: t.d[0] + r() * (t.d[1] - t.d[0]), rot: r() * Math.PI * 2 };
    if (!fits(rc)) continue;
    add('house', rc, zone, false);
    k++;
  }
  return out;
}

// ---------- ข้างในตึก ----------

const WALL = 0.3;
const INNER = 0.14;
const SLAB = 0.22;
const DOOR_W = BUILDING.doorWidth;
const DOOR_H = BUILDING.doorHeight;

const TONES = [0xd8d2c4, 0xc9b99a, 0xa9b8c0, 0xd6c48e, 0x9a5a48, 0xb8b4aa, 0x8e8a80];

/** กล่องทั้งหมดของตึกหนึ่งหลัง กับของชิ้นเล็กในห้อง · seed ตามรหัสตึก ผลเดิมทุกครั้ง */
export function buildingParts(b: Pick<Building, 'key' | 'type' | 'w' | 'd' | 'floors' | 'storey' | 'decay' | 'tone'>): { boxes: TownBox[]; items: RoomItem[]; stairs: { x: number; z: number }[] } {
  const r = rng(Number(b.key.split('-')[1]) * 7919 + 13);
  const boxes: TownBox[] = [];
  const items: RoomItem[] = [];
  const hw = b.w / 2;
  const hd = b.d / 2;
  const dec = b.decay;
  // สีผนังซีดหม่นลงตามเวลา (สีทาหลุดเหลือเนื้อปูน)
  const wallColor = weather(TONES[Math.floor(b.tone * TONES.length) % TONES.length], 0.35);
  const innerColor = 0xa8a294;
  // พื้นมีดินกับใบไม้ทับถม ตึกที่หลังคาหายพื้นเป็นดิน
  const floorColor = dec > 0 ? 0x4a4032 : b.type === 'clinic' || b.type === 'diner' ? 0x86847c : 0x5e5040;
  const box = (x: number, z: number, hx: number, hz: number, y0: number, y1: number, kind: TownBox['kind'], color: number) => {
    if (hx > 0.01 && hz > 0.01 && y1 > y0 + 0.01) boxes.push({ x, z, hx, hz, y0, y1, kind, color });
  };
  const put = box;
  const H = b.storey;
  const stairsAt: { x: number; z: number }[] = [];
  /** ทางเดินของชั้นบนสุด (เศษปูนของตึกพังห้ามกองขวาง) */
  let topClear: [number, number, number, number][] = [];
  // บันไดชิดผนังหลังขวา กว้าง 1.2 ม. ขั้นสูง 0.25 ลึก 0.3 · ชานพักหลังบันได 1 ม.
  // ชั้นคู่ใช้ช่องขวาสุด ขึ้นไปทางหลังตึก · ชั้นคี่ใช้ช่องถัดไปทางซ้าย ขึ้นย้อนกลับมาทางหน้าตึก (บันไดพับ)
  // บันไดไม่ซ้อนกัน หัวไม่ชนบันไดชั้นบน · ขึ้นถึงชานพักแล้วเลี้ยวขึ้นช่วงถัดไปได้ทันที
  // พื้นชั้นบนเว้นช่องเฉพาะเหนือขั้นบันได ชานพักกับพื้นรอบ ๆ ยังอยู่
  const stairW = 1.2;
  const steps = Math.round(H / 0.25);
  const run = steps * 0.3;
  const laneX = (f: number) => hw - WALL - 0.1 - stairW / 2 - (f % 2) * (stairW + 0.2);
  const sz0 = hd - WALL - 1.0 - run;
  const roomEdge = b.floors > 1 ? laneX(b.floors > 2 ? 1 : 0) - stairW / 2 - 0.25 : hw - WALL;

  for (let f = 0; f < b.floors; f++) {
    const y = f * H;
    const ruinedHere = dec > 0 && f === b.floors - 1;
    // ทางเดินผ่านประตู (ข้างหน้าและข้างหลังประตู) กับทางขึ้นลงบันได ห้ามวางเฟอร์นิเจอร์หรือผนังห้องขวาง
    // (เดิมเคาน์เตอร์ครัวชิดผนังหน้าบังประตูบ้าน ผนังห้องผ่ากลางประตูหน้าสถานีตำรวจ)
    const keepClear: [number, number, number, number][] = [];
    if (f === b.floors - 1) topClear = keepClear;
    if (b.floors > 1) {
      keepClear.push([roomEdge - 1.6, sz0 + run - 0.2, hw, hd]);
      keepClear.push([roomEdge - 1.6, sz0 - 1.8, hw, sz0 + 0.2]);
    }
    // พื้น · ชั้นบนเว้นช่องบันได
    if (f === 0) box(0, 0, hw, hd, 0, 0.15, 'floor', floorColor);
    else {
      const slab = (x0: number, x1: number, z0: number, z1: number) => box((x0 + x1) / 2, (z0 + z1) / 2, (x1 - x0) / 2, (z1 - z0) / 2, y - SLAB, y, 'floor', floorColor);
      const lx = laneX(f - 1);
      const hx0 = lx - stairW / 2 - 0.1;
      const hx1 = lx + stairW / 2 + 0.1;
      slab(-hw, hx0, -hd, hd);
      slab(hx1, hw, -hd, hd);
      slab(hx0, hx1, -hd, sz0);
      slab(hx0, hx1, sz0 + run, hd);
    }
    // ผนังนอก 4 ด้าน มีช่องหน้าต่างทุกราว 3 ม. · ด้านหน้าชั้นล่างมีประตู
    const walls: [number, number, number, 'x' | 'z'][] = [[0, -hd + WALL / 2, b.w, 'x'], [0, hd - WALL / 2, b.w, 'x'], [-hw + WALL / 2, 0, b.d, 'z'], [hw - WALL / 2, 0, b.d, 'z']];
    walls.forEach(([cx, cz, len, axis], wi) => {
      const front = wi === 0;
      const big = b.type === 'fireStation' || b.type === 'warehouse' || b.type === 'gasStation';
      const doorW = front && f === 0 ? (big ? 3.6 : b.type === 'shop' || b.type === 'grocery' || b.type === 'diner' ? 1.8 : DOOR_W) : 0;
      const doorH = big && front && f === 0 ? Math.min(H - 0.4, 3.8) : DOOR_H;
      const nWin = Math.max(1, Math.floor((len - 2) / 3.2));
      const openings: { c: number; w: number; y0: number; y1: number }[] = [];
      if (doorW) {
        openings.push({ c: 0, w: doorW, y0: 0.15, y1: doorH });
        keepClear.push([-doorW / 2 - 0.4, -hd, doorW / 2 + 0.4, -hd + 1.8]);
      }
      for (let k = 0; k < nWin; k++) {
        const c = -len / 2 + (len / (nWin + 1)) * (k + 1);
        if (doorW && Math.abs(c) < doorW / 2 + 1.0) continue;
        openings.push({ c, w: 1.2, y0: BUILDING.windowSill, y1: Math.min(H - 0.5, 2.3) });
      }
      openings.sort((a, b2) => a.c - b2.c);
      let at = -len / 2;
      const seg = (c0: number, c1: number, y0: number, y1: number) => {
        if (c1 - c0 < 0.02) return;
        if (dec === 2) {
          // เหลือแต่ตอผนังสูงต่ำไม่เท่ากัน บางช่วงพังหายทั้งช่วง
          if (y0 > 0.95 || r() < 0.2) return;
          y1 = Math.min(y1, 0.35 + r() * 2.1);
        } else if (ruinedHere && r() < 0.6) {
          // ชั้นบนสุดของตึกหลังคาหาย ผนังพังเป็นช่วง ๆ ขอบบนแหว่ง
          y1 = y0 + (y1 - y0) * (0.2 + r() * 0.6);
        } else if (r() < (dec === 0 ? 0.05 : 0.1)) {
          // ผนังเป็นรูโหว่ อิฐร่วงลงมา
          y1 = y0 + (y1 - y0) * (0.3 + r() * 0.5);
        }
        const mid = (c0 + c1) / 2;
        if (axis === 'x') box(cx + mid, cz, (c1 - c0) / 2, WALL / 2, y + y0, y + y1, 'wall', wallColor);
        else box(cx, cz + mid, WALL / 2, (c1 - c0) / 2, y + y0, y + y1, 'wall', wallColor);
      };
      for (const o of openings) {
        seg(at, o.c - o.w / 2, 0, H);
        seg(o.c - o.w / 2, o.c + o.w / 2, 0, o.y0);
        seg(o.c - o.w / 2, o.c + o.w / 2, o.y1, H);
        // กระจกแทบไม่เหลือ ตึกที่ยังมีหลังคาเหลือบ้างสักบาน
        if (o.y0 > 0.5 && dec === 0 && r() < 0.06) {
          if (axis === 'x') box(cx + o.c, cz, o.w / 2, 0.02, y + o.y0, y + o.y1, 'glass', 0x2a3438);
          else box(cx, cz + o.c, 0.02, o.w / 2, y + o.y0, y + o.y1, 'glass', 0x2a3438);
        }
        at = o.c + o.w / 2;
      }
      seg(at, len / 2, 0, H);
    });
    // ห้อง: แบ่งพื้นที่ (เว้นช่องบันได) ด้วยผนังข้างในที่มีประตู
    const big = b.type === 'warehouse' || b.type === 'church' || b.type === 'grocery' || b.type === 'fireStation' || b.type === 'gasStation';
    const rooms: [number, number, number, number][] = [];
    const split = (x0: number, z0: number, x1: number, z1: number, depth: number) => {
      const w = x1 - x0;
      const d = z1 - z0;
      if (big || depth > 3 || (w < 7.5 && d < 7.5)) { rooms.push([x0, z0, x1, z1]); return; }
      const alongX = w >= d;
      const blocks = (c: number) => keepClear.some(([a, cz, e, g]) => (alongX ? c > a - 0.3 && c < e + 0.3 && g > z0 && cz < z1 : c > cz - 0.3 && c < g + 0.3 && e > x0 && a < x1));
      let cut = NaN;
      for (let tries = 0; tries < 6 && Number.isNaN(cut); tries++) {
        const t = 0.35 + r() * 0.3;
        const c = alongX ? x0 + w * t : z0 + d * t;
        if (!blocks(c)) cut = c;
      }
      // แบ่งตรงไหนก็ขวางทางเดิน เป็นห้องใหญ่ห้องเดียว
      if (Number.isNaN(cut)) { rooms.push([x0, z0, x1, z1]); return; }
      const len = alongX ? d : w;
      const door = (alongX ? z0 : x0) + 0.6 + r() * Math.max(0.1, len - 1.2 - DOOR_W);
      // ผนังห้องสูงถึงใต้พื้นชั้นบน มีช่องประตูกับคานเหนือประตู · ผนังห้องบางกว่าผนังนอก พังง่ายกว่า
      const wallTop = y + H - (f < b.floors - 1 ? SLAB : 0);
      const crumble = dec === 0 ? 0.15 : dec === 1 ? 0.45 : 0.75;
      const box = (x: number, z: number, hx: number, hz: number, y0: number, y1: number, kind: TownBox['kind'], color: number) => {
        if (r() < crumble) {
          if (y0 > y + 0.5) return; // คานเหนือประตูร่วงหาย
          y1 = y + 0.25 + r() * Math.min(1.6, y1 - y - 0.3);
        }
        put(x, z, hx, hz, y0, y1, kind, color);
      };
      keepClear.push(alongX ? [cut - 1.2, door - 0.35, cut + 1.2, door + DOOR_W + 0.35] : [door - 0.35, cut - 1.2, door + DOOR_W + 0.35, cut + 1.2]);
      if (alongX) {
        box(cut, (z0 + door) / 2, INNER / 2, (door - z0) / 2, y, wallTop, 'inner', innerColor);
        box(cut, (door + DOOR_W + z1) / 2, INNER / 2, (z1 - door - DOOR_W) / 2, y, wallTop, 'inner', innerColor);
        box(cut, door + DOOR_W / 2, INNER / 2, DOOR_W / 2, y + DOOR_H, wallTop, 'inner', innerColor);
        split(x0, z0, cut, z1, depth + 1);
        split(cut, z0, x1, z1, depth + 1);
      } else {
        box((x0 + door) / 2, cut, (door - x0) / 2, INNER / 2, y, wallTop, 'inner', innerColor);
        box((door + DOOR_W + x1) / 2, cut, (x1 - door - DOOR_W) / 2, INNER / 2, y, wallTop, 'inner', innerColor);
        box(door + DOOR_W / 2, cut, DOOR_W / 2, INNER / 2, y + DOOR_H, wallTop, 'inner', innerColor);
        split(x0, z0, x1, cut, depth + 1);
        split(x0, cut, x1, z1, depth + 1);
      }
    };
    split(-hw + WALL, -hd + WALL, roomEdge, hd - WALL, 0);
    // เฟอร์นิเจอร์กับของในห้องตามชนิดตึก
    // พันปีผ่านไป ไม้กับผ้าผุหายเกือบหมด ที่เหลือเป็นโครงเหล็กสนิมกับของปูน ทรุดเตี้ยลง
    const survive = dec === 0 ? 0.45 : dec === 1 ? 0.25 : 0.08;
    const furnBox: BoxFn = (x, z, hx, hz, y0, y1, kind, color) => {
      if (keepClear.some(([a, c, e, g]) => x + hx > a && x - hx < e && z + hz > c && z - hz < g)) return;
      if (r() > survive) return;
      const sag = dec === 0 ? 0.7 + r() * 0.3 : 0.35 + r() * 0.45;
      box(x, z, hx, hz, y0, y0 + (y1 - y0) * sag, kind, weather(color, 0.55));
    };
    for (const [x0, z0, x1, z1] of rooms) furnish(b.type, f, x0, z0, x1, z1, y, r, furnBox, items);
    // บันไดขึ้นชั้นถัดไป
    if (f < b.floors - 1) {
      const lx = laneX(f);
      const back = f % 2 === 0;
      for (let k = 0; k < steps; k++) box(lx, back ? sz0 + k * 0.3 + 0.15 : sz0 + run - k * 0.3 - 0.15, stairW / 2, 0.15, y, y + (k + 1) * (H / steps), 'stair', 0x6a5a48);
      stairsAt.push({ x: lx, z: back ? sz0 : sz0 + run });
    }
  }
  // หลังคา: ตึกที่ยังมีหลังคา แผ่นหลังคาแตกเป็นรูหลายจุด ขอบกันตกพังเป็นช่วง · ตึกอื่นหลังคาหายหมด
  const top = b.floors * H;
  const clearOf = (x: number, z: number, hx: number, hz: number, zones: [number, number, number, number][]) =>
    !zones.some(([a, c, e, g]) => x + hx > a && x - hx < e && z + hz > c && z - hz < g);
  if (dec === 0) {
    const nx = Math.max(2, Math.round(b.w / 3.2));
    const nz = Math.max(2, Math.round(b.d / 3.2));
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
        if (r() < 0.16) continue;
        const tw = (b.w + 0.3) / nx;
        const td = (b.d + 0.3) / nz;
        box(-hw - 0.15 + tw * (i + 0.5), -hd - 0.15 + td * (j + 0.5), tw / 2, td / 2, top, top + 0.3, 'roof', 0x5b5a52);
      }
    }
    for (const [x, z, hx, hz] of [[0, -hd, hw, 0.12], [0, hd, hw, 0.12], [-hw, 0, 0.12, hd], [hw, 0, 0.12, hd]] as const) {
      if (r() < 0.3) continue;
      box(x, z, hx, hz, top + 0.3, top + 0.4 + r() * 0.4, 'roof', 0x6a6862);
    }
  }
  // เศษปูนกับอิฐกองในห้องชั้นบนสุด ไม่กองขวางประตูหรือหัวบันได (เดิมกองทับประตูห้อง เข้าห้องไม่ได้ หัวบันไดชั้นสามตัน)
  // ซากที่เหลือแต่ตอผนัง กองใหญ่กว่า มีดินพูนเป็นเนิน
  const floorY = (b.floors - 1) * H;
  const piles = dec === 0 ? 2 : dec === 1 ? 7 : 12;
  const rubbleColors = [0x77736a, 0x8a6a58, 0x5e5a52, 0x6e6458];
  for (let k = 0, tries = 0; k < piles && tries < 60; tries++) {
    const x = (r() - 0.5) * b.w * 0.75;
    const z = (r() - 0.5) * b.d * 0.75;
    const hx = 0.4 + r() * (dec === 2 ? 1.5 : 1.1);
    const hz = 0.4 + r() * (dec === 2 ? 1.5 : 1.1);
    // กองกลางห้องเตี้ยพอก้าวขึ้นได้ (ห้องไม่ถูกกองซากปิดตาย) · กองสูงชิดผนังเท่านั้น
    const nearWall = Math.abs(x) + hx > hw - 1.2 || Math.abs(z) + hz > hd - 1.2;
    const h = 0.2 + r() * (nearWall ? 1.0 : 0.38);
    if (x + hx > roomEdge || !clearOf(x, z, hx, hz, topClear)) continue;
    box(x, z, hx, hz, floorY, floorY + h, 'rubble', rubbleColors[Math.floor(r() * rubbleColors.length)]);
    k++;
  }
  if (dec === 2) {
    // ดินพูนเป็นเนินเตี้ยในซากบ้าน (เดินขึ้นได้)
    for (let k = 0; k < 4; k++) {
      const x = (r() - 0.5) * b.w * 0.6;
      const z = (r() - 0.5) * b.d * 0.6;
      const hx = 1 + r() * 1.8;
      const hz = 1 + r() * 1.8;
      if (clearOf(x, z, hx, hz, topClear)) box(x, z, hx, hz, 0, 0.25 + r() * 0.3, 'floor', 0x4a4030);
    }
  }
  if (dec > 0) {
    // อิฐกับปูนที่ร่วงลงนอกตึกตามแนวผนัง ไม่กองหน้าประตู
    for (let k = 0, tries = 0; k < (dec === 2 ? 10 : 6) && tries < 40; tries++) {
      const side = Math.floor(r() * 4);
      const along = (r() - 0.5) * (side < 2 ? b.w : b.d) * 0.9;
      const out = 0.4 + r() * 2.2;
      const x = side < 2 ? along : (side === 2 ? -1 : 1) * (hw + out);
      const z = side < 2 ? (side === 0 ? -1 : 1) * (hd + out) : along;
      if (side === 0 && Math.abs(x) < 3) continue;
      const hx = 0.4 + r() * 1.2;
      const hz = 0.4 + r() * 1.2;
      box(x, z, hx, hz, -0.3, 0.15 + r() * 0.7, 'rubble', rubbleColors[Math.floor(r() * rubbleColors.length)]);
      k++;
    }
  }
  return { boxes, items, stairs: stairsAt };
}

type BoxFn = (x: number, z: number, hx: number, hz: number, y0: number, y1: number, kind: TownBox['kind'], color: number) => void;

/** สีซีดหม่นลงตามเวลา (ผสมสีดินเทาเข้าไป t ส่วน) */
function weather(c: number, t: number): number {
  const g = 0x5e584c;
  const mix = (sh: number) => Math.round(((c >> sh) & 255) * (1 - t) + ((g >> sh) & 255) * t);
  return (mix(16) << 16) | (mix(8) << 8) | mix(0);
}

const SMALL = ['teddy', 'phone', 'bottle', 'watch', 'glasses', 'frame', 'toycar', 'book', 'keys', 'coin'];

/** วางเฟอร์นิเจอร์ในห้องหนึ่งห้อง (กล่องง่าย ๆ ขนาดจริง) กับของชิ้นเล็ก */
function furnish(type: BuildingType, floor: number, x0: number, z0: number, x1: number, z1: number, y: number, r: () => number, put: BoxFn, items: RoomItem[]): void {
  // จดที่วางเฟอร์นิเจอร์ไว้ ของชิ้นเล็กจะได้ไม่จมอยู่ในเตียงหรือชั้นวาง
  const taken: [number, number, number, number][] = [];
  const box: BoxFn = (x, z, hx, hz, by0, by1, kind, color) => {
    taken.push([x - hx - 0.35, z - hz - 0.35, x + hx + 0.35, z + hz + 0.35]);
    put(x, z, hx, hz, by0, by1, kind, color);
  };
  const w = x1 - x0;
  const d = z1 - z0;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const wood = 0x6a4a34;
  const fabric = [0x6a7a8a, 0x8a6a5a, 0x5a6a4a][Math.floor(r() * 3)];
  const metal = 0x7a7e80;
  const along = (n: number, fn: (k: number) => void) => { for (let k = 0; k < n; k++) fn(k); };
  if (type === 'house' || type === 'townhouse' || type === 'motel') {
    const pick = r();
    if (pick < 0.35 && w > 2.4 && d > 2.4) {
      // ห้องนอน: เตียง ตู้เสื้อผ้า
      box(x0 + 1.1, cz, 1.0, 0.75, y, y + 0.5, 'furn', fabric);
      box(x1 - 0.35, z0 + 0.8, 0.3, 0.6, y, y + 1.9, 'furn', wood);
    } else if (pick < 0.65) {
      // ห้องนั่งเล่น: โซฟา โต๊ะ
      box(cx, z1 - 0.5, Math.min(1.0, w / 2 - 0.3), 0.4, y, y + 0.8, 'furn', fabric);
      box(cx, cz, 0.6, 0.4, y, y + 0.45, 'furn', wood);
    } else {
      // ครัว: เคาน์เตอร์ชิดผนัง ตู้เย็น โต๊ะกินข้าว
      box(cx, z0 + 0.3, Math.min(1.6, w / 2 - 0.2), 0.3, y, y + 0.9, 'furn', 0xb8b2a4);
      box(x1 - 0.4, z0 + 0.4, 0.35, 0.35, y, y + 1.8, 'furn', 0xd8d8d2);
      box(cx, cz + 0.3, 0.6, 0.45, y, y + 0.75, 'furn', wood);
    }
  } else if (type === 'shop' || type === 'grocery' || type === 'hardware' || type === 'postOffice') {
    // ชั้นวางของเรียงแถว เคาน์เตอร์ด้านหน้า
    const rows = Math.max(1, Math.floor((w - 1) / 2.2));
    along(rows, (k) => box(x0 + 1.2 + k * 2.2, cz + 0.8, 0.25, Math.max(0.5, d / 2 - 2.2), y, y + 1.8, 'furn', metal));
    if (floor === 0) box(cx, z0 + 1.2, Math.min(1.5, w / 2 - 0.4), 0.3, y, y + 1.0, 'furn', wood);
  } else if (type === 'diner') {
    box(cx, z1 - 1.0, w / 2 - 0.6, 0.35, y, y + 1.05, 'furn', 0xa83a2a);
    along(Math.floor((w - 1) / 2.5), (k) => box(x0 + 1.4 + k * 2.5, cz - 0.8, 0.5, 0.5, y, y + 0.75, 'furn', 0xd8d2c4));
  } else if (type === 'clinic') {
    along(Math.max(1, Math.floor((w - 1) / 2.4)), (k) => box(x0 + 1.2 + k * 2.4, z1 - 1.2, 0.45, 1.0, y, y + 0.7, 'furn', 0xe0e0dc));
    box(x0 + 0.35, z0 + 0.8, 0.3, 0.6, y, y + 1.6, 'furn', 0xc8ccd0);
  } else if (type === 'school') {
    for (let gx = x0 + 1.2; gx < x1 - 0.8; gx += 1.6) for (let gz = z0 + 1.6; gz < z1 - 1.2; gz += 1.4) box(gx, gz, 0.35, 0.25, y, y + 0.72, 'furn', 0x8a6a4a);
    box(cx, z0 + 0.6, 1.2, 0.3, y, y + 0.9, 'furn', wood);
  } else if (type === 'church') {
    for (let gz = z0 + 4; gz < z1 - 2; gz += 1.4) { box(x0 + w * 0.28, gz, w * 0.18, 0.25, y, y + 0.9, 'furn', wood); box(x1 - w * 0.28, gz, w * 0.18, 0.25, y, y + 0.9, 'furn', wood); }
    box(cx, z0 + 1.6, 1.2, 0.5, y, y + 1.0, 'furn', 0xd8d2c4);
  } else if (type === 'police') {
    along(Math.max(1, Math.floor((w - 1) / 2.6)), (k) => box(x0 + 1.4 + k * 2.6, cz, 0.7, 0.4, y, y + 0.75, 'furn', metal));
    // ห้องขัง ลูกกรงเป็นเส้น
    if (floor === 0) along(8, (k) => box(x1 - 0.2 - k * 0.18 - 0.1, z1 - 2.2, 0.02, 0.02, y, y + 2.2, 'furn', 0x4a4c4e));
  } else if (type === 'fireStation' && floor === 0) {
    box(cx, cz, 1.25, 4.0, y, y + 3.0, 'furn', 0xa82a22); // รถดับเพลิงร้าง
    along(4, (k) => box(x0 + 0.35, z0 + 1 + k * 0.7, 0.3, 0.3, y, y + 1.9, 'furn', metal));
  } else if (type === 'warehouse') {
    for (let gx = x0 + 2; gx < x1 - 2; gx += 4) for (let gz = z0 + 3; gz < z1 - 2; gz += 4) if (r() < 0.6) box(gx, gz, 0.6 + r() * 0.3, 0.6 + r() * 0.3, y, y + 0.9 + r() * 1.8, 'furn', 0x8a6e4a);
  }
  // ของชิ้นเล็กในห้องตามโอกาส วางบนพื้นที่ว่าง
  if (r() < 0.45) {
    const kind = SMALL[Math.floor(r() * SMALL.length)];
    for (let tries = 0; tries < 8; tries++) {
      const ix = x0 + 0.6 + r() * Math.max(0.1, w - 1.2);
      const iz = z0 + 0.6 + r() * Math.max(0.1, d - 1.2);
      if (taken.some(([a, b, c, e]) => ix > a && ix < c && iz > b && iz < e)) continue;
      items.push({ x: ix, z: iz, y: y + (floor === 0 ? 0.15 : 0), kind });
      break;
    }
  }
}

/** แปลงพิกัดในตึกเป็นพิกัดโลก */
export function toWorld(b: Pick<Building, 'x' | 'z' | 'rot'>, lx: number, lz: number): { x: number; z: number } {
  const c = Math.cos(b.rot);
  const s = Math.sin(b.rot);
  return { x: b.x + lx * c + lz * s, z: b.z - lx * s + lz * c };
}

// ---------- สวน สุสาน สนามเด็กเล่น หอส่งน้ำ ----------

function extraParts(e: Omit<TownExtra, 'y'>, r: () => number): void {
  const out = e.boxes;
  const box = (x: number, z: number, hx: number, hz: number, y0: number, y1: number, color: number, kind: TownBox['kind'] = 'furn') => out.push({ x, z, hx, hz, y0, y1, kind, color });
  const hw = e.w / 2;
  const hd = e.d / 2;
  const stone = [0x8c8a84, 0x7a7872, 0x9c9a92, 0x6e6c66];
  if (e.kind === 'park') {
    // สวนกลางเมืองเก่า: ทางเดินปูนแตกเป็นแผ่น น้ำพุหินแห้ง ตีนม้านั่งปูน (ไม้ผุหายไปแล้ว) · พุ่มไม้เดิมโตเป็นต้นไม้ไปหมด
    for (let k = 0; k < 14; k++) {
      const along = (r() - 0.5) * (e.w - 3);
      if (r() < 0.5) box(along, (r() - 0.5) * 1.4, 0.4 + r() * 0.7, 0.4 + r() * 0.5, 0, 0.05, 0x7a766c, 'floor');
      else box((r() - 0.5) * 1.4, (r() - 0.5) * (e.d - 2), 0.4 + r() * 0.5, 0.4 + r() * 0.7, 0, 0.05, 0x7a766c, 'floor');
    }
    for (const [x, z, hx, hz] of [[0, -2.2, 2.4, 0.25], [0, 2.2, 2.4, 0.25], [-2.2, 0, 0.25, 1.95], [2.2, 0, 0.25, 1.95]] as const) box(x, z, hx, hz, 0, 0.35 + r() * 0.25, 0x86827a);
    box(0, 0, 1.95, 1.95, 0, 0.18, 0x4a4436, 'floor');
    box(0, 0, 0.3, 0.3, 0, 1.2 + r() * 0.5, 0x86827a);
    if (r() < 0.6) box(0.9, 0.6, 0.7, 0.35, 0.18, 0.4, 0x86827a); // ชามน้ำพุที่หักร่วงลงมา
    for (const [x, z] of [[-6, -1.9], [6, -1.9], [-6, 1.9], [6, 1.9], [-1.9, -6.5], [1.9, 6.5]] as const) for (const s2 of [-0.7, 0.7]) box(x + (Math.abs(x) > 2 ? s2 : 0), z + (Math.abs(x) > 2 ? 0 : s2), 0.1, 0.18, 0, 0.42, 0x8a867c);
  } else if (e.kind === 'cemetery') {
    // สุสาน: รั้วเหล็กผุหายไปแล้ว เหลือเสาประตูหิน · ป้ายหลุมศพหินแกรนิตยังอยู่ บางป้ายล้ม บางป้ายจมดิน
    for (const sx of [-1.6, 1.6]) box(sx, -hd + 0.3, 0.18, 0.18, 0, 1.2 + r() * 0.5, 0x77736a);
    for (let rz = -hd + 3.5; rz < hd - 1.5; rz += 2.4) {
      for (let cx = -hw + 2; cx < hw - 1.5; cx += 1.7) {
        if (Math.abs(cx) < 1.6 || r() < 0.18) continue;
        const col = stone[Math.floor(r() * stone.length)];
        const k = r();
        const jx = (r() - 0.5) * 0.5;
        if (k < 0.3) box(cx + jx, rz + 0.5, 0.3, 0.45, 0, 0.1, col); // ป้ายล้มนอนราบ
        else if (k < 0.4) box(cx + jx, rz, 0.32, 0.07, 0, 0.2 + r() * 0.2, col); // จมดินเหลือแต่ขอบ
        else box(cx + jx, rz, 0.3 + r() * 0.08, 0.07, 0, 0.45 + r() * 0.5, col);
      }
    }
  } else if (e.kind === 'playground') {
    // ซากสนามเด็กเล่น: เหล็กผุเหลือแต่ตอเสาสนิม ขอบกระบะทรายปูนยังอยู่ แท่นกระดานลื่นล้มนอนกับพื้น
    const rust = 0x5a3a28;
    for (const sx of [-1.9, 1.9]) for (const sz of [-0.6, 0.6]) if (r() < 0.7) box(-6 + sx, sz, 0.06, 0.06, 0, 0.3 + r() * 0.7, rust);
    box(-6 + (r() - 0.5), 1.4, 1.8, 0.07, 0, 0.12, rust);
    box(4, 2, 0.6, 1.4, 0, 0.12, rust);
    for (const sx of [-0.55, 0.55]) box(4 + sx, 3.6, 0.05, 0.05, 0, 0.25 + r() * 0.4, rust);
    for (const [x, z, hx, hz] of [[0, -6.6, 1.7, 0.1], [0, -3.4, 1.7, 0.1], [-1.6, -5, 0.1, 1.6], [1.6, -5, 0.1, 1.6]] as const) if (r() < 0.85) box(x, z, hx, hz, 0, 0.18 + r() * 0.1, 0x7a766c);
    box(8, -4, 0.15, 0.15, 0, 0.3, rust);
  } else {
    // หอส่งน้ำคอนกรีต (เหล็กผุพังไปหมดแล้ว ที่ยังยืนอยู่ได้พันปีต้องเป็นปูน) · เสา 4 ต้น คานเป็นชั้น ถังบนยอดราว 18 ม.
    // ทางเดินรอบถัง ราวกันตกพังเป็นช่วง · บันไดปูนยื่นจากเสาเป็นขั้น ๆ ปีนขึ้นได้ด้วยที่ปีนป่าย
    const conc = 0x8a867c;
    const H = 18;
    for (const sx of [-2.2, 2.2]) for (const sz of [-2.2, 2.2]) box(sx, sz, 0.35, 0.35, 0, H, conc, 'wall');
    for (const y of [6, 12]) {
      for (const s2 of [-2.2, 2.2]) {
        box(0, s2, 2.2, 0.2, y, y + 0.4, conc);
        box(s2, 0, 0.2, 2.2, y, y + 0.4, conc);
      }
    }
    box(0, 0, 3.4, 3.4, H - 0.3, H, 0x6e6a62, 'floor');
    for (const [x, z, hx, hz] of [[0, -3.3, 3.4, 0.1], [0, 3.3, 3.4, 0.1], [-3.3, 0, 0.1, 3.4], [3.3, 0.6, 0.1, 2.8]] as const) if (r() < 0.7) box(x, z, hx, hz, H, H + 0.4 + r() * 0.6, conc);
    const tank = 0x8e8a80;
    box(0, 0, 2.6, 2.6, H, H + 4.8, tank, 'wall');
    box(0, 0, 3.0, 1.9, H, H + 4.8, tank, 'wall');
    box(0, 0, 1.9, 3.0, H, H + 4.8, tank, 'wall');
    box(0, 0, 2.2, 2.2, H + 4.8, H + 5.3, 0x6e6a62, 'roof');
    // คราบน้ำฝนไหลเป็นทางเข้มลงจากขอบถัง
    for (let k = 0; k < 9; k++) box(-2.4 + r() * 4.8, -3.02, 0.06 + r() * 0.25, 0.02, H + 0.2 + r() * 2.5, H + 4.6, 0x4e4a42);
    box(3.6, 0.6, 0.12, 0.4, 0, H, 0x6e6a62, 'wall');
    e.sign = { text: 'PINE VALLEY', x: 0, y: H + 2.6, z: -3.03, w: 4.6 };
  }
}
