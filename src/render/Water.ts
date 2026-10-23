import * as THREE from 'three';
import { WORLD } from '../config/game';

const vert = /* glsl */ `
  varying vec3 vWorld;
  #include <fog_pars_vertex>
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    vec4 mvPosition = viewMatrix * wp;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const frag = /* glsl */ `
  uniform float uTime;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uSkyColor;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform float uLight;
  uniform sampler2D uFlow;
  uniform float uHalf;
  varying vec3 vWorld;
  #include <fog_pars_fragment>

  float h(vec2 p) {
    return sin(p.x * 0.9 + uTime * 0.9) * 0.5 + sin(p.y * 1.3 - uTime * 0.7) * 0.35
      + sin((p.x + p.y) * 2.7 + uTime * 1.6) * 0.15 + sin((p.x - p.y) * 4.1 - uTime * 2.1) * 0.08;
  }

  void main() {
    vec2 p = vWorld.xz;
    // ทิศน้ำไหลจากแผนที่ทิศ (แม่น้ำไหลตามสาย ทะเลสาบนิ่ง) · ลายคลื่นเลื่อนตามทิศ สลับสองชุดกันลายยืด
    vec3 f = texture2D(uFlow, (p + uHalf) / (uHalf * 2.0)).rgb;
    vec2 dir = f.xy * 2.0 - 1.0;
    float s = f.z;
    float t0 = fract(uTime * 0.22);
    float t1 = fract(uTime * 0.22 + 0.5);
    float wb = abs(t0 - 0.5) * 2.0;
    vec2 o0 = dir * s * t0 * 7.0;
    vec2 o1 = dir * s * t1 * 7.0;
    float e = 0.15;
    vec2 g0 = vec2(h(p - o0 + vec2(e, 0.0)) - h(p - o0 - vec2(e, 0.0)), h(p - o0 + vec2(0.0, e)) - h(p - o0 - vec2(0.0, e)));
    vec2 g1 = vec2(h(p - o1 + vec2(e, 0.0)) - h(p - o1 - vec2(e, 0.0)), h(p - o1 + vec2(0.0, e)) - h(p - o1 - vec2(0.0, e)));
    vec2 g = mix(g0, g1, wb) * (1.0 + s * 0.8);
    vec3 n = normalize(vec3(-g.x * 0.35, 1.0, -g.y * 0.35));
    vec3 v = normalize(cameraPosition - vWorld);
    float fres = pow(1.0 - max(dot(n, v), 0.0), 4.0);
    vec3 r = reflect(-v, n);
    float spec = pow(max(dot(r, normalize(uSunDir)), 0.0), 180.0);
    vec3 base = mix(uShallow, uDeep, 0.7) * uLight;
    vec3 col = mix(base, uSkyColor * 0.85, 0.12 + 0.5 * fres) + uSunColor * spec * 1.4;
    // ฟองเป็นริ้วตามน้ำไหลแรง
    vec2 side = vec2(-dir.y, dir.x);
    float streak = sin(dot(p, side) * 2.3 + sin(dot(p - o0, dir) * 0.6) * 1.5);
    col += vec3(0.07, 0.08, 0.08) * smoothstep(0.45, 1.0, s) * smoothstep(0.6, 1.0, streak) * uLight;
    gl_FragColor = vec4(col, 0.86 + 0.12 * fres);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

/**
 * ผิวน้ำแผ่นเดียวทั้งแมพที่ระดับน้ำ · พื้นดินที่สูงกว่าบังไว้ จึงเห็นเฉพาะแม่น้ำกับทะเลสาบ
 * ลายคลื่นไหลตามทิศน้ำจากแผนที่ทิศ (world/water.ts flowField) ทะเลสาบนิ่ง
 */
export class Water {
  readonly mesh: THREE.Mesh;
  readonly uniforms = {
    uTime: { value: 0 },
    uSunDir: { value: new THREE.Vector3(0.5, 0.8, 0.3) },
    uSunColor: { value: new THREE.Color(1, 0.95, 0.85) },
    uSkyColor: { value: new THREE.Color(0.6, 0.75, 0.88) },
    uDeep: { value: new THREE.Color(0.06, 0.16, 0.18) },
    uShallow: { value: new THREE.Color(0.17, 0.30, 0.27) },
    /** ความสว่างรอบตัว 0 ถึง 1 (กลางคืนน้ำต้องมืดตาม) */
    uLight: { value: 1 },
    uFlow: { value: null as THREE.Texture | null },
    uHalf: { value: WORLD.half },
  };

  /** flow = ค่าจาก flowField (n × n ช่อง × [dx, dz, แรง]) */
  constructor(flow?: Float32Array, n = 192) {
    const data = new Uint8Array(n * n * 4);
    for (let k = 0; k < n * n; k++) {
      data[k * 4] = flow ? Math.round((flow[k * 3] * 0.5 + 0.5) * 255) : 128;
      data[k * 4 + 1] = flow ? Math.round((flow[k * 3 + 1] * 0.5 + 0.5) * 255) : 128;
      data[k * 4 + 2] = flow ? Math.round(flow[k * 3 + 2] * 255) : 0;
      data[k * 4 + 3] = 255;
    }
    const tex = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
    tex.magFilter = tex.minFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    this.uniforms.uFlow.value = tex;
    const mat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, this.uniforms]),
      vertexShader: vert,
      fragmentShader: frag,
      transparent: true,
      fog: true,
      depthWrite: false,
    });
    // merge คัดลอกค่า ภาพทิศน้ำต้องใส่กลับเอง แล้วใช้ uniforms ชุดเดียวกับวัสดุ จะได้อัปเดตจากข้างนอกได้
    mat.uniforms.uFlow.value = tex;
    Object.assign(this.uniforms, mat.uniforms);
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.size, WORLD.size, 1, 1).rotateX(-Math.PI / 2), mat);
    this.mesh.position.y = WORLD.waterLevel;
    this.mesh.renderOrder = 2;
  }

  update(dt: number): void {
    this.uniforms.uTime.value += dt;
  }
}
