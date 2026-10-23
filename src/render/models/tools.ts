import * as THREE from 'three';
import type { GearId } from '../../core/gear';

// อุปกรณ์ที่ถืออยู่ในมือ ปั้นด้วยโค้ด · ขนาดเล็ก ให้เห็นว่าแขนไหนถืออะไร

const DARK = new THREE.MeshStandardMaterial({ color: 0x3a3f42, roughness: 0.6, metalness: 0.3 });
const MID = new THREE.MeshStandardMaterial({ color: 0x8a9294, roughness: 0.5, metalness: 0.4 });
const HOLO = new THREE.MeshStandardMaterial({ color: 0x6ff0e0, emissive: 0x2fd0c0, emissiveIntensity: 1.4 });
const INK = new THREE.MeshStandardMaterial({ color: 0x1a1020, roughness: 0.3 });
const GLUE = new THREE.MeshStandardMaterial({ color: 0xe8d27a, roughness: 0.4, emissive: 0x3a2a00, emissiveIntensity: 0.3 });
const TANK = new THREE.MeshStandardMaterial({ color: 0x7fd7ff, roughness: 0.35, metalness: 0.2 });
const BAG = new THREE.MeshStandardMaterial({ color: 0x6b6250, roughness: 0.9 });

function box(w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

function cyl(r: number, h: number, m: THREE.Material, x = 0, y = 0, z = 0, rx = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 10), m);
  mesh.position.set(x, y, z);
  mesh.rotation.x = rx;
  mesh.castShadow = true;
  return mesh;
}

/** โมเดลอุปกรณ์ชิ้นนั้น · ปลายอุปกรณ์ชี้ไป -z (ทิศเดียวกับที่ตัวละครหัน) */
export function toolModel(id: GearId): THREE.Group {
  const g = new THREE.Group();
  switch (id) {
    case 'scanner':
      g.add(box(0.08, 0.06, 0.14, DARK), box(0.06, 0.012, 0.08, HOLO, 0, 0.036, -0.01), cyl(0.012, 0.08, MID, 0, 0.05, 0.03));
      break;
    case 'flashlight':
      g.add(cyl(0.025, 0.16, MID, 0, 0, 0, Math.PI / 2), cyl(0.034, 0.04, DARK, 0, 0, -0.09, Math.PI / 2));
      break;
    case 'inkGun':
      g.add(box(0.07, 0.07, 0.2, DARK), cyl(0.02, 0.1, MID, 0, 0.01, -0.14, Math.PI / 2), cyl(0.035, 0.07, INK, 0, 0.07, 0.02), box(0.04, 0.09, 0.04, DARK, 0, -0.07, 0.05));
      break;
    case 'glueGun':
      g.add(box(0.06, 0.06, 0.16, MID), cyl(0.012, 0.08, DARK, 0, 0, -0.11, Math.PI / 2), cyl(0.028, 0.06, GLUE, 0, 0.06, 0.03), box(0.035, 0.08, 0.035, DARK, 0, -0.06, 0.04));
      break;
    case 'climber':
      g.add(cyl(0.012, 0.22, MID, 0, 0.06, 0), box(0.1, 0.02, 0.03, DARK, 0.03, 0.17, -0.01));
      break;
    case 'oxygenTank':
      g.add(cyl(0.04, 0.16, TANK), cyl(0.012, 0.03, DARK, 0, 0.095, 0));
      break;
    case 'bag':
      g.add(box(0.16, 0.18, 0.08, BAG), box(0.12, 0.02, 0.09, DARK, 0, 0.1, 0));
      break;
  }
  return g;
}

/** ก้อนหมึกที่ยิงออกไป */
export function inkBlob(): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 1), INK);
  m.castShadow = false;
  return m;
}

/** รอยหมึกเปื้อนพื้น */
export function inkSplat(): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(0.45, 12).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x0c0810, roughness: 0.2, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
  );
  return m;
}
