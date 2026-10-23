import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Simplex2 } from '../../world/noise';
import type { RockType } from '../../world/rocks';

// ก้อนหิน 6 ชนิด ปั้นด้วยโค้ดตามรูปจริง (docs/REFERENCES-R2.md หัวข้อ 10) · หน่วยเมตรที่ขนาด 1 เท่า · โคนจมดินอยู่ใต้ y = 0
// แกรนิต: ทรงเหลี่ยมมนมุม หน้าค่อนข้างเรียบ มีรอยแตกผ่าด้านบน ด่างไลเคน มอสในแอ่งด้านบน ด้านล่างชื้นสีเข้ม
// แผ่นหินชั้น: ชั้นหินเหลื่อมกันเป็นขั้น สีชั้นสลับ · ก้อนริมน้ำ: กลมแบนเกลี้ยง มีรอยน้ำ · เศษหินร่วง: เหลี่ยมคม
// กองหินโผล่: ก้อนแกรนิตซ้อนกันสามชั้น · ก้อนมอส: แกรนิตจมดินลึก มอสคลุมด้านบนหนา

const nz = new Simplex2(4417);
const n3 = (x: number, y: number, z: number) => nz.noise(x + z * 0.71, y - z * 0.37) * 0.6 + nz.noise(z - y * 0.53, x * 0.9 + y) * 0.4;

/** กล่องมนมุม: กล่องแบ่งละเอียดแล้วดึงเข้าหาทรงกลมบางส่วน (มุมกับขอบมนแบบหินผุ หน้าเรียบยังอยู่) */
function block(hx: number, hy: number, hz: number, round: number, seed: number, rough: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(hx * 2, hy * 2, hz * 2, 7, 6, 7);
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.set(p.getX(i) / hx, p.getY(i) / hy, p.getZ(i) / hz);
    const s = v.clone().normalize().multiplyScalar(1.12);
    v.lerp(s, round);
    const d = 1 + rough * (n3(v.x * 1.3 + seed, v.y * 1.3, v.z * 1.3) * 0.7 + n3(v.x * 4 + seed, v.y * 4, v.z * 4) * 0.3);
    p.setXYZ(i, v.x * hx * d, v.y * hy * d, v.z * hz * d);
  }
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  return mergeVertices(g, 1e-4);
}

/** ย้อมสีหิน: สีเนื้อหิน ด้านล่างชื้นเข้ม ด่างไลเคน มอสบนหน้าที่หงายขึ้น */
function paint(g: THREE.BufferGeometry, base: number, moss: number, lichen: number, seed: number, bands = 0): THREE.BufferGeometry {
  g.computeVertexNormals();
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  const nrm = g.getAttribute('normal') as THREE.BufferAttribute;
  g.computeBoundingBox();
  const bb = g.boundingBox!;
  const col = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  const stone = new THREE.Color(base);
  const mossC = new THREE.Color(0x4a6a2c);
  const lichenC = new THREE.Color(0xc4c6b4);
  const damp = new THREE.Color(0x3a3630);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    c.copy(stone).multiplyScalar(0.9 + 0.2 * n3(x * 2 + seed, y * 2, z * 2));
    if (bands) c.multiplyScalar(Math.floor((y - bb.min.y) / bands) % 2 ? 0.86 : 1.06);
    const t = (y - bb.min.y) / Math.max(1e-3, bb.max.y - bb.min.y);
    // ด่างไลเคนขาวเป็นหย่อมทางครึ่งบน
    if (lichen > 0 && n3(x * 3.1 - seed, y * 3.1, z * 3.1) > 0.35 - lichen * 0.3 && t > 0.3) c.lerp(lichenC, 0.55);
    // มอสเกาะหน้าที่หงายขึ้นกับในร่อง
    const up = nrm.getY(i);
    const m = moss * Math.max(0, up - 0.25) * 1.6 * (0.6 + 0.4 * n3(x * 1.7, y * 1.7 + seed, z * 1.7));
    c.lerp(mossC, Math.min(0.9, m));
    // โคนหินชื้นสีเข้ม
    c.lerp(damp, (1 - Math.min(1, t * 3)) * 0.45);
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

/** ร่องรอยแตกผ่าด้านบน: จุดที่อยู่ใกล้ระนาบแตกยุบลง */
function crack(g: THREE.BufferGeometry, ax: number, az: number, depth: number, width: number): void {
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  g.computeBoundingBox();
  const top = g.boundingBox!.max.y;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const d = Math.abs(x * ax + z * az);
    if (d < width && y > top * 0.1) {
      const k = (1 - d / width) * depth * Math.min(1, (y - top * 0.1) / (top * 0.6));
      p.setY(i, y - k * 0.6);
      p.setX(i, x - Math.sign(x * ax + z * az || 1) * ax * k * 0.4);
      p.setZ(i, z - Math.sign(x * ax + z * az || 1) * az * k * 0.4);
    }
  }
}

const cache = new Map<string, THREE.BufferGeometry>();

/** โมเดลหินชนิดนั้น แบบย่อย 0 หรือ 1 */
export function rockModel(type: RockType, sub: number): THREE.BufferGeometry {
  const key = `${type}:${sub}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const seed = sub * 13.7 + type.length;
  let g: THREE.BufferGeometry;
  if (type === 'granite' || type === 'mossy') {
    g = block(sub ? 1.0 : 0.95, sub ? 0.72 : 0.62, sub ? 0.82 : 0.9, 0.42, seed, 0.09);
    crack(g, sub ? 0.85 : 0.3, sub ? 0.5 : 0.95, 0.22, 0.09);
    g.translate(0, type === 'mossy' ? 0.2 : 0.42, 0);
    g = paint(g, sub ? 0x8a867e : 0x7e7a72, type === 'mossy' ? 1.0 : 0.25, type === 'mossy' ? 0.2 : 0.55, seed);
  } else if (type === 'slab') {
    // แผ่นหินชั้น: ชั้นหนาราว 0.16 ม. เหลื่อมกันออกไปไม่เท่ากัน
    g = block(1.2, 0.32, 0.9, 0.12, seed, 0.05);
    const p = g.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const layer = Math.floor((p.getY(i) + 0.32) / 0.16);
      const off = 1 + (nz.noise(layer * 3.1 + seed, 0.5) * 0.12);
      p.setX(i, p.getX(i) * off);
      p.setZ(i, p.getZ(i) * (2 - off));
    }
    g.translate(0, 0.22, 0);
    g = paint(g, sub ? 0x7c7468 : 0x6a6660, 0.2, 0.35, seed, 0.16);
  } else if (type === 'river') {
    // ก้อนริมน้ำ: กลมแบน ผิวเกลี้ยง น้ำขัดจนมน
    g = new THREE.SphereGeometry(1, 20, 14);
    const p = g.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const d = 1 + 0.05 * n3(p.getX(i) + seed, p.getY(i), p.getZ(i));
      p.setXYZ(i, p.getX(i) * 1.15 * d, p.getY(i) * 0.5 * d, p.getZ(i) * (sub ? 0.85 : 0.95) * d);
    }
    g.deleteAttribute('normal');
    g.deleteAttribute('uv');
    g = mergeVertices(g, 1e-4).translate(0, 0.18, 0);
    g = paint(g, sub ? 0x8e8880 : 0x958a80, 0.15, 0.1, seed);
  } else if (type === 'scree') {
    // เศษหินร่วงจากหน้าผา: เหลี่ยมคม ยังไม่ผุมน
    g = new THREE.DodecahedronGeometry(1, 0);
    const p = g.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (sub ? 0.9 : 0.75), p.getY(i) * 0.55, p.getZ(i) * (sub ? 0.65 : 0.8));
    g.deleteAttribute('uv');
    g = g.toNonIndexed().translate(0, 0.25, 0);
    g = paint(g, sub ? 0x86817a : 0x7a766f, 0.05, 0.2, seed);
    g.computeVertexNormals();
  } else {
    // กองหินโผล่บนยอดเนิน: ก้อนแกรนิตซ้อนกันสามชั้น ก้อนบนเหลื่อมออกไม่ตรงกัน
    const parts = [
      block(1.6, 0.8, 1.3, 0.38, seed, 0.08).translate(0, 0.55, 0),
      block(1.15, 0.62, 1.0, 0.42, seed + 3, 0.08).translate(sub ? 0.35 : -0.3, 1.85, sub ? -0.2 : 0.25),
      block(0.7, 0.45, 0.65, 0.45, seed + 6, 0.08).translate(sub ? -0.25 : 0.3, 2.75, 0.1),
    ];
    const merged = mergeGeometries(parts, false)!;
    g = paint(merged, 0x858179, 0.3, 0.6, seed);
  }
  g.computeBoundingSphere();
  cache.set(key, g);
  return g;
}
