import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rng } from '../../world/noise';
import { SPECIES_BY_ID, type TreeForm, type TreeKind } from '../../world/trees';
import { assemble, jitter, type Part } from './build';

// ต้นไม้ 19 ชนิด + ต้นตาย 2 แบบ (รอบสอง ช่วง 4) · ปั้นด้วยโค้ดทั้งหมด ไม่มีไฟล์โมเดลหรือภาพจากข้างนอก
// ทุกต้นปั้นสูง 10 ม. โคนอยู่ที่ y = 0 แล้วย่อขยายตามความสูงจริงตอนวาง
// ใบเป็นแผ่นภาพโปร่งใส (ลายใบวาดลง canvas) · 4 ระดับ ใกล้ กลาง ไกล ไกลมาก

export type TreeLod = 'near' | 'mid' | 'far' | 'distant';
/** ลายใบ แต่ละแบบเป็นวัสดุหนึ่งชุด */
export type LeafStyle = 'needle' | 'broad' | 'palm' | 'fern' | 'bamboo' | 'blossom' | 'hang';

export interface TreeModel {
  /** ลำต้นกิ่ง (ทึบ สีประจำจุด) */
  wood: THREE.BufferGeometry;
  /** แผ่นใบ (ภาพโปร่งใส) · ระดับไกลไม่มี */
  leaves: THREE.BufferGeometry | null;
  style: LeafStyle;
}

const BARK = 0x4a3a2c;
const BARK_RED = 0x6a3a26;
const BARK_GREY = 0x6b645b;
const BIRCH_BARK = 0xd9d6cc;
const DEAD = 0x77706a;

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);

/** ทรงกระบอกจากจุดหนึ่งไปอีกจุด (กิ่ง ลำต้น) */
function limb(a: THREE.Vector3, b: THREE.Vector3, r0: number, r1: number, seg: number): THREE.BufferGeometry {
  const d = b.clone().sub(a);
  const len = d.length();
  const g = new THREE.CylinderGeometry(r1, r0, len, seg, 1, true).translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()));
  return g.translate(a.x, a.y, a.z);
}

function blob(r: number, x: number, y: number, z: number, sy = 1, detail = 0): THREE.BufferGeometry {
  return jitter(new THREE.IcosahedronGeometry(r, detail).scale(1, sy, 1), r * 0.2, 1.1, x + z).translate(x, y, z);
}

/** แผ่นใบหนึ่งแผ่น หมุนสุ่ม กลางแผ่นอยู่ที่ c · hang = แผ่นตั้งห้อยลง (หลิว ปาล์ม) */
interface Card { c: THREE.Vector3; size: number; color: THREE.Color; sway: number; tilt?: number; yaw?: number; stretch?: number; hang?: boolean }

function cardsGeometry(cards: Card[], rand: () => number): THREE.BufferGeometry {
  const geos: THREE.BufferGeometry[] = [];
  const e = new THREE.Euler();
  const q = new THREE.Quaternion();
  for (const k of cards) {
    const h = k.size * (k.stretch ?? 1);
    const g = new THREE.PlaneGeometry(k.size, h);
    if (k.hang) g.translate(0, -h / 2, 0);
    e.set(k.tilt ?? (rand() - 0.5) * 2.4, k.yaw ?? rand() * Math.PI * 2, (rand() - 0.5) * 1.2);
    g.applyQuaternion(q.setFromEuler(e));
    g.translate(k.c.x, k.c.y, k.c.z);
    const n = g.getAttribute('position').count;
    const col = new Float32Array(n * 3);
    const sway = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const s = 0.85 + rand() * 0.25;
      col[i * 3] = k.color.r * s;
      col[i * 3 + 1] = k.color.g * s;
      col[i * 3 + 2] = k.color.b * s;
      sway[i] = k.sway;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('sway', new THREE.BufferAttribute(sway, 1));
    // แสงบนแผ่นใบชี้ออกจากกลางพุ่ม พุ่มจะดูกลมไม่แบนเป็นแผ่น ๆ
    const nor = g.getAttribute('normal') as THREE.BufferAttribute;
    const dir = k.c.clone().setY(k.c.y * 0.15).normalize();
    for (let i = 0; i < n; i++) nor.setXYZ(i, dir.x * 0.6, 0.75, dir.z * 0.6);
    geos.push(g);
  }
  const m = mergeGeometries(geos, false)!;
  m.computeBoundingSphere();
  return m;
}

/** จุดสุ่มในทรงรีของพุ่ม */
function inCrown(rand: () => number, cx: number, cy: number, rx: number, ry: number, shell = 0.55): THREE.Vector3 {
  const a = rand() * Math.PI * 2;
  const u = rand() * 2 - 1;
  const r = shell + (1 - shell) * Math.cbrt(rand());
  const s = Math.sqrt(1 - u * u);
  return V(cx + Math.cos(a) * s * rx * r, cy + u * ry * r, Math.sin(a) * s * rx * r);
}

interface FormSpec {
  /** ลำต้นกิ่ง */
  wood: (lod: TreeLod, rand: () => number) => Part[];
  /** แผ่นใบ ระดับใกล้กับกลาง */
  cards: (lod: 'near' | 'mid', rand: () => number, leaf: THREE.Color[], bloom: THREE.Color | null) => Card[];
  /** ระดับไกลกับไกลมาก รูปทึบสีใบ */
  solid: (lod: 'far' | 'distant', leaf: number) => Part[];
  style: LeafStyle;
}

const seg = (lod: TreeLod, n: number) => (lod === 'near' ? n : Math.max(4, Math.round(n * 0.6)));
const count = (lod: 'near' | 'mid', n: number) => (lod === 'near' ? n : Math.max(6, Math.round(n * 0.3)));
const cardSize = (lod: 'near' | 'mid', s: number) => (lod === 'near' ? s : s * 1.9);
const pickLeaf = (rand: () => number, leaf: THREE.Color[]) => leaf[rand() < 0.5 ? 0 : 1];

/** กิ่งแตกจากลำต้นช่วง y0 ถึง y1 แผ่ออกด้วยมุม lift · คืนจุดปลายกิ่งไว้ติดใบ */
function branches(parts: Part[], tips: THREE.Vector3[], rand: () => number, n: number, y0: number, y1: number, len: number, lift: number, r: number, color: number, sg: number): void {
  for (let i = 0; i < n; i++) {
    const y = y0 + ((y1 - y0) * (i + rand() * 0.6)) / n;
    const a = i * 2.399 + rand() * 0.6;
    const l = len * (0.75 + rand() * 0.5);
    const from = V(0, y, 0);
    const to = V(Math.cos(a) * l, y + l * lift, Math.sin(a) * l);
    parts.push({ geo: limb(from, to, r, r * 0.35, sg), color, vary: 0.12, sway: [0.05, 0.35] });
    tips.push(to);
  }
}

const FORMS: Record<TreeForm | 'deadConifer' | 'deadBroad', FormSpec> = {
  pine: {
    style: 'needle',
    wood: (lod, rand) => {
      const p: Part[] = [{ geo: limb(V(), V(0, 9.8, 0), 0.3, 0.1, seg(lod, 8)), color: BARK_RED, vary: 0.15, sway: [0, 0.12] }];
      if (lod !== 'far' && lod !== 'distant') branches(p, [], rand, lod === 'near' ? 7 : 4, 6.4, 9.2, 1.7, 0.35, 0.09, BARK, 5);
      return p;
    },
    cards: (lod, rand, leaf) => Array.from({ length: count(lod, 46) }, () => ({ c: inCrown(rand, 0, 8.3, 2.0, 1.4), size: cardSize(lod, 1.5), color: pickLeaf(rand, leaf), sway: 0.6 })),
    solid: (lod, leaf) => lod === 'far'
      ? [{ geo: limb(V(), V(0, 9.5, 0), 0.3, 0.1, 4), color: BARK_RED }, { geo: blob(2.0, 0, 8.3, 0, 0.7), color: leaf, sway: [0.3, 0.6] }]
      : [{ geo: new THREE.OctahedronGeometry(1).scale(2, 1.6, 2).translate(0, 8.2, 0), color: leaf }],
  },
  redwood: {
    style: 'needle',
    wood: (lod, rand) => {
      const p: Part[] = [{ geo: limb(V(), V(0, 9.9, 0), 0.42, 0.08, seg(lod, 10)), color: BARK_RED, vary: 0.12, sway: [0, 0.08] }];
      // โคนบานออกเหมือนรากค้ำ
      if (lod === 'near') for (let i = 0; i < 5; i++) { const a = i * 1.26; p.push({ geo: limb(V(Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5), V(0, 1.2, 0), 0.16, 0.05, 5), color: BARK_RED }); }
      if (lod !== 'far' && lod !== 'distant') branches(p, [], rand, lod === 'near' ? 14 : 6, 5.2, 9.6, 0.9, -0.15, 0.05, BARK, 4);
      return p;
    },
    cards: (lod, rand, leaf) => Array.from({ length: count(lod, 64) }, () => {
      const y = 5.4 + rand() * 4.5;
      const r = 1.25 * (1 - (y - 5.4) / 5) + 0.2;
      const a = rand() * Math.PI * 2;
      return { c: V(Math.cos(a) * r * (0.5 + rand() * 0.6), y, Math.sin(a) * r * (0.5 + rand() * 0.6)), size: cardSize(lod, 0.95), color: pickLeaf(rand, leaf), sway: 0.45 };
    }),
    solid: (lod, leaf) => lod === 'far'
      ? [{ geo: limb(V(), V(0, 9.6, 0), 0.42, 0.1, 5), color: BARK_RED }, { geo: new THREE.ConeGeometry(1.4, 4.8, 6).translate(0, 7.6, 0), color: leaf, sway: [0.2, 0.4] }]
      : [{ geo: new THREE.ConeGeometry(1.3, 5.5, 5).translate(0, 7.3, 0), color: leaf }, { geo: limb(V(), V(0, 5, 0), 0.42, 0.3, 4), color: BARK_RED }],
  },
  spruce: {
    style: 'needle',
    wood: (lod, rand) => {
      const p: Part[] = [{ geo: limb(V(), V(0, 9.9, 0), 0.32, 0.06, seg(lod, 8)), color: BARK, vary: 0.12, sway: [0, 0.15] }];
      if (lod === 'near') branches(p, [], rand, 12, 1.2, 9, 2.0, -0.12, 0.05, BARK, 4);
      return p;
    },
    cards: (lod, rand, leaf) => Array.from({ length: count(lod, 70) }, () => {
      const y = 1.2 + rand() * 8.6;
      const r = 2.5 * (1 - (y - 1) / 9.2) + 0.15;
      const a = rand() * Math.PI * 2;
      const d = r * (0.35 + rand() * 0.7);
      return { c: V(Math.cos(a) * d, y - d * 0.15, Math.sin(a) * d), size: cardSize(lod, 1.25), color: pickLeaf(rand, leaf), sway: 0.3 + (y / 10) * 0.4, tilt: -0.3 - rand() * 0.6 };
    }),
    solid: (lod, leaf) => lod === 'far'
      ? [{ geo: limb(V(), V(0, 2, 0), 0.32, 0.25, 4), color: BARK }, { geo: jitter(new THREE.ConeGeometry(2.6, 9, 7, 2), 0.2, 1.5, 2).translate(0, 5.5, 0), color: leaf, sway: [0.1, 0.5] }]
      : [{ geo: new THREE.ConeGeometry(2.6, 9.4, 5).translate(0, 5.3, 0), color: leaf }],
  },
  fir: {
    style: 'needle',
    wood: (lod, rand) => {
      const p: Part[] = [{ geo: limb(V(), V(0, 9.9, 0), 0.3, 0.05, seg(lod, 8)), color: BARK_GREY, vary: 0.12, sway: [0, 0.15] }];
      if (lod === 'near') branches(p, [], rand, 10, 1.5, 9, 1.8, 0.02, 0.05, BARK_GREY, 4);
      return p;
    },
    cards: (lod, rand, leaf) => {
      // ชั้นกิ่งเป็นวงสมมาตร
      const out: Card[] = [];
      const tiers = lod === 'near' ? 8 : 4;
      for (let t = 0; t < tiers; t++) {
        const y = 1.6 + (t / tiers) * 8;
        const r = 2.2 * (1 - t / tiers) + 0.25;
        const n = lod === 'near' ? 8 : 4;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + t;
          out.push({ c: V(Math.cos(a) * r * 0.62, y, Math.sin(a) * r * 0.62), size: cardSize(lod, r * 0.95 + 0.4), color: pickLeaf(rand, leaf), sway: 0.3 + t * 0.05, tilt: -Math.PI / 2 + 0.25, yaw: a });
        }
      }
      return out;
    },
    solid: (lod, leaf) => lod === 'far'
      ? [{ geo: limb(V(), V(0, 2, 0), 0.3, 0.25, 4), color: BARK_GREY }, { geo: new THREE.ConeGeometry(2.3, 8.6, 8, 3).translate(0, 5.6, 0), color: leaf, sway: [0.1, 0.5] }]
      : [{ geo: new THREE.ConeGeometry(2.3, 8.8, 5).translate(0, 5.6, 0), color: leaf }],
  },
  broad: {
    style: 'broad',
    wood: (lod, rand) => {
      const p: Part[] = [{ geo: jitter(limb(V(), V(0, 4.2, 0), 0.55, 0.36, seg(lod, 9)), 0.05, 2, 1), color: BARK, vary: 0.15, sway: [0, 0.05] }];
      if (lod !== 'far' && lod !== 'distant') {
        const n = lod === 'near' ? 5 : 3;
        for (let i = 0; i < n; i++) {
          const a = i * 1.3 + rand();
          const mid = V(Math.cos(a) * 1.6, 5.4, Math.sin(a) * 1.6);
          const tip = V(Math.cos(a) * 3.4, 6.8 + rand(), Math.sin(a) * 3.4);
          p.push({ geo: limb(V(0, 3.9, 0), mid, 0.24, 0.15, 6), color: BARK, sway: [0.05, 0.2] });
          if (lod === 'near') p.push({ geo: limb(mid, tip, 0.15, 0.05, 5), color: BARK, sway: [0.2, 0.4] });
        }
      }
      return p;
    },
    cards: (lod, rand, leaf) => Array.from({ length: count(lod, 90) }, () => ({ c: inCrown(rand, 0, 6.8, 4.4, 2.6, 0.45), size: cardSize(lod, 1.6), color: pickLeaf(rand, leaf), sway: 0.55 })),
    solid: (lod, leaf) => lod === 'far'
      ? [{ geo: limb(V(), V(0, 4.5, 0), 0.55, 0.36, 5), color: BARK }, { geo: blob(4.2, 0, 6.8, 0, 0.62), color: leaf, sway: [0.3, 0.5] }]
      : [{ geo: new THREE.OctahedronGeometry(1).scale(4.2, 2.6, 4.2).translate(0, 6.8, 0), color: leaf }],
  },
  tallBroad: {
    style: 'broad',
    wood: (lod, rand) => {
      const p: Part[] = [{ geo: limb(V(), V(0, 6.5, 0), 0.42, 0.22, seg(lod, 8)), color: BARK_GREY, vary: 0.12, sway: [0, 0.08] }];
      if (lod !== 'far' && lod !== 'distant') branches(p, [], rand, lod === 'near' ? 6 : 3, 4.6, 7.5, 1.6, 0.8, 0.12, BARK_GREY, 5);
      return p;
    },
    cards: (lod, rand, leaf) => Array.from({ length: count(lod, 80) }, () => ({ c: inCrown(rand, 0, 7.2, 2.9, 2.6, 0.45), size: cardSize(lod, 1.4), color: pickLeaf(rand, leaf), sway: 0.55 })),
    solid: (lod, leaf) => lod === 'far'
      ? [{ geo: limb(V(), V(0, 5.5, 0), 0.42, 0.25, 5), color: BARK_GREY }, { geo: blob(2.9, 0, 7.2, 0, 0.95), color: leaf, sway: [0.3, 0.5] }]
      : [{ geo: new THREE.OctahedronGeometry(1).scale(2.9, 2.7, 2.9).translate(0, 7.2, 0), color: leaf }],
  },
  birch: {
    style: 'broad',
    wood: (lod, rand) => {
      const p: Part[] = [{ geo: limb(V(), V(0, 9.6, 0), 0.22, 0.06, seg(lod, 8)), color: BIRCH_BARK, vary: 0.28, sway: [0, 0.25] }];
      if (lod === 'near') branches(p, [], rand, 8, 4.8, 9, 1.3, 0.55, 0.05, BIRCH_BARK, 4);
      return p;
    },
    cards: (lod, rand, leaf) => Array.from({ length: count(lod, 60) }, () => ({ c: inCrown(rand, 0, 7.3, 1.8, 2.6, 0.4), size: cardSize(lod, 1.1), color: pickLeaf(rand, leaf), sway: 0.75 })),
    solid: (lod, leaf) => lod === 'far'
      ? [{ geo: limb(V(), V(0, 9, 0), 0.22, 0.08, 4), color: BIRCH_BARK }, { geo: blob(1.8, 0, 7.3, 0, 1.5), color: leaf, sway: [0.4, 0.8] }]
      : [{ geo: new THREE.OctahedronGeometry(1).scale(1.8, 2.6, 1.8).translate(0, 7.3, 0), color: leaf }],
  },
  weeping: {
    style: 'hang',
    wood: (lod, rand) => {
      const p: Part[] = [{ geo: jitter(limb(V(), V(0, 3.6, 0), 0.5, 0.36, seg(lod, 8)), 0.05, 2, 4), color: BARK, vary: 0.15 }];
      if (lod !== 'far' && lod !== 'distant') branches(p, [], rand, lod === 'near' ? 6 : 3, 3.2, 4, 2.6, 0.7, 0.16, BARK, 5);
      return p;
    },
    cards: (lod, rand, leaf) => Array.from({ length: count(lod, 70) }, () => {
      const a = rand() * Math.PI * 2;
      const r = 1.2 + rand() * 2.9;
      return { c: V(Math.cos(a) * r, 6.8 + rand() * 1.8 - r * 0.25, Math.sin(a) * r), size: cardSize(lod, 0.9), stretch: 3.4, hang: true, tilt: 0, yaw: a + Math.PI / 2, color: pickLeaf(rand, leaf), sway: 0.9 };
    }),
    solid: (lod, leaf) => lod === 'far'
      ? [{ geo: limb(V(), V(0, 4, 0), 0.5, 0.36, 5), color: BARK }, { geo: blob(4, 0, 5.4, 0, 0.75), color: leaf, sway: [0.4, 0.7] }]
      : [{ geo: new THREE.OctahedronGeometry(1).scale(4, 2.8, 4).translate(0, 5.6, 0), color: leaf }],
  },
  fig: {
    style: 'broad',
    wood: (lod, rand) => {
      const p: Part[] = [];
      // รากพันเป็นตาข่ายรอบต้นเจ้าบ้านที่ตายไปแล้ว
      const n = lod === 'near' ? 9 : 4;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const foot = V(Math.cos(a) * 1.5, 0, Math.sin(a) * 1.5);
        const knee = V(Math.cos(a + 0.4) * 0.75, 3.2, Math.sin(a + 0.4) * 0.75);
        const top = V(Math.cos(a - 0.3) * 0.5, 6.5, Math.sin(a - 0.3) * 0.5);
        p.push({ geo: limb(foot, knee, 0.24, 0.16, seg(lod, 6)), color: BARK_GREY, vary: 0.15 }, { geo: limb(knee, top, 0.16, 0.12, seg(lod, 6)), color: BARK_GREY, vary: 0.15 });
      }
      if (lod !== 'far' && lod !== 'distant') for (let i = 0; i < (lod === 'near' ? 5 : 3); i++) { const a = i * 1.25 + rand(); p.push({ geo: limb(V(0, 6.3, 0), V(Math.cos(a) * 4.5, 8.2, Math.sin(a) * 4.5), 0.25, 0.08, 5), color: BARK_GREY }); }
      return p;
    },
    cards: (lod, rand, leaf) => Array.from({ length: count(lod, 100) }, () => ({ c: inCrown(rand, 0, 8.4, 5.6, 2.0, 0.4), size: cardSize(lod, 1.7), color: pickLeaf(rand, leaf), sway: 0.4 })),
    solid: (lod, leaf) => lod === 'far'
      ? [{ geo: limb(V(), V(0, 6.5, 0), 1.1, 0.6, 6), color: BARK_GREY }, { geo: blob(5.4, 0, 8.4, 0, 0.42), color: leaf, sway: [0.2, 0.4] }]
      : [{ geo: new THREE.OctahedronGeometry(1).scale(5.4, 2.2, 5.4).translate(0, 8.4, 0), color: leaf }],
  },
  emergent: {
    style: 'broad',
    wood: (lod, rand) => {
      const p: Part[] = [{ geo: limb(V(), V(0, 8.4, 0), 0.5, 0.26, seg(lod, 9)), color: BARK_GREY, vary: 0.1, sway: [0, 0.06] }];
      // พูพอนที่โคน
      if (lod === 'near') for (let i = 0; i < 4; i++) { const a = i * 1.57 + 0.4; p.push({ geo: new THREE.BoxGeometry(1.6, 1.4, 0.12).translate(0.8, 0.7, 0).rotateY(a), color: BARK_GREY }); }
      if (lod !== 'far' && lod !== 'distant') branches(p, [], rand, lod === 'near' ? 6 : 3, 8.1, 8.6, 2.2, 0.35, 0.14, BARK_GREY, 5);
      return p;
    },
    cards: (lod, rand, leaf) => Array.from({ length: count(lod, 70) }, () => ({ c: inCrown(rand, 0, 9.0, 3.1, 0.95, 0.35), size: cardSize(lod, 1.3), color: pickLeaf(rand, leaf), sway: 0.35 })),
    solid: (lod, leaf) => lod === 'far'
      ? [{ geo: limb(V(), V(0, 8.4, 0), 0.5, 0.26, 5), color: BARK_GREY }, { geo: blob(3.1, 0, 9.0, 0, 0.38), color: leaf, sway: [0.2, 0.4] }]
      : [{ geo: new THREE.OctahedronGeometry(1).scale(3.1, 1.1, 3.1).translate(0, 9, 0), color: leaf }, { geo: limb(V(), V(0, 8, 0), 0.5, 0.3, 3), color: BARK_GREY }],
  },
  palm: {
    style: 'palm',
    wood: (lod) => [{ geo: limb(V(), V(0.4, 9.2, 0), 0.22, 0.17, seg(lod, 7)), color: BARK_GREY, vary: 0.2, sway: [0, 0.35] }],
    cards: (lod, rand, leaf) => Array.from({ length: lod === 'near' ? 16 : 8 }, (_, i) => {
      const a = (i / (lod === 'near' ? 16 : 8)) * Math.PI * 2 + rand() * 0.3;
      return { c: V(0.4 + Math.cos(a) * 0.3, 9.3, Math.sin(a) * 0.3), size: 1.1, stretch: 3.2, hang: true, tilt: -1.0 - rand() * 0.5, yaw: a, color: pickLeaf(rand, leaf), sway: 0.8 };
    }),
    solid: (lod, leaf) => ([{ geo: limb(V(), V(0.4, 9.2, 0), 0.22, 0.17, 4), color: BARK_GREY }, { geo: blob(2.4, 0.4, 9.0, 0, 0.45), color: leaf, sway: [0.4, 0.6] }] as Part[]).slice(lod === 'distant' ? 1 : 0),
  },
  treeFern: {
    style: 'fern',
    wood: (lod) => [{ geo: jitter(limb(V(), V(0, 8.6, 0), 0.2, 0.17, seg(lod, 7)), 0.04, 3, 7), color: 0x3a2a1e, vary: 0.2, sway: [0, 0.25] }],
    cards: (lod, rand, leaf) => Array.from({ length: lod === 'near' ? 14 : 7 }, (_, i) => {
      const a = (i / (lod === 'near' ? 14 : 7)) * Math.PI * 2 + rand() * 0.3;
      return { c: V(Math.cos(a) * 0.2, 8.7, Math.sin(a) * 0.2), size: 1.3, stretch: 2.8, hang: true, tilt: -1.15 - rand() * 0.3, yaw: a, color: pickLeaf(rand, leaf), sway: 0.7 };
    }),
    solid: (lod, leaf) => ([{ geo: limb(V(), V(0, 8.6, 0), 0.2, 0.17, 4), color: 0x3a2a1e }, { geo: blob(3.0, 0, 8.4, 0, 0.35), color: leaf, sway: [0.3, 0.5] }] as Part[]).slice(lod === 'distant' ? 1 : 0),
  },
  bamboo: {
    style: 'bamboo',
    wood: (lod, rand) => {
      const p: Part[] = [];
      const n = lod === 'near' ? 14 : 7;
      for (let i = 0; i < n; i++) {
        const a = i * 2.39;
        const r = 0.25 + rand() * 0.75;
        const lean = 0.08 + rand() * 0.12;
        const foot = V(Math.cos(a) * r, 0, Math.sin(a) * r);
        const top = V(Math.cos(a) * (r + 10 * lean), 9 + rand(), Math.sin(a) * (r + 10 * lean));
        p.push({ geo: limb(foot, top, 0.07, 0.04, seg(lod, 6)), color: 0x6a7a3a, vary: 0.2, sway: [0, 0.9] });
      }
      return p;
    },
    cards: (lod, rand, leaf) => Array.from({ length: count(lod, 70) }, () => {
      const a = rand() * Math.PI * 2;
      const y = 4.5 + rand() * 5.3;
      const r = 0.5 + (y / 10) * 1.6 * rand();
      return { c: V(Math.cos(a) * r, y, Math.sin(a) * r), size: cardSize(lod, 1.2), color: pickLeaf(rand, leaf), sway: 0.9 };
    }),
    solid: (lod, leaf) => ([{ geo: blob(1.4, 0, 3, 0, 2.2), color: 0x6a7a3a }, { geo: blob(2.3, 0, 7.5, 0, 1.2), color: leaf, sway: [0.5, 0.9] }] as Part[]).slice(lod === 'distant' ? 1 : 0),
  },
  blossom: {
    style: 'blossom',
    wood: (lod, rand) => {
      const p: Part[] = [{ geo: jitter(limb(V(), V(0, 3.4, 0), 0.32, 0.2, seg(lod, 8)), 0.05, 2, 9), color: BARK, vary: 0.15, sway: [0, 0.06] }];
      if (lod !== 'far' && lod !== 'distant') branches(p, [], rand, lod === 'near' ? 6 : 3, 3.0, 3.6, 2.6, 0.9, 0.13, BARK, 5);
      return p;
    },
    cards: (lod, rand, leaf, bloom) => Array.from({ length: count(lod, 85) }, () => ({ c: inCrown(rand, 0, 6.2, 3.3, 2.3, 0.4), size: cardSize(lod, 1.35), color: bloom && rand() < 0.72 ? bloom : pickLeaf(rand, leaf), sway: 0.55 })),
    solid: (lod, leaf) => lod === 'far'
      ? [{ geo: limb(V(), V(0, 3.6, 0), 0.32, 0.2, 5), color: BARK }, { geo: blob(3.2, 0, 6.2, 0, 0.72), color: leaf, sway: [0.3, 0.5] }]
      : [{ geo: new THREE.OctahedronGeometry(1).scale(3.2, 2.3, 3.2).translate(0, 6.2, 0), color: leaf }],
  },
  orchard: {
    style: 'broad',
    wood: (lod, rand) => {
      const p: Part[] = [{ geo: jitter(limb(V(), V(0, 2.4, 0), 0.38, 0.26, seg(lod, 8)), 0.08, 2, 5), color: BARK, vary: 0.18 }];
      if (lod !== 'far' && lod !== 'distant') branches(p, [], rand, lod === 'near' ? 7 : 4, 2.0, 3.0, 3.2, 0.75, 0.14, BARK, 5);
      return p;
    },
    cards: (lod, rand, leaf) => Array.from({ length: count(lod, 80) }, () => ({ c: inCrown(rand, 0, 5.4, 3.6, 2.4, 0.4), size: cardSize(lod, 1.5), color: pickLeaf(rand, leaf), sway: 0.5 })),
    solid: (lod, leaf) => lod === 'far'
      ? [{ geo: limb(V(), V(0, 2.6, 0), 0.38, 0.26, 5), color: BARK }, { geo: blob(3.6, 0, 5.4, 0, 0.68), color: leaf, sway: [0.3, 0.5] }]
      : [{ geo: new THREE.OctahedronGeometry(1).scale(3.6, 2.4, 3.6).translate(0, 5.4, 0), color: leaf }],
  },
  deadConifer: {
    style: 'needle',
    wood: (lod, rand) => {
      const p: Part[] = [{ geo: jitter(limb(V(), V(0, 9.6, 0), 0.3, 0.05, seg(lod, 7)), 0.05, 2, 3), color: DEAD, vary: 0.15 }];
      if (lod !== 'distant') branches(p, [], rand, lod === 'near' ? 16 : 6, 2, 9, 1.1, -0.1, 0.04, DEAD, 4);
      return p;
    },
    cards: () => [],
    solid: (lod) => [{ geo: limb(V(), V(0, 9.6, 0), 0.3, 0.05, lod === 'far' ? 5 : 3), color: DEAD }],
  },
  deadBroad: {
    style: 'broad',
    wood: (lod, rand) => {
      const p: Part[] = [{ geo: jitter(limb(V(), V(0, 6, 0), 0.4, 0.14, seg(lod, 7)), 0.08, 1, 3), color: DEAD, vary: 0.15 }];
      if (lod !== 'distant') {
        const n = lod === 'near' ? 6 : 3;
        for (let i = 0; i < n; i++) {
          const a = i * 1.7 + rand();
          const mid = V(Math.cos(a) * 1.4, 6.6 + rand(), Math.sin(a) * 1.4);
          p.push({ geo: limb(V(0, 4.5 + rand(), 0), mid, 0.12, 0.06, 4), color: DEAD });
          if (lod === 'near') p.push({ geo: limb(mid, V(mid.x * 1.9, mid.y + 1.4, mid.z * 1.9), 0.06, 0.02, 4), color: DEAD });
        }
      }
      return p;
    },
    cards: () => [],
    solid: (lod) => [{ geo: limb(V(), V(0, 6.5, 0), 0.4, 0.14, lod === 'far' ? 5 : 3), color: DEAD }],
  },
};

const cache = new Map<string, TreeModel>();

/** โมเดลต้นไม้ชนิดนั้นที่ระดับนั้น (สร้างครั้งเดียวเก็บไว้ใช้ซ้ำ) */
export function treeModel(kind: TreeKind, lod: TreeLod): TreeModel {
  const key = `${kind}:${lod}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const sp = SPECIES_BY_ID.get(kind);
  const form = FORMS[(sp?.form ?? kind) as TreeForm | 'deadConifer' | 'deadBroad'];
  const leafHex = sp ? sp.leaf : [0x555555, 0x555555];
  const rand = rng(kind.length * 977 + kind.charCodeAt(0) * 31 + (lod === 'near' ? 1 : lod === 'mid' ? 2 : 3));
  let model: TreeModel;
  if (lod === 'far' || lod === 'distant') {
    // ระดับไกลเป็นรูปทึบ สีใบผสมดอก (ไกลยังเห็นต้นสีชมพูม่วงได้)
    let solidColor = leafHex[0];
    if (sp?.bloom) solidColor = new THREE.Color(sp.bloom).lerp(new THREE.Color(leafHex[0]), 0.35).getHex();
    if (kind === 'maple') solidColor = 0x8a5a24;
    model = { wood: assemble(form.solid(lod, solidColor)), leaves: null, style: form.style };
  } else {
    const parts = form.wood(lod, rand);
    // ผลไม้ (แอปเปิลแดง มะม่วงเขียวเหลือง) ติดในพุ่ม เฉพาะระดับใกล้
    if (sp?.fruit && lod === 'near') {
      const cy = sp.form === 'orchard' ? 5.0 : 6.4;
      const rx = sp.form === 'orchard' ? 3.2 : 3.9;
      for (let i = 0; i < 22; i++) parts.push({ geo: new THREE.IcosahedronGeometry(sp.form === 'orchard' ? 0.11 : 0.13, 0).scale(1, sp.form === 'orchard' ? 1 : 1.4, 1).translate(...inCrown(rand, 0, cy - 0.5, rx, 2.0, 0.7).toArray()), color: sp.fruit, vary: 0.15, sway: [0.5, 0.5] });
    }
    const leafCols = (kind === 'maple' ? [0xa8541c, 0xc8862a, 0x6a7a2a] : leafHex).map((h) => new THREE.Color(h));
    const cards = form.cards(lod, rand, leafCols.length > 2 ? [leafCols[0], leafCols[rand() < 0.5 ? 1 : 2]] : leafCols, sp?.bloom ? new THREE.Color(sp.bloom) : null);
    model = { wood: assemble(parts), leaves: cards.length ? cardsGeometry(cards, rand) : null, style: form.style };
  }
  cache.set(key, model);
  return model;
}

// ---------- ลายใบ (วาดลง canvas ครั้งเดียว) ----------

const textures = new Map<LeafStyle, THREE.Texture>();

/** ภาพลายใบโปร่งใส สีเทาขาว (สีจริงมาจากสีประจำจุดของแผ่นใบ) */
export function leafTexture(style: LeafStyle): THREE.Texture {
  const hit = textures.get(style);
  if (hit) return hit;
  const S = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const c = cv.getContext('2d')!;
  const rand = rng(style.length * 131 + style.charCodeAt(1));
  const shade = () => { const v = 175 + Math.floor(rand() * 80); return `rgb(${v},${v},${v})`; };
  c.lineCap = 'round';
  if (style === 'needle') {
    // กระจุกเข็มสน
    for (let i = 0; i < 26; i++) {
      const x = 14 + rand() * 100;
      const y = 14 + rand() * 100;
      c.strokeStyle = shade();
      c.lineWidth = 2;
      for (let k = 0; k < 9; k++) {
        const a = rand() * Math.PI * 2;
        const l = 8 + rand() * 12;
        c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke();
      }
    }
  } else if (style === 'palm' || style === 'fern' || style === 'hang') {
    // ใบขนนกยาว (ปาล์ม เฟิน) หรือกิ่งห้อย (หลิว) แกนตามแนวตั้งของภาพ
    const n = style === 'hang' ? 4 : 1;
    for (let s = 0; s < n; s++) {
      const x0 = n === 1 ? S / 2 : 16 + s * 32;
      c.strokeStyle = shade();
      c.lineWidth = style === 'hang' ? 1.5 : 3;
      c.beginPath(); c.moveTo(x0, 2); c.lineTo(x0, S - 4); c.stroke();
      for (let y = 6; y < S - 6; y += style === 'fern' ? 5 : 6) {
        const w = (style === 'hang' ? 9 : 52) * Math.sin((y / S) * Math.PI) + 4;
        c.fillStyle = shade();
        for (const side of [-1, 1]) {
          c.beginPath();
          c.ellipse(x0 + side * w * 0.5, y + 3, w * 0.5, style === 'palm' ? 2.6 : 2, side * (style === 'fern' ? 0.25 : 0.5), 0, Math.PI * 2);
          c.fill();
        }
      }
    }
  } else if (style === 'bamboo') {
    for (let i = 0; i < 16; i++) {
      const x = 10 + rand() * 108;
      const y = 10 + rand() * 108;
      const a = rand() * Math.PI * 2;
      c.fillStyle = shade();
      c.beginPath(); c.ellipse(x, y, 18, 3.5, a, 0, Math.PI * 2); c.fill();
    }
  } else {
    // ใบกว้าง หรือดอก (กลีบกลมเล็ก) เป็นกระจุก
    const petal = style === 'blossom';
    for (let i = 0; i < (petal ? 70 : 34); i++) {
      const x = 12 + rand() * 104;
      const y = 12 + rand() * 104;
      c.fillStyle = shade();
      c.beginPath();
      if (petal) c.arc(x, y, 4 + rand() * 3, 0, Math.PI * 2);
      else c.ellipse(x, y, 9 + rand() * 4, 5 + rand() * 2, rand() * Math.PI, 0, Math.PI * 2);
      c.fill();
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  textures.set(style, tex);
  return tex;
}

/** คืนหน่วยความจำโมเดลที่สร้างเก็บไว้ (ใช้ตอนเทส) */
export function clearTreeCache(): void {
  for (const m of cache.values()) { m.wood.dispose(); m.leaves?.dispose(); }
  cache.clear();
}

