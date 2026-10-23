import * as THREE from 'three';

/** ลมทั้งโลก ใช้ร่วมกันทุกวัสดุที่ไหวตามลม */
export const WIND = {
  uTime: { value: 0 },
  uWindDir: { value: new THREE.Vector2(0.8, 0.6).normalize() },
  uWindStrength: { value: 1 },
};

/**
 * ใส่การไหวตามลมให้วัสดุ · ต้องมี attribute `sway` (0 = ไม่ขยับ 1 = ขยับเต็ม)
 * amount คือระยะไหวสูงสุดเป็นเมตร · ใช้ตำแหน่งในโลกของแต่ละต้นให้ไหวไม่พร้อมกัน
 */
export function addWind(mat: THREE.Material, amount: number, flutter = 0.3, keepNormalBothSides = false, fadeNearCamera = 0): void {
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, WIND);
    // ใบไม้ที่อยู่ชิดกล้องค่อย ๆ จางเป็นจุด ๆ กล้องไม่จมในพุ่มไม้ (แบบ RDR2)
    if (fadeNearCamera > 0) {
      shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
      varying vec3 vFadeWorld;`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
        varying vec3 vFadeWorld;`)
        .replace(
          '#include <clipping_planes_fragment>',
          `#include <clipping_planes_fragment>
          float fadeD = distance(vFadeWorld, cameraPosition);
          float fadeA = smoothstep(${(fadeNearCamera * 0.45).toFixed(2)}, ${fadeNearCamera.toFixed(2)}, fadeD);
          float dith = fract(sin(dot(floor(gl_FragCoord.xy), vec2(12.9898, 78.233))) * 43758.5453);
          if (fadeA < dith) discard;`,
        );
    }
    // ใบไม้บาง ๆ สองหน้า: ไม่กลับทิศแสงด้านหลัง ไม่งั้นด้านหลังจะดำ
    if (keepNormalBothSides) shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
      normal = normalize( vNormal );`);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute float sway;
        uniform float uTime;
        uniform vec2 uWindDir;
        uniform float uWindStrength;`,
      )
      .replace(
        '#include <project_vertex>',
        `vec4 mvPosition = vec4( transformed, 1.0 );
        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
        #endif
        vec4 wpos = modelMatrix * mvPosition;
        ${fadeNearCamera > 0 ? 'vFadeWorld = wpos.xyz;' : ''}
        float phase = wpos.x * 0.11 + wpos.z * 0.07;
        float gust = 0.55 + 0.45 * sin(uTime * 0.35 + wpos.x * 0.013 + wpos.z * 0.009);
        float w = (sin(uTime * 1.6 + phase) * 0.6 + sin(uTime * 2.7 + phase * 2.3) * 0.25) * gust * uWindStrength;
        float f = sin(uTime * 7.0 + phase * 9.0 + position.y * 3.0) * ${flutter.toFixed(3)};
        vec2 off = uWindDir * (w + 0.35 * gust * uWindStrength) * ${amount.toFixed(3)} * sway;
        mvPosition.xz += off + vec2(-uWindDir.y, uWindDir.x) * f * ${amount.toFixed(3)} * sway;
        mvPosition.y -= length(off) * 0.25 * sway;
        mvPosition = modelViewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;`,
      );
  };
  mat.customProgramCacheKey = () => `wind-${amount}-${flutter}-${keepNormalBothSides}-${fadeNearCamera}`;
}
