import * as THREE from 'three';
import { Simplex2 } from '../world/noise';

/** ภาพรายละเอียดพื้นผิวแบบสร้างเอง (ไม่โหลดไฟล์) · สีเทาอ่อนเข้ม ใช้คูณกับสีพื้น */
export function makeDetailTexture(size = 256, seed = 5): THREE.DataTexture {
  const nz = new Simplex2(seed);
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // ใช้พิกัดวงกลมให้ภาพต่อกันได้ไม่เห็นรอยต่อ
      const u = (x / size) * Math.PI * 2;
      const v = (y / size) * Math.PI * 2;
      const nx = Math.cos(u) * 2;
      const ny = Math.sin(u) * 2;
      const n1 = nz.fbm(nx + Math.cos(v) * 2, ny + Math.sin(v) * 2, 4);
      const n2 = nz.noise(nx * 6 + Math.cos(v) * 12, ny * 6 + Math.sin(v) * 12);
      const val = 0.82 + 0.12 * n1 + 0.06 * n2;
      const c = Math.max(0, Math.min(255, Math.round(val * 255)));
      const i = (y * size + x) * 4;
      data[i] = c;
      data[i + 1] = c;
      data[i + 2] = c;
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}
