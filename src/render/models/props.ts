import { STREET } from '../../config/scale';
import * as THREE from 'three';
import { jitter } from './build';

// ของมนุษย์ที่พังแล้ว · ยาน · ของชิ้นเล็ก · ปั้นด้วยโค้ดทั้งหมด

const mat = (color: number, rough = 0.85, metal = 0.1, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });

const RUST = mat(0x6e4a34, 0.95, 0.3);
const RUST2 = mat(0x7f5a3c, 0.9, 0.25);
const PAINT_FADED = [mat(0x5d6e74, 0.85, 0.3), mat(0x7a6a4f, 0.85, 0.3), mat(0x6d4d4a, 0.85, 0.3), mat(0x8c8a80, 0.85, 0.3)];
const GLASS_DARK = mat(0x1b2226, 0.25, 0.4, { transparent: true, opacity: 0.75 });
const TIRE = mat(0x1d1d1d, 1);
const MOSS = mat(0x3f5a26, 1);
const METAL = mat(0x6a6e70, 0.6, 0.6);
const POST = mat(0x5c5f60, 0.7, 0.5);

function m(geo: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function mossPatch(r: number, x: number, y: number, z: number): THREE.Mesh {
  const moss = m(jitter(new THREE.IcosahedronGeometry(r, 1).scale(1, 0.25, 1), r * 0.25, 2), MOSS, x, y, z);
  moss.userData.moss = true; // เทสขนาดของจริงวัดเฉพาะตัวรถ ไม่นับมอสที่ขึ้นทับ
  return moss;
}

export function carModel(variant: number): THREE.Group {
  const g = new THREE.Group();
  const paint = PAINT_FADED[variant % PAINT_FADED.length];
  // รถเก๋งยาว 4.5 กว้าง 1.8 สูง 1.45 ม. (src/config/scale.ts)
  g.add(m(new THREE.BoxGeometry(1.8, 0.7, 4.5), paint, 0, 0.55, 0));
  g.add(m(new THREE.BoxGeometry(1.6, 0.6, 2.4), paint, 0, 1.15, 0.2));
  g.add(m(new THREE.BoxGeometry(1.62, 0.42, 0.06), GLASS_DARK, 0, 1.18, -1.02));
  g.add(m(new THREE.BoxGeometry(0.06, 0.4, 2.0), GLASS_DARK, 0.81, 1.18, 0.2), m(new THREE.BoxGeometry(0.06, 0.4, 2.0), GLASS_DARK, -0.81, 1.18, 0.2));
  // สนิมเป็นแผ่น
  g.add(m(new THREE.BoxGeometry(1.82, 0.25, 1.2), RUST, 0, 0.42, 1.5), m(new THREE.BoxGeometry(1.0, 0.05, 1.1), RUST2, 0.3, 0.91, -1.5));
  // ล้อแบน ยางแตก
  for (const [x, z] of [[0.78, 1.45], [-0.78, 1.45], [0.78, -1.45], [-0.78, -1.45]]) {
    const w = m(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 12).rotateZ(Math.PI / 2), TIRE, x, 0.26, z);
    w.scale.y = 0.8;
    g.add(w);
  }
  g.add(mossPatch(0.6, 0.2, 1.45, 0.5), mossPatch(0.45, -0.3, 0.9, -1.75));
  g.rotation.z = (variant % 3 - 1) * 0.03;
  return g;
}

export function busModel(): THREE.Group {
  const g = new THREE.Group();
  const body = mat(0x8a7a3a, 0.9, 0.2);
  // รถบัสยาว 12 กว้าง 2.5 สูง 3.2 ม.
  g.add(m(new THREE.BoxGeometry(2.5, 2.85, 12), body, 0, 1.775, 0));
  for (let i = 0; i < 7; i++) {
    g.add(m(new THREE.BoxGeometry(2.54, 0.85, 1.25), GLASS_DARK, 0, 2.4, -4.8 + i * 1.6));
  }
  g.add(m(new THREE.BoxGeometry(2.56, 0.5, 12.02), RUST, 0, 0.6, 0));
  for (const z of [4.2, -4.2]) for (const x of [1.2, -1.2]) g.add(m(new THREE.CylinderGeometry(0.5, 0.5, 0.3, 12).rotateZ(Math.PI / 2), TIRE, x, 0.45, z));
  g.add(mossPatch(1.2, 0.3, 3.2, 1.8), mossPatch(1.0, -0.4, 3.2, -3.6));
  g.rotation.z = 0.06;
  return g;
}

export function lampModel(): THREE.Group {
  const g = new THREE.Group();
  // เสาไฟถนนสูง 8 ม.
  g.add(m(new THREE.CylinderGeometry(0.09, 0.14, 8, 8).translate(0, 4, 0), POST));
  g.add(m(new THREE.CylinderGeometry(0.05, 0.05, 1.8, 6).rotateZ(Math.PI / 2).translate(0.85, 7.9, 0), POST));
  g.add(m(new THREE.BoxGeometry(0.55, 0.18, 0.3), METAL, 1.65, 7.8, 0));
  g.rotation.z = 0.05;
  return g;
}

export function mailboxModel(): THREE.Group {
  const g = new THREE.Group();
  const blue = mat(0x2f4e78, 0.8, 0.3);
  g.add(m(new THREE.BoxGeometry(0.55, 0.9, 0.5), blue, 0, 0.95, 0));
  g.add(m(new THREE.CylinderGeometry(0.275, 0.275, 0.5, 12, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2), blue, 0, 1.4, 0));
  g.add(m(new THREE.BoxGeometry(0.4, 0.04, 0.02), METAL, 0, 1.15, -0.26));
  g.add(m(new THREE.BoxGeometry(0.4, 0.5, 0.4), RUST, 0, 0.25, 0));
  // ปั้นไว้สูง 1.675 ม. ย่อความสูงเหลือ 1.27 ม. ตามตู้จริง
  g.scale.y = STREET.mailboxHeight / 1.675;
  return g;
}

function textTexture(text: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 160;
  const x = c.getContext('2d')!;
  x.fillStyle = '#2f6b52';
  x.fillRect(0, 0, 512, 160);
  x.strokeStyle = '#e8efe8';
  x.lineWidth = 8;
  x.strokeRect(10, 10, 492, 140);
  x.fillStyle = '#eef2ec';
  x.font = 'bold 54px "Roboto Mono", monospace';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(text, 256, 84, 470);
  // รอยสนิมกับสีลอก
  for (let i = 0; i < 60; i++) {
    x.fillStyle = `rgba(${90 + Math.random() * 40},${60 + Math.random() * 20},40,${0.15 + Math.random() * 0.35})`;
    x.beginPath();
    x.arc(Math.random() * 512, Math.random() * 160, 2 + Math.random() * 12, 0, Math.PI * 2);
    x.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function signModel(text: string): THREE.Group {
  const g = new THREE.Group();
  g.add(m(new THREE.CylinderGeometry(0.06, 0.06, 3, 8).translate(0, 1.5, 0), POST));
  const face = new THREE.MeshStandardMaterial({ map: textTexture(text), roughness: 0.7, metalness: 0.2 });
  const plate = m(new THREE.BoxGeometry(2.2, 0.7, 0.05), [POST, POST, POST, POST, face, face] as unknown as THREE.Material, 0, 2.7, 0);
  (plate as THREE.Mesh).material = [POST, POST, POST, POST, face, face];
  plate.rotation.z = 0.06;
  g.add(plate);
  return g;
}

/** ยานของเอเลี่ยน · ทรงยานลงจอดสามขา มีไฟรอบตัว */
export function shipModel(): THREE.Group {
  const g = new THREE.Group();
  const hull = mat(0xc9ccc8, 0.4, 0.6);
  const dark = mat(0x2b3034, 0.5, 0.6);
  const glow = mat(0x6ff0e0, 0.3, 0, { emissive: 0x2fd0c0, emissiveIntensity: 2 });
  g.add(m(new THREE.CylinderGeometry(4.2, 5.2, 1.6, 32), hull, 0, 3.2, 0));
  g.add(m(new THREE.SphereGeometry(3.2, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.55, 1), hull, 0, 4.0, 0));
  g.add(m(new THREE.CylinderGeometry(5.25, 5.25, 0.25, 32), dark, 0, 2.5, 0));
  g.add(m(new THREE.SphereGeometry(1.2, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.7, 1), mat(0x6fb7c9, 0.1, 0.2, { transparent: true, opacity: 0.6 }), 0, 5.7, 0));
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    g.add(m(new THREE.SphereGeometry(0.12, 8, 6), glow, Math.cos(a) * 5.0, 2.95, Math.sin(a) * 5.0));
  }
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    const leg = m(new THREE.CylinderGeometry(0.15, 0.2, 3.4, 8), dark, Math.cos(a) * 3.6, 1.4, Math.sin(a) * 3.6);
    leg.rotation.z = Math.cos(a) * 0.35;
    leg.rotation.x = -Math.sin(a) * 0.35;
    g.add(leg, m(new THREE.CylinderGeometry(0.6, 0.7, 0.15, 12), dark, Math.cos(a) * 4.2, 0.08, Math.sin(a) * 4.2));
  }
  // ทางลาดลงมาที่พื้น
  const ramp = m(new THREE.BoxGeometry(1.6, 0.12, 3.2), dark, 0, 1.3, 4.8);
  ramp.rotation.x = 0.55;
  g.add(ramp, m(new THREE.BoxGeometry(1.4, 1.5, 0.1), glow, 0, 2.6, 3.95));
  return g;
}

// ===== ของชิ้นเล็ก =====
const FUR = mat(0x8a5e3c, 1);
const PLASTIC = (c: number) => mat(c, 0.5, 0.1);

export function smallItemModel(kind: string): THREE.Group {
  const g = new THREE.Group();
  switch (kind) {
    case 'teddy':
      g.add(m(new THREE.SphereGeometry(0.11, 12, 10).scale(1, 1.15, 0.9), FUR, 0, 0.12, 0), m(new THREE.SphereGeometry(0.08, 12, 10), FUR, 0, 0.3, 0));
      for (const s of [-1, 1]) g.add(m(new THREE.SphereGeometry(0.03, 8, 6), FUR, s * 0.06, 0.37, 0), m(new THREE.SphereGeometry(0.04, 8, 6), FUR, s * 0.11, 0.13, -0.02), m(new THREE.SphereGeometry(0.045, 8, 6), FUR, s * 0.06, 0.02, -0.04));
      break;
    case 'phone':
      g.add(m(new THREE.BoxGeometry(0.075, 0.01, 0.15), PLASTIC(0x16181a), 0, 0.006, 0), m(new THREE.BoxGeometry(0.068, 0.002, 0.135), mat(0x0a0c10, 0.1, 0.5), 0, 0.012, 0));
      break;
    case 'bottle': {
      const pts = [[0, 0], [0.04, 0], [0.042, 0.16], [0.03, 0.2], [0.014, 0.23], [0.014, 0.27], [0, 0.27]].map(([x, y]) => new THREE.Vector2(x, y));
      g.add(m(new THREE.LatheGeometry(pts, 14), mat(0x4f8a5c, 0.1, 0.1, { transparent: true, opacity: 0.7 })));
      g.rotation.z = Math.PI / 2;
      g.position.y = 0.04;
      break;
    }
    case 'watch':
      g.add(m(new THREE.TorusGeometry(0.035, 0.008, 6, 16).rotateX(Math.PI / 2), PLASTIC(0x2a2018), 0, 0.01, 0), m(new THREE.CylinderGeometry(0.02, 0.02, 0.01, 14), METAL, 0, 0.012, 0.03));
      break;
    case 'glasses':
      for (const s of [-1, 1]) g.add(m(new THREE.TorusGeometry(0.025, 0.004, 6, 14), PLASTIC(0x202020), s * 0.032, 0.03, 0));
      g.add(m(new THREE.BoxGeometry(0.02, 0.004, 0.004), PLASTIC(0x202020), 0, 0.034, 0));
      break;
    case 'frame':
      g.add(m(new THREE.BoxGeometry(0.22, 0.28, 0.025), mat(0x5a3a22, 0.7), 0, 0.14, 0), m(new THREE.BoxGeometry(0.17, 0.22, 0.027), mat(0xc8b89a, 0.6), 0, 0.14, 0));
      g.rotation.x = -0.3;
      break;
    case 'toycar':
      g.add(m(new THREE.BoxGeometry(0.06, 0.03, 0.12), PLASTIC(0xc03a2a), 0, 0.03, 0), m(new THREE.BoxGeometry(0.05, 0.025, 0.06), PLASTIC(0xc03a2a), 0, 0.055, 0.005));
      for (const [x, z] of [[0.03, 0.04], [-0.03, 0.04], [0.03, -0.04], [-0.03, -0.04]]) g.add(m(new THREE.CylinderGeometry(0.014, 0.014, 0.01, 10).rotateZ(Math.PI / 2), TIRE, x, 0.014, z));
      break;
    case 'book':
      g.add(m(new THREE.BoxGeometry(0.16, 0.04, 0.22), mat(0x6a2f2a, 0.8), 0, 0.02, 0), m(new THREE.BoxGeometry(0.15, 0.036, 0.21), mat(0xe8dfc8, 0.9), 0.006, 0.02, 0));
      break;
    case 'keys':
      g.add(m(new THREE.TorusGeometry(0.02, 0.003, 6, 14).rotateX(Math.PI / 2), METAL, 0, 0.005, 0));
      for (const a of [0.3, 1.2, 2.2]) g.add(m(new THREE.BoxGeometry(0.008, 0.003, 0.05), mat(0xb89a4a, 0.4, 0.8), Math.cos(a) * 0.03, 0.005, Math.sin(a) * 0.03));
      break;
    case 'coin':
      g.add(m(new THREE.CylinderGeometry(0.012, 0.012, 0.002, 16), mat(0xc9a24a, 0.35, 0.9), 0, 0.002, 0));
      break;
    default:
      g.add(m(new THREE.BoxGeometry(0.1, 0.1, 0.1), METAL, 0, 0.05, 0));
  }
  return g;
}

/** กระเป๋าที่วางไว้บนพื้น · ส่งสัญญาณแล้วมีไฟสีม่วงกะพริบ */
export function droppedBagModel(): THREE.Group {
  const g = new THREE.Group();
  g.add(m(new THREE.BoxGeometry(0.4, 0.45, 0.25), mat(0x6b6250, 0.9), 0, 0.22, 0), m(new THREE.BoxGeometry(0.3, 0.05, 0.27), mat(0x3a3f42, 0.6), 0, 0.46, 0));
  const beacon = m(new THREE.SphereGeometry(0.06, 10, 8), mat(0xc7a5ff, 0.3, 0, { emissive: 0x9a6fff, emissiveIntensity: 2 }), 0, 0.55, 0);
  beacon.name = 'beacon';
  beacon.visible = false;
  g.add(beacon);
  return g;
}
