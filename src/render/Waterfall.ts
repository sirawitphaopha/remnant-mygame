import * as THREE from 'three';
import type { WaterfallSpot } from '../world/water';

// น้ำตกลำธารสาขาตกจากที่ราบสูงลงหุบป่าดิบชื้น (รอบสอง ช่วง 6) · สายน้ำเลื่อนลงเป็นริ้ว ฟองกับละอองที่ตีนน้ำตก

const vert = /* glsl */ `
  varying vec2 vUv;
  #include <fog_pars_vertex>
  void main() {
    vUv = uv;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;
const frag = /* glsl */ `
  uniform float uTime;
  uniform float uLight;
  uniform float uLen;
  varying vec2 vUv;
  #include <fog_pars_fragment>
  void main() {
    float y = vUv.y * uLen;
    float streak = sin(vUv.x * 40.0 + sin(vUv.x * 9.0) * 3.0) * 0.5 + 0.5;
    float flow = fract(y * 0.12 - uTime * 1.6 + streak * 0.35);
    float edge = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);
    vec3 col = mix(vec3(0.55, 0.68, 0.72), vec3(0.92, 0.96, 0.97), smoothstep(0.3, 0.9, flow) * (0.4 + 0.6 * streak));
    gl_FragColor = vec4(col * uLight, (0.55 + 0.4 * flow) * edge);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

export class Waterfall {
  readonly group = new THREE.Group();
  readonly uniforms = { uTime: { value: 0 }, uLight: { value: 1 }, uLen: { value: 1 } };
  private mist: THREE.Mesh[] = [];

  constructor(readonly spot: WaterfallSpot) {
    const mat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, this.uniforms]),
      vertexShader: vert,
      fragmentShader: frag,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: true,
    });
    Object.assign(this.uniforms, mat.uniforms);
    // สายน้ำกว้าง 7 ม. ไหลแนบตามแนวหน้าผาจริง (แผ่นแถบตามจุดของ profile) uv.y = ระยะตามสายน้ำ
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    let along = 0;
    spot.profile.forEach(([x, y], k) => {
      if (k > 0) along += Math.hypot(x - spot.profile[k - 1][0], y - spot.profile[k - 1][1]);
      for (const side of [-3.5, 3.5]) { pos.push(x, y, spot.z + side); uv.push(side < 0 ? 0 : 1, along); }
      if (k > 0) { const a = (k - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    });
    for (let k = 1; k < uv.length; k += 2) uv[k] = uv[k] / Math.max(1, along);
    this.uniforms.uLen.value = along;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const sheet = new THREE.Mesh(geo, mat);
    sheet.renderOrder = 3;
    this.group.add(sheet);
    // ฟองกับละอองที่ตีนน้ำตก
    const foamMat = new THREE.MeshLambertMaterial({ color: 0xf2f6f6, transparent: true, opacity: 0.55, depthWrite: false });
    for (let i = 0; i < 9; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(1.2 + (i % 3) * 0.6, 8, 6), foamMat);
      const [ex, ey] = spot.profile[spot.profile.length - 1];
      m.position.set(ex + spot.dirX * (1 + (i % 4)) + Math.sin(i * 2.3) * 2.5, ey - 0.3, spot.z + Math.cos(i * 1.7) * 3);
      m.scale.y = 0.35;
      this.mist.push(m);
      this.group.add(m);
    }
  }

  update(dt: number, light: number): void {
    this.uniforms.uTime.value += dt;
    this.uniforms.uLight.value = light;
    const t = this.uniforms.uTime.value;
    this.mist.forEach((m, i) => { const k = 1 + 0.15 * Math.sin(t * 2.5 + i * 1.3); m.scale.set(k, 0.35 * k, k); });
  }
}
