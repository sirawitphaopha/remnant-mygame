import * as THREE from 'three';
import { caveCenter, caveFeatures, type Cave, type CaveFeature } from '../world/caves';
import { Simplex2 } from '../world/noise';
import { applyDetail } from './detail';
import { assemble, jitter, type Part } from './models/build';
import { plantGeometry } from './models/plants';

// ถ้ำ 2 แห่ง (รอบสอง ช่วง 11 · ของในถ้ำวางใน world/caves.ts)
// ถ้ำหินปูน: อุโมงค์กลมขรุขระสีครีม หินย้อย หินงอก เสาหิน มอสกับเฟิร์นใกล้ปากถ้ำ รากไม้ห้อย หลุมยุบมีลำแสง แอ่งน้ำมีปลาไม่มีตา ค้างคาว ภาพวาดรอยมือ
// ถ้ำเหมืองเก่า: อุโมงค์ทรงเหลี่ยม ค้ำยันไม้ผุ รางสนิม รถเข็นแร่ ตะเกียงสนิม ช่วงถล่ม ค่ายพักเก่า เห็ดเรืองแสง ก๊าซพิษ
// ไม่มีไฟจริงในถ้ำ (เดิมไฟจุด 4 ดวงถูกคิดแสงกับทุกพื้นผิวทั้งแมพ) · แสงเห็ดกับลำแสงหลุมยุบย้อมไว้ในสีผนังแทน

function paintingTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const x = c.getContext('2d')!;
  x.fillStyle = '#4a4038';
  x.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 400; i++) {
    x.fillStyle = `rgba(${40 + Math.random() * 30},${35 + Math.random() * 25},30,${Math.random() * 0.3})`;
    x.fillRect(Math.random() * 512, Math.random() * 256, 4 + Math.random() * 20, 2 + Math.random() * 10);
  }
  // รอยมือ ใหญ่เล็ก มือเล็กที่สุดอยู่ต่ำที่สุด
  const hand = (cx: number, cy: number, s: number, col: string) => {
    x.fillStyle = col;
    x.beginPath();
    x.ellipse(cx, cy, 14 * s, 17 * s, 0, 0, Math.PI * 2);
    x.fill();
    const fingers = [[-12, -26, -0.25], [-4, -32, -0.08], [4, -33, 0.05], [12, -28, 0.2], [20, -6, 0.9]];
    for (const [fx, fy, a] of fingers) {
      x.save();
      x.translate(cx + fx * s, cy + fy * s);
      x.rotate(a);
      x.beginPath();
      x.ellipse(0, 0, 3.8 * s, 11 * s, 0, 0, Math.PI * 2);
      x.fill();
      x.restore();
    }
  };
  const hands: [number, number, number, string][] = [
    [80, 90, 1.25, 'rgba(160,60,40,.85)'], [150, 70, 1.15, 'rgba(170,80,40,.8)'], [215, 100, 1.2, 'rgba(150,50,35,.8)'],
    [300, 80, 1.1, 'rgba(165,70,45,.85)'], [370, 110, 1.0, 'rgba(180,90,50,.8)'], [440, 85, 1.2, 'rgba(150,55,40,.8)'], [260, 190, 0.6, 'rgba(190,100,60,.9)'],
  ];
  for (const h of hands) hand(...h);
  // คนตัวเล็กยืนจับมือกัน
  x.strokeStyle = 'rgba(30,25,20,.8)';
  x.lineWidth = 4;
  for (let i = 0; i < 6; i++) {
    const px = 120 + i * 50;
    x.beginPath();
    x.arc(px, 160, 7, 0, Math.PI * 2);
    x.moveTo(px, 167); x.lineTo(px, 200);
    x.moveTo(px - 25, 180); x.lineTo(px + 25, 180);
    x.moveTo(px, 200); x.lineTo(px - 10, 222); x.moveTo(px, 200); x.lineTo(px + 10, 222);
    x.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** ภาพวาดรอยมือในคอลเลกชัน: ผนังหินปูนขรุขระสีครีม มีภาพวาดอยู่ด้านหน้า (เดิมขึ้นเป็นกล่องเทา 10 ซม.) */
export function paintingPreview(): THREE.Group {
  const g = new THREE.Group();
  const wall = new THREE.Mesh(jitter(new THREE.BoxGeometry(3.8, 2.2, 0.5, 10, 6, 2), 0.07, 2, 7), new THREE.MeshLambertMaterial({ color: 0xb5a98f }));
  wall.position.z = -0.3;
  const paint = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.6), new THREE.MeshLambertMaterial({ map: paintingTexture(), transparent: true, opacity: 0.92 }));
  g.add(wall, paint);
  return g;
}

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/** กรวยขรุขระ (หินงอก หินย้อย) ปลายชี้ขึ้นจากฐาน y = 0 */
function spike(r: number, h: number, seed: number): THREE.BufferGeometry {
  const g = new THREE.ConeGeometry(r, h, 8, 4).translate(0, h / 2, 0);
  return jitter(g, r * 0.25, 3, seed);
}

export class Caves {
  readonly group = new THREE.Group();
  /** จุดที่มีของให้สแกน (ภาพวาด เห็ดเรืองแสง) */
  readonly scannables: { key: string; kind: string; x: number; y: number; z: number; special?: boolean }[] = [];
  private gasMats: THREE.MeshBasicMaterial[] = [];
  /** ส่งให้วัสดุพื้นดิน เจาะรูตรงปากถ้ำ · เป็นคู่จุดต้นกับปลายของแต่ละช่วงอุโมงค์ (x พื้น z รัศมี) */
  readonly holeUniform = { value: [] as THREE.Vector4[] };
  /** ปล่องหลุมยุบ (กลาง รัศมี) เจาะผิวดินทุกความสูง */
  readonly sinkUniform = { value: [] as THREE.Vector4[] };
  /** กรอบถ้ำแต่ละแห่ง (กลาง x z รัศมี) พื้นดินนอกกรอบไม่ต้องวนหารู */
  readonly holeBoxes = { value: [] as THREE.Vector4[] };
  private fish: { mesh: THREE.InstancedMesh; cx: number; cz: number; y: number; r: number }[] = [];
  private bats: { mesh: THREE.InstancedMesh; spots: CaveFeature[] }[] = [];
  private m4 = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  /** ของในถ้ำที่ชนได้ (App ใส่ตัวชน) */
  readonly solids: CaveFeature[] = [];

  constructor(caves: Cave[]) {
    const nz = new Simplex2(3141);
    const up = V(0, 1, 0);
    for (const cave of caves) {
      const pts = cave.points;
      const lime = cave.kind === 'limestone';
      const feats = caveFeatures(cave);
      for (const f of feats) if (f.solid > 0) this.solids.push(f);
      const sink = feats.find((f) => f.kind === 'sinkhole');
      // ---------- อุโมงค์ ----------
      const rings = 72;
      const seg = 20;
      const curve = new THREE.CatmullRomCurve3(pts.map((p) => V(p.x, p.y, p.z)));
      const pos: number[] = [];
      const col: number[] = [];
      const idx: number[] = [];
      for (let i = 0; i <= rings; i++) {
        const f = i / rings;
        const c = curve.getPointAt(f);
        const tan = curve.getTangentAt(f).setY(0).normalize();
        const side = V().crossVectors(tan, up).normalize();
        const k = Math.min(pts.length - 2, Math.floor(f * (pts.length - 1)));
        const r = pts[k].r + (pts[k + 1].r - pts[k].r) * (f * (pts.length - 1) - k);
        const endShrink = f > 0.97 ? 1 - (f - 0.97) * 25 : 1;
        for (let j = 0; j <= seg; j++) {
          const a = (j / seg) * Math.PI * 2;
          const bump = 1 + (lime ? 0.18 : 0.07) * nz.noise(i * 0.4 + cave.id * 9, j * 0.7);
          const rr = r * bump * Math.max(0.15, endShrink);
          // หินปูนทรงกลมรี · เหมืองทรงเหลี่ยม ผนังตั้งตรง เพดานแบน
          const ca = Math.cos(a);
          const sa = Math.sin(a);
          const sx = lime ? ca : Math.sign(ca) * Math.pow(Math.abs(ca), 0.35);
          const sy = lime ? sa : Math.sign(sa) * Math.pow(Math.abs(sa), 0.35);
          let y = c.y + sy * rr * (lime ? 1.25 : 1.05) + rr * (lime ? 0.55 : 0.5);
          if (y < c.y) y = c.y - 0.05; // พื้นถ้ำแบน
          const px = c.x + side.x * sx * rr * 1.1;
          const pz = c.z + side.z * sx * rr * 1.1;
          pos.push(px, y, pz);
          // สีผนัง: หินปูนครีมอมเทา เหมืองน้ำตาลเทา · มืดลงตามความลึก · พื้นชื้นเข้ม
          const dark = 0.66 - f * 0.22 + 0.08 * nz.noise(i * 0.9, j * 0.9);
          const wet = y < c.y + 0.3 ? 0.72 : 1;
          let cr = (lime ? 0.62 : 0.42) * dark * wet;
          let cg = (lime ? 0.57 : 0.37) * dark * wet;
          let cb = (lime ? 0.48 : 0.31) * dark * wet;
          // มอสเขียวช่วงปากถ้ำที่ยังได้แสง
          if (lime && f < 0.22 && y < c.y + rr * 1.2) {
            const m = (1 - f / 0.22) * (0.55 + 0.45 * nz.noise(i * 1.7, j * 1.3));
            cr = cr * (1 - m) + 0.2 * m;
            cg = cg * (1 - m) + 0.32 * m;
            cb = cb * (1 - m) + 0.12 * m;
          }
          // ลำแสงจากหลุมยุบส่องผนังกับพื้นรอบ ๆ
          if (sink) {
            const d = Math.hypot(px - sink.x, pz - sink.z);
            const lit = Math.max(0, 1 - d / 7) * 1.4;
            cr += lit * 0.45;
            cg += lit * 0.42;
            cb += lit * 0.32;
          }
          // แสงเห็ดเรืองแสงย้อมผนังส่วนลึกของเหมืองเป็นสีฟ้าอ่อน
          if (!lime && f > 0.4) {
            const g = 0.12 * Math.max(0, nz.noise(i * 0.3 + 4, j * 0.5));
            cg += g;
            cb += g * 1.2;
          }
          col.push(cr, cg, cb);
        }
      }
      for (let i = 0; i < rings; i++) {
        for (let j = 0; j < seg; j++) {
          const a = i * (seg + 1) + j;
          const b = a + seg + 1;
          idx.push(a, b, a + 1, b, b + 1, a + 1);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      // วาดสองด้าน: ช่วงปากถ้ำที่ยื่นพ้นหน้าผาเห็นเป็นซุ้มหิน (เดิมวาดแต่ผิวใน มองจากข้างนอกเห็นผนังฝั่งไกลลอยเป็นแผ่นโค้ง)
      const rockMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
      const r40 = sink ? caveCenter(cave, 0.4).r : 0;
      // หลุมยุบ: เพดานอุโมงค์เปิดเป็นช่องตรงปล่อง
      if (sink) {
        rockMat.onBeforeCompile = (sh) => {
          sh.vertexShader = sh.vertexShader
            .replace('#include <common>', '#include <common>\nvarying vec3 vSinkW;')
            .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvSinkW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
          sh.fragmentShader = sh.fragmentShader
            .replace('#include <common>', '#include <common>\nvarying vec3 vSinkW;')
            .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
              if (length(vSinkW.xz - vec2(${sink.x.toFixed(2)}, ${sink.z.toFixed(2)})) < ${(sink.size * 1.1).toFixed(2)} && vSinkW.y > ${(sink.y + r40 * 1.2).toFixed(2)}) discard;`);
        };
        rockMat.customProgramCacheKey = () => `cave-sink-${cave.id}`;
      }
      applyDetail(rockMat, 'stone', 1.4);
      const tunnel = new THREE.Mesh(geo, rockMat);
      tunnel.receiveShadow = true;
      this.group.add(tunnel);

      // รูปากถ้ำในพื้นดิน: ช่วงแรกของอุโมงค์ให้วัสดุพื้นดินตัดทิ้ง · กรอบถ้ำไว้ข้ามรูเร็ว ๆ
      // 5 ช่วงแรกของอุโมงค์ ตัดเฉพาะผิวดินที่อยู่ข้างช่วงนั้นจริง (เดิมตัดเป็นวงกลมรอบจุด วงแรกยื่นเลยปลายอุโมงค์ออกมา ข้างใต้ไม่มีอะไร มองทะลุเห็นฟ้า)
      for (let i = 0; i < 5; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        // รัศมีติดลบ = เหมือง (รูปตัดเหลี่ยม)
        const k = lime ? 1 : -1;
        this.holeUniform.value.push(new THREE.Vector4(a.x, a.y, a.z, a.r * k), new THREE.Vector4(b.x, b.y, b.z, b.r * k));
      }
      if (sink) this.sinkUniform.value.push(new THREE.Vector4(sink.x, sink.y, sink.z, sink.size * 1.1));
      const c0 = pts[0];
      const c1 = pts[pts.length - 1];
      this.holeBoxes.value.push(new THREE.Vector4((c0.x + c1.x) / 2, (c0.z + c1.z) / 2, Math.hypot(c1.x - c0.x, c1.z - c0.z) / 2 + 20, 0));

      // ---------- ของในถ้ำ ----------
      const stone: Part[] = [];
      const wood: Part[] = [];
      const rust: Part[] = [];
      const green: Part[] = [];
      const ferns: CaveFeature[] = [];
      let seed = cave.id * 100;
      for (const f of feats) {
        seed++;
        const rot = new THREE.Matrix4().makeRotationY(f.rot);
        const at = (g: THREE.BufferGeometry) => g.applyMatrix4(rot).translate(f.x, f.y, f.z);
        switch (f.kind) {
          case 'stalagmite':
            stone.push({ geo: at(spike(f.size, f.h, seed)), color: 0xbdb19a, vary: 0.12 });
            break;
          case 'stalactite':
            stone.push({ geo: at(spike(f.size, f.h, seed).rotateX(Math.PI)), color: 0xc4b9a2, vary: 0.1 });
            break;
          case 'column': {
            const g = jitter(new THREE.CylinderGeometry(f.size * 0.6, f.size, f.h, 10, 6).translate(0, f.h / 2, 0), f.size * 0.25, 2, seed);
            stone.push({ geo: at(g), color: 0xb5a98f, vary: 0.12 });
            break;
          }
          case 'root': {
            const pts2: THREE.Vector3[] = [];
            for (let k = 0; k <= 5; k++) pts2.push(V(Math.sin(k * 1.3 + seed) * 0.15, -(k / 5) * f.h, Math.cos(k * 0.9 + seed) * 0.15));
            wood.push({ geo: at(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts2), 8, f.size, 4, false)), color: 0x4a3626, vary: 0.2 });
            break;
          }
          case 'moss':
            green.push({ geo: at(jitter(new THREE.CircleGeometry(f.size, 9).rotateX(-Math.PI / 2), f.size * 0.2, 2, seed, false)), color: 0x3e5a24, vary: 0.25 });
            break;
          case 'fern':
            ferns.push(f);
            break;
          case 'timber':
            wood.push({ geo: at(new THREE.BoxGeometry(f.size * 2, f.h, f.size * 2).translate(0, f.h / 2, 0)), color: 0x3e3022, vary: 0.2 });
            break;
          case 'beam':
            wood.push({ geo: at(new THREE.BoxGeometry(f.size * 2, f.h, 0.26).translate(0, f.h / 2, 0)), color: 0x3a2c20, vary: 0.2 });
            break;
          case 'lantern':
            rust.push({ geo: at(new THREE.BoxGeometry(f.size * 2, f.h, f.size * 2)), color: 0x4a3426, vary: 0.2 });
            break;
          case 'cart': {
            // รถเข็นแร่: กระบะเปิดด้านบน ล้อสี่ล้อ · คันที่คว่ำนอนตะแคง
            const parts: THREE.BufferGeometry[] = [
              new THREE.BoxGeometry(1.4, 0.08, 0.9).translate(0, 0.35, 0),
              new THREE.BoxGeometry(1.4, 0.6, 0.06).translate(0, 0.65, 0.42),
              new THREE.BoxGeometry(1.4, 0.6, 0.06).translate(0, 0.65, -0.42),
              new THREE.BoxGeometry(0.06, 0.6, 0.9).translate(0.67, 0.65, 0),
              new THREE.BoxGeometry(0.06, 0.6, 0.9).translate(-0.67, 0.65, 0),
            ];
            for (const wx of [-0.45, 0.45]) for (const wz of [-0.47, 0.47]) parts.push(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 10).rotateX(Math.PI / 2).translate(wx, 0.16, wz));
            for (const g of parts) {
              if (f.h > 0) g.rotateX(Math.PI / 2 - 0.1).translate(0, 0.45, 0);
              rust.push({ geo: at(g), color: 0x5a3a28, vary: 0.2 });
            }
            break;
          }
          case 'collapse':
            stone.push({ geo: at(jitter(new THREE.IcosahedronGeometry(1, 1).scale(f.size, f.h, f.size * 0.9), 0.15, 1.6, seed)), color: 0x6a6258, vary: 0.2 });
            if (seed % 2) wood.push({ geo: at(new THREE.BoxGeometry(2.4, 0.2, 0.22).rotateZ(0.5).translate(0, f.h * 0.6, 0)), color: 0x3a2c20, vary: 0.2 });
            break;
          case 'stove':
            rust.push({ geo: at(new THREE.BoxGeometry(0.8, f.h, 0.6).translate(0, f.h / 2, 0)), color: 0x3e2a20, vary: 0.2 });
            rust.push({ geo: at(new THREE.CylinderGeometry(0.07, 0.07, 1.4, 8).translate(0.2, f.h + 0.7, 0)), color: 0x3e2a20, vary: 0.2 });
            break;
          case 'cot': {
            // โครงเตียงเหล็ก ผ้ากับไม้ผุหายแล้ว
            for (const sz of [-0.38, 0.38]) rust.push({ geo: at(new THREE.BoxGeometry(1.9, 0.05, 0.05).translate(0, f.h, sz)), color: 0x5a3a28, vary: 0.2 });
            for (const sx of [-0.9, 0.9]) for (const sz of [-0.38, 0.38]) rust.push({ geo: at(new THREE.BoxGeometry(0.05, f.h, 0.05).translate(sx, f.h / 2, sz)), color: 0x5a3a28, vary: 0.2 });
            break;
          }
          case 'crate':
            wood.push({ geo: at(jitter(new THREE.IcosahedronGeometry(1, 1).scale(f.size, f.h, f.size), 0.08, 2, seed)), color: 0x4a3a2a, vary: 0.25 });
            break;
          default:
            break;
        }
      }
      const stoneMat = new THREE.MeshLambertMaterial({ vertexColors: true });
      applyDetail(stoneMat, 'stone', 2);
      const woodMat = new THREE.MeshLambertMaterial({ vertexColors: true });
      applyDetail(woodMat, 'bark', 1.5);
      const rustMat = new THREE.MeshLambertMaterial({ vertexColors: true });
      applyDetail(rustMat, 'rust', 1.5);
      const greenMat = new THREE.MeshLambertMaterial({ vertexColors: true });
      for (const [parts, mat] of [[stone, stoneMat], [wood, woodMat], [rust, rustMat], [green, greenMat]] as const) {
        if (!parts.length) continue;
        const m = new THREE.Mesh(assemble(parts), mat);
        m.receiveShadow = true;
        this.group.add(m);
      }
      if (ferns.length) {
        const fm = new THREE.InstancedMesh(plantGeometry('fern'), new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), ferns.length);
        ferns.forEach((f, i) => {
          this.m4.compose(V(f.x, f.y, f.z), this.q.setFromAxisAngle(up, f.rot), V(f.size, f.size, f.size));
          fm.setMatrixAt(i, this.m4);
        });
        this.group.add(fm);
      }

      // รางรถเข็นตามพื้นเหมือง: รางสนิมสองเส้น หมอนไม้ผุทุกราว 0.9 ม.
      if (!lime) {
        const railParts: Part[] = [];
        const L = 120;
        for (let k = 0; k < L; k++) {
          const f0 = 0.02 + (k / L) * 0.86;
          const c = caveCenter(cave, f0);
          const c2 = caveCenter(cave, f0 + 0.86 / L);
          const len = Math.hypot(c2.x - c.x, c2.z - c.z);
          const rot = Math.atan2(c.dx, c.dz);
          for (const s of [-0.45, 0.45]) {
            if ((k * 7 + (s > 0 ? 3 : 0)) % 11 === 0) continue; // รางผุขาดเป็นช่วง
            railParts.push({ geo: new THREE.BoxGeometry(0.06, 0.08, len).rotateY(rot).translate(c.x - c.dz * s + c.dx * len / 2, c.y + 0.1, c.z + c.dx * s + c.dz * len / 2), color: 0x4e3426, vary: 0.15 });
          }
          if (k % 2 === 0) railParts.push({ geo: new THREE.BoxGeometry(1.3, 0.08, 0.18).rotateY(rot).translate(c.x, c.y + 0.03, c.z), color: 0x3a2c20, vary: 0.2 });
        }
        const rm = new THREE.Mesh(assemble(railParts), rustMat);
        rm.receiveShadow = true;
        this.group.add(rm);
      }

      // ---------- หลุมยุบ: ปล่องหินขึ้นไปถึงผิวดิน ลำแสงลงมาที่พื้น ----------
      if (sink) {
        // ปล่องหินจากเพดานห้องถึงผิวดินพอดี (sink.h = ผิวดินเหนือพื้นถ้ำ) ยื่นพ้นดินเป็นขอบนิดเดียว
        const base = r40 * 1.5;
        const shaftH = Math.max(2, sink.h - base + 0.3);
        const shaftMat = new THREE.MeshLambertMaterial({ color: 0x7e776a, side: THREE.DoubleSide });
        applyDetail(shaftMat, 'stone', 1.4);
        const shaft = new THREE.Mesh(
          jitter(new THREE.CylinderGeometry(sink.size * 1.15, sink.size * 1.25, shaftH, 14, Math.max(2, Math.round(shaftH / 2)), true).translate(0, shaftH / 2, 0), 0.18, 1.2, 9, false),
          shaftMat,
        );
        shaft.position.set(sink.x, sink.y + base, sink.z);
        this.group.add(shaft);
        // ลำแสงสว่างที่ปากปล่อง จางลงจนเกือบหายที่พื้น (เดิมสีเท่ากันทั้งลำ เห็นเป็นแผ่นเทาแบน)
        const beamMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
        const beamGeo = new THREE.CylinderGeometry(sink.size * 0.95, sink.size * 1.3, sink.h, 16, 8, true);
        const bp = beamGeo.attributes.position;
        const bc: number[] = [];
        for (let k = 0; k < bp.count; k++) {
          const u = Math.pow(bp.getY(k) / sink.h + 0.5, 1.6);
          bc.push(1 * u, 0.95 * u, 0.82 * u);
        }
        beamGeo.setAttribute('color', new THREE.Float32BufferAttribute(bc, 3));
        const beam = new THREE.Mesh(beamGeo, beamMat);
        beam.position.set(sink.x, sink.y + sink.h / 2, sink.z);
        this.group.add(beam);
        const pool = new THREE.Mesh(new THREE.CircleGeometry(sink.size * 1.5, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xfff0cc, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending }));
        pool.position.set(sink.x, sink.y + 0.03, sink.z);
        this.group.add(pool);
      }

      // ---------- แอ่งน้ำใต้ดิน ปลาไม่มีตาสีขาวว่ายวน ----------
      const poolF = feats.find((f) => f.kind === 'pool');
      if (poolF) {
        const water = new THREE.Mesh(new THREE.CircleGeometry(poolF.size, 28).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x1e3a3e, transparent: true, opacity: 0.8, roughness: 0.05, metalness: 0.2 }));
        water.position.set(poolF.x, poolF.y + 0.06, poolF.z);
        this.group.add(water);
        const rim: Part[] = [];
        for (let k = 0; k < 14; k++) {
          const a = (k / 14) * Math.PI * 2;
          rim.push({ geo: jitter(new THREE.IcosahedronGeometry(0.28 + (k % 3) * 0.08, 0), 0.06, 3, k).translate(poolF.x + Math.cos(a) * poolF.size, poolF.y + 0.08, poolF.z + Math.sin(a) * poolF.size), color: 0xa89c86, vary: 0.15 });
        }
        this.group.add(new THREE.Mesh(assemble(rim), stoneMat));
        const fishGeo = new THREE.SphereGeometry(0.06, 8, 6).scale(1, 0.6, 2.6);
        const fishMesh = new THREE.InstancedMesh(fishGeo, new THREE.MeshLambertMaterial({ color: 0xe8e2dc, emissive: 0x222222 }), 7);
        this.group.add(fishMesh);
        this.fish.push({ mesh: fishMesh, cx: poolF.x, cz: poolF.z, y: poolF.y + 0.0, r: poolF.size * 0.7 });
        this.scannables.push({ key: `cavefish-${cave.id}`, kind: 'cavefish', x: poolF.x, y: poolF.y, z: poolF.z });
      }

      // ---------- ค้างคาวบินวนใต้เพดาน ----------
      const batSpots = feats.filter((f) => f.kind === 'bat');
      if (batSpots.length) {
        const wing = new THREE.BufferGeometry();
        wing.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.08, -0.22, 0.04, -0.05, 0, 0, -0.08, 0, 0, 0.08, 0.22, 0.04, -0.05, 0, 0, -0.08], 3));
        wing.computeVertexNormals();
        const bm = new THREE.InstancedMesh(wing, new THREE.MeshBasicMaterial({ color: 0x1a1614, side: THREE.DoubleSide }), batSpots.length);
        this.group.add(bm);
        this.bats.push({ mesh: bm, spots: batSpots });
        this.scannables.push({ key: `bat-${cave.id}`, kind: 'bat', x: batSpots[0].x, y: batSpots[0].y - 0.5, z: batSpots[0].z });
      }

      // ---------- เห็ดเรืองแสงตามผนังเหมือง ----------
      if (!lime) {
        const glowMat = new THREE.MeshStandardMaterial({ vertexColors: true, emissive: 0x3fd8f0, emissiveIntensity: 1.5, roughness: 0.6 });
        const mush = plantGeometry('mushroom');
        const n = 34;
        const inst = new THREE.InstancedMesh(mush, glowMat, n);
        for (let i = 0; i < n; i++) {
          const f = 0.4 + (i / n) * 0.55;
          const c = curve.getPointAt(f);
          const tan = curve.getTangentAt(f).setY(0).normalize();
          const side = V().crossVectors(tan, up).normalize();
          const s = i % 2 ? 1 : -1;
          const k = Math.min(pts.length - 2, Math.floor(f * (pts.length - 1)));
          const r = pts[k].r * 0.88;
          const p = V(c.x + side.x * s * r, c.y, c.z + side.z * s * r);
          this.m4.compose(p, this.q.setFromAxisAngle(up, i), V().setScalar(1.4 + (i % 3) * 0.5));
          inst.setMatrixAt(i, this.m4);
          if (i % 6 === 0) this.scannables.push({ key: `glow-${cave.id}-${i}`, kind: 'glowshroom', x: p.x, y: p.y + 0.15, z: p.z });
        }
        this.group.add(inst);
      }

      // ---------- ภาพวาดรอยมือบนผนังห้องปลายถ้ำหินปูน ----------
      if (lime) {
        const end = curve.getPointAt(0.93);
        const tan = curve.getTangentAt(0.93).setY(0).normalize();
        const side = V().crossVectors(tan, up).normalize();
        const r = pts[pts.length - 2].r * 1.05;
        const paint = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.6), new THREE.MeshLambertMaterial({ map: paintingTexture(), transparent: true, opacity: 0.92 }));
        paint.position.set(end.x + side.x * r, end.y + 1.6, end.z + side.z * r);
        paint.lookAt(end.x, end.y + 1.6, end.z);
        this.group.add(paint);
        this.scannables.push({ key: `painting-${cave.id}`, kind: 'painting', x: paint.position.x, y: paint.position.y, z: paint.position.z, special: true });
      }

      // ---------- ก๊าซพิษ: หมอกสีเขียวจาง ๆ ในส่วนลึกของเหมือง ----------
      if (cave.gasFrom < 1) {
        const gm = new THREE.MeshBasicMaterial({ color: 0x9adf7a, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide });
        this.gasMats.push(gm);
        for (let i = 0; i < 6; i++) {
          const f = cave.gasFrom + (i / 6) * (1 - cave.gasFrom) * 0.95;
          const c = curve.getPointAt(Math.min(0.98, f));
          const puff = new THREE.Mesh(new THREE.SphereGeometry(2.2 + (i % 3) * 0.5, 12, 8), gm);
          puff.position.set(c.x, c.y + 1.3, c.z);
          this.group.add(puff);
        }
      }
    }
  }

  update(time: number): void {
    for (const m of this.gasMats) m.opacity = 0.08 + 0.04 * Math.sin(time * 0.7);
    // ปลาไม่มีตาว่ายวนช้า ๆ ในแอ่ง
    for (const f of this.fish) {
      for (let i = 0; i < f.mesh.count; i++) {
        const a = time * (0.25 + i * 0.04) + i * 0.9;
        const rr = f.r * (0.35 + (i % 3) * 0.25);
        const x = f.cx + Math.cos(a) * rr;
        const z = f.cz + Math.sin(a) * rr;
        this.q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a);
        this.m4.compose(new THREE.Vector3(x, f.y - 0.06 - (i % 2) * 0.08, z), this.q, new THREE.Vector3(1, 1, 1));
        f.mesh.setMatrixAt(i, this.m4);
      }
      f.mesh.instanceMatrix.needsUpdate = true;
    }
    // ค้างคาวบินวนเป็นวงใต้เพดาน ปีกกระพือ
    for (const b of this.bats) {
      b.spots.forEach((s, i) => {
        const a = time * (1.2 + (i % 4) * 0.2) + i;
        const flap = 0.4 + 0.6 * Math.abs(Math.sin(time * 14 + i));
        this.q.setFromEuler(new THREE.Euler(0, -a, 0));
        this.m4.compose(new THREE.Vector3(s.x + Math.cos(a) * 1.6, s.y - 0.4 + Math.sin(time * 2 + i) * 0.3, s.z + Math.sin(a) * 1.6), this.q, new THREE.Vector3(1, flap, 1));
        b.mesh.setMatrixAt(i, this.m4);
      });
      b.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  /**
   * เจาะรูปากถ้ำในวัสดุพื้นดิน (ตัดผิวดินที่อยู่ในโพรงช่วงปากถ้ำทิ้ง · ปล่องหลุมยุบเจาะทุกความสูง)
   * จุดที่อยู่นอกกรอบถ้ำข้ามไปเลย (เดิมทุกพิกเซลของพื้นทั้งแมพวนตรวจรูทุกรู) · ไม่มีถ้ำ = ไม่แก้ shader
   */
  cutTerrain(mat: THREE.Material): void {
    const holes = this.holeUniform;
    const sinks = this.sinkUniform;
    const boxes = this.holeBoxes;
    const nseg = holes.value.length / 2;
    const nsink = sinks.value.length;
    const nb = boxes.value.length;
    if (!nseg || !nb) return;
    // ต่อจากตัวแก้เดิมของวัสดุ (พื้นเปียกตอนฝน) ไม่ทับกัน
    const prev = mat.onBeforeCompile;
    const prevKey = mat.customProgramCacheKey();
    mat.onBeforeCompile = (sh, r) => {
      prev.call(mat, sh, r);
      sh.uniforms.uHoles = holes;
      sh.uniforms.uHoleBoxes = boxes;
      if (nsink) sh.uniforms.uSinks = sinks;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vHoleWorld;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvHoleWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
varying vec3 vHoleWorld;
uniform vec4 uHoles[${nseg * 2}];
uniform vec4 uHoleBoxes[${nb}];
${nsink ? `uniform vec4 uSinks[${nsink}];` : ''}`)
        .replace(
          '#include <clipping_planes_fragment>',
          `#include <clipping_planes_fragment>
          bool nearCave = false;
          for (int b = 0; b < ${nb}; b++) if (length(vHoleWorld.xz - uHoleBoxes[b].xy) < uHoleBoxes[b].z) nearCave = true;
          if (nearCave) {
            for (int i = 0; i < ${nseg}; i++) {
              vec4 a = uHoles[i * 2];
              vec4 b = uHoles[i * 2 + 1];
              vec2 ab = b.xz - a.xz;
              float s = dot(vHoleWorld.xz - a.xz, ab) / dot(ab, ab);
              if (s < 0.0 || s > 1.0) continue;
              float rr = abs(mix(a.w, b.w, s));
              float fy = mix(a.y, b.y, s);
              if (vHoleWorld.y < fy + 0.6) continue;
              // ตัดเฉพาะในรูปตัดของอุโมงค์ที่วาดจริง (เดิมตัดเป็นกล่อง มุมบนตัดเลยผนังอุโมงค์ มองทะลุเห็นฟ้า)
              float lat = length(vHoleWorld.xz - a.xz - ab * s) / (rr * 1.1);
              if (a.w > 0.0) {
                float up = (vHoleWorld.y - fy - rr * 0.55) / (rr * 1.25);
                if (lat * lat + up * up < 0.66) discard;
              } else {
                float up = (vHoleWorld.y - fy - rr * 0.5) / (rr * 1.05);
                if (lat < 0.86 && abs(up) < 0.86) discard;
              }
            }
            ${nsink ? `for (int k = 0; k < ${nsink}; k++) if (length(vHoleWorld.xz - uSinks[k].xz) < uSinks[k].w) discard;` : ''}
          }`,
        );
    };
    mat.customProgramCacheKey = () => `${prevKey}-cave-holes-${nseg}-${nsink}-${nb}`;
    mat.needsUpdate = true;
  }
}
