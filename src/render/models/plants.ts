import * as THREE from 'three';
import type { PlantKind, TreeKind } from '../../world/scatter';
import { assemble, jitter, type Part } from './build';

// ต้นไม้ หิน และพืชเล็ก ปั้นด้วยโค้ดทั้งหมด · หน่วยเมตร โคนต้นอยู่ที่ y = 0

const BARK = 0x4a3a2c;
const BARK_GREY = 0x6b645b;

function cone(r: number, h: number, y: number, seg = 9): THREE.BufferGeometry {
  return new THREE.ConeGeometry(r, h, seg, 3, true).translate(0, y + h / 2, 0);
}

function trunk(r0: number, r1: number, h: number, seg = 7): THREE.BufferGeometry {
  return new THREE.CylinderGeometry(r1, r0, h, seg, 3).translate(0, h / 2, 0);
}

function blob(r: number, x: number, y: number, z: number, detail = 1, sy = 1): THREE.BufferGeometry {
  return jitter(new THREE.IcosahedronGeometry(r, detail).scale(1, sy, 1), r * 0.22, 1.1, x + z).translate(x, y, z);
}

export function treeGeometry(kind: TreeKind, lod: 'near' | 'far'): THREE.BufferGeometry {
  const parts: Part[] = [];
  if (kind === 'pine') {
    const H = 11;
    parts.push({ geo: trunk(0.32, 0.1, H * 0.95, lod === 'near' ? 7 : 5), color: BARK, sway: [0, 0.1] });
    if (lod === 'near') {
      const tiers = 6;
      for (let i = 0; i < tiers; i++) {
        const t = i / (tiers - 1);
        const r = 2.5 * (1 - t * 0.78);
        parts.push({ geo: jitter(cone(r, 3.0 - t * 0.9, 2.2 + t * 7.6, 10), 0.22, 1.5, i), color: i % 2 ? 0x24402a : 0x2b4a2f, vary: 0.12, sway: [0.15 + t * 0.4, 0.3 + t * 0.6] });
      }
    } else {
      parts.push({ geo: cone(2.4, 9.5, 2.0, 6), color: 0x284530, sway: [0.2, 0.8] });
    }
  } else if (kind === 'oak') {
    parts.push({ geo: trunk(0.45, 0.28, 3.6, lod === 'near' ? 8 : 5), color: BARK, sway: [0, 0.05] });
    if (lod === 'near') {
      parts.push({ geo: trunk(0.18, 0.08, 2.6, 5).rotateZ(0.8).translate(0.9, 3.0, 0), color: BARK, sway: [0.05, 0.2] });
      parts.push({ geo: trunk(0.16, 0.07, 2.4, 5).rotateZ(-0.7).rotateY(2.2).translate(-0.7, 3.1, 0.5), color: BARK, sway: [0.05, 0.2] });
      const blobs: [number, number, number, number][] = [[2.3, 0, 5.4, 0], [1.8, 1.7, 4.8, 0.4], [1.7, -1.5, 5.0, -0.6], [1.6, 0.3, 4.6, 1.7], [1.6, -0.4, 5.0, -1.7], [1.5, 0.4, 6.6, 0.2]];
      blobs.forEach(([r, x, y, z], i) => parts.push({ geo: blob(r, x, y, z), color: i % 2 ? 0x3c5a26 : 0x47662c, vary: 0.14, sway: [0.35, 0.7] }));
    } else {
      parts.push({ geo: blob(3.0, 0, 5.3, 0, 0, 0.85), color: 0x42602a, sway: [0.3, 0.6] });
    }
  } else if (kind === 'birch') {
    const H = 9;
    parts.push({ geo: trunk(0.2, 0.08, H, lod === 'near' ? 7 : 5), color: 0xd9d6cc, vary: 0.25, sway: [0, 0.2] });
    if (lod === 'near') {
      for (let i = 0; i < 4; i++) {
        const a = i * 1.7;
        parts.push({ geo: blob(1.2 + (i % 2) * 0.3, Math.cos(a) * 0.8, 5.6 + i * 0.9, Math.sin(a) * 0.8, 1, 1.5), color: i % 2 ? 0x6c8a35 : 0x7d9940, vary: 0.15, sway: [0.4, 0.9] });
      }
    } else {
      parts.push({ geo: blob(1.7, 0, 7, 0, 0, 1.8), color: 0x739238, sway: [0.4, 0.8] });
    }
  } else {
    parts.push({ geo: jitter(trunk(0.35, 0.12, 7, 6), 0.08, 1, 3), color: BARK_GREY, vary: 0.15 });
    if (lod === 'near') {
      parts.push({ geo: trunk(0.12, 0.03, 3, 4).rotateZ(1.0).translate(1.1, 4, 0), color: BARK_GREY });
      parts.push({ geo: trunk(0.1, 0.03, 2.6, 4).rotateZ(-0.9).rotateY(1.9).translate(-0.6, 5, 0.6), color: BARK_GREY });
      parts.push({ geo: trunk(0.08, 0.02, 2, 4).rotateZ(0.7).rotateY(-2).translate(0.2, 5.8, -0.8), color: BARK_GREY });
    }
  }
  return assemble(parts);
}

export function rockGeometry(variant: number): THREE.BufferGeometry {
  const g = jitter(new THREE.IcosahedronGeometry(1, 2).scale(1.2, 0.75, 1), 0.28, 0.9, variant * 7.3, false).translate(0, 0.35, 0);
  const geo = assemble([{ geo: g, color: 0x5f5a52, vary: 0.18 }]);
  // มอสขึ้นด้านบนของหิน
  const n = geo.getAttribute('normal') as THREE.BufferAttribute;
  const c = geo.getAttribute('color') as THREE.BufferAttribute;
  const moss = new THREE.Color(0x4f6430);
  const tmp = new THREE.Color();
  for (let i = 0; i < n.count; i++) {
    const up = n.getY(i);
    if (up > 0.55) {
      tmp.setRGB(c.getX(i), c.getY(i), c.getZ(i)).lerp(moss, Math.min(1, (up - 0.55) * 2.2) * 0.75);
      c.setXYZ(i, tmp.r, tmp.g, tmp.b);
    }
  }
  return geo;
}

function frond(len: number, angle: number, tilt: number): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(0.16, len, 1, 5).translate(0, len / 2, 0);
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const t = y / len;
    p.setX(i, p.getX(i) * (1 - t * 0.85) * (1 + Math.sin(t * Math.PI) * 1.6));
    p.setZ(i, -t * t * len * 0.55);
  }
  g.rotateX(-tilt).rotateY(angle);
  g.computeVertexNormals();
  return g;
}

export function plantGeometry(kind: PlantKind, variant = 0): THREE.BufferGeometry {
  const parts: Part[] = [];
  if (kind === 'fern') {
    for (let i = 0; i < 8; i++) parts.push({ geo: frond(0.85 + (i % 3) * 0.15, (i / 8) * Math.PI * 2, 0.45 + (i % 2) * 0.25), color: i % 2 ? 0x3d6a2a : 0x4c7a30, vary: 0.15, sway: [0, 0.6] });
  } else if (kind === 'flower') {
    for (let i = 0; i < 4; i++) {
      const a = i * 1.9;
      const x = Math.cos(a) * 0.12;
      const z = Math.sin(a) * 0.12;
      const h = 0.35 + (i % 3) * 0.1;
      parts.push({ geo: new THREE.CylinderGeometry(0.008, 0.012, h, 3).translate(x, h / 2, z), color: 0x5b8a34, sway: [0, 1] });
      parts.push({ geo: new THREE.IcosahedronGeometry(0.045, 0).translate(x, h + 0.02, z), color: FLOWER_COLORS[(i * 2 + variant) % FLOWER_COLORS.length], vary: 0.05, sway: [1, 1] });
    }
  } else if (kind === 'bush') {
    parts.push({ geo: blob(0.55, 0, 0.45, 0), color: 0x3f5f28, vary: 0.14, sway: [0, 0.25] });
    parts.push({ geo: blob(0.42, 0.4, 0.35, 0.2), color: 0x4a6b2d, vary: 0.14, sway: [0, 0.25] });
    parts.push({ geo: blob(0.38, -0.35, 0.32, -0.25), color: 0x37552a, vary: 0.14, sway: [0, 0.25] });
  } else if (kind === 'mushroom') {
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * 0.09;
      const h = 0.09 + i * 0.03;
      parts.push({ geo: new THREE.CylinderGeometry(0.012, 0.016, h, 5).translate(x, h / 2, i * 0.05), color: 0xe8dcc4 });
      parts.push({ geo: new THREE.SphereGeometry(0.045 + i * 0.01, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2).translate(x, h, i * 0.05), color: 0x9a4a2a, vary: 0.2 });
    }
  } else {
    parts.push({ geo: jitter(new THREE.IcosahedronGeometry(0.28, 1).scale(1.3, 0.12, 1), 0.08, 2.5, 4), color: 0x46592a, vary: 0.25 });
  }
  return assemble(parts);
}

/** สีดอกไม้ป่าหลายสี (ใช้ย้อมทีละต้น) */
export const FLOWER_COLORS = [0xf4f0e6, 0xf2d24b, 0xb58ad8, 0xe06a5a, 0x7fb0e8, 0xf0a0c0];
