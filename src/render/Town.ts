import * as THREE from 'three';
import type { BridgePart, Building } from '../world/town';
import { rng } from '../world/noise';
import { assemble, jitter } from './models/build';
import { addWind } from './wind';

// ตึกพังในหุบเขา มีเถาวัลย์ มอส ต้นไม้ขึ้นแทรก · สะพานพังข้ามแม่น้ำ

function facadeTexture(tone: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const x = c.getContext('2d')!;
  const base = 120 + tone * 40;
  x.fillStyle = `rgb(${base},${base - 4},${base - 12})`;
  x.fillRect(0, 0, 256, 256);
  // คราบน้ำไหลกับรอยด่าง
  for (let i = 0; i < 260; i++) {
    const g = Math.random() * 40 - 20;
    x.fillStyle = `rgba(${70 + g},${70 + g},${60 + g},${Math.random() * 0.18})`;
    x.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 18, 8 + Math.random() * 60);
  }
  // หน้าต่าง 2 × 2 ต่อแผ่น (แผ่นละ 6 ม. × 6.4 ม. = 2 ชั้น)
  for (let fy = 0; fy < 2; fy++) {
    for (let fx = 0; fx < 2; fx++) {
      const px = fx * 128 + 30;
      const py = fy * 128 + 34;
      const broken = Math.random() < 0.5;
      x.fillStyle = broken ? '#121416' : '#2a3438';
      x.fillRect(px, py, 68, 58);
      if (!broken) {
        x.fillStyle = 'rgba(150,170,175,.25)';
        x.fillRect(px + 4, py + 4, 28, 50);
      }
      x.fillStyle = 'rgba(40,40,40,.6)';
      x.fillRect(px - 4, py + 58, 76, 6);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** กล่องที่ uv ยืดตามขนาดจริง หน้าต่างไม่ยืดตามตึก */
function wallBox(w: number, h: number, d: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  // ลำดับหน้า: +x -x +y -y +z -z ทีละ 4 จุด
  const sizes: [number, number][] = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    const [su, sv] = sizes[f];
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      uv.setXY(i, uv.getX(i) * (su / 6), uv.getY(i) * (sv / 6.4));
    }
  }
  return g;
}

export class Town {
  readonly group = new THREE.Group();

  constructor(buildings: Building[], bridge: BridgePart[]) {
    const r = rng(9091);
    const roofMat = new THREE.MeshLambertMaterial({ color: 0x5b5a52 });
    const mossMat = new THREE.MeshLambertMaterial({ color: 0x41592a });
    const rubbleMat = new THREE.MeshLambertMaterial({ color: 0x77736a, flatShading: true });
    const vineMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    addWind(vineMat, 0.08, 0.3, true);
    const texes = [0, 1, 2].map((i) => facadeTexture(i / 2));

    for (const b of buildings) {
      const g = new THREE.Group();
      g.position.set(b.x, b.y, b.z);
      g.rotation.y = b.rot;
      const wall = new THREE.MeshLambertMaterial({ map: texes[Math.floor(b.tone * 3) % 3] });
      if (b.style === 'shelter') {
        // ตึกโล่งมีประตู ผนังบาง หลังคา
        const th = 0.35;
        const hw = b.w / 2;
        const hd = b.d / 2;
        const add = (geo: THREE.BufferGeometry, x: number, y: number, z: number, m: THREE.Material) => {
          const mesh = new THREE.Mesh(geo, m);
          mesh.position.set(x, y, z);
          mesh.castShadow = mesh.receiveShadow = true;
          g.add(mesh);
        };
        const door = 1.6;
        add(wallBox(b.w, b.h + 1, th), 0, (b.h - 1) / 2, hd - th / 2, wall);
        add(wallBox(th, b.h + 1, b.d), -hw + th / 2, (b.h - 1) / 2, 0, wall);
        add(wallBox(th, b.h + 1, b.d), hw - th / 2, (b.h - 1) / 2, 0, wall);
        add(wallBox(hw - door, b.h + 1, th), -(hw + door) / 2, (b.h - 1) / 2, -hd + th / 2, wall);
        add(wallBox(hw - door, b.h + 1, th), (hw + door) / 2, (b.h - 1) / 2, -hd + th / 2, wall);
        add(new THREE.BoxGeometry(door * 2, 1.2, th), 0, b.h - 0.6, -hd + th / 2, wall);
        add(new THREE.BoxGeometry(b.w + 0.3, 0.3, b.d + 0.3), 0, b.h + 0.15, 0, roofMat);
        add(jitter(new THREE.BoxGeometry(b.w * 0.6, 0.15, b.d * 0.5, 4, 1, 4), 0.2, 0.6, b.x), b.w * 0.1, b.h + 0.34, 0, mossMat);
        // ข้างในมีเศษของ ให้รู้ว่าเคยมีคนอยู่
        add(new THREE.BoxGeometry(1.2, 0.8, 0.6), -hw + 1.2, 0.4, hd - 1, rubbleMat);
      } else {
        const h = b.h;
        const body = new THREE.Mesh(wallBox(b.w, h + 1, b.d), wall);
        body.position.y = (h - 1) / 2;
        body.castShadow = body.receiveShadow = true;
        g.add(body);
        const roof = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.2, 0.25, b.d + 0.2), roofMat);
        roof.position.y = h + 0.1;
        roof.receiveShadow = true;
        g.add(roof);
        if (b.style === 'ruin') {
          // ผนังบนพังเป็นฟันเลื่อย มีเศษปูนกองข้างล่าง
          for (let i = 0; i < 5; i++) {
            const bw = b.w * (0.15 + r() * 0.25);
            const bh = 1 + r() * 3.5;
            const chunk = new THREE.Mesh(wallBox(bw, bh, 0.4), wall);
            chunk.position.set((r() - 0.5) * (b.w - bw), h + bh / 2, (r() < 0.5 ? -1 : 1) * (b.d / 2 - 0.2));
            chunk.rotation.z = (r() - 0.5) * 0.15;
            chunk.castShadow = true;
            g.add(chunk);
          }
          for (let i = 0; i < 7; i++) {
            const s = 0.4 + r() * 1.2;
            const rock = new THREE.Mesh(jitter(new THREE.IcosahedronGeometry(s, 0), s * 0.3, 1, i, false), rubbleMat);
            rock.position.set((r() - 0.5) * b.w * 1.3, s * 0.4, (r() < 0.5 ? -1 : 1) * (b.d / 2 + 0.6 + r() * 1.5));
            rock.castShadow = true;
            g.add(rock);
          }
        }
        const moss = new THREE.Mesh(jitter(new THREE.BoxGeometry(b.w * 0.7, 0.2, b.d * 0.6, 5, 1, 5), 0.25, 0.5, b.z), mossMat);
        moss.position.set((r() - 0.5) * b.w * 0.2, h + 0.3, 0);
        g.add(moss);
      }
      // เถาวัลย์ห้อยจากหลังคาลงมาตามผนัง ไหวตามลม
      const vines: THREE.BufferGeometry[] = [];
      const nv = 4 + Math.floor(r() * 6);
      for (let i = 0; i < nv; i++) {
        const len = Math.min(b.h, 2 + r() * b.h * 0.9);
        const side = Math.floor(r() * 4);
        const along = (r() - 0.5) * (side < 2 ? b.w : b.d) * 0.85;
        const geo = new THREE.PlaneGeometry(0.5 + r() * 0.9, len, 1, 6).translate(0, -len / 2, 0);
        const off = (side < 2 ? b.d : b.w) / 2 + 0.06;
        if (side === 0) geo.translate(along, b.h, off);
        else if (side === 1) geo.rotateY(Math.PI).translate(along, b.h, -off);
        else if (side === 2) geo.rotateY(Math.PI / 2).translate(off, b.h, along);
        else geo.rotateY(-Math.PI / 2).translate(-off, b.h, along);
        vines.push(geo);
      }
      const vineGeo = assemble(vines.map((geo, i) => ({ geo, color: i % 2 ? 0x3e5d27 : 0x4e6e2e, vary: 0.25, sway: [1, 0] as [number, number] })));
      const vineMesh = new THREE.Mesh(vineGeo, vineMat);
      g.add(vineMesh);
      g.userData.key = b.key;
      this.group.add(g);
    }

    // สะพาน
    const concrete = new THREE.MeshLambertMaterial({ color: 0x8a8780 });
    const rust = new THREE.MeshLambertMaterial({ color: 0x6e4a34 });
    for (const p of bridge) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(p.hx * 2, p.y1 - p.y0, p.hz * 2), p.kind === 'rail' ? rust : concrete);
      mesh.position.set(p.x, (p.y0 + p.y1) / 2, p.z);
      mesh.rotation.y = p.rot;
      mesh.castShadow = mesh.receiveShadow = true;
      this.group.add(mesh);
    }
  }
}
