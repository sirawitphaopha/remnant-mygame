import * as THREE from 'three';
import type { SkyState } from '../core/time';

const vert = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww;
  }
`;

const frag = /* glsl */ `
  uniform vec3 uSunDir;
  uniform vec3 uMoonDir;
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uSunColor;
  uniform vec3 uCloudLit;
  uniform vec3 uCloudShade;
  uniform float uMoonLight;
  uniform float uMoonPhase;
  uniform float uNight;
  uniform float uTime;
  varying vec3 vDir;

  float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash2(i), hash2(i + vec2(1, 0)), f.x), mix(hash2(i + vec2(0, 1)), hash2(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p) { float s = 0.0; float a = 0.5; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p *= 2.03; a *= 0.5; } return s; }

  void main() {
    vec3 dir = normalize(vDir);
    float h = dir.y;
    vec3 col = mix(uHorizon, uZenith, pow(clamp(h, 0.0, 1.0), 0.45));
    if (h < 0.0) col = mix(uHorizon, uHorizon * 0.7, clamp(-h * 4.0, 0.0, 1.0));

    // ดวงอาทิตย์ แสงฟุ้งรอบ ๆ
    float ds = dot(dir, normalize(uSunDir));
    col += uSunColor * (pow(max(ds, 0.0), 6.0) * 0.18 + pow(max(ds, 0.0), 64.0) * 0.5);
    col += uSunColor * smoothstep(0.99955, 0.9998, ds) * 6.0;

    // ดาว ค่อย ๆ ชัดเมื่อฟ้ามืด
    if (uNight > 0.01 && h > 0.0) {
      vec3 p = dir * 220.0;
      vec3 cell = floor(p);
      float r = hash(cell);
      if (r > 0.9965) {
        vec3 c = cell + 0.5 + 0.3 * (vec3(hash(cell + 1.7), hash(cell + 3.1), hash(cell + 5.3)) - 0.5);
        float d = length(p - c);
        float tw = 0.7 + 0.3 * sin(uTime * (1.5 + r * 4.0) + r * 100.0);
        col += vec3(0.9, 0.93, 1.0) * smoothstep(0.32, 0.0, d) * tw * uNight * smoothstep(0.0, 0.2, h) * (r - 0.9965) * 300.0;
      }
    }

    // ดวงจันทร์ ข้างขึ้นข้างแรม
    vec3 md = normalize(uMoonDir);
    float dm = dot(dir, md);
    float disc = smoothstep(0.99962, 0.99972, dm);
    if (disc > 0.0) {
      vec3 right = normalize(cross(md, vec3(0.0, 1.0, 0.0)));
      float lit = (1.0 - cos(uMoonPhase * 6.2831853)) * 0.5;
      float s = 0.05 * lit * (uMoonPhase < 0.5 ? 1.0 : -1.0);
      float shadow = smoothstep(0.99962, 0.99972, dot(dir, normalize(md + right * s)));
      float bright = mix(1.0, 0.06, shadow * (1.0 - step(0.98, lit)));
      col = mix(col, vec3(0.92, 0.93, 0.88) * (0.25 + 0.75 * bright), disc * clamp(0.35 + uNight, 0.0, 1.0));
    }
    col += vec3(0.6, 0.7, 0.9) * pow(max(dm, 0.0), 220.0) * 0.25 * uMoonLight * uNight;

    // เมฆ เลื่อนไปตามลม
    if (h > -0.02) {
      vec2 uv = dir.xz / (h + 0.18) * 1.1 + vec2(uTime * 0.004, uTime * 0.0015);
      float n = fbm(uv * 1.3) * 0.7 + fbm(uv * 3.1 + 7.0) * 0.3;
      float cover = smoothstep(0.5, 0.78, n) * smoothstep(-0.02, 0.18, h);
      float sunSide = pow(max(ds, 0.0), 3.0);
      vec3 cloud = mix(uCloudShade, uCloudLit, smoothstep(0.45, 0.9, n) * 0.6 + 0.4 * sunSide);
      col = mix(col, cloud, cover * 0.92);
    }
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const c = (r: number, g: number, b: number) => new THREE.Color(r, g, b);
const DAY_Z = c(0.22, 0.45, 0.78);
const DAY_H = c(0.66, 0.78, 0.86);
const SET_Z = c(0.20, 0.26, 0.48);
const SET_H = c(0.98, 0.56, 0.32);
const NIGHT_Z = c(0.004, 0.007, 0.02);
const NIGHT_H = c(0.012, 0.018, 0.03);
const MOON_Z = c(0.02, 0.035, 0.08);
const MOON_H = c(0.045, 0.06, 0.09);

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** ท้องฟ้า แสงแดด แสงจันทร์ และหมอก ปรับตามเวลาในเกม */
export class Sky {
  readonly mesh: THREE.Mesh;
  readonly uniforms = {
    uSunDir: { value: new THREE.Vector3() },
    uMoonDir: { value: new THREE.Vector3() },
    uZenith: { value: new THREE.Color() },
    uHorizon: { value: new THREE.Color() },
    uSunColor: { value: new THREE.Color() },
    uCloudLit: { value: new THREE.Color() },
    uCloudShade: { value: new THREE.Color() },
    uMoonLight: { value: 0 },
    uMoonPhase: { value: 0 },
    uNight: { value: 0 },
    uTime: { value: 0 },
  };
  /** ข้อมูลไว้ให้ส่วนอื่นอ่าน (น้ำ เสียง ความหนาว) */
  readonly horizon = new THREE.Color();
  readonly sunColor = new THREE.Color();
  night = 0;
  /** แสงสว่างรวมตอนนี้ 0 = มืดสนิท 1 = กลางวัน */
  brightness = 1;
  /** คูณความหนาหมอก (ระยะมองเห็นในหน้าตั้งค่า) */
  fogScale = 1;

  constructor() {
    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(4500, 32, 16),
      new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: vert, fragmentShader: frag, side: THREE.BackSide, depthWrite: false, fog: false }),
    );
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1;
  }

  update(
    s: SkyState,
    time: number,
    camera: THREE.Camera,
    light: THREE.DirectionalLight,
    hemi: THREE.HemisphereLight,
    fog: THREE.FogExp2,
  ): void {
    const u = this.uniforms;
    const sh = s.sunHeight;
    const day = smooth(-0.12, 0.2, sh);
    const twilight = Math.max(0, 1 - Math.abs(sh - 0.02) / 0.22);
    const moonUp = smooth(-0.02, 0.15, s.moon[1]);
    const moonGlow = s.moonLight * moonUp;
    this.night = 1 - smooth(-0.12, 0.08, sh);

    const zen = NIGHT_Z.clone().lerp(MOON_Z, moonGlow).lerp(DAY_Z, day).lerp(SET_Z, twilight * 0.7);
    const hor = NIGHT_H.clone().lerp(MOON_H, moonGlow).lerp(DAY_H, day).lerp(SET_H, twilight * 0.85);
    u.uZenith.value.copy(zen);
    u.uHorizon.value.copy(hor);
    this.horizon.copy(hor);
    this.sunColor.setRGB(1, 0.62 + 0.33 * smooth(0, 0.4, sh), 0.38 + 0.5 * smooth(0, 0.5, sh));
    u.uSunColor.value.copy(this.sunColor).multiplyScalar(smooth(-0.05, 0.02, sh));
    u.uSunDir.value.set(...s.sun);
    u.uMoonDir.value.set(...s.moon);
    u.uMoonLight.value = s.moonLight;
    u.uMoonPhase.value = s.moonPhase;
    u.uNight.value = this.night;
    u.uTime.value = time;
    u.uCloudLit.value.copy(hor).lerp(c(1, 1, 1), day * 0.75).lerp(SET_H, twilight * 0.4);
    u.uCloudShade.value.copy(zen).lerp(c(0.55, 0.6, 0.66), day * 0.7).multiplyScalar(0.9);
    this.mesh.position.copy(camera.position);

    // แสงหลัก: กลางวันคือดวงอาทิตย์ กลางคืนคือดวงจันทร์
    const sunI = 2.1 * smooth(-0.04, 0.14, sh);
    const moonI = 0.32 * moonGlow * (1 - day);
    if (sunI >= moonI) {
      light.color.copy(this.sunColor);
      light.intensity = sunI;
      light.userData.dir = s.sun;
    } else {
      light.color.setRGB(0.55, 0.66, 0.92);
      light.intensity = moonI;
      light.userData.dir = s.moon;
    }
    hemi.color.copy(zen).lerp(c(0.8, 0.88, 0.95), day * 0.5);
    hemi.groundColor.setRGB(0.22, 0.2, 0.14).multiplyScalar(0.15 + 0.85 * day);
    hemi.intensity = 0.05 + 0.3 * moonGlow * (1 - day) + 1.0 * day + 0.25 * twilight;
    this.brightness = Math.min(1, day + moonGlow * 0.25);

    fog.color.copy(hor);
    // ฟ้าใสมองเห็นภูเขาไกล 1.5 กม. · หมอกเช้าหนาจนเห็นแค่ใกล้ ๆ
    fog.density = (0.0011 + s.fog * 0.012) * this.fogScale;
  }
}
