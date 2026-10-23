import * as THREE from 'three';

// สัตว์ 12 ชนิด ปั้นด้วยโค้ด · ขยับขา ปีก หาง ด้วยโค้ดตามความเร็ว

export interface AnimalModel {
  root: THREE.Group;
  /** ขยับท่า · speed ความเร็วตอนนี้ */
  animate(dt: number, speed: number, time: number): void;
}

const mat = (c: number, extra: THREE.MeshLambertMaterialParameters = {}) => new THREE.MeshLambertMaterial({ color: c, ...extra });

function part(geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1): THREE.Mesh {
  const mesh = new THREE.Mesh(geo, m);
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  mesh.castShadow = true;
  return mesh;
}

const sphere = (r: number) => new THREE.SphereGeometry(r, 12, 9);

/** สัตว์สี่ขา (กวาง จิ้งจอก หมาป่า หมี กระต่าย) */
function quadruped(o: { body: number; belly?: number; len: number; h: number; leg: number; head: number; color: number; dark: number; antlers?: boolean; tail?: number; ears?: number }): AnimalModel {
  const g = new THREE.Group();
  const c = mat(o.color);
  const d = mat(o.dark);
  const body = part(sphere(o.body), c, 0, o.h, 0, 1, 0.85, o.len);
  g.add(body);
  const neck = new THREE.Group();
  neck.position.set(0, o.h + o.body * 0.4, -o.body * o.len * 0.85);
  const head = part(sphere(o.head), c, 0, o.head * 0.6, -o.head * 0.6, 0.9, 0.9, 1.3);
  neck.add(head);
  const snout = part(sphere(o.head * 0.5), d, 0, o.head * 0.45, -o.head * 1.7, 0.8, 0.7, 1.2);
  neck.add(snout);
  if (o.ears) for (const s of [-1, 1]) neck.add(part(new THREE.ConeGeometry(o.head * 0.3, o.ears, 6), c, s * o.head * 0.5, o.head * 1.3 + o.ears * 0.4, -o.head * 0.4));
  if (o.antlers) {
    for (const s of [-1, 1]) {
      const a = part(new THREE.CylinderGeometry(0.02, 0.03, 0.5, 5), d, s * 0.12, o.head * 1.6 + 0.2, -o.head * 0.3);
      a.rotation.z = s * 0.5;
      neck.add(a);
      const b = part(new THREE.CylinderGeometry(0.015, 0.02, 0.3, 5), d, s * 0.25, o.head * 1.6 + 0.35, -o.head * 0.5);
      b.rotation.set(-0.5, 0, s * 0.9);
      neck.add(b);
    }
  }
  g.add(neck);
  const legs: THREE.Group[] = [];
  for (const [lx, lz] of [[1, -1], [-1, -1], [1, 1], [-1, 1]]) {
    const hip = new THREE.Group();
    hip.position.set(lx * o.body * 0.55, o.h - o.body * 0.3, lz * o.body * o.len * 0.6);
    hip.add(part(new THREE.CylinderGeometry(o.leg * 0.12, o.leg * 0.08, o.leg, 6).translate(0, -o.leg / 2, 0), d));
    g.add(hip);
    legs.push(hip);
  }
  let tail: THREE.Object3D | null = null;
  if (o.tail) {
    tail = part(sphere(o.tail), c, 0, o.h + o.body * 0.2, o.body * o.len * 0.95, 0.6, 0.6, 1.6);
    g.add(tail);
  }
  let phase = 0;
  return {
    root: g,
    animate(dt, speed, time) {
      phase += dt * (2 + speed * 2.2);
      const amp = Math.min(0.8, speed * 0.18);
      legs.forEach((l, i) => (l.rotation.x = Math.sin(phase + (i === 0 || i === 3 ? 0 : Math.PI)) * amp));
      body.position.y = o.h + Math.abs(Math.sin(phase)) * amp * 0.05;
      neck.rotation.x = speed < 0.2 ? Math.sin(time * 0.5) * 0.25 + 0.2 : -0.1;
      if (tail) tail.rotation.y = Math.sin(time * 3) * 0.3;
    },
  };
}

function bird(o: { size: number; color: number; dark: number; wing: number; round?: boolean }): AnimalModel {
  const g = new THREE.Group();
  const c = mat(o.color);
  const d = mat(o.dark);
  g.add(part(sphere(o.size), c, 0, 0, 0, 0.8, 0.75, o.round ? 1.1 : 1.6));
  g.add(part(sphere(o.size * 0.6), c, 0, o.size * 0.35, -o.size * (o.round ? 0.6 : 1.2)));
  g.add(part(new THREE.ConeGeometry(o.size * 0.18, o.size * 0.5, 5).rotateX(-Math.PI / 2), mat(0xd9a64a), 0, o.size * 0.3, -o.size * (o.round ? 1.15 : 1.8)));
  if (o.round) for (const s of [-1, 1]) g.add(part(sphere(o.size * 0.18), mat(0xf2c040, { emissive: 0x302000 }), s * o.size * 0.22, o.size * 0.45, -o.size * 1.05));
  const wings: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const w = new THREE.Group();
    const plane = part(new THREE.BoxGeometry(o.wing, o.size * 0.08, o.size * 1.1).translate((s * o.wing) / 2, 0, 0), d);
    w.add(plane);
    g.add(w);
    wings.push(w);
  }
  let phase = Math.random() * 6;
  return {
    root: g,
    animate(dt, speed) {
      phase += dt * (speed > 0.3 ? 9 : 2);
      const flap = speed > 0.3 ? Math.sin(phase) * 0.7 : 0.05;
      wings[0].rotation.z = -flap;
      wings[1].rotation.z = flap;
    },
  };
}

function fish(): AnimalModel {
  const g = new THREE.Group();
  const c = mat(0x7a8a8a, { emissive: 0x0a1414 });
  g.add(part(sphere(0.12), c, 0, 0, 0, 0.6, 0.8, 2.2));
  const tail = part(new THREE.ConeGeometry(0.1, 0.18, 4).rotateX(Math.PI / 2), c, 0, 0, 0.32);
  g.add(tail);
  let phase = Math.random() * 6;
  return { root: g, animate(dt, speed) { phase += dt * (3 + speed * 4); tail.rotation.y = Math.sin(phase) * 0.6; g.children[0].rotation.y = Math.sin(phase) * 0.1; } };
}

function frog(): AnimalModel {
  const g = new THREE.Group();
  const c = mat(0x4f6e2c);
  g.add(part(sphere(0.09), c, 0, 0.07, 0, 1.1, 0.7, 1.2));
  for (const s of [-1, 1]) {
    g.add(part(sphere(0.03), mat(0xc8c060), s * 0.05, 0.13, -0.07));
    g.add(part(sphere(0.045), c, s * 0.09, 0.03, 0.07, 1, 0.6, 1.6));
  }
  return { root: g, animate(_dt, speed, time) { g.children[0].scale.y = 0.7 + Math.sin(time * 4) * 0.04 + (speed > 0.2 ? 0.2 : 0); } };
}

function butterfly(): AnimalModel {
  const g = new THREE.Group();
  const colors = [0xf2a03c, 0xe8e8f0, 0x7fb0e8, 0xf2d24b];
  const wm = new THREE.MeshLambertMaterial({ color: colors[Math.floor(Math.random() * colors.length)], side: THREE.DoubleSide });
  const wings: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const w = part(new THREE.CircleGeometry(0.06, 6).translate(s * 0.05, 0, 0).rotateX(-Math.PI / 2), wm);
    g.add(w);
    wings.push(w);
  }
  g.add(part(new THREE.CylinderGeometry(0.006, 0.006, 0.07, 4).rotateX(Math.PI / 2), mat(0x222222)));
  let phase = Math.random() * 6;
  return { root: g, animate(dt) { phase += dt * 22; wings[0].rotation.z = Math.sin(phase) * 1.1; wings[1].rotation.z = -Math.sin(phase) * 1.1; } };
}

export function animalModel(id: string): AnimalModel {
  switch (id) {
    case 'deer': return quadruped({ body: 0.35, len: 1.9, h: 0.95, leg: 0.9, head: 0.14, color: 0x8a6440, dark: 0x4a3424, antlers: true, tail: 0.05, ears: 0.12 });
    case 'fox': return quadruped({ body: 0.17, len: 2.2, h: 0.38, leg: 0.36, head: 0.1, color: 0xc0642a, dark: 0x3a2418, tail: 0.1, ears: 0.09 });
    case 'wolf': return quadruped({ body: 0.26, len: 2.1, h: 0.62, leg: 0.6, head: 0.13, color: 0x6e6a62, dark: 0x34322e, tail: 0.09, ears: 0.1 });
    case 'bear': return quadruped({ body: 0.6, len: 1.5, h: 0.95, leg: 0.7, head: 0.26, color: 0x4a3626, dark: 0x2a1e16, ears: 0.08 });
    case 'rabbit': return quadruped({ body: 0.1, len: 1.4, h: 0.16, leg: 0.12, head: 0.07, color: 0x9a8a74, dark: 0x6a5e50, tail: 0.04, ears: 0.13 });
    case 'crow': return bird({ size: 0.12, color: 0x16161a, dark: 0x0e0e12, wing: 0.34 });
    case 'eagle': return bird({ size: 0.26, color: 0x5a4230, dark: 0x3a2a1e, wing: 0.95 });
    case 'owl': return bird({ size: 0.17, color: 0x8a7a60, dark: 0x5a4c3a, wing: 0.42, round: true });
    case 'fish': return fish();
    case 'frog': return frog();
    case 'butterfly': return butterfly();
    default: return { root: new THREE.Group(), animate() {} };
  }
}
