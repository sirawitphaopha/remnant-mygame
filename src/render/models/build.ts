import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Simplex2 } from '../../world/noise';

const jitterNoise = new Simplex2(911);

/** ชิ้นส่วนหนึ่งของโมเดล · สีหนึ่งสี ค่าไหวตามลมตามความสูง */
export interface Part {
  geo: THREE.BufferGeometry;
  color: THREE.ColorRepresentation;
  /** สุ่มสีเพิ่มลดกี่ส่วน */
  vary?: number;
  /** ไหวตามลม: ค่าที่โคนกับยอดของชิ้นนี้ */
  sway?: [number, number];
}

/** ขยับจุดยอดแบบสุ่มให้ไม่เรียบเหมือนเครื่องจักร */
export function jitter(src: THREE.BufferGeometry, amount: number, scale = 1.3, seed = 0, smoothShade = true): THREE.BufferGeometry {
  // รวมจุดซ้ำก่อน แสงเงาจะนุ่มไม่เป็นเหลี่ยม
  src.deleteAttribute('normal');
  src.deleteAttribute('uv');
  const g = smoothShade ? mergeVertices(src, 0.0001) : src;
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const n = jitterNoise.noise(x * scale + seed, z * scale + y * 0.7 - seed);
    const m = jitterNoise.noise(y * scale - seed, x * scale + 3);
    p.setXYZ(i, x + n * amount, y + m * amount * 0.6, z + jitterNoise.noise(z * scale, y * scale + seed) * amount);
  }
  g.computeVertexNormals();
  return g;
}

/** รวมชิ้นส่วนเป็นรูปทรงเดียว พร้อมสีประจำจุดและค่าไหวตามลม */
export function assemble(parts: Part[]): THREE.BufferGeometry {
  const tmp = new THREE.Color();
  const geos = parts.map((part, pi) => {
    const g = part.geo.index ? part.geo.toNonIndexed() : part.geo;
    if (g.getAttribute('uv')) g.deleteAttribute('uv');
    const p = g.getAttribute('position') as THREE.BufferAttribute;
    g.computeBoundingBox();
    const bb = g.boundingBox!;
    const col = new Float32Array(p.count * 3);
    const sway = new Float32Array(p.count);
    const base = new THREE.Color(part.color);
    for (let i = 0; i < p.count; i++) {
      const v = part.vary ?? 0.08;
      const r = jitterNoise.noise(p.getX(i) * 2.1 + pi, p.getZ(i) * 2.1 + p.getY(i));
      tmp.copy(base).multiplyScalar(1 + r * v);
      col[i * 3] = tmp.r;
      col[i * 3 + 1] = tmp.g;
      col[i * 3 + 2] = tmp.b;
      const s = part.sway ?? [0, 0];
      const t = (p.getY(i) - bb.min.y) / Math.max(0.001, bb.max.y - bb.min.y);
      sway[i] = s[0] + (s[1] - s[0]) * t;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('sway', new THREE.BufferAttribute(sway, 1));
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    return g;
  });
  const merged = mergeGeometries(geos, false)!;
  merged.computeBoundingSphere();
  return merged;
}

/**
 * รวมชิ้นส่วนของโมเดลที่นิ่ง (ไม่มีชิ้นขยับ) ที่ใช้วัสดุเดียวกันเป็นชิ้นเดียว · ภาพเหมือนเดิม วาดน้อยครั้งลง
 * (รถคันหนึ่งเดิมวาดราว 13 ครั้ง เสาไฟ 5 ครั้ง · ในเมืองมีรถกับเสาไฟหลายสิบชิ้น)
 */
export function flattenStatic(root: THREE.Object3D): void {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert();
  const byMat = new Map<THREE.Material, THREE.Mesh[]>();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || (m as THREE.InstancedMesh).isInstancedMesh || Array.isArray(m.material) || m.children.length) return;
    const l = byMat.get(m.material) ?? [];
    l.push(m);
    byMat.set(m.material, l);
  });
  for (const [mat, list] of byMat) {
    if (list.length < 2) continue;
    let geos = list.map((m) => m.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld)));
    // ใช้เฉพาะข้อมูลจุดที่ทุกชิ้นมี · มีดัชนีบ้างไม่มีบ้าง แปลงเป็นแบบไม่มีดัชนีทั้งหมด
    const names = Object.keys(geos[0].attributes).filter((n) => geos.every((g) => g.getAttribute(n)));
    for (const g of geos) for (const n of Object.keys(g.attributes)) if (!names.includes(n)) g.deleteAttribute(n);
    if (!geos.every((g) => !!g.index === !!geos[0].index)) geos = geos.map((g) => (g.index ? g.toNonIndexed() : g));
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    const one = new THREE.Mesh(merged, mat);
    one.castShadow = list.some((m) => m.castShadow);
    one.receiveShadow = list.some((m) => m.receiveShadow);
    for (const m of list) m.removeFromParent();
    root.add(one);
  }
}
