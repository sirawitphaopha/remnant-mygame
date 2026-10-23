import * as THREE from 'three';
import { Simplex2 } from '../world/noise';

// ลายพื้นผิวกับผิวนูนแบบสมจริง (พี่กันขอ 23 ต.ค. 2569: *"เพิ่ม texture ทุกอย่างให้ดูสมจริงขึ้น"*)
// ลายสร้างด้วยโค้ดทั้งหมด ไม่โหลดรูปจากข้างนอก · แปะลายตามพิกัดโลกสามทิศ (triplanar) ไม่ต้องมีพิกัดภาพบนโมเดล
// ช่อง RGB = ลายสี (เทากลาง 0.5 = ไม่เปลี่ยนสี) · ช่อง A = ความสูงผิว ใช้ทำผิวนูน (รอยแตก ร่องเปลือกไม้ เม็ดทราย)
// ใช้ซ้อนกับตัวแก้ภาพเดิมได้ (ลม พื้นเปียก ถ้ำ) เพราะเรียกตัวเดิมต่อทุกครั้ง

export type DetailKind = 'stone' | 'bark' | 'plaster' | 'soil' | 'rust';

/** ความถี่ของลาย (ครั้งต่อเมตร) ความเข้มของลายสี ความนูน */
const LOOK: Record<DetailKind, { scale: number; strength: number; bump: number }> = {
  stone: { scale: 0.45, strength: 0.85, bump: 1.6 },
  bark: { scale: 0.9, strength: 0.9, bump: 2.2 },
  plaster: { scale: 0.3, strength: 0.75, bump: 0.9 },
  soil: { scale: 0.5, strength: 0.55, bump: 0.8 },
  rust: { scale: 0.8, strength: 0.8, bump: 0.7 },
};

/** เปิดปิดลายทั้งเกม (ระดับภาพต่ำปิดได้ · ช่วง 13) */
export const DETAIL = { enabled: { value: 1 } };

const cache = new Map<DetailKind, THREE.DataTexture>();
const SIZE = 256;

/** ลายต่อกันได้ไม่มีรอยต่อ: ใช้พิกัดวงกลมสองวง (ภาพวนกลับมาที่เดิมทั้งสองแกน) */
function tileNoise(nz: Simplex2, u: number, v: number, freq: number, oct: number): number {
  const a = u * Math.PI * 2;
  const b = v * Math.PI * 2;
  const r = freq / (Math.PI * 2);
  return nz.fbm(Math.cos(a) * r + Math.cos(b) * r * 0.37 + 17, Math.sin(a) * r + Math.sin(b) * r * 0.37 - 5, oct) * 0.6 +
    nz.noise(Math.cos(b) * r * 1.3 + 3, Math.sin(b) * r * 1.3 + Math.cos(a) * r * 0.2) * 0.4;
}

export function detailTexture(kind: DetailKind): THREE.DataTexture {
  const hit = cache.get(kind);
  if (hit) return hit;
  const nz = new Simplex2(911 + kind.length * 31);
  const data = new Uint8Array(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const u = x / SIZE;
      const v = y / SIZE;
      let c = 0.5;
      let h = 0.5;
      if (kind === 'stone') {
        // เนื้อหินแกรนิต: เม็ดแร่ขาวดำเป็นจุด · ด่างไลเคนเป็นหย่อม · รอยร้าวบาง ๆ
        const grain = tileNoise(nz, u, v, 90, 1);
        const blotch = tileNoise(nz, u + 0.3, v, 7, 3);
        // รอยร้าวบางและขึ้นเป็นบางจุด (เดิมขึ้นถี่ทั่วผิว ดูเป็นลายกระดองเต่า)
        const mask = Math.max(0, Math.min(1, (tileNoise(nz, u + 0.1, v + 0.9, 3, 2) - 0.25) * 4));
        const crack = (1 - Math.min(1, Math.abs(tileNoise(nz, u, v + 0.5, 5, 2)) * 26)) * mask;
        c = 0.5 + grain * 0.16 + blotch * 0.12 - crack * 0.18 + (blotch > 0.35 ? 0.12 : 0);
        h = 0.55 + grain * 0.12 + blotch * 0.2 - crack * 0.4;
      } else if (kind === 'bark') {
        // เปลือกไม้: ร่องตามแนวตั้งคดไปมา สันนูนระหว่างร่อง มีแผ่นเปลือกแตกเป็นช่วง
        const warp = tileNoise(nz, u, v, 4, 2) * 0.08;
        const ridge = Math.abs(Math.sin((u + warp) * Math.PI * 2 * 14));
        const plates = tileNoise(nz, u * 3, v, 12, 2);
        c = 0.42 + ridge * 0.22 + plates * 0.08;
        h = ridge * 0.8 + plates * 0.15;
      } else if (kind === 'plaster') {
        // ปูนฉาบเก่าพันปี: คราบน้ำไหลเป็นทางตั้ง · ปูนกะเทาะเป็นแผ่น · รูพรุน · รอยร้าว
        const stain = tileNoise(nz, u * 0.35, v, 6, 3);
        const flake = tileNoise(nz, u, v, 10, 2);
        const pore = tileNoise(nz, u, v, 120, 1);
        // รอยร้าวบางขึ้นเป็นบางจุด (เดิมขึ้นถี่ทั่วผนังเป็นเส้นหยักเหมือนหินอ่อน)
        const mask = Math.max(0, Math.min(1, (tileNoise(nz, u + 0.4, v + 0.2, 3, 2) - 0.3) * 4));
        const crack = (1 - Math.min(1, Math.abs(tileNoise(nz, u + 0.7, v, 4, 2)) * 28)) * mask;
        c = 0.5 + stain * 0.18 + pore * 0.05 - (flake > 0.3 ? 0.08 : 0) - crack * 0.2;
        h = 0.6 + pore * 0.1 - (flake > 0.3 ? 0.22 : 0) - crack * 0.35;
      } else if (kind === 'soil') {
        // ดิน: เม็ดดินกับกรวดเล็ก ๆ ใบไม้แห้งเป็นจุด
        const grain = tileNoise(nz, u, v, 70, 1);
        const pebble = tileNoise(nz, u + 0.2, v + 0.4, 24, 1);
        const patch = tileNoise(nz, u, v, 5, 3);
        c = 0.5 + grain * 0.1 + patch * 0.12 + (pebble > 0.45 ? 0.12 : 0);
        h = 0.5 + grain * 0.15 + (pebble > 0.45 ? 0.35 : 0);
      } else {
        // สนิม: ด่างเป็นหย่อม สะเก็ดพอง รูกัด
        const blotch = tileNoise(nz, u, v, 8, 3);
        const pit = tileNoise(nz, u, v, 80, 1);
        c = 0.5 + blotch * 0.2 + pit * 0.08;
        h = 0.5 + blotch * 0.2 - (pit > 0.4 ? 0.3 : 0);
      }
      const i = (y * SIZE + x) * 4;
      const cc = Math.max(0, Math.min(255, Math.round(c * 255)));
      data[i] = cc;
      data[i + 1] = cc;
      data[i + 2] = cc;
      data[i + 3] = Math.max(0, Math.min(255, Math.round(h * 255)));
    }
  }
  const tex = new THREE.DataTexture(data, SIZE, SIZE, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  cache.set(kind, tex);
  return tex;
}

/**
 * ใส่ลายพื้นผิวกับผิวนูนให้วัสดุ (MeshLambertMaterial หรือ MeshStandardMaterial) · เรียกตัวแก้ภาพเดิมของวัสดุต่อก่อนเสมอ
 * scale = ความถี่ของลาย (คูณกับค่าตั้งต้นของชนิดนั้น)
 */
export function applyDetail(mat: THREE.Material, kind: DetailKind, scale = 1): void {
  const look = LOOK[kind];
  const prev = mat.onBeforeCompile;
  // จำรหัสภาพของตัวแก้ภาพเดิมไว้ก่อนเปลี่ยน (รหัสตั้งต้นของ three คือข้อความของตัวแก้ภาพ ถ้าอ่านทีหลังจะได้ของตัวใหม่แทน
  // วัสดุที่ตัวแก้ภาพเดิมต่างกันจะได้รหัสเดียวกัน ใช้ภาพผิดตัว)
  const baseKey = mat.customProgramCacheKey();
  const map = detailTexture(kind);
  mat.onBeforeCompile = (sh, renderer) => {
    prev.call(mat, sh, renderer);
    sh.uniforms.uDetailMap = { value: map };
    sh.uniforms.uDetailScale = { value: look.scale * scale };
    sh.uniforms.uDetailStrength = { value: look.strength };
    sh.uniforms.uDetailBump = { value: look.bump };
    sh.uniforms.uDetailOn = DETAIL.enabled;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vDetailPos;\nvarying vec3 vDetailNrm;')
      // เกาะท้ายตัววาดจุด (ตัวแก้ภาพลมแทนที่ project_vertex ทั้งก้อน ถ้าเกาะตรงนั้นลายจะไม่ได้ค่า ลำต้นไม้ดำสนิท)
      .replace(
        '#include <fog_vertex>',
        `#include <fog_vertex>
        {
          mat4 dm = modelMatrix;
          #ifdef USE_INSTANCING
            dm = modelMatrix * instanceMatrix;
          #endif
          vDetailPos = (dm * vec4(transformed, 1.0)).xyz;
          vDetailNrm = normalize(mat3(dm) * objectNormal);
        }`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vDetailPos;
        varying vec3 vDetailNrm;
        uniform sampler2D uDetailMap;
        uniform float uDetailScale;
        uniform float uDetailStrength;
        uniform float uDetailBump;
        uniform float uDetailOn;
        vec4 gDetail;
        vec3 detailPerturb(vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDir) {
          vec3 vSigmaX = normalize(dFdx(surf_pos.xyz));
          vec3 vSigmaY = normalize(dFdy(surf_pos.xyz));
          vec3 R1 = cross(vSigmaY, surf_norm);
          vec3 R2 = cross(surf_norm, vSigmaX);
          float fDet = dot(vSigmaX, R1) * faceDir;
          vec3 vGrad = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2);
          return normalize(abs(fDet) * surf_norm - vGrad);
        }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          vec3 w = pow(abs(normalize(vDetailNrm)), vec3(4.0));
          w /= (w.x + w.y + w.z + 1e-5);
          vec3 p = vDetailPos * uDetailScale;
          gDetail = texture2D(uDetailMap, p.zy) * w.x + texture2D(uDetailMap, p.xz) * w.y + texture2D(uDetailMap, p.xy) * w.z;
          // ไกลแล้วลายเล็กจนเป็นสัญญาณรบกวน ค่อย ๆ จางลง
          float fade = uDetailOn * (1.0 - smoothstep(40.0, 140.0, length(vViewPosition)));
          diffuseColor.rgb *= mix(vec3(1.0), gDetail.rgb * 2.0, uDetailStrength * fade);
          gDetail.a = mix(0.5, gDetail.a, fade);
        }`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        {
          vec2 dH = vec2(dFdx(gDetail.a), dFdy(gDetail.a)) * uDetailBump;
          normal = detailPerturb(-vViewPosition, normal, dH, faceDirection);
        }`,
      );
  };
  mat.customProgramCacheKey = () => `${baseKey}|detail-${kind}-${scale}`;
  mat.needsUpdate = true;
}
