import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rng } from '../world/noise';
import type { BridgePart, Building, TownExtra } from '../world/town';
import type { TownBox } from '../world/townPlan';
import { assemble, jitter, type Part } from './models/build';
import { cardsGeometry, leafTexture, type Card } from './models/trees';
import { addWind } from './wind';
import { applyDetail } from './detail';

// เมืองเก่าหลังมนุษย์หายไปราวพันปี (รอบสอง ช่วง 8 และ 9) · กล่องชุดเดียวกับตัวชน (world/townPlan.ts) ภาพกับตัวชนจึงตรงกันเสมอ
// ภายนอก (ผนัง หลังคาที่ยังเหลือ ซากปูน มอส) รวมเป็นก้อนละ 128 ม. วาดไม่กี่ครั้งทั้งเมือง
// เถาวัลย์เป็นเส้นโค้งมีใบเป็นแผ่นภาพโปร่งใสแบบเดียวกับใบไม้ (พี่กันทักว่าเถาวัลย์กล่องเหลี่ยม ๆ ไม่เหมือนจริง)
// ภายในตึกที่ยังมีหลังคา (พื้นชั้นบน ผนังห้อง บันได เฟอร์นิเจอร์) แยกหลังละชิ้น วาดเฉพาะหลังที่อยู่ใกล้
// ซากที่หลังคาหายแล้ว พื้นกับผนังห้องมองเห็นจากข้างบน จึงรวมไว้กับภายนอก · ป้ายภาษาอังกฤษซีดหลุด · สะพานพัง

const CHUNK = 128;
/** ภายในตึกวาดเมื่ออยู่ห่างไม่เกินเท่านี้ (นับจากขอบตึก) */
const INTERIOR_NEAR = 45;
/** ภายนอกเมืองซ่อนเมื่อไกลกว่านี้ */
const TOWN_FAR = 1300;
/** เถาวัลย์ ใบไม้เลื้อย กองซาก ซ่อนเมื่อกลางก้อนไกลกว่านี้ (ไกลแล้วเล็กจนมองไม่ออก แต่กินสามเหลี่ยมราวครึ่งหนึ่งของเมือง) */
const DETAIL_FAR = 280;
const IVY = [0x3e5d27, 0x4a6a2c, 0x33501f, 0x56702e, 0x2f4a1e];

type Solid = Pick<TownBox, 'x' | 'z' | 'y0' | 'y1' | 'hx' | 'hz' | 'color'> & { grime?: boolean };

const signCache = new Map<string, THREE.Texture>();

/** ป้ายภาษาอังกฤษผ่านมาพันปี สีหลุดเหลือคราบ ตัวอักษรหายไปหลายตัว · สุ่มด้วยเลขคงที่ ป้ายเดิมทุกครั้ง */
function signTexture(text: string): THREE.Texture {
  const hit = signCache.get(text);
  if (hit) return hit;
  const r = rng(text.length * 131 + text.charCodeAt(0));
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 96;
  const x = c.getContext('2d')!;
  x.fillStyle = '#9c968a';
  x.fillRect(0, 0, 512, 96);
  for (let i = 0; i < 70; i++) {
    x.fillStyle = r() < 0.5 ? 'rgba(60,50,40,.35)' : 'rgba(70,90,50,.3)';
    x.fillRect(r() * 512, r() * 96, 3 + r() * 50, 1 + r() * 14);
  }
  x.font = '700 56px "Chakra Petch", sans-serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillStyle = 'rgba(48,40,32,.82)';
  const shown = [...text].map((ch) => (r() < 0.3 && ch !== ' ' ? ' ' : ch)).join('');
  x.fillText(shown, 256, 52, 480);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  signCache.set(text, tex);
  return tex;
}

const UNIT = new THREE.BoxGeometry(1, 1, 1);

/**
 * กล่องหลายใบรวมเป็นรูปทรงเดียว (24 จุดต่อกล่องพร้อมดัชนี) · สีต่างกันนิดหน่อยต่อกล่อง
 * ผนังที่ติดพื้นมีคราบดินเข้มที่โคน
 */
function mergeBoxes(list: { s: Solid; m: THREE.Matrix4 }[], r: () => number): THREE.BufferGeometry {
  const n = list.length;
  const pos = new Float32Array(n * 72);
  const nor = new Float32Array(n * 72);
  const col = new Float32Array(n * 72);
  const idx = new Uint32Array(n * 36);
  const bp = UNIT.getAttribute('position');
  const bn = UNIT.getAttribute('normal');
  const bi = UNIT.index!;
  const v = new THREE.Vector3();
  const nm = new THREE.Vector3();
  const c = new THREE.Color();
  const nmat = new THREE.Matrix3();
  list.forEach(({ s, m }, k) => {
    nmat.getNormalMatrix(m);
    c.set(s.color).multiplyScalar(0.88 + r() * 0.24);
    for (let i = 0; i < 24; i++) {
      const ly = bp.getY(i);
      v.set(s.x + bp.getX(i) * s.hx * 2, s.y0 + (ly + 0.5) * (s.y1 - s.y0), s.z + bp.getZ(i) * s.hz * 2).applyMatrix4(m);
      nm.set(bn.getX(i), bn.getY(i), bn.getZ(i)).applyMatrix3(nmat).normalize();
      const o = (k * 24 + i) * 3;
      // คราบดินกับตะไคร่ที่โคนผนัง เข้มกว่าเดิม (พันปี)
      const dirt = s.grime && ly < 0 && s.y0 < 0.6 ? 0.55 : 1;
      pos[o] = v.x;
      pos[o + 1] = v.y;
      pos[o + 2] = v.z;
      nor[o] = nm.x;
      nor[o + 1] = nm.y;
      nor[o + 2] = nm.z;
      col[o] = c.r * dirt;
      col[o + 1] = c.g * dirt * (s.grime && ly < 0 ? 1.05 : 1);
      col[o + 2] = c.b * dirt;
    }
    for (let i = 0; i < 36; i++) idx[k * 36 + i] = bi.getX(i) + k * 24;
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  return g;
}

/**
 * กองซากอิฐปูนที่ดินกับมอสทับมาพันปี: เนินขรุขระจมดินครึ่งหนึ่ง ขนาดเท่ากล่องตัวชน (เดิมเป็นกล่องเหลี่ยมดูไม่จริง)
 */
function mound(b: TownBox, m: THREE.Matrix4, r: () => number): Part {
  const h = b.y1 - b.y0;
  // บนพื้นชั้นบนวางบนพื้นพอดี (ไม่ทะลุเพดานชั้นล่าง) · บนดินจมลงไปครึ่งหนึ่ง
  const upper = b.y0 > 0.5;
  const sy = upper ? h * 0.5 : h * 0.95;
  const geo = jitter(new THREE.IcosahedronGeometry(1, 1), 0.22, 1.7, r() * 50)
    .scale(b.hx * 1.15, sy, b.hz * 1.15)
    .translate(b.x, b.y0 + (upper ? sy : h * 0.15), b.z)
    .applyMatrix4(m);
  const tone = r();
  return { geo, color: tone < 0.55 ? 0x4e4e34 : tone < 0.8 ? 0x5a5640 : 0x6a665c, vary: 0.3 };
}

/** ผนังด้านหนึ่งของตึก (พิกัดในตึก): จุดกึ่งกลาง ทิศออกนอก ทิศตามผนัง ความยาว */
interface Face { cx: number; cz: number; nx: number; nz: number; tx: number; tz: number; len: number }

/**
 * เถาวัลย์กับไม้เลื้อยคลุมผนัง (พิกัดในตึก) · เส้นเถาโค้งห้อยจากขอบผนังลงมา ใบเกาะตามเส้น
 * กับแผงไม้เลื้อยหนาคลุมผนังเป็นผืน · ไม่ห้อยบังประตูหน้า
 */
function overgrowth(b: Building, top: number, r: () => number): { stems: Part[]; cards: Card[] } {
  const stems: Part[] = [];
  const cards: Card[] = [];
  const hw = b.w / 2;
  const hd = b.d / 2;
  const faces: Face[] = [
    { cx: 0, cz: -hd, nx: 0, nz: -1, tx: 1, tz: 0, len: b.w },
    { cx: 0, cz: hd, nx: 0, nz: 1, tx: 1, tz: 0, len: b.w },
    { cx: -hw, cz: 0, nx: -1, nz: 0, tx: 0, tz: 1, len: b.d },
    { cx: hw, cz: 0, nx: 1, nz: 0, tx: 0, tz: 1, len: b.d },
  ];
  const leaf = (x: number, y: number, z: number, f: Face, size: number) => {
    cards.push({
      c: new THREE.Vector3(x + f.nx * (0.05 + r() * 0.08), y, z + f.nz * (0.05 + r() * 0.08)),
      size,
      color: new THREE.Color(IVY[Math.floor(r() * IVY.length)]).multiplyScalar(0.85 + r() * 0.3),
      sway: 0.25,
      tilt: (r() - 0.5) * 0.9,
      yaw: Math.atan2(f.nx, f.nz) + (r() - 0.5) * 0.8,
    });
  };
  const clusters = b.decay === 0 ? 4 + Math.floor(r() * 3) : b.decay === 1 ? 5 + Math.floor(r() * 4) : 3 + Math.floor(r() * 3);
  for (let k = 0; k < clusters; k++) {
    const f = faces[Math.floor(r() * 4)];
    let u = (r() - 0.5) * (f.len - 1.5);
    if (f === faces[0] && Math.abs(u) < 2.4) u = Math.sign(u || 1) * Math.min(f.len / 2 - 0.6, 2.4 + Math.abs(u));
    const strands = 2 + Math.floor(r() * 3);
    for (let q = 0; q < strands; q++) {
      const len = Math.min(top - 0.1, 1.2 + r() * top * 0.85);
      // เส้นเถาโค้งไปมา ห้อยลงจากขอบผนัง
      const pts: THREE.Vector3[] = [];
      let along = u + (r() - 0.5) * 1.2;
      const off = 0.04 + r() * 0.04;
      for (let y = top + 0.15; y > top - len; y -= 0.55) {
        pts.push(new THREE.Vector3(f.cx + f.tx * along + f.nx * off, y, f.cz + f.tz * along + f.nz * off));
        along += (r() - 0.5) * 0.45;
      }
      if (pts.length < 2) continue;
      const curve = new THREE.CatmullRomCurve3(pts);
      stems.push({ geo: new THREE.TubeGeometry(curve, pts.length * 2, 0.018 + r() * 0.012, 4, false), color: 0x4a3c26, vary: 0.2 });
      for (let t = 0.02; t < 1; t += 0.28 / Math.max(1, len)) {
        const p = curve.getPoint(t);
        leaf(p.x, p.y, p.z, f, 0.3 + r() * 0.22);
        if (r() < 0.5) leaf(p.x + f.tx * (r() - 0.5) * 0.3, p.y - 0.1, p.z + f.tz * (r() - 0.5) * 0.3, f, 0.26 + r() * 0.2);
      }
    }
  }
  // แผงไม้เลื้อยคลุมผนังเป็นผืน
  const mats = b.decay === 0 ? 1 + Math.floor(r() * 2) : 2 + Math.floor(r() * 2);
  for (let k = 0; k < mats; k++) {
    const f = faces[1 + Math.floor(r() * 3)];
    const u0 = (r() - 0.5) * (f.len - 3);
    const w = 1.2 + r() * 2.2;
    const h = Math.min(top, 1 + r() * 2.5);
    const y0 = r() < 0.6 ? 0 : Math.max(0, top - h);
    for (let a = 0; a < w; a += 0.34) {
      for (let c = 0; c < h; c += 0.34) {
        if (r() < 0.2) continue;
        const along = u0 + a + (r() - 0.5) * 0.2;
        leaf(f.cx + f.tx * along, y0 + c + (r() - 0.5) * 0.2, f.cz + f.tz * along, f, 0.34 + r() * 0.22);
      }
    }
  }
  return { stems, cards };
}

export class Town {
  readonly group = new THREE.Group();
  /** ของที่ซ่อนเมื่อไกล (ก้อนภายนอก ป้าย สะพาน) */
  private far: { o: THREE.Object3D; x: number; z: number; r: number }[] = [];
  private interiors: { mesh: THREE.Mesh; x: number; z: number; r: number }[] = [];

  constructor(buildings: Building[], parts: Map<string, TownBox[]>, bridge: BridgePart[], extras: TownExtra[] = []) {
    const r = rng(9091);
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    // ปูนฉาบเก่าพันปี คราบน้ำไหล ปูนกะเทาะ รอยร้าว · กองซากเป็นเนื้อหิน
    applyDetail(mat, 'plaster');
    const moundMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    applyDetail(moundMat, 'stone');
    const glassMat = new THREE.MeshLambertMaterial({ color: 0x2a3634, transparent: true, opacity: 0.45 });
    const ivyMap = leafTexture('broad');
    const ivyMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: ivyMap, alphaTest: 0.45, side: THREE.DoubleSide });
    addWind(ivyMat, 0.05, 0.25, true);
    const ivyDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: ivyMap, alphaTest: 0.45, side: THREE.DoubleSide });
    type Chunk = { cx: number; cz: number; solid: { s: Solid; m: THREE.Matrix4 }[]; glass: { s: Solid; m: THREE.Matrix4 }[]; stems: THREE.BufferGeometry[]; leaves: THREE.BufferGeometry[]; mounds: Part[] };
    const chunks = new Map<string, Chunk>();
    const chunkAt = (x: number, z: number): Chunk => {
      const ci = Math.floor(x / CHUNK);
      const cj = Math.floor(z / CHUNK);
      let ch = chunks.get(`${ci},${cj}`);
      if (!ch) chunks.set(`${ci},${cj}`, (ch = { cx: (ci + 0.5) * CHUNK, cz: (cj + 0.5) * CHUNK, solid: [], glass: [], stems: [], leaves: [], mounds: [] }));
      return ch;
    };
    const signs = new Map<string, THREE.BufferGeometry[]>();
    const none = new THREE.Matrix4();

    for (const b of buildings) {
      const boxes = parts.get(b.key) ?? [];
      const M = new THREE.Matrix4().makeRotationY(b.rot).setPosition(b.x, b.y, b.z);
      const ch = chunkAt(b.x, b.z);
      const Mc = new THREE.Matrix4().makeTranslation(-ch.cx, 0, -ch.cz).multiply(M);
      const inside: { s: Solid; m: THREE.Matrix4 }[] = [];
      for (const bx of boxes) {
        const outer = bx.kind === 'wall' || bx.kind === 'roof' || bx.kind === 'rubble' || (b.decay > 0 && bx.kind !== 'furn');
        if (bx.kind === 'glass') ch.glass.push({ s: bx, m: Mc });
        else if (bx.kind === 'rubble') ch.mounds.push(mound(bx, Mc, r));
        else if (outer) ch.solid.push({ s: { ...bx, grime: bx.kind === 'wall' }, m: Mc });
        else inside.push({ s: bx, m: none });
      }
      // มอสกับดินบนหลังคาที่ยังเหลือ (แผ่นบางราบไปกับหลังคา) · โคนผนังใช้ไม้เลื้อยเป็นแผ่นใบแทน (เดิมเป็นกล่องเขียวดูเป็นแท่น)
      const top = b.decay === 2 ? 1.6 : b.floors * b.storey;
      if (b.decay === 0) {
        for (let k = 0; k < 8; k++) {
          ch.solid.push({ s: { x: (r() - 0.5) * b.w * 0.7, z: (r() - 0.5) * b.d * 0.7, hx: 0.5 + r() * 1.4, hz: 0.5 + r() * 1.2, y0: top + 0.3, y1: top + 0.35 + r() * 0.06, color: 0x4e5a2c }, m: Mc });
        }
      }
      // เถาวัลย์ไม้เลื้อย
      const og = overgrowth(b, top, r);
      if (og.stems.length) ch.stems.push(assemble(og.stems).applyMatrix4(Mc));
      if (og.cards.length) ch.leaves.push(cardsGeometry(og.cards, r).applyMatrix4(Mc));
      if (inside.length) {
        const mesh = new THREE.Mesh(mergeBoxes(inside, r), mat);
        mesh.position.set(b.x, b.y, b.z);
        mesh.rotation.y = b.rot;
        mesh.castShadow = mesh.receiveShadow = true;
        mesh.visible = false;
        this.group.add(mesh);
        this.interiors.push({ mesh, x: b.x, z: b.z, r: Math.hypot(b.w, b.d) / 2 });
      }
      // ป้ายเหนือประตูหน้า · ซากที่เหลือแต่ตอผนังไม่มีป้ายแล้ว ตึกหลังคาหายป้ายร่วงไปครึ่งหนึ่ง
      if (b.sign && b.decay < 2 && (b.decay === 0 || r() < 0.5)) {
        const w = Math.min(b.w * 0.8, Math.max(3, b.sign.length * 0.42));
        const g = new THREE.PlaneGeometry(w, w * 0.19);
        const local = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0, Math.PI, (r() - 0.5) * 0.14)).setPosition(0, Math.min(b.storey - 0.3, 2.75), -b.d / 2 - 0.17);
        g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(M, local));
        const list = signs.get(b.sign) ?? [];
        list.push(g);
        signs.set(b.sign, list);
      }
    }

    // สวน สุสาน สนามเด็กเล่น หอส่งน้ำ
    for (const e of extras) {
      const M = new THREE.Matrix4().makeRotationY(e.rot).setPosition(e.x, e.y, e.z);
      const ch = chunkAt(e.x, e.z);
      const Mc = new THREE.Matrix4().makeTranslation(-ch.cx, 0, -ch.cz).multiply(M);
      for (const bx of e.boxes) ch.solid.push({ s: bx, m: Mc });
      if (e.sign) {
        const g = new THREE.PlaneGeometry(e.sign.w, e.sign.w * 0.19);
        const local = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0, Math.PI, 0)).setPosition(e.sign.x, e.sign.y, e.sign.z);
        g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(M, local));
        const list = signs.get(e.sign.text) ?? [];
        list.push(g);
        signs.set(e.sign.text, list);
      }
    }

    for (const ch of chunks.values()) {
      const m = new THREE.Mesh(mergeBoxes(ch.solid, r), mat);
      m.position.set(ch.cx, 0, ch.cz);
      m.castShadow = m.receiveShadow = true;
      this.add(m, ch.cx, ch.cz);
      if (ch.glass.length) {
        const gm = new THREE.Mesh(mergeBoxes(ch.glass, r), glassMat);
        gm.position.set(ch.cx, 0, ch.cz);
        this.add(gm, ch.cx, ch.cz);
      }
      if (ch.mounds.length) {
        const mm = new THREE.Mesh(assemble(ch.mounds), moundMat);
        mm.position.set(ch.cx, 0, ch.cz);
        mm.castShadow = mm.receiveShadow = true;
        this.add(mm, ch.cx, ch.cz, DETAIL_FAR);
      }
      if (ch.stems.length) {
        const sm = new THREE.Mesh(mergeGeometries(ch.stems, false)!, mat);
        sm.position.set(ch.cx, 0, ch.cz);
        this.add(sm, ch.cx, ch.cz, DETAIL_FAR);
      }
      if (ch.leaves.length) {
        const lm = new THREE.Mesh(mergeGeometries(ch.leaves, false)!, ivyMat);
        lm.position.set(ch.cx, 0, ch.cz);
        lm.customDepthMaterial = ivyDepth;
        lm.castShadow = lm.receiveShadow = true;
        this.add(lm, ch.cx, ch.cz, DETAIL_FAR);
      }
    }
    for (const [text, list] of signs) {
      const g = mergeGeometries(list)!;
      g.computeBoundingSphere();
      const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: signTexture(text) }));
      this.add(m, g.boundingSphere!.center.x, g.boundingSphere!.center.z);
    }

    // สะพาน
    const concrete = new THREE.MeshLambertMaterial({ color: 0x7a776e });
    applyDetail(concrete, 'stone');
    const rust = new THREE.MeshLambertMaterial({ color: 0x4e3424 });
    applyDetail(rust, 'rust');
    for (const p of bridge) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(p.hx * 2, p.y1 - p.y0, p.hz * 2), p.kind === 'rail' ? rust : concrete);
      mesh.position.set(p.x, (p.y0 + p.y1) / 2, p.z);
      mesh.rotation.y = p.rot;
      mesh.castShadow = mesh.receiveShadow = true;
      this.add(mesh, p.x, p.z);
    }
  }

  private add(o: THREE.Object3D, x: number, z: number, r = TOWN_FAR): void {
    this.group.add(o);
    this.far.push({ o, x, z, r });
  }

  /** จำนวนตึกที่วาดภายในอยู่ตอนนี้ (ตัวช่วยทดสอบ) */
  get interiorsShown(): number {
    return this.interiors.filter((i) => i.mesh.visible).length;
  }

  /** ภายในวาดเฉพาะหลังที่อยู่ใกล้ · ภายนอกกับสะพานซ่อนเมื่อไกล */
  cull(x: number, z: number): void {
    for (const it of this.interiors) it.mesh.visible = Math.hypot(it.x - x, it.z - z) < INTERIOR_NEAR + it.r;
    for (const f of this.far) f.o.visible = Math.hypot(f.x - x, f.z - z) < f.r;
  }
}

// ของในคอลเลกชัน (พี่กันขอ 26 ต.ค. 2569 ให้ของที่สแกนแล้วดูโมเดลได้ · เดิมตึกกับสะพานขึ้นเป็นกล่องเทา 10 ซม.)
// ใช้กล่อง กองซาก เถาวัลย์ ป้าย ชุดเดียวกับในเมือง · ทำวัสดุใหม่ทุกครั้ง ปิดหน้าคอลเลกชันแล้วคืนหน่วยความจำได้ ไม่ไปลบของที่เมืองใช้อยู่

/** ตึกหนึ่งหลัง (พิกัดในตึก) ทั้งภายนอก ภายใน เถาวัลย์ กองซาก ป้ายหน้าร้าน */
export function buildingPreview(b: Building, boxes: TownBox[]): THREE.Group {
  const r = rng(9091);
  const g = new THREE.Group();
  const none = new THREE.Matrix4();
  const solid: { s: Solid; m: THREE.Matrix4 }[] = [];
  const glass: { s: Solid; m: THREE.Matrix4 }[] = [];
  const mounds: Part[] = [];
  for (const bx of boxes) {
    if (bx.kind === 'glass') glass.push({ s: bx, m: none });
    else if (bx.kind === 'rubble') mounds.push(mound(bx, none, r));
    else solid.push({ s: { ...bx, grime: bx.kind === 'wall' }, m: none });
  }
  const top = b.decay === 2 ? 1.6 : b.floors * b.storey;
  if (b.decay === 0) {
    for (let k = 0; k < 8; k++) {
      solid.push({ s: { x: (r() - 0.5) * b.w * 0.7, z: (r() - 0.5) * b.d * 0.7, hx: 0.5 + r() * 1.4, hz: 0.5 + r() * 1.2, y0: top + 0.3, y1: top + 0.35 + r() * 0.06, color: 0x4e5a2c }, m: none });
    }
  }
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  applyDetail(mat, 'plaster');
  if (solid.length) g.add(new THREE.Mesh(mergeBoxes(solid, r), mat));
  if (glass.length) g.add(new THREE.Mesh(mergeBoxes(glass, r), new THREE.MeshLambertMaterial({ color: 0x2a3634, transparent: true, opacity: 0.45 })));
  if (mounds.length) {
    const mm = new THREE.MeshLambertMaterial({ vertexColors: true });
    applyDetail(mm, 'stone');
    g.add(new THREE.Mesh(assemble(mounds), mm));
  }
  const og = overgrowth(b, top, r);
  if (og.stems.length) g.add(new THREE.Mesh(assemble(og.stems), new THREE.MeshLambertMaterial({ vertexColors: true })));
  if (og.cards.length) g.add(new THREE.Mesh(cardsGeometry(og.cards, r), new THREE.MeshLambertMaterial({ vertexColors: true, map: leafTexture('broad').clone(), alphaTest: 0.45, side: THREE.DoubleSide })));
  if (b.sign && b.decay < 2) {
    const w = Math.min(b.w * 0.8, Math.max(3, b.sign.length * 0.42));
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.19), new THREE.MeshLambertMaterial({ map: signTexture(b.sign).clone() }));
    sign.position.set(0, Math.min(b.storey - 0.3, 2.75), -b.d / 2 - 0.17);
    sign.rotation.y = Math.PI;
    g.add(sign);
  }
  return g;
}

/** สะพานพังทั้งตัว (พื้นสะพาน เสา ราวสนิม) · พิกัดโลก ตัวดูโมเดลย้ายมากลางเอง */
export function bridgePreview(bridge: BridgePart[]): THREE.Group {
  const g = new THREE.Group();
  const concrete = new THREE.MeshLambertMaterial({ color: 0x7a776e });
  applyDetail(concrete, 'stone');
  const rust = new THREE.MeshLambertMaterial({ color: 0x4e3424 });
  applyDetail(rust, 'rust');
  for (const p of bridge) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(p.hx * 2, p.y1 - p.y0, p.hz * 2), p.kind === 'rail' ? rust : concrete);
    mesh.position.set(p.x, (p.y0 + p.y1) / 2, p.z);
    mesh.rotation.y = p.rot;
    g.add(mesh);
  }
  return g;
}
