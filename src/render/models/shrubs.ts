import * as THREE from 'three';
import { rng } from '../../world/noise';
import type { ShrubId } from '../../world/shrubs';
import { assemble, type Part } from './build';
import { cardsGeometry, type Card, type LeafStyle } from './trees';

// พุ่มไม้ 6 ชนิด ปั้นด้วยโค้ด · กิ่งเป็นทรงกระบอกจริง ใบเป็นแผ่นภาพโปร่งใสแบบเดียวกับใบไม้ของต้นไม้
// (เดิมพุ่มไม้เป็นก้อนกลมสามก้อนชนิดเดียวทั้งแมพ) · หน่วยเมตร โคนอยู่ที่ y = 0 · สูงราว 0.8 ถึง 2.4 ม. ก่อนย่อขยายตามต้น

export interface ShrubModel {
  wood: THREE.BufferGeometry;
  leaves: THREE.BufferGeometry;
  style: LeafStyle;
}

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);

/** กิ่งจากจุดหนึ่งไปอีกจุด */
function stick(a: THREE.Vector3, b: THREE.Vector3, r0: number, r1: number): THREE.BufferGeometry {
  const d = b.clone().sub(a);
  const len = d.length();
  const g = new THREE.CylinderGeometry(r1, r0, len, 4, 1, true).translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()));
  return g.translate(a.x, a.y, a.z);
}

/** ลูกเล็ก ๆ (ผล ดอก) */
function bead(r: number, p: THREE.Vector3): THREE.BufferGeometry {
  return new THREE.IcosahedronGeometry(r, 0).translate(p.x, p.y, p.z);
}

interface Spec {
  /** จำนวนกิ่งจากโคน · สูง · กางออก · โค้งลง (กิ่งโค้งแบบกุหลาบป่า แบล็กเบอร์รี่) */
  stems: number;
  height: number;
  spread: number;
  arch: number;
  bark: number;
  leaf: number[];
  leafSize: number;
  /** ใบต่อเมตรของกิ่ง */
  leafDensity: number;
  style: LeafStyle;
  /** ผลหรือดอกเป็นเม็ดตามปลายกิ่ง */
  fruit?: { color: number; r: number; per: number };
}

const SPECS: Record<ShrubId, Spec> = {
  // เฮเซล: กิ่งตั้งตรงหลายกิ่งจากกอ ใบกลมกว้าง
  hazel: { stems: 9, height: 2.3, spread: 0.5, arch: 0.15, bark: 0x6a5240, leaf: [0x4e6e2a, 0x587a30], leafSize: 0.5, leafDensity: 11, style: 'broad' },
  // เอลเดอร์: กิ่งโค้งออก ใบเขียวเข้ม ผลสีม่วงดำเป็นพวง
  elder: { stems: 6, height: 2.1, spread: 0.8, arch: 0.45, bark: 0x7a6a56, leaf: [0x3e5e26, 0x4a6a2c], leafSize: 0.46, leafDensity: 12, style: 'broad', fruit: { color: 0x4a2c5a, r: 0.02, per: 12 } },
  // กุหลาบป่า: กิ่งหนามโค้งลง ใบเล็ก ดอกชมพูกับผลสีแดง
  dogRose: { stems: 7, height: 1.6, spread: 0.9, arch: 0.8, bark: 0x5a4a30, leaf: [0x5a7a34, 0x4e6e2e], leafSize: 0.32, leafDensity: 16, style: 'broad', fruit: { color: 0xe89ab4, r: 0.04, per: 5 } },
  // จูนิเปอร์: พุ่มเตี้ยแผ่กว้าง ใบเข็มสีเขียวอมฟ้า
  juniper: { stems: 10, height: 0.9, spread: 1.2, arch: 0.25, bark: 0x5a4636, leaf: [0x2e4a3a, 0x37554a], leafSize: 0.42, leafDensity: 18, style: 'needle' },
  // แบล็กเบอร์รี่: กิ่งยาวโค้งพันกันเป็นกอรก ผลดำ
  bramble: { stems: 11, height: 1.3, spread: 1.1, arch: 1.0, bark: 0x5a3a3a, leaf: [0x3a5a26, 0x46662c], leafSize: 0.36, leafDensity: 14, style: 'broad', fruit: { color: 0x3a2236, r: 0.022, per: 9 } },
  // โรโดเดนดรอน: ป่าชื้น กิ่งแตกแขนง ใบหนาเงาเข้ม ดอกม่วงเป็นช่อ
  rhododendron: { stems: 6, height: 2.2, spread: 0.7, arch: 0.2, bark: 0x5e4a3a, leaf: [0x2c4a24, 0x335226], leafSize: 0.56, leafDensity: 10, style: 'broad', fruit: { color: 0x9a6ac8, r: 0.07, per: 3 } },
};

const cache = new Map<ShrubId, ShrubModel>();

export function shrubModel(id: ShrubId): ShrubModel {
  const hit = cache.get(id);
  if (hit) return hit;
  const sp = SPECS[id];
  const r = rng(id.length * 977 + id.charCodeAt(0) * 31);
  const wood: Part[] = [];
  const cards: Card[] = [];
  for (let k = 0; k < sp.stems; k++) {
    const a = (k / sp.stems) * Math.PI * 2 + r() * 0.6;
    const out = sp.spread * (0.5 + r() * 0.6);
    const h = sp.height * (0.65 + r() * 0.4);
    // กิ่งเป็นสามท่อน ขึ้นแล้วโค้งออก (กิ่งโค้งมากปลายลู่ลง)
    const p0 = V(Math.cos(a) * 0.08, 0, Math.sin(a) * 0.08);
    const p1 = V(Math.cos(a) * out * 0.4, h * 0.55, Math.sin(a) * out * 0.4);
    const p2 = V(Math.cos(a) * out * 0.8, h * (0.95 - sp.arch * 0.1), Math.sin(a) * out * 0.8);
    const p3 = V(Math.cos(a + 0.2) * out * (1 + sp.arch * 0.4), h * (1 - sp.arch * 0.45), Math.sin(a + 0.2) * out * (1 + sp.arch * 0.4));
    const pts = [p0, p1, p2, p3];
    for (let i = 0; i < 3; i++) wood.push({ geo: stick(pts[i], pts[i + 1], 0.03 - i * 0.008, 0.022 - i * 0.007), color: sp.bark, vary: 0.15, sway: [i * 0.2, (i + 1) * 0.25] });
    // ใบเกาะตามกิ่งช่วงบน
    for (let i = 1; i < 3; i++) {
      const len = pts[i].distanceTo(pts[i + 1]);
      const n = Math.max(2, Math.round(len * sp.leafDensity));
      for (let q = 0; q < n; q++) {
        const t = r();
        const c = pts[i].clone().lerp(pts[i + 1], t).add(V((r() - 0.5) * 0.35, (r() - 0.5) * 0.25, (r() - 0.5) * 0.35));
        cards.push({ c, size: sp.leafSize * (0.75 + r() * 0.5), color: new THREE.Color(sp.leaf[Math.floor(r() * sp.leaf.length)]), sway: 0.3 + i * 0.25 });
      }
    }
    // ผลหรือดอกที่ปลายกิ่ง
    if (sp.fruit) {
      for (let q = 0; q < sp.fruit.per; q++) {
        const c = p3.clone().lerp(p2, r() * 0.5).add(V((r() - 0.5) * 0.25, (r() - 0.5) * 0.15, (r() - 0.5) * 0.25));
        wood.push({ geo: bead(sp.fruit.r * (0.8 + r() * 0.4), c), color: sp.fruit.color, vary: 0.15, sway: [0.8, 0.8] });
      }
    }
  }
  const model = { wood: assemble(wood), leaves: cardsGeometry(cards, r), style: sp.style };
  cache.set(id, model);
  return model;
}
