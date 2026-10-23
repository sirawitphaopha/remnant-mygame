import { WORLD } from '../config/game';
import { BRIDGE, RIVER_WIDTH } from './layout';
import { buildingParts, planExtras, planTown, toWorld, type Building, type TownBox, type TownExtra } from './townPlan';
import { planRuins } from './ruins';
import { Structures as S } from './structures';
import type { Structures } from './structures';
import type { Terrain } from './Terrain';

// เมืองที่มีจริงในหุบริมแม่น้ำ (ผังใน townPlan.ts) + สะพานพัง · ผลเดิมทุกครั้ง
// ทุกตึกเดินเข้าได้ · กล่องทุกชิ้น (ผนังมีช่องประตูหน้าต่าง พื้นแต่ละชั้น บันได เฟอร์นิเจอร์) ใส่ตัวชนด้วย

export type { Building, TownExtra } from './townPlan';

export interface BridgePart { x: number; z: number; hx: number; hz: number; rot: number; y0: number; y1: number; kind: 'deck' | 'pillar' | 'rail' }

export interface TownLayout {
  buildings: Building[];
  /** กล่องของแต่ละตึก (พิกัดในตึก) ใช้วาดภาพ */
  parts: Map<string, TownBox[]>;
  /** ของชิ้นเล็กในห้อง (พิกัดโลก) */
  items: { key: string; kind: string; x: number; y: number; z: number; special?: boolean }[];
  /** สวน สุสาน สนามเด็กเล่น หอส่งน้ำ */
  extras: TownExtra[];
  bridge: BridgePart[];
}

export function buildTown(t: Terrain, s: Structures): TownLayout {
  const buildings: Building[] = [];
  const parts = new Map<string, TownBox[]>();
  const items: TownLayout['items'] = [];
  // ที่ว่างในเมืองวางบนพื้นตรงกลางที่ดิน (ของชิ้นเตี้ย ๆ พื้นลาดนิดหน่อยไม่เป็นไร)
  // ที่ว่างในเมือง + ซากอารยธรรมนอกเมือง (world/ruins.ts ช่วง 10) ใช้ตัวสร้างกับตัววาดชุดเดียวกัน
  const ruins = planRuins();
  const extras: TownExtra[] = [...planExtras(), ...ruins.extras].map((e) => ({ ...e, y: t.heightAt(e.x, e.z) }));
  for (const e of extras) {
    for (const bx of e.boxes) {
      const w = toWorld(e, bx.x, bx.z);
      s.add({ x: w.x, z: w.z, hx: bx.hx, hz: bx.hz, rot: e.rot, y0: e.y + bx.y0, y1: e.y + bx.y1, tag: e.key });
    }
  }
  for (const p of [...planTown(), ...ruins.buildings]) {
    // ฐานตึกเท่ากับจุดต่ำสุดของพื้นใต้ตึก ตึกไม่ลอย
    let y = Infinity;
    for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]]) {
      const w = toWorld(p, (px * p.w) / 2, (pz * p.d) / 2);
      y = Math.min(y, t.heightAt(w.x, w.z));
    }
    const b: Building = { ...p, y };
    buildings.push(b);
    const { boxes, items: inRoom } = buildingParts(b);
    parts.set(b.key, boxes);
    for (const bx of boxes) {
      const w = toWorld(b, bx.x, bx.z);
      s.add({ x: w.x, z: w.z, hx: bx.hx, hz: bx.hz, rot: b.rot, y0: b.y + bx.y0, y1: b.y + bx.y1, tag: b.key });
    }
    // ฐานตึกใต้พื้นชั้นล่าง (พื้นลาดนิด ๆ จะไม่เห็นช่องใต้ตึก)
    s.add({ x: b.x, z: b.z, hx: b.w / 2, hz: b.d / 2, rot: b.rot, y0: b.y - 1.5, y1: b.y, tag: b.key });
    inRoom.forEach((it, k) => {
      const w = toWorld(b, it.x, it.z);
      items.push({ key: `${it.kind}@${b.key}-${k}`, kind: it.kind, x: w.x, y: b.y + it.y, z: w.z, special: it.special });
    });
  }
  // ชิ้นพิเศษ: โทรศัพท์ในที่ทำการไปรษณีย์ กรอบรูปในบ้านหลังแรก (เดิมวางกลางเมือง)
  const markSpecial = (type: string, kind: string) => {
    const b = buildings.find((x) => x.type === type);
    if (!b) return;
    const w = toWorld(b, 0, -b.d / 2 + 2.5);
    items.push({ key: `${kind}@${b.key}-special`, kind, x: w.x, y: b.y + 0.15, z: w.z, special: true });
  };
  markSpecial('postOffice', 'phone');
  markSpecial('house', 'frame');

  // สะพานพัง: พื้นสะพานสองท่อน ขาดตรงกลาง มีเสาตอม่อ
  const bridge: BridgePart[] = [];
  const dirX = Math.cos(BRIDGE.angle);
  const dirZ = Math.sin(BRIDGE.angle);
  const rot = -BRIDGE.angle;
  // พื้นสะพานเท่าคันดินหัวสะพาน (terrainGen ปั้นคันดินถึงห่างแม่น้ำ RIVER_WIDTH + 6 ม.) ปลายสะพานจมคันดินเล็กน้อย เดินขึ้นได้ราบ
  const reach = RIVER_WIDTH + 14;
  const half = (reach - 2) / 2;
  const deckY = Math.max(t.heightAt(BRIDGE.x - dirX * (reach + 3), BRIDGE.z - dirZ * (reach + 3)), t.heightAt(BRIDGE.x + dirX * (reach + 3), BRIDGE.z + dirZ * (reach + 3)), WORLD.waterLevel + 2);
  for (const side of [-1, 1]) {
    // ขาดตรงกลาง 4 ม.
    const cx = BRIDGE.x + dirX * side * (2 + half);
    const cz = BRIDGE.z + dirZ * side * (2 + half);
    bridge.push({ x: cx, z: cz, hx: half, hz: 3.2, rot, y0: deckY - 0.6, y1: deckY, kind: 'deck' });
    s.add({ x: cx, z: cz, hx: half, hz: 3.2, rot, y0: deckY - 0.6, y1: deckY, tag: 'bridge' });
    for (const rail of [-1, 1]) {
      const rx = cx - dirZ * rail * 3.05;
      const rz = cz + dirX * rail * 3.05;
      bridge.push({ x: rx, z: rz, hx: half, hz: 0.12, rot, y0: deckY, y1: deckY + 1, kind: 'rail' });
      s.add({ x: rx, z: rz, hx: half, hz: 0.12, rot, y0: deckY, y1: deckY + 1, tag: 'bridge' });
    }
    const px = BRIDGE.x + dirX * side * 7;
    const pz = BRIDGE.z + dirZ * side * 7;
    const py0 = t.heightAt(px, pz) - 1;
    bridge.push({ x: px, z: pz, hx: 0.8, hz: 2.4, rot, y0: py0, y1: deckY - 0.6, kind: 'pillar' });
    s.add({ x: px, z: pz, hx: 0.8, hz: 2.4, rot, y0: py0, y1: deckY - 0.6, tag: 'bridge' });
  }
  return { buildings, parts, items, extras, bridge };
}

/** พิกัดโลกเป็นพิกัดในตึก (หรือในที่ดิน) */
export function toLocal(b: { x: number; z: number; rot: number }, x: number, z: number): [number, number] {
  return S.local({ x: b.x, z: b.z, hx: 0, hz: 0, rot: b.rot, y0: 0, y1: 0 }, x, z);
}

/** ตึกที่จุดนี้อยู่ข้างใน (ตึกหมุนตามถนน) */
export function buildingAt(L: TownLayout, x: number, z: number, pad = 0): Building | null {
  for (const b of L.buildings) {
    if (Math.abs(x - b.x) > b.w + b.d || Math.abs(z - b.z) > b.w + b.d) continue;
    const [lx, lz] = toLocal(b, x, z);
    if (Math.abs(lx) < b.w / 2 + pad && Math.abs(lz) < b.d / 2 + pad) return b;
  }
  return null;
}

/**
 * ต้นไม้ขึ้นตรงนี้ไม่ได้: ในตึกที่ยังมีหลังคา · หน้าประตูกับทางเดินเข้าตึก · ช่องบันได · หอส่งน้ำ สนามเด็กเล่น
 * ซากตึกที่หลังคาหายแล้วต้นไม้ขึ้นข้างในได้ (พันปีผ่านไป ต้นไม้ขึ้นกลางห้อง ทะลุผนัง)
 */
export function treeBlocked(L: TownLayout, x: number, z: number): boolean {
  for (const b of L.buildings) {
    if (Math.abs(x - b.x) > b.w + b.d + 8 || Math.abs(z - b.z) > b.w + b.d + 8) continue;
    const [lx, lz] = toLocal(b, x, z);
    const hw = b.w / 2;
    const hd = b.d / 2;
    // ทางเดินจากถนนเข้าประตูหน้า
    if (Math.abs(lx) < 2.4 && lz < -hd + 3.5 && lz > -hd - 6.5) return true;
    if (Math.abs(lx) > hw + 1.2 || Math.abs(lz) > hd + 1.2) continue;
    if (b.decay === 0) return true;
    if (b.floors > 1 && lx > hw - 4.8) return true;
  }
  for (const e of L.extras) {
    if (!TREE_FREE.has(e.kind)) continue;
    const [lx, lz] = toLocal(e, x, z);
    if (Math.abs(lx) < e.w / 2 + 1 && Math.abs(lz) < e.d / 2 + 1) return true;
  }
  return false;
}

/** ที่ว่างที่ต้นไม้ไม่ขึ้น (ทางรถไฟ ขบวนรถ เสาไฟฟ้าล้ม ต้นไม้ขึ้นแทรกได้) */
const TREE_FREE = new Set<TownExtra['kind']>(['waterTower', 'playground', 'lookout', 'gasCanopy', 'platform', 'campsite', 'sawyard']);

/** หญ้าไม่ขึ้นในตึกที่ยังมีหลังคา (ซากที่หลังคาหายหญ้าขึ้นได้) */
export function grassBlocked(L: TownLayout, x: number, z: number): boolean {
  const b = buildingAt(L, x, z, 0.2);
  return !!b && b.decay === 0;
}
