import * as THREE from 'three';
import type { TilePlantId } from '../../world/flowers';
import { jitter } from './build';
import { assemble, type Part } from './build';

// ดอกไม้ 13 ชนิด ปั้นด้วยโค้ด · ทุกชนิดปั้นสูง 1 ม. โคนอยู่ที่ y = 0 แล้วย่อขยายตามความสูงจริงตอนวาง
// สีดอกตามแหล่งอ้างอิง (REFERENCES-R2 หัวข้อ 4)

const STEM = 0x4a6a2a;
const LEAF = 0x3f6226;

function stem(h: number, r = 0.012, bend = 0): THREE.BufferGeometry {
  // ก้านสามเหลี่ยม เปิดหัวท้าย (ทั้งทุ่งมีหลายพันต้น ต้องเบา)
  const g = new THREE.CylinderGeometry(r * 0.7, r, h, 3, bend ? 2 : 1, true).translate(0, h / 2, 0);
  if (bend) {
    const p = g.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) { const t = p.getY(i) / h; p.setX(i, p.getX(i) + bend * t * t); }
  }
  return g;
}

/** กลีบรอบวง n กลีบ แผ่ออกด้วยมุม tilt */
function petals(n: number, len: number, wid: number, y: number, tilt: number, x = 0): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  for (let i = 0; i < n; i++) {
    const g = new THREE.PlaneGeometry(wid, len).translate(0, len / 2, 0).rotateX(-Math.PI / 2 + tilt).rotateY((i / n) * Math.PI * 2);
    out.push(g.translate(x, y, 0));
  }
  return out;
}

const leaf = (y: number, a: number, len = 0.14) => new THREE.PlaneGeometry(0.05, len).translate(0, len / 2, 0).rotateX(-0.9).rotateY(a).translate(0, y, 0);

export function flowerGeometry(kind: TilePlantId): THREE.BufferGeometry {
  const p: Part[] = [];
  const add = (geo: THREE.BufferGeometry | THREE.BufferGeometry[], color: number, sway: [number, number] = [0.6, 1], vary = 0.12) => {
    for (const g of Array.isArray(geo) ? geo : [geo]) p.push({ geo: g, color, vary, sway });
  };
  switch (kind) {
    case 'poppy':
      add(stem(0.92, 0.012, 0.05), STEM, [0, 1]);
      add(petals(4, 0.09, 0.1, 0.9, 0.9, 0.05), 0xc8241c);
      add(new THREE.SphereGeometry(0.025, 5, 4).translate(0.05, 0.93, 0), 0x1a1a14);
      add([leaf(0.2, 0), leaf(0.3, 2.4)], LEAF, [0, 0.3]);
      break;
    case 'lupin':
      add(stem(0.95, 0.014), STEM, [0, 1]);
      for (let i = 0; i < 12; i++) add(new THREE.ConeGeometry(0.035 * (1 - i / 14), 0.05, 5).translate(0, 0.45 + i * 0.045, 0).rotateY(i * 2.1), i % 3 ? 0x6a58c8 : 0x8a74d8, [0.5, 1]);
      for (let i = 0; i < 6; i++) add(leaf(0.12, (i / 6) * Math.PI * 2, 0.12), LEAF, [0, 0.2]);
      break;
    case 'sunflower':
      add(stem(0.95, 0.03), 0x4e6a28, [0, 0.5]);
      // ใบรูปหัวใจยาว (วงห้าเหลี่ยมยืด) ไม่ใช่สี่เหลี่ยม
      for (let i = 0; i < 5; i++) add(new THREE.CircleGeometry(0.05, 5).scale(0.75, 1.5, 1).translate(0, 0.07, 0).rotateX(-1.0).rotateY(i * 1.3).translate(0, 0.2 + i * 0.13, 0), LEAF, [0.1, 0.4]);
      // ดอกหันออกด้านข้าง (หมุนทั้งต้นให้หันตะวันออกตอนวาง)
      add(petals(16, 0.08, 0.04, 0, 0.15).map((g) => g.rotateX(Math.PI / 2).translate(0, 0.96, 0.03)), 0xe8b820, [0.4, 0.6]);
      add(new THREE.CylinderGeometry(0.07, 0.07, 0.03, 10).rotateX(Math.PI / 2).translate(0, 0.96, 0.04), 0x4a2e14, [0.4, 0.6]);
      break;
    case 'daisy':
      add(stem(0.9, 0.02), STEM, [0, 1]);
      add(petals(12, 0.12, 0.04, 0.9, 1.35), 0xf2f0e8);
      add(new THREE.SphereGeometry(0.05, 6, 4).scale(1, 0.5, 1).translate(0, 0.92, 0), 0xe8b820);
      break;
    case 'cornflower':
      add(stem(0.92, 0.012, 0.04), STEM, [0, 1]);
      add(petals(9, 0.07, 0.03, 0.9, 0.6, 0.04), 0x3a5ed0);
      add([leaf(0.3, 0.5, 0.1), leaf(0.5, 3.4, 0.1)], LEAF, [0, 0.4]);
      break;
    case 'lavender':
      for (let s = 0; s < 5; s++) {
        const a = (s / 5) * Math.PI * 2;
        const lean = 0.05 + (s % 3) * 0.03;
        add(stem(0.75, 0.008, lean).rotateY(a), 0x6a7a5a, [0, 1]);
        // ช่อดอกเป็นแท่งเดียว (เดิมลูกกลมเล็ก 5 ลูกต่อก้าน หนักเกินไปทั้งทุ่ง)
        add(new THREE.CylinderGeometry(0.012, 0.024, 0.26, 4).translate(lean * 0.9, 0.82, 0).rotateY(a), 0x8a6ac0, [0.8, 1]);
      }
      break;
    case 'foxglove':
      add(stem(0.98, 0.016), STEM, [0, 0.8]);
      for (let i = 0; i < 14; i++) add(new THREE.CylinderGeometry(0.03, 0.015, 0.06, 6, 1, true).rotateZ(1.2).translate(0.04, 0.4 + i * 0.04, 0).rotateY(i * 0.9), i % 2 ? 0xc86aa8 : 0xd87ab8, [0.5, 1]);
      for (let i = 0; i < 6; i++) add(leaf(0.05, (i / 6) * Math.PI * 2, 0.2), LEAF, [0, 0.2]);
      break;
    case 'bluebell':
      add(stem(0.85, 0.012, 0.25), STEM, [0, 1]);
      for (let i = 0; i < 6; i++) add(new THREE.CylinderGeometry(0.035, 0.02, 0.07, 6, 1, true).translate(0.12 + i * 0.022, 0.78 - i * 0.07, 0), 0x4a5ac8, [0.6, 1]);
      for (let i = 0; i < 4; i++) add(leaf(0, (i / 4) * Math.PI * 2, 0.45), LEAF, [0, 0.3]);
      break;
    case 'dogRose':
      // พุ่มกุหลาบป่า กิ่งโค้ง ดอกชมพู 5 กลีบ
      for (let s = 0; s < 6; s++) add(stem(0.9, 0.012, 0.35).rotateY((s / 6) * Math.PI * 2), 0x4a5a2a, [0, 0.6]);
      for (let i = 0; i < 10; i++) {
        const a = i * 1.9;
        add(new THREE.IcosahedronGeometry(0.16, 0).translate(Math.cos(a) * 0.25, 0.55 + (i % 3) * 0.12, Math.sin(a) * 0.25), LEAF, [0.3, 0.6], 0.2);
        add(petals(5, 0.05, 0.05, 0, 1.2).map((g) => g.translate(Math.cos(a) * 0.38, 0.62 + (i % 3) * 0.12, Math.sin(a) * 0.38)), 0xe896b4, [0.4, 0.7]);
      }
      break;
    case 'dandelion':
      add(stem(0.9, 0.025), 0x6a8a3a, [0, 1]);
      add(new THREE.SphereGeometry(0.11, 7, 5).scale(1, 0.6, 1).translate(0, 0.92, 0), 0xf0c020);
      for (let i = 0; i < 6; i++) add(new THREE.PlaneGeometry(0.08, 0.35).translate(0, 0.17, 0).rotateX(-1.3).rotateY((i / 6) * Math.PI * 2), LEAF, [0, 0.2]);
      break;
    case 'buttercup':
      for (let s = 0; s < 3; s++) {
        const a = s * 2.1;
        add(stem(0.9, 0.012, 0.12).rotateY(a), STEM, [0, 1]);
        add(petals(5, 0.07, 0.07, 0, 0.7).map((g) => g.translate(Math.cos(-a) * 0.12, 0.9, Math.sin(-a) * 0.12)), 0xf0d020);
      }
      break;
    case 'orchid':
      add(stem(0.9, 0.01, 0.35), 0x4a6a3a, [0, 1]);
      for (let i = 0; i < 4; i++) add(petals(5, 0.07, 0.06, 0, 1.4).map((g) => g.rotateX(Math.PI / 2).translate(0.12 + i * 0.06, 0.85 - i * 0.07, 0)), i % 2 ? 0xf0e8f4 : 0xe0a0d0, [0.6, 1]);
      for (let i = 0; i < 3; i++) add(new THREE.PlaneGeometry(0.1, 0.4).translate(0, 0.2, 0).rotateX(-1.1).rotateY(i * 2.1), 0x3a6a2a, [0, 0.2]);
      break;
    case 'cattail':
      // ธูปฤาษี ใบยาวแบนตั้งตรง ช่อดอกสีน้ำตาลรูปไส้กรอก
      for (let i = 0; i < 6; i++) add(new THREE.PlaneGeometry(0.03, 0.9).translate(0, 0.45, 0).rotateX(0.06 * (i % 3)).rotateY(i * 1.05), 0x5a7a34, [0, 1]);
      add(stem(0.95, 0.008), 0x6a7a3a, [0, 1]);
      add(new THREE.CylinderGeometry(0.025, 0.025, 0.16, 6).translate(0, 0.84, 0), 0x5a3a20, [0.8, 1]);
      break;
    case 'reed':
      // อ้อ ลำสูงใบเรียวกับช่อดอกฟูที่ยอด
      for (let s = 0; s < 4; s++) {
        const a = s * 1.6;
        add(stem(0.98, 0.006, 0.06).rotateY(a), 0x8a9a52, [0, 1]);
        add(new THREE.PlaneGeometry(0.04, 0.12).translate(0, 0.06, 0).rotateY(a).translate(Math.cos(-a) * 0.05, 0.93, Math.sin(-a) * 0.05), 0xb8a888, [0.9, 1]);
        for (let k = 0; k < 3; k++) add(new THREE.PlaneGeometry(0.02, 0.22).translate(0, 0.11, 0).rotateZ(0.7).rotateY(a + k * 2).translate(0, 0.3 + k * 0.2, 0), 0x7a8a42, [0.3, 0.8]);
      }
      break;
    case 'horsetail':
      // หญ้าหางม้า ลำตั้งมีกิ่งเส้นเล็กเป็นวงทุกข้อ
      for (let s = 0; s < 5; s++) {
        const a = s * 1.25;
        const ox = Math.cos(a) * 0.06;
        const oz = Math.sin(a) * 0.06;
        add(stem(0.95, 0.007).translate(ox, 0, oz), 0x4e7a34, [0, 1]);
        for (let k = 0; k < 5; k++) add(new THREE.PlaneGeometry(0.008, 0.09).translate(0, 0.045, 0).rotateZ(1.0).rotateY(k * 1.3 + a).translate(ox, 0.25 + k * 0.13, oz), 0x5e8a3a, [0.4, 0.9]);
      }
      break;
    case 'stone':
      // หินกลมท้องน้ำ (ขนาดตาม scale เป็นเมตร) มีตะไคร่ด้านบน
      add(jitter(new THREE.IcosahedronGeometry(0.5, 1).scale(1.3, 0.55, 1), 0.08, 2, 3).translate(0, 0.18, 0), 0x6a665e, [0, 0], 0.18);
      add(jitter(new THREE.SphereGeometry(0.48, 7, 3, 0, Math.PI * 2, 0, 0.7).scale(1.25, 0.5, 0.95), 0.05, 2, 5).translate(0, 0.2, 0), 0x4f6430, [0, 0], 0.2);
      break;
    case 'waterLily':
      add(new THREE.CircleGeometry(4, 14, 0.3, Math.PI * 1.85).rotateX(-Math.PI / 2), 0x3a6a2a, [0.1, 0.1]);
      add(petals(10, 1.6, 1.0, 0.1, 0.8), 0xf4eef0, [0.1, 0.1]);
      add(new THREE.SphereGeometry(0.5, 6, 4).translate(0, 0.3, 0), 0xe8c030, [0.1, 0.1]);
      break;
  }
  return assemble(p);
}
