import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ANIMAL_SHOULDER } from '../../config/scale';

// สัตว์ปั้นด้วยโค้ด · ขยับขา ปีก หาง ตามความเร็วและท่าทาง
// รอบสอง ช่วง 12: ชิ้นที่ไม่ขยับรวมเป็นเมชเดียวใส่สีต่อจุด (ลำตัว · หัว · ขาละชิ้น) วาดเบาลงราวครึ่งหนึ่ง
// ท่าทางตามระบบนิเวศ: เล็มหญ้า ระวังภัย นอนพัก ก้มกินน้ำ กินซาก หมียืนสองขา หมีจับปลา ตาย กระรอกปีนต้นไม้

/** ท่าทาง · walk ใช้ความเร็วขยับขา */
export type Pose = 'walk' | 'graze' | 'alert' | 'rest' | 'drink' | 'eat' | 'rear' | 'fish' | 'dead' | 'climbUp' | 'climbDown' | 'perch';

export interface AnimalModel {
  root: THREE.Group;
  /** ขยับท่า · speed ความเร็วตอนนี้ */
  animate(dt: number, speed: number, time: number, pose?: Pose): void;
  /** ย้อมสีทั้งตัว (ซากที่ถูกกินแล้วสีคล้ำลง) */
  tint?(k: number): void;
}

/** วัสดุร่วมของสัตว์ทุกตัว (สีต่อจุด) · ซากใช้ตัวที่สองที่ย้อมได้ต่อตัว */
const SHARED = new THREE.MeshLambertMaterial({ vertexColors: true });

interface Bit { geo: THREE.BufferGeometry; color: number; x?: number; y?: number; z?: number; sx?: number; sy?: number; sz?: number; rx?: number; ry?: number; rz?: number }

/** รวมชิ้นส่วนเป็นรูปทรงเดียว ใส่สีของแต่ละชิ้นเป็นสีต่อจุด */
function bake(bits: Bit[]): THREE.BufferGeometry {
  const c = new THREE.Color();
  const parts = bits.map((b) => {
    const g = b.geo.index ? b.geo.toNonIndexed() : b.geo.clone();
    g.deleteAttribute('uv');
    g.scale(b.sx ?? 1, b.sy ?? 1, b.sz ?? 1);
    g.rotateX(b.rx ?? 0).rotateY(b.ry ?? 0).rotateZ(b.rz ?? 0);
    g.translate(b.x ?? 0, b.y ?? 0, b.z ?? 0);
    c.setHex(b.color);
    const n = g.getAttribute('position').count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  });
  return mergeGeometries(parts, false)!;
}

function mesh(geo: THREE.BufferGeometry, m: THREE.Material = SHARED, name = ''): THREE.Mesh {
  const me = new THREE.Mesh(geo, m);
  me.castShadow = true;
  me.name = name;
  return me;
}

const sphere = (r: number) => new THREE.SphereGeometry(r, 12, 9);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

interface QuadOpts {
  /** สูงถึงไหล่ (ยอดลำตัว) */
  shoulder: number;
  body: number;
  len: number;
  head: number;
  color: number;
  dark: number;
  belly?: number;
  antlers?: boolean;
  tail?: number;
  /** หางฟูงอขึ้น (จิ้งจอก กระรอก) */
  bushy?: boolean;
  ears?: number;
  /** คอยาวเท่าไร เงยขึ้นกี่องศาจากแนวนอน (กวางคอตั้ง หมาป่าคอยื่นไปข้างหน้า) */
  neck: number;
  neckUp: number;
}

/** สัตว์สี่ขา (กวาง จิ้งจอก หมาป่า หมี กระต่าย กระรอก) · root หมุนตามทิศ · pivot ที่สะโพกหลังไว้ยืนสองขา · inner ไว้นอน ตาย ปีน */
function quadruped(o: QuadOpts): AnimalModel {
  const root = new THREE.Group();
  const h = o.shoulder - o.body * 0.85;
  const leg = h - o.body * 0.3;
  const hipZ = o.body * o.len * 0.6;
  const pivot = new THREE.Group();
  pivot.position.z = hipZ;
  root.add(pivot);
  const inner = new THREE.Group();
  inner.position.z = -hipZ;
  pivot.add(inner);
  // ลำตัว (ท้องสีอ่อนกว่าหลัง)
  const bodyBits: Bit[] = [{ geo: sphere(o.body), color: o.color, y: h, sx: 1, sy: 0.85, sz: o.len }];
  if (o.belly !== undefined) bodyBits.push({ geo: sphere(o.body * 0.92), color: o.belly, y: h - o.body * 0.18, sx: 0.9, sy: 0.7, sz: o.len * 0.92 });
  const body = mesh(bake(bodyBits), SHARED, 'body');
  inner.add(body);
  // คอกับหัว · จุดหมุนอยู่ที่ไหล่ด้านหน้า คอยื่นขึ้นไปข้างหน้า หัวอยู่ปลายคอ (เดิมหัวจมอยู่ในลำตัว มองไม่เห็นหัวกวาง)
  const neck = new THREE.Group();
  neck.position.set(0, h + o.body * 0.45, -o.body * o.len * 0.8);
  const up = (o.neckUp * Math.PI) / 180;
  const ny = Math.sin(up) * o.neck;
  const nz = -Math.cos(up) * o.neck;
  const hy = ny + o.head * 0.35;
  const hz = nz - o.head * 0.55;
  const hb: Bit[] = [
    { geo: new THREE.CylinderGeometry(o.head * 0.55, o.body * 0.42, Math.max(0.01, o.neck), 7).translate(0, o.neck / 2, 0), color: o.color, rx: -(Math.PI / 2 - up) },
    { geo: sphere(o.head), color: o.color, y: hy, z: hz, sx: 0.9, sy: 0.9, sz: 1.3 },
    { geo: sphere(o.head * 0.5), color: o.dark, y: hy - o.head * 0.15, z: hz - o.head * 1.1, sx: 0.8, sy: 0.7, sz: 1.2 },
  ];
  for (const s of [-1, 1]) hb.push({ geo: sphere(o.head * 0.12), color: 0x111111, x: s * o.head * 0.55, y: hy + o.head * 0.25, z: hz - o.head * 0.55 });
  if (o.ears) for (const s of [-1, 1]) hb.push({ geo: new THREE.ConeGeometry(o.head * 0.3, o.ears, 6), color: o.color, x: s * o.head * 0.5, y: hy + o.head * 0.7 + o.ears * 0.4, z: hz + o.head * 0.2 });
  if (o.antlers) {
    for (const s of [-1, 1]) {
      hb.push({ geo: new THREE.CylinderGeometry(0.02, 0.03, 0.5, 5), color: o.dark, x: s * 0.12, y: hy + o.head + 0.2, z: hz + o.head * 0.3, rz: s * 0.5 });
      hb.push({ geo: new THREE.CylinderGeometry(0.015, 0.02, 0.3, 5), color: o.dark, x: s * 0.25, y: hy + o.head + 0.35, z: hz + o.head * 0.1, rx: -0.5, rz: s * 0.9 });
    }
  }
  neck.add(mesh(bake(hb)));
  // มุมก้มที่ทำให้ปากถึงพื้นหญ้า (ท่าเล็มหญ้า กินน้ำ)
  const reach = neck.position.y - o.head * 0.5;
  const dip = -Math.min(2.4, up + Math.asin(Math.min(1, reach / (o.neck + o.head * 1.6))));
  inner.add(neck);
  // ขา: หน้า 2 หลัง 2
  const legs: THREE.Group[] = [];
  const legGeo = bake([{ geo: new THREE.CylinderGeometry(leg * 0.12, leg * 0.08, leg, 6).translate(0, -leg / 2, 0), color: o.dark }]);
  for (const [lx, lz] of [[1, -1], [-1, -1], [1, 1], [-1, 1]]) {
    const hip = new THREE.Group();
    hip.position.set(lx * o.body * 0.55, h - o.body * 0.3, lz * o.body * o.len * 0.6);
    hip.add(mesh(legGeo));
    inner.add(hip);
    legs.push(hip);
  }
  let tail: THREE.Object3D | null = null;
  if (o.tail) {
    const tg = o.bushy
      ? bake([{ geo: sphere(o.tail), color: o.color, y: o.tail * 1.4, z: o.tail * 0.9, sx: 0.8, sy: 2.2, sz: 1.2, rx: -0.5 }])
      : bake([{ geo: sphere(o.tail), color: o.color, sx: 0.6, sy: 0.6, sz: 1.6 }]);
    tail = mesh(tg);
    tail.position.set(0, h + o.body * 0.2, o.body * o.len * 0.95);
    inner.add(tail);
  }
  let phase = Math.random() * 6;
  let swipe = 0;
  let deadMat: THREE.MeshLambertMaterial | null = null;
  return {
    root,
    animate(dt, speed, time, pose = 'walk') {
      const moving = pose === 'walk' || pose === 'climbUp' || pose === 'climbDown';
      phase += dt * (2 + speed * 2.2);
      const amp = moving ? Math.min(0.8, speed * 0.18 + (pose === 'walk' ? 0 : 0.4)) : 0;
      // ค่าตั้งต้นทุกเฟรม แล้วค่อยปรับตามท่า
      pivot.rotation.set(0, 0, 0);
      inner.rotation.set(0, 0, 0);
      inner.position.set(0, 0, -hipZ);
      legs.forEach((l, i) => (l.rotation.x = Math.sin(phase + (i === 0 || i === 3 ? 0 : Math.PI)) * amp));
      body.position.y = Math.abs(Math.sin(phase)) * amp * 0.05;
      if (tail) tail.rotation.y = Math.sin(time * 3) * 0.3;
      switch (pose) {
        // หมุนคอแกน x บวก = เงยขึ้น ลบ = ก้มลง (เดิมกลับด้าน ท่าเล็มหญ้ากลายเป็นเงยหน้า)
        case 'walk': neck.rotation.x = speed < 0.2 ? Math.sin(time * 0.5) * 0.15 : -0.15; break;
        case 'graze': case 'drink': neck.rotation.x = dip + Math.sin(time * 2.2) * 0.05; break;
        case 'eat': neck.rotation.x = dip * 0.8 + Math.abs(Math.sin(time * 3.4)) * 0.2; break;
        case 'alert': neck.rotation.x = 0.3; if (tail) tail.rotation.y = 0; break;
        case 'rest': {
          // นอนหมอบ ขาพับ หัวตั้ง
          inner.position.y = -leg * 0.8;
          legs.forEach((l, i) => (l.rotation.x = i < 2 ? -1.35 : 1.35));
          neck.rotation.x = -0.1 + Math.sin(time * 0.3) * 0.05;
          break;
        }
        case 'rear': {
          // ยืนสองขาหลัง เอื้อมกินลูกไม้
          pivot.rotation.x = 1.05;
          legs[0].rotation.x = legs[1].rotation.x = 0.5 + Math.sin(time * 2) * 0.25;
          neck.rotation.x = 0.15 + Math.sin(time * 3) * 0.12;
          break;
        }
        case 'fish': {
          // ยืนในน้ำ ก้มมอง ตะปบด้วยขาหน้าเป็นพัก ๆ
          neck.rotation.x = dip * 0.55;
          swipe = Math.max(0, swipe - dt);
          if (swipe <= 0 && Math.random() < dt * 0.25) swipe = 0.6;
          legs[0].rotation.x = swipe > 0 ? 1.2 * Math.sin((swipe / 0.6) * Math.PI) : 0;
          break;
        }
        case 'dead': {
          inner.rotation.z = Math.PI / 2 * 0.95;
          inner.position.set(h, o.body * 0.8, -hipZ);
          neck.rotation.x = -0.3;
          legs.forEach((l, i) => (l.rotation.x = (i % 2 ? 0.25 : -0.25)));
          if (tail) tail.rotation.y = 0;
          break;
        }
        case 'climbUp': inner.rotation.x = Math.PI / 2; neck.rotation.x = 0.3; break;
        case 'climbDown': inner.rotation.x = -Math.PI / 2; neck.rotation.x = -0.4; break;
        default: neck.rotation.x = 0;
      }
    },
    tint(k) {
      if (!deadMat) {
        deadMat = SHARED.clone();
        root.traverse((c) => { if ((c as THREE.Mesh).isMesh) (c as THREE.Mesh).material = deadMat!; });
      }
      deadMat.color.setScalar(lerp(1, 0.45, k));
    },
  };
}

function bird(o: { size: number; color: number; dark: number; wing: number; round?: boolean; belly?: number }): AnimalModel {
  const root = new THREE.Group();
  const inner = new THREE.Group();
  root.add(inner);
  const bits: Bit[] = [
    { geo: sphere(o.size), color: o.color, sx: 0.8, sy: 0.75, sz: o.round ? 1.1 : 1.6 },
    { geo: sphere(o.size * 0.6), color: o.color, y: o.size * 0.35, z: -o.size * (o.round ? 0.6 : 1.2) },
    { geo: new THREE.ConeGeometry(o.size * 0.18, o.size * 0.5, 5), color: 0xd9a64a, y: o.size * 0.3, z: -o.size * (o.round ? 1.15 : 1.8), rx: -Math.PI / 2 },
    { geo: new THREE.ConeGeometry(o.size * 0.35, o.size * 1.1, 4), color: o.dark, y: o.size * 0.1, z: o.size * (o.round ? 1.1 : 1.7), rx: Math.PI / 2, sx: 1, sy: 1, sz: 0.3 },
  ];
  if (o.belly !== undefined) bits.push({ geo: sphere(o.size * 0.8), color: o.belly, y: -o.size * 0.25, sx: 0.85, sy: 0.6, sz: o.round ? 1 : 1.4 });
  if (o.round) for (const s of [-1, 1]) bits.push({ geo: sphere(o.size * 0.18), color: 0xf2c040, x: s * o.size * 0.22, y: o.size * 0.45, z: -o.size * 1.05 });
  else for (const s of [-1, 1]) bits.push({ geo: sphere(o.size * 0.09), color: 0x101010, x: s * o.size * 0.3, y: o.size * 0.5, z: -o.size * 1.45 });
  inner.add(mesh(bake(bits)));
  // ขาสองข้าง (เห็นตอนเกาะพื้น)
  const legGeo = bake([{ geo: new THREE.CylinderGeometry(o.size * 0.05, o.size * 0.05, o.size * 0.9, 4), color: 0x6a5a3a, y: -o.size * 0.95 }]);
  for (const s of [-1, 1]) { const l = mesh(legGeo); l.position.x = s * o.size * 0.25; inner.add(l); }
  const wings: THREE.Group[] = [];
  const wingGeo = (s: number) => bake([{ geo: new THREE.BoxGeometry(o.wing, o.size * 0.08, o.size * 1.1), color: o.dark, x: (s * o.wing) / 2 }]);
  for (const s of [-1, 1]) {
    const w = new THREE.Group();
    w.add(mesh(wingGeo(s)));
    inner.add(w);
    wings.push(w);
  }
  let phase = Math.random() * 6;
  return {
    root,
    animate(dt, speed, time, pose = 'walk') {
      inner.rotation.set(0, 0, 0);
      if (pose === 'perch' || pose === 'eat') {
        // เกาะพื้น ปีกพับแนบตัว · กินซากก้มจิก
        wings[0].rotation.z = 0;
        wings[1].rotation.z = 0;
        wings[0].scale.x = wings[1].scale.x = 0.35;
        inner.position.y = o.size * 1.1;
        if (pose === 'eat') inner.rotation.x = 0.5 + Math.abs(Math.sin(time * 5 + phase)) * 0.4;
        return;
      }
      wings[0].scale.x = wings[1].scale.x = 1;
      inner.position.y = 0;
      phase += dt * (speed > 0.3 ? 9 : 2);
      const flap = speed > 0.3 ? Math.sin(phase) * 0.7 : 0.05;
      wings[0].rotation.z = -flap;
      wings[1].rotation.z = flap;
      // เอียงตัวตอนเลี้ยว (นกอินทรีร่อนเป็นวง)
      inner.rotation.z = Math.sin(time * 0.3 + phase) * 0.15;
    },
  };
}

function fish(): AnimalModel {
  const g = new THREE.Group();
  const c = new THREE.MeshLambertMaterial({ color: 0x7a8a8a, emissive: 0x0a1414 });
  const b = mesh(sphere(0.12), c);
  b.scale.set(0.6, 0.8, 2.2);
  g.add(b);
  const tail = mesh(new THREE.ConeGeometry(0.1, 0.18, 4).rotateX(Math.PI / 2), c);
  tail.position.z = 0.32;
  g.add(tail);
  let phase = Math.random() * 6;
  return { root: g, animate(dt, speed) { phase += dt * (3 + speed * 4); tail.rotation.y = Math.sin(phase) * 0.6; b.rotation.y = Math.sin(phase) * 0.1; } };
}

function frog(): AnimalModel {
  const g = new THREE.Group();
  const bits: Bit[] = [{ geo: sphere(0.09), color: 0x4f6e2c, y: 0.07, sx: 1.1, sy: 0.7, sz: 1.2 }];
  for (const s of [-1, 1]) {
    bits.push({ geo: sphere(0.03), color: 0xc8c060, x: s * 0.05, y: 0.13, z: -0.07 });
    bits.push({ geo: sphere(0.045), color: 0x46632a, x: s * 0.09, y: 0.03, z: 0.07, sx: 1, sy: 0.6, sz: 1.6 });
  }
  const body = mesh(bake(bits));
  g.add(body);
  return { root: g, animate(_dt, speed, time) { body.scale.y = 1 + Math.sin(time * 4) * 0.04 + (speed > 0.2 ? 0.2 : 0); } };
}

function butterfly(): AnimalModel {
  const g = new THREE.Group();
  const wm = new THREE.MeshLambertMaterial({ color: 0xf2a03c, side: THREE.DoubleSide });
  const wings: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const w = mesh(new THREE.CircleGeometry(0.06, 6).translate(s * 0.05, 0, 0).rotateX(-Math.PI / 2), wm);
    g.add(w);
    wings.push(w);
  }
  g.add(mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.07, 4).rotateX(Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x222222 })));
  let phase = Math.random() * 6;
  return { root: g, animate(dt) { phase += dt * 22; wings[0].rotation.z = Math.sin(phase) * 1.1; wings[1].rotation.z = -Math.sin(phase) * 1.1; } };
}

/** ผึ้ง (ไว้โชว์ในคอลเลกชัน · ในโลกวาดเป็นฝูงด้วย render/Insects.ts) */
function bee(): AnimalModel {
  const g = new THREE.Group();
  const bits: Bit[] = [];
  for (let i = 0; i < 4; i++) bits.push({ geo: new THREE.CylinderGeometry(0.0062, 0.0062, 0.0035, 8), color: i % 2 ? 0x1a1408 : 0xd8a020, z: 0.004 + i * 0.0035, rx: Math.PI / 2 });
  bits.push({ geo: sphere(0.0068), color: 0xd8a020, z: 0.014, sx: 1, sy: 1, sz: 1.3 });
  bits.push({ geo: sphere(0.005), color: 0x2a2010, z: -0.002 });
  bits.push({ geo: sphere(0.0042), color: 0x1a1408, z: -0.009 });
  g.add(mesh(bake(bits)));
  const wm = new THREE.MeshLambertMaterial({ color: 0xe8eef2, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
  const wings: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const w = mesh(new THREE.CircleGeometry(0.008, 6).scale(1, 0.55, 1).translate(s * 0.008, 0, 0).rotateX(-Math.PI / 2), wm);
    w.position.y = 0.005;
    g.add(w);
    wings.push(w);
  }
  return { root: g, animate(_dt, _speed, time) { const f = Math.sin(time * 90) * 0.7; wings[0].rotation.z = f; wings[1].rotation.z = -f; } };
}

export function animalModel(id: string): AnimalModel {
  const S = ANIMAL_SHOULDER;
  switch (id) {
    case 'deer': return quadruped({ shoulder: S.deer, body: 0.3, len: 2.1, head: 0.13, color: 0x8a6440, belly: 0xb89a74, dark: 0x4a3424, antlers: true, tail: 0.05, ears: 0.12, neck: 0.55, neckUp: 50 });
    case 'fox': return quadruped({ shoulder: S.fox, body: 0.15, len: 2.3, head: 0.09, color: 0xc0642a, belly: 0xe8dcc8, dark: 0x3a2418, tail: 0.09, bushy: true, ears: 0.08, neck: 0.1, neckUp: 30 });
    case 'wolf': return quadruped({ shoulder: S.wolf, body: 0.24, len: 2.2, head: 0.12, color: 0x6e6a62, belly: 0x9a958a, dark: 0x34322e, tail: 0.09, ears: 0.09, neck: 0.2, neckUp: 25 });
    case 'bear': return quadruped({ shoulder: S.bear, body: 0.55, len: 1.55, head: 0.24, color: 0x4a3626, dark: 0x2a1e16, ears: 0.07, neck: 0.18, neckUp: 10 });
    case 'rabbit': return quadruped({ shoulder: S.rabbit, body: 0.1, len: 1.4, head: 0.07, color: 0x9a8a74, belly: 0xd8cfc0, dark: 0x6a5e50, tail: 0.04, ears: 0.13, neck: 0.04, neckUp: 40 });
    case 'squirrel': return quadruped({ shoulder: S.squirrel, body: 0.055, len: 1.9, head: 0.04, color: 0xa04a1e, belly: 0xeadfca, dark: 0x6a3416, tail: 0.05, bushy: true, ears: 0.04, neck: 0.02, neckUp: 40 });
    case 'crow': return bird({ size: 0.12, color: 0x16161a, dark: 0x0e0e12, wing: 0.34 });
    case 'starling': return bird({ size: 0.055, color: 0x1c1a24, dark: 0x16141c, wing: 0.16, belly: 0x2a2836 });
    case 'eagle': return bird({ size: 0.26, color: 0x5a4230, dark: 0x3a2a1e, wing: 0.95 });
    case 'owl': return bird({ size: 0.17, color: 0x8a7a60, dark: 0x5a4c3a, wing: 0.42, round: true });
    case 'fish': return fish();
    case 'frog': return frog();
    case 'butterfly': return butterfly();
    case 'bee': return bee();
    default: return { root: new THREE.Group(), animate() {} };
  }
}
