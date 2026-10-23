import * as THREE from 'three';
import type { Cave } from '../world/caves';
import { Simplex2 } from '../world/noise';
import { plantGeometry } from './models/plants';

// อุโมงค์ถ้ำ เห็ดเรืองแสง ภาพวาดรอยมือบนผนัง ก๊าซพิษ · และเจาะรูปากถ้ำในพื้นดิน

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

export class Caves {
  readonly group = new THREE.Group();
  /** จุดที่มีของให้สแกน (ภาพวาด เห็ดเรืองแสง) */
  readonly scannables: { key: string; kind: string; x: number; y: number; z: number; special?: boolean }[] = [];
  private gasMats: THREE.MeshBasicMaterial[] = [];
  /** ส่งให้วัสดุพื้นดิน เจาะรูตรงปากถ้ำ */
  readonly holeUniform = { value: [] as THREE.Vector4[] };

  constructor(caves: Cave[]) {
    const nz = new Simplex2(3141);
    const rockMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.BackSide });
    const glowMat = new THREE.MeshStandardMaterial({ vertexColors: true, emissive: 0x3fd8f0, emissiveIntensity: 1.3, roughness: 0.6 });
    for (const cave of caves) {
      const pts = cave.points;
      // อุโมงค์: วงแหวนตามทาง พื้นแบน ผนังขรุขระ มืดลงเรื่อย ๆ ตามความลึก
      const rings = 64;
      const seg = 18;
      const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p.x, p.y, p.z)));
      const pos: number[] = [];
      const col: number[] = [];
      const idx: number[] = [];
      const up = new THREE.Vector3(0, 1, 0);
      for (let i = 0; i <= rings; i++) {
        const f = i / rings;
        const c = curve.getPointAt(f);
        const tan = curve.getTangentAt(f).setY(0).normalize();
        const side = new THREE.Vector3().crossVectors(tan, up).normalize();
        const k = Math.min(pts.length - 2, Math.floor(f * (pts.length - 1)));
        const r = pts[k].r + (pts[k + 1].r - pts[k].r) * (f * (pts.length - 1) - k);
        const endShrink = f > 0.97 ? 1 - (f - 0.97) * 25 : 1;
        for (let j = 0; j <= seg; j++) {
          const a = (j / seg) * Math.PI * 2;
          const bump = 1 + 0.18 * nz.noise(i * 0.4 + cave.id * 9, j * 0.7);
          const rr = r * bump * Math.max(0.15, endShrink);
          let y = c.y + Math.sin(a) * rr * 1.25 + rr * 0.55;
          if (y < c.y) y = c.y - 0.05; // พื้นถ้ำแบน
          pos.push(c.x + side.x * Math.cos(a) * rr * 1.1, y, c.z + side.z * Math.cos(a) * rr * 1.1);
          const dark = 0.62 - f * 0.25 + 0.08 * nz.noise(i * 0.9, j * 0.9);
          const wet = y < c.y + 0.3 ? 0.75 : 1;
          col.push(0.42 * dark * wet, 0.38 * dark * wet, 0.33 * dark * wet);
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
      const tunnel = new THREE.Mesh(geo, rockMat);
      tunnel.receiveShadow = true;
      this.group.add(tunnel);

      // รูปากถ้ำในพื้นดิน: ส่งช่วงแรกของอุโมงค์ให้วัสดุพื้นดินตัดทิ้ง
      for (let i = 0; i < 5; i++) {
        const p = pts[i];
        this.holeUniform.value.push(new THREE.Vector4(p.x, p.y, p.z, p.r * 0.95));
      }

      // เห็ดเรืองแสงตามผนังครึ่งในของถ้ำ
      const mush = plantGeometry('mushroom');
      const n = 26;
      const inst = new THREE.InstancedMesh(mush, glowMat, n);
      const m4 = new THREE.Matrix4();
      for (let i = 0; i < n; i++) {
        const f = 0.4 + (i / n) * 0.58;
        const c = curve.getPointAt(f);
        const tan = curve.getTangentAt(f).setY(0).normalize();
        const side = new THREE.Vector3().crossVectors(tan, up).normalize();
        const s = i % 2 ? 1 : -1;
        const k = Math.min(pts.length - 2, Math.floor(f * (pts.length - 1)));
        const r = pts[k].r * 0.9;
        const p = new THREE.Vector3(c.x + side.x * s * r, c.y, c.z + side.z * s * r);
        m4.compose(p, new THREE.Quaternion().setFromAxisAngle(up, i), new THREE.Vector3().setScalar(1.4 + (i % 3) * 0.5));
        inst.setMatrixAt(i, m4);
        if (i % 6 === 0) this.scannables.push({ key: `glow-${cave.id}-${i}`, kind: 'glowshroom', x: p.x, y: p.y + 0.15, z: p.z });
      }
      this.group.add(inst);
      for (const f of [0.6, 0.9]) {
        const c = curve.getPointAt(f);
        const l = new THREE.PointLight(0x5fd8f0, 6, 14, 1.6);
        l.position.set(c.x, c.y + 1.2, c.z);
        this.group.add(l);
      }

      // ภาพวาดรอยมือบนผนังห้องปลายถ้ำ
      const end = curve.getPointAt(0.93);
      const tan = curve.getTangentAt(0.93).setY(0).normalize();
      const side = new THREE.Vector3().crossVectors(tan, up).normalize();
      const r = pts[pts.length - 2].r * 1.05;
      const paint = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.6), new THREE.MeshLambertMaterial({ map: paintingTexture(), transparent: true, opacity: 0.92 }));
      paint.position.set(end.x + side.x * r, end.y + 1.6, end.z + side.z * r);
      paint.lookAt(end.x, end.y + 1.6, end.z);
      this.group.add(paint);
      this.scannables.push({ key: `painting-${cave.id}`, kind: 'painting', x: paint.position.x, y: paint.position.y, z: paint.position.z, special: true });

      // ก๊าซพิษ: หมอกสีเขียวจาง ๆ ในส่วนลึก
      if (cave.gasFrom < 1) {
        const gm = new THREE.MeshBasicMaterial({ color: 0x9adf7a, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide });
        this.gasMats.push(gm);
        for (let i = 0; i < 6; i++) {
          const f = cave.gasFrom + (i / 6) * (1 - cave.gasFrom) * 0.95;
          const c = curve.getPointAt(Math.min(0.98, f));
          const puff = new THREE.Mesh(new THREE.SphereGeometry(2.4 + (i % 3) * 0.6, 12, 8), gm);
          puff.position.set(c.x, c.y + 1.3, c.z);
          this.group.add(puff);
        }
      }
    }
  }

  update(time: number): void {
    for (const m of this.gasMats) m.opacity = 0.08 + 0.04 * Math.sin(time * 0.7);
  }

  /** เจาะรูปากถ้ำในวัสดุพื้นดิน (ตัดผิวดินที่อยู่ในอุโมงค์ช่วงปากถ้ำทิ้ง) */
  cutTerrain(mat: THREE.Material): void {
    const holes = this.holeUniform;
    const count = holes.value.length;
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uHoles = holes;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vHoleWorld;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvHoleWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>\nvarying vec3 vHoleWorld;\nuniform vec4 uHoles[${count}];`)
        .replace(
          '#include <clipping_planes_fragment>',
          `#include <clipping_planes_fragment>
          for (int i = 0; i < ${count}; i++) {
            vec4 h = uHoles[i];
            float d = length(vHoleWorld.xz - h.xz);
            if (d < h.w && vHoleWorld.y > h.y + 0.25 && vHoleWorld.y < h.y + h.w * 1.55) discard;
          }`,
        );
    };
    mat.customProgramCacheKey = () => `cave-holes-${count}`;
    mat.needsUpdate = true;
  }
}
