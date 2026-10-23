import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// ตัวละคร: ชุดอวกาศสีขาวหม่น 4 แขน ไฟฟ้าที่หน้าอก หัวเป็นโหลแก้วมีน้ำ มีปลาหมึกสีชมพูอมม่วงอยู่ข้างใน
// ขยับท่าด้วยโค้ด (เดิน วิ่ง ว่าย ปีน ลอยกลางอากาศ ยืนหายใจ)

const SUIT = new THREE.MeshStandardMaterial({ color: 0xd3d5cf, roughness: 0.75 });
const SUIT_DARK = new THREE.MeshStandardMaterial({ color: 0x6d716c, roughness: 0.8 });
const PANEL = new THREE.MeshStandardMaterial({ color: 0xa9ada7, roughness: 0.7 });
const LIGHT = new THREE.MeshStandardMaterial({ color: 0x7fd7ff, emissive: 0x3fb7ff, emissiveIntensity: 1.6 });

export const OCTO_UNIFORMS = { uTime: { value: 0 } };

function limb(r0: number, r1: number, len: number, mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, len, 10).translate(0, -len / 2, 0), mat);
  m.castShadow = true;
  return m;
}

function joint(r: number, mat: THREE.Material = SUIT_DARK): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat);
  m.castShadow = true;
  return m;
}

interface Arm {
  shoulder: THREE.Group;
  elbow: THREE.Group;
  side: number;
  lower: boolean;
}

interface Leg {
  hip: THREE.Group;
  knee: THREE.Group;
  side: number;
}

function octopus(): THREE.Group {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xc874b6, roughness: 0.45, emissive: 0x2a0a26, emissiveIntensity: 0.4 });
  const mantle = new THREE.Mesh(new THREE.SphereGeometry(0.085, 16, 12).scale(1, 1.25, 1).translate(0, 0.05, 0), skin);
  g.add(mantle);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1a1020, roughness: 0.2 });
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), eyeMat);
    eye.position.set(s * 0.045, 0.02, -0.07);
    g.add(eye);
  }
  // หนวด 8 เส้น ไหวด้วยตัวปรับจุดยอด ไม่ต้องขยับกระดูก
  const geos: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const pts = [
      new THREE.Vector3(Math.cos(a) * 0.03, -0.02, Math.sin(a) * 0.03),
      new THREE.Vector3(Math.cos(a) * 0.09, -0.07, Math.sin(a) * 0.09),
      new THREE.Vector3(Math.cos(a) * 0.13, -0.11, Math.sin(a) * 0.13),
      new THREE.Vector3(Math.cos(a + 0.4) * 0.15, -0.16, Math.sin(a + 0.4) * 0.15),
    ];
    const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.014, 6, false);
    const seed = new Float32Array(tube.getAttribute('position').count).fill(i * 0.79);
    tube.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    geos.push(tube);
  }
  const tentMat = skin.clone();
  tentMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, OCTO_UNIFORMS);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float seed;\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float down = clamp(-position.y / 0.16, 0.0, 1.0);
        transformed.x += sin(uTime * 2.1 + seed * 3.0 + down * 4.0) * 0.022 * down;
        transformed.z += cos(uTime * 1.7 + seed * 2.0 + down * 3.0) * 0.022 * down;
        transformed.y += sin(uTime * 1.3 + seed) * 0.008 * down;`,
      );
  };
  g.add(new THREE.Mesh(mergeGeometries(geos)!, tentMat));
  return g;
}

export class HeroModel {
  readonly root = new THREE.Group();
  /** ส่วนตัวทั้งหมด (หมุนก้มตอนว่าย) */
  readonly body = new THREE.Group();
  readonly torso = new THREE.Group();
  readonly head = new THREE.Group();
  readonly octo: THREE.Group;
  readonly jarGlass: THREE.Mesh;
  readonly jarWater: THREE.Mesh;
  readonly chestLight: THREE.Mesh;
  readonly arms: Arm[] = [];
  readonly legs: Leg[] = [];
  /** จุดถือของของแต่ละแขน: บนขวา บนซ้าย ล่างขวา ล่างซ้าย */
  readonly hands: THREE.Group[] = [];
  private breath = 0;

  constructor() {
    this.root.add(this.body);
    this.body.position.y = 0.98;
    this.body.add(this.torso);

    // ลำตัว
    const chest = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.32, 6, 14), SUIT);
    chest.position.y = 0.3;
    chest.scale.set(1.05, 1, 0.8);
    chest.castShadow = true;
    this.torso.add(chest);
    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.04, 8, 18).rotateX(Math.PI / 2), SUIT_DARK);
    belt.position.y = 0.05;
    this.torso.add(belt);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.2, 0.06), PANEL);
    plate.position.set(0, 0.4, -0.17);
    this.torso.add(plate);
    this.chestLight = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.035, 0.02), LIGHT);
    this.chestLight.position.set(0, 0.44, -0.205);
    this.torso.add(this.chestLight);
    // กระเป๋าหลังกับเครื่องกรองออกซิเจน
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.44, 0.16), PANEL);
    pack.position.set(0, 0.36, 0.2);
    pack.castShadow = true;
    this.torso.add(pack);
    for (const s of [-1, 1]) {
      const can = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.36, 10), SUIT_DARK);
      can.position.set(s * 0.11, 0.38, 0.3);
      this.torso.add(can);
    }

    // หัว: คอ โหลแก้ว น้ำ ปลาหมึก
    this.head.position.y = 0.66;
    this.torso.add(this.head);
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.06, 18), SUIT_DARK);
    this.head.add(collar);
    this.jarWater = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 22, 16),
      new THREE.MeshStandardMaterial({ color: 0x5fb3c8, transparent: true, opacity: 0.28, roughness: 0.1, depthWrite: false }),
    );
    this.jarWater.position.y = 0.2;
    this.head.add(this.jarWater);
    this.octo = octopus();
    this.octo.position.y = 0.2;
    this.head.add(this.octo);
    this.jarGlass = new THREE.Mesh(
      new THREE.SphereGeometry(0.225, 26, 18),
      new THREE.MeshStandardMaterial({ color: 0xe8f6fa, transparent: true, opacity: 0.2, roughness: 0.03, metalness: 0.1, depthWrite: false }),
    );
    this.jarGlass.position.y = 0.2;
    this.jarGlass.renderOrder = 3;
    this.head.add(this.jarGlass);
    const lid = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.022, 8, 20).rotateX(Math.PI / 2), SUIT_DARK);
    lid.position.y = 0.04;
    this.head.add(lid);

    // แขน 4 ข้าง: คู่บนที่ไหล่ คู่ล่างข้างเอว
    const armSpec: [number, number, boolean][] = [[1, 0.5, false], [-1, 0.5, false], [1, 0.22, true], [-1, 0.22, true]];
    for (const [side, y, lower] of armSpec) {
      const shoulder = new THREE.Group();
      shoulder.position.set(side * (lower ? 0.24 : 0.29), y, 0);
      shoulder.add(joint(lower ? 0.065 : 0.08));
      const upper = limb(0.065, 0.055, lower ? 0.24 : 0.28, SUIT);
      shoulder.add(upper);
      const elbow = new THREE.Group();
      elbow.position.y = lower ? -0.24 : -0.28;
      elbow.add(joint(0.055));
      elbow.add(limb(0.052, 0.045, lower ? 0.22 : 0.26, SUIT));
      const hand = new THREE.Group();
      hand.position.y = lower ? -0.24 : -0.28;
      hand.add(joint(0.055, SUIT_DARK));
      elbow.add(hand);
      shoulder.add(elbow);
      this.torso.add(shoulder);
      this.arms.push({ shoulder, elbow, side, lower });
      this.hands.push(hand);
    }

    // ขา
    for (const side of [1, -1]) {
      const hip = new THREE.Group();
      hip.position.set(side * 0.11, 0, 0);
      hip.add(joint(0.08));
      hip.add(limb(0.085, 0.07, 0.46, SUIT));
      const knee = new THREE.Group();
      knee.position.y = -0.46;
      knee.add(joint(0.07));
      knee.add(limb(0.07, 0.06, 0.44, SUIT));
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.09, 0.24).translate(0, -0.47, -0.04), SUIT_DARK);
      boot.castShadow = true;
      knee.add(boot);
      hip.add(knee);
      this.body.add(hip);
      this.legs.push({ hip, knee, side });
    }
    this.root.traverse((o) => { if ((o as THREE.Mesh).isMesh && o !== this.jarGlass && o !== this.jarWater) o.castShadow = true; });
  }

  /**
   * ขยับท่าตามสถานะ
   * @param phase จังหวะก้าว · speed ความเร็วแนวราบ
   */
  pose(dt: number, state: 'ground' | 'air' | 'swim' | 'climb', phase: number, speed: number, running: boolean, time: number): void {
    OCTO_UNIFORMS.uTime.value = time;
    this.breath += dt;
    const k = 1 - Math.exp(-dt * 12);
    const set = (o: THREE.Object3D, x: number, z = 0, y = 0) => {
      o.rotation.x += (x - o.rotation.x) * k;
      o.rotation.z += (z - o.rotation.z) * k;
      o.rotation.y += (y - o.rotation.y) * k;
    };
    const s = Math.sin(phase);
    const c = Math.cos(phase);
    const amt = Math.min(1, speed / 1.5) * (running ? 1.35 : 0.85);
    let bodyPitch = 0;
    let bodyY = 0.98;

    if (state === 'swim') {
      bodyPitch = -1.25;
      bodyY = 0.9;
      const p = time * 3.2;
      this.arms.forEach((a, i) => set(a.shoulder, Math.sin(p + i * 1.6) * 1.1 - 1.4, a.side * (0.4 + 0.2 * Math.cos(p + i)), 0));
      this.arms.forEach((a) => set(a.elbow, -0.6));
      this.legs.forEach((l, i) => { set(l.hip, Math.sin(time * 5 + i * Math.PI) * 0.35); set(l.knee, 0.35); });
    } else if (state === 'climb') {
      const p = phase;
      this.arms.forEach((a, i) => {
        const reach = Math.sin(p + (i % 2) * Math.PI + (a.lower ? 1.2 : 0));
        set(a.shoulder, a.lower ? -1.2 : -2.6 + reach * 0.5, a.side * 0.25, 0);
        set(a.elbow, -0.5 - Math.max(0, -reach) * 0.6);
      });
      this.legs.forEach((l, i) => { const st = Math.sin(p + i * Math.PI); set(l.hip, -0.6 + st * 0.5); set(l.knee, 0.9 + st * 0.4); });
      bodyPitch = 0.12;
    } else if (state === 'air') {
      this.arms.forEach((a) => set(a.shoulder, -0.5, a.side * (a.lower ? 0.6 : 0.9), 0));
      this.arms.forEach((a) => set(a.elbow, -0.4));
      this.legs.forEach((l, i) => { set(l.hip, i ? -0.5 : 0.2); set(l.knee, 0.7); });
    } else {
      // เดิน วิ่ง ยืน
      this.legs.forEach((l, i) => {
        const sw = (i ? -s : s) * 0.55 * amt;
        set(l.hip, sw);
        set(l.knee, Math.max(0, (i ? c : -c)) * 0.9 * amt + 0.05);
      });
      this.arms.forEach((a, i) => {
        const opp = i % 2 ? s : -s;
        const swing = opp * (a.lower ? 0.25 : 0.5) * amt;
        set(a.shoulder, swing + (a.lower ? -0.12 : 0), a.side * (a.lower ? 0.38 : 0.14), 0);
        set(a.elbow, -0.25 - (running ? 0.9 : 0.2) * amt);
      });
      bodyPitch = running ? -0.18 : -0.04 * amt;
      bodyY = 0.98 + Math.abs(c) * 0.035 * amt;
    }
    this.body.rotation.x += (bodyPitch - this.body.rotation.x) * k;
    this.body.position.y += (bodyY - this.body.position.y) * k;
    // หายใจ
    this.torso.scale.y = 1 + Math.sin(this.breath * 1.6) * 0.012;
    // ปลาหมึกลอยขึ้นลงในน้ำเบา ๆ
    this.octo.position.y = 0.2 + Math.sin(time * 1.4) * 0.012;
    this.octo.rotation.y = Math.sin(time * 0.5) * 0.4;
  }
}
