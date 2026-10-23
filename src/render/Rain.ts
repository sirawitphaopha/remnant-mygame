import * as THREE from 'three';

// ฝน (รอบสอง ช่วง 7) · สายฝนรอบกล้อง ละอองกระเด็นบนพื้น หมอกฝนเป็นแผ่นต่ำในหุบตอนเช้า
// เม็ดฝน 3 มม. ตกราว 8 ม./วินาที (REFERENCES-R2 หัวข้อ 7) · สายฝนเลื่อนในตัววาด ไม่ขยับทีละเม็ดด้วยเครื่อง

const BOX = 28;
const HEIGHT = 18;

const rainVert = /* glsl */ `
  attribute vec4 seed;
  uniform float uTime;
  uniform vec3 uCam;
  uniform vec2 uWind;
  uniform float uAmount;
  uniform vec4 uHole;
  uniform vec2 uHoleRot;
  varying float vAlpha;
  #include <fog_pars_vertex>
  void main() {
    // แต่ละเม็ดวนตกในกล่องรอบกล้อง (ตำแหน่งต่อเม็ดจาก seed)
    float fall = 8.0 + seed.w * 2.0;
    vec3 p;
    p.x = uCam.x + mod(seed.x * ${BOX * 2}.0 - uCam.x, ${BOX * 2}.0) - ${BOX}.0;
    p.z = uCam.z + mod(seed.z * ${BOX * 2}.0 - uCam.z, ${BOX * 2}.0) - ${BOX}.0;
    p.y = uCam.y + ${HEIGHT / 2}.0 - mod(seed.y * ${HEIGHT}.0 + uTime * fall, ${HEIGHT}.0);
    p.xz += uWind * (p.y - uCam.y) * -0.08;
    // แผ่นสายฝนบาง หันเข้ากล้องตามแกนตั้ง
    vec3 toCam = normalize(vec3(cameraPosition.x - p.x, 0.0, cameraPosition.z - p.z));
    vec3 side = vec3(-toCam.z, 0.0, toCam.x);
    vec3 world = p + side * position.x + vec3(uWind.x * -0.08, 1.0, uWind.y * -0.08) * position.y;
    // เม็ดที่ไม่ได้ใช้ตามความแรงฝนหดหาย
    // เม็ดที่อยู่ในตึกที่กล้องอยู่ข้างในไม่ตก (มองออกหน้าต่างเห็นฝนข้างนอก ในห้องแห้ง)
    vec2 hd = p.xz - uHole.xy;
    vec2 hl = vec2(hd.x * uHoleRot.x - hd.y * uHoleRot.y, hd.x * uHoleRot.y + hd.y * uHoleRot.x);
    float inHole = step(abs(hl.x), uHole.z) * step(abs(hl.y), uHole.w);
    float use = step(seed.w, uAmount) * (1.0 - inHole);
    vAlpha = use * (0.3 + 0.35 * seed.w) * smoothstep(1.5, 4.0, distance(p, cameraPosition));
    vec4 mvPosition = viewMatrix * vec4(world, 1.0);
    gl_Position = projectionMatrix * mvPosition * use + vec4(0.0, 0.0, -2.0, 1.0) * (1.0 - use);
    #include <fog_vertex>
  }
`;
const rainFrag = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  #include <fog_pars_fragment>
  void main() {
    gl_FragColor = vec4(uColor, vAlpha);
    #include <fog_fragment>
  }
`;

const splashVert = /* glsl */ `
  attribute vec3 seed;
  uniform float uTime;
  uniform float uAmount;
  uniform vec4 uHole;
  uniform vec2 uHoleRot;
  varying float vA;
  #include <fog_pars_vertex>
  void main() {
    float t = fract(uTime * (1.4 + seed.z) + seed.x * 7.0);
    float use = step(seed.y, uAmount);
    vec3 p = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    vec2 hd = p.xz - uHole.xy;
    vec2 hl = vec2(hd.x * uHoleRot.x - hd.y * uHoleRot.y, hd.x * uHoleRot.y + hd.y * uHoleRot.x);
    use *= 1.0 - step(abs(hl.x), uHole.z) * step(abs(hl.y), uHole.w);
    vec3 world = p + vec3(position.x, 0.0, position.y) * (0.03 + t * 0.12) + vec3(0.0, 0.03, 0.0);
    vA = (1.0 - t) * 0.5 * use;
    vec4 mvPosition = viewMatrix * vec4(world, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;
const splashFrag = /* glsl */ `
  varying float vA;
  #include <fog_pars_fragment>
  void main() {
    gl_FragColor = vec4(0.85, 0.9, 0.95, vA);
    #include <fog_fragment>
  }
`;

export class Rain {
  readonly group = new THREE.Group();
  readonly uniforms = {
    uTime: { value: 0 },
    uCam: { value: new THREE.Vector3() },
    uWind: { value: new THREE.Vector2(0.8, 0.6) },
    uAmount: { value: 0 },
    uColor: { value: new THREE.Color(0.86, 0.9, 0.95) },
    /** ช่องที่ฝนไม่ตก (ตึกที่กล้องอยู่ข้างใน) กลาง x z ครึ่งกว้าง ครึ่งลึก · มุมหมุน cos sin */
    uHole: { value: new THREE.Vector4(1e9, 1e9, 0, 0) },
    uHoleRot: { value: new THREE.Vector2(1, 0) },
  };
  private splashes: THREE.InstancedMesh;
  private lastSX = Infinity;
  private lastSZ = Infinity;

  constructor(private groundAt: (x: number, z: number) => number, count = 3200) {
    // สายฝน: แผ่นกว้าง 3.5 ซม. ยาว 90 ซม. (ภาพเม็ดฝนที่ตกเร็วจะยืดเป็นเส้น เส้นจริงบางกว่านี้มาก บนจอจะไม่เห็น)
    const base = new THREE.PlaneGeometry(0.035, 0.9).translate(0, 0.45, 0);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = base.index;
    geo.setAttribute('position', base.getAttribute('position'));
    const seeds = new Float32Array(count * 4);
    for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random();
    geo.setAttribute('seed', new THREE.InstancedBufferAttribute(seeds, 4));
    geo.instanceCount = count;
    const mat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, this.uniforms]),
      vertexShader: rainVert,
      fragmentShader: rainFrag,
      transparent: true,
      depthWrite: false,
      // แผ่นสายฝนหมุนเข้าหากล้องเอง ด้านที่หันมาอาจเป็นด้านหลัง ต้องวาดทั้งสองหน้า (เดิมการ์ดจอไม่วาดเลย)
      side: THREE.DoubleSide,
      fog: true,
    });
    Object.assign(this.uniforms, mat.uniforms);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 4;
    this.group.add(mesh);
    // ละอองกระเด็นเป็นวงบนพื้นรอบตัว
    const ring = new THREE.RingGeometry(0.6, 1, 10);
    const smat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: this.uniforms.uTime, uAmount: this.uniforms.uAmount, uHole: this.uniforms.uHole, uHoleRot: this.uniforms.uHoleRot }]),
      vertexShader: splashVert,
      fragmentShader: splashFrag,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: true,
    });
    smat.uniforms.uTime = this.uniforms.uTime;
    smat.uniforms.uAmount = this.uniforms.uAmount;
    smat.uniforms.uHole = this.uniforms.uHole;
    smat.uniforms.uHoleRot = this.uniforms.uHoleRot;
    this.splashes = new THREE.InstancedMesh(ring, smat, 260);
    const ss = new Float32Array(260 * 3);
    for (let i = 0; i < ss.length; i++) ss[i] = Math.random();
    this.splashes.geometry.setAttribute('seed', new THREE.InstancedBufferAttribute(ss, 3));
    this.splashes.frustumCulled = false;
    this.group.add(this.splashes);
    this.group.visible = false;
  }

  /**
   * amount = ความแรงฝน 0 ถึง 1 · sheltered = กล้องอยู่ใต้หลังคาหรือในถ้ำ (ไม่เห็นสายฝนรอบตัว)
   * hole = กล้องอยู่ในตึก ฝนตกเฉพาะนอกตึก มองออกหน้าต่างยังเห็นฝน (เดิมเข้าตึกแล้วฝนข้างนอกหายหมด)
   */
  update(dt: number, cam: THREE.Vector3, amount: number, sheltered: boolean, hole: { x: number; z: number; hx: number; hz: number; rot: number } | null = null): void {
    this.uniforms.uTime.value += dt;
    if (hole) {
      this.uniforms.uHole.value.set(hole.x, hole.z, hole.hx, hole.hz);
      this.uniforms.uHoleRot.value.set(Math.cos(hole.rot), Math.sin(hole.rot));
    } else this.uniforms.uHole.value.set(1e9, 1e9, 0, 0);
    this.uniforms.uAmount.value = sheltered ? 0 : amount;
    this.uniforms.uCam.value.copy(cam);
    this.group.visible = amount > 0.01 && !sheltered;
    if (!this.group.visible) return;
    // ย้ายจุดละอองตามกล้องทุก 4 ม. วางบนพื้นจริง
    if (Math.hypot(cam.x - this.lastSX, cam.z - this.lastSZ) > 4) {
      this.lastSX = cam.x;
      this.lastSZ = cam.z;
      const m = new THREE.Matrix4();
      for (let i = 0; i < this.splashes.count; i++) {
        const a = i * 2.399;
        const r = 1.5 + Math.sqrt((i * 0.618) % 1) * 14;
        const x = cam.x + Math.cos(a) * r;
        const z = cam.z + Math.sin(a) * r;
        m.makeTranslation(x, this.groundAt(x, z), z);
        this.splashes.setMatrixAt(i, m);
      }
      this.splashes.instanceMatrix.needsUpdate = true;
    }
  }
}

const FOG_WHITE = new THREE.Color(0.9, 0.9, 0.9);

/** หมอกเช้าเป็นแผ่นลอยต่ำ · พื้นที่สูงกว่าแผ่นบังแผ่นไว้ จึงเห็นหมอกเฉพาะในหุบ (REFERENCES-R2 หัวข้อ 7) */
export class ValleyFog {
  readonly group = new THREE.Group();
  readonly uniforms = { uTime: { value: 0 }, uAmount: { value: 0 }, uColor: { value: new THREE.Color(0.85, 0.86, 0.86) } };

  constructor(size: number, levels = [9, 15, 22]) {
    const mat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, this.uniforms]),
      vertexShader: /* glsl */ `
        varying vec3 vW;
        #include <fog_pars_vertex>
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vW = w.xyz;
          vec4 mvPosition = viewMatrix * w;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uAmount;
        uniform vec3 uColor;
        varying vec3 vW;
        #include <fog_pars_fragment>
        float n(vec2 p) { return sin(p.x) * sin(p.y); }
        void main() {
          vec2 p = vW.xz * 0.012 + vec2(uTime * 0.01, uTime * 0.004);
          float v = n(p * 3.1) * 0.5 + n(p * 7.3 + 2.0) * 0.3 + n(p * 15.0 - 1.0) * 0.2;
          float a = uAmount * smoothstep(-0.6, 0.6, v) * 0.38;
          // ใกล้กล้องจางลง เดินในหมอกไม่เห็นแผ่นเป็นเพดาน
          a *= smoothstep(6.0, 40.0, distance(vW, cameraPosition));
          gl_FragColor = vec4(uColor, a);
          #include <fog_fragment>
        }`,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: true,
    });
    Object.assign(this.uniforms, mat.uniforms);
    for (const y of levels) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2), mat);
      m.position.y = y;
      m.renderOrder = 3;
      this.group.add(m);
    }
    this.group.visible = false;
  }

  update(dt: number, amount: number, color: THREE.Color): void {
    this.uniforms.uTime.value += dt;
    this.uniforms.uAmount.value = amount;
    this.uniforms.uColor.value.copy(color).lerp(FOG_WHITE, 0.5);
    this.group.visible = amount > 0.02;
  }
}
