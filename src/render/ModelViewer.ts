import * as THREE from 'three';
import { disposeObject } from './dispose';
import { busModel, carModel, droppedBagModel, lampModel, mailboxModel, signModel, smallItemModel } from './models/props';
import { plantGeometry } from './models/plants';
import { HeroModel } from './models/hero';
import { animalModel } from './models/animals';
import { leafTexture, treeModel } from './models/trees';
import { shrubModel } from './models/shrubs';
import { rockModel } from './models/rocks';
import { flowerGeometry } from './models/flowers';
import { fishGeometry } from './Fish';
import { paintingPreview } from './Caves';
import { ALL_TREE_KINDS } from '../world/trees';
import { SHRUB_IDS, type ShrubId } from '../world/shrubs';
import { FLOWER_IDS, RIVER_PLANT_IDS, type TilePlantId } from '../world/flowers';
import { ROCK_SCAN, ROCK_TYPES, type RockType } from '../world/rocks';

// โมเดลในคอลเลกชันใช้รูปทรงชุดเดียวกับในโลก แต่ทำสำเนาไว้ (ปิดหน้าคอลเลกชันแล้วคืนหน่วยความจำได้ ไม่ไปลบของที่โลกใช้อยู่)

/** ต้นไม้หรือพุ่มไม้ (กิ่ง + แผ่นใบโปร่งใส) */
function woodAndLeaves(wood: THREE.BufferGeometry, leaves: THREE.BufferGeometry | null, style: Parameters<typeof leafTexture>[0]): THREE.Group {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(wood.clone(), new THREE.MeshLambertMaterial({ vertexColors: true })));
  if (leaves) g.add(new THREE.Mesh(leaves.clone(), new THREE.MeshLambertMaterial({ vertexColors: true, map: leafTexture(style).clone(), alphaTest: 0.45, side: THREE.DoubleSide })));
  return g;
}

/** ชนิดต้นไม้ในโลกจากชนิดในคอลเลกชัน (สนสก็อตใช้รหัส pine · ต้นตายใช้ dead) */
const TREE_OF: Record<string, string> = { pine: 'scotsPine', dead: 'deadBroad' };
const ROCK_OF = new Map<string, RockType>(ROCK_TYPES.map((r) => [ROCK_SCAN[r], r]));

/** สร้างโมเดลของชนิดนั้นไว้โชว์ในคอลเลกชัน */
export function kindModel(kind: string): THREE.Object3D {
  switch (kind) {

    case 'fern': case 'flower': case 'mushroom':
      return new THREE.Mesh(plantGeometry(kind), new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    case 'glowshroom': {
      const g = new THREE.Mesh(plantGeometry('mushroom'), new THREE.MeshStandardMaterial({ vertexColors: true, emissive: 0x2fb7d0, emissiveIntensity: 0.8 }));
      return g;
    }
    case 'car': return carModel(2);
    case 'bus': return busModel();
    case 'lamp': return lampModel();
    case 'mailbox': return mailboxModel();
    case 'sign': return signModel('PINE VALLEY  3 km');
    case 'remains': {
      const h = new HeroModel();
      h.root.rotation.z = Math.PI / 2;
      h.octo.visible = false;
      h.jarWater.visible = false;
      return h.root;
    }
    case 'bag': return droppedBagModel();
    case 'painting': return paintingPreview();
    case 'trout': case 'carp': return new THREE.Mesh(fishGeometry(kind), new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    case 'cavefish': return new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 7).scale(1, 0.6, 2.6), new THREE.MeshLambertMaterial({ color: 0xe8e2dc, emissive: 0x222222 }));
    case 'bat': {
      const g = new THREE.Group();
      const wing = new THREE.BufferGeometry();
      wing.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.08, -0.22, 0.04, -0.05, 0, 0, -0.08, 0, 0, 0.08, 0.22, 0.04, -0.05, 0, 0, -0.08], 3));
      wing.computeVertexNormals();
      g.add(new THREE.Mesh(wing, new THREE.MeshLambertMaterial({ color: 0x1a1614, side: THREE.DoubleSide })));
      g.add(new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6).scale(1, 0.9, 1.8), new THREE.MeshLambertMaterial({ color: 0x2a2220 })));
      return g;
    }
    case 'deer': case 'rabbit': case 'fox': case 'crow': case 'eagle': case 'frog': case 'butterfly': case 'owl': case 'wolf': case 'bear': case 'starling': case 'squirrel': case 'bee': {
      const a = animalModel(kind);
      a.animate(0.016, 0, 0);
      return a.root;
    }
    case 'firefly': return new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), new THREE.MeshBasicMaterial({ color: 0xd8ff7a }));
    default: {
      // ต้นไม้ 19 ชนิด พุ่มไม้ 6 ชนิด ดอกไม้ พืชริมน้ำ หิน 6 ชนิด (รอบสอง ช่วง 12)
      const tree = TREE_OF[kind] ?? kind;
      // ต้นไม้กับพุ่มไม้มีวงดินรองโคน (userData.ground) ปลายรากจมดินเหมือนในโลก
      if ((ALL_TREE_KINDS as string[]).includes(tree)) { const m = treeModel(tree, 'near'); const g = woodAndLeaves(m.wood, m.leaves, m.style); g.userData.ground = true; return g; }
      if ((SHRUB_IDS as readonly string[]).includes(kind) && !(FLOWER_IDS as string[]).includes(kind)) { const m = shrubModel(kind as ShrubId); const g = woodAndLeaves(m.wood, m.leaves, m.style); g.userData.ground = true; return g; }
      if ((FLOWER_IDS as string[]).includes(kind) || (RIVER_PLANT_IDS as string[]).includes(kind)) return new THREE.Mesh(flowerGeometry(kind as TilePlantId).clone(), new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
      const rock = ROCK_OF.get(kind);
      if (rock) return new THREE.Mesh(rockModel(rock, 0).clone(), new THREE.MeshLambertMaterial({ vertexColors: true }));
      return smallItemModel(kind);
    }
  }
}

/** วงดินรองโคนต้นไม้ในกรอบดูโมเดล · กลางทึบ ขอบจางหายไปกับพื้นหลัง */
function groundDisc(radius: number): THREE.Mesh {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d')!;
  const grad = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(92,72,48,1)');
  grad.addColorStop(0.55, 'rgba(80,63,44,.95)');
  grad.addColorStop(1, 'rgba(60,50,38,0)');
  x.fillStyle = grad;
  x.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const disc = new THREE.Mesh(new THREE.CircleGeometry(radius, 40).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: tex, transparent: true }));
  disc.position.y = 0.01;
  return disc;
}

/** มุมเงยตั้งต้นของกล้อง (เท่าเดิม กล้องสูงหนึ่งในสิบของระยะ) */
const PITCH0 = Math.atan2(0.25, 2.4);
/** ซูมเข้าใกล้สุด · ถอยไกลสุด (เท่าของระยะที่เห็นทั้งชิ้นพอดีกรอบ) */
const ZOOM_IN = 0.08;
const ZOOM_OUT = 1.8;

/**
 * ช่องดูโมเดลในหน้าคอลเลกชัน · ลากซ้ายขวาหมุน ลากขึ้นลงเอียงมุม ล้อเมาส์ซูมเข้าตรงจุดที่ชี้ ดับเบิลคลิกคืนมุมเดิม
 * (พี่กันขอ 26 ต.ค. 2569 *"โมเดลที่ดู ซูมได้นะ กดขยายดูได้"* · ปุ่มขยายกรอบอยู่ในหน้าคอลเลกชัน)
 */
export class ModelViewer {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(35, 1, 0.01, 200);
  private holder = new THREE.Group();
  private yaw = 0.6;
  private pitch = PITCH0;
  private zoom = 1;
  /** ระยะกล้องที่เห็นทั้งชิ้นพอดีกรอบ */
  private fitDist = 1;
  /** ความสูงจุดที่กล้องมอง (กลางชิ้น = 0) · ซูมเข้าตรงจุดที่ชี้แล้วจุดนี้เลื่อนตาม · ครึ่งความสูงชิ้นไว้กันเลื่อนหลุดชิ้น */
  private lookY = 0;
  private halfH = 0;
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  /** เวลาที่แตะครั้งล่าสุด · หมุนเองหยุด 4 วินาทีหลังแตะ ไม่หมุนหนีตอนกำลังดูจุดที่ซูมเข้าไป */
  private touchedAt = -1e9;
  private current = '';
  private raf = 0;
  /** โมเดลที่ต้องใช้ข้อมูลโลก (ตึก สะพาน) App ส่งตัวสร้างมาให้ · ชนิดอื่นสร้างจาก kindModel */
  private sources = new Map<string, () => THREE.Object3D>();

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'model-viewer';
    this.scene.add(new THREE.HemisphereLight(0xdfefff, 0x334444, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(3, 5, 4);
    this.scene.add(key, this.holder);
    this.canvas.addEventListener('pointerdown', (e) => { this.dragging = true; this.lastX = e.clientX; this.lastY = e.clientY; this.touchedAt = performance.now(); this.canvas.setPointerCapture(e.pointerId); });
    this.canvas.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      this.yaw += (e.clientX - this.lastX) * 0.01;
      this.pitch = Math.min(1.35, Math.max(-0.35, this.pitch + (e.clientY - this.lastY) * 0.006));
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.touchedAt = performance.now();
    });
    this.canvas.addEventListener('pointerup', () => { this.dragging = false; });
    this.canvas.addEventListener('wheel', (e) => {
      // ไม่ให้กล่องรอบ ๆ เลื่อนตาม และไม่ให้ล้อเมาส์ไปสลับของในมือหลังปิดหน้าคอลเลกชัน
      e.preventDefault();
      e.stopPropagation();
      const dy = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY;
      const next = Math.min(ZOOM_OUT, Math.max(ZOOM_IN, this.zoom * Math.exp(dy * 0.0015)));
      // ซูมเข้าตรงความสูงที่เมาส์ชี้: จุดใต้เมาส์ค้างอยู่ใต้เมาส์ ไม่ใช่วิ่งเข้ากลางชิ้นเสมอ (ต้นไม้สูง ซูมดูรากได้)
      const h = this.canvas.clientHeight || 1;
      const ndcY = 1 - (2 * e.offsetY) / h;
      const halfView = this.fitDist * this.zoom * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
      this.lookY = Math.min(this.halfH, Math.max(-this.halfH, this.lookY + ndcY * halfView * (1 - next / this.zoom)));
      this.zoom = next;
      this.touchedAt = performance.now();
    }, { passive: false });
    this.canvas.addEventListener('dblclick', () => this.resetView());
  }

  /** ตัวสร้างโมเดลของชนิดนั้นจากข้อมูลโลก · ตั้งใหม่แล้วชิ้นที่ดูอยู่สร้างใหม่ตอนเปิดดูครั้งถัดไป */
  setSource(kind: string, make: () => THREE.Object3D): void {
    this.sources.set(kind, make);
    if (this.current === kind) this.current = '';
  }

  /** คืนมุมเดิม: ทั้งชิ้นพอดีกรอบ มุมเงยตั้งต้น */
  resetView(): void {
    this.zoom = 1;
    this.pitch = PITCH0;
    this.lookY = 0;
    this.touchedAt = -1e9;
  }

  show(kind: string): void {
    if (!this.renderer) {
      this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    }
    if (kind !== this.current) {
      this.current = kind;
      // คืนหน่วยความจำชิ้นที่ดูก่อนหน้า (เดิมสลับดูทีไรของเก่าค้างทุกชิ้น)
      for (const c of [...this.holder.children]) disposeObject(c);
      const obj = this.sources.get(kind)?.() ?? kindModel(kind);
      const box = new THREE.Box3().setFromObject(obj);
      // ต้นไม้กับพุ่มไม้: ส่วนใต้ดินไม่นับตอนจัดกรอบ · วงดินบังปลายรากที่จมดิน (เดิมไม่มีพื้น ปลายรากห้อยลอยลงไปข้างล่าง)
      if (obj.userData.ground) {
        box.min.y = Math.max(box.min.y, 0);
        obj.add(groundDisc(Math.max(box.max.x - box.min.x, box.max.z - box.min.z) * 0.6));
      }
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      obj.position.sub(center);
      const r = Math.max(size.x, size.y, size.z);
      this.fitDist = Math.hypot(0.25, 2.4) * r;
      this.halfH = size.y / 2;
      this.camera.near = Math.max(0.002, r * 0.002);
      this.camera.far = r * 8;
      this.camera.updateProjectionMatrix();
      this.resetView();
      this.holder.add(obj);
    }
    if (!this.raf) this.loop();
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private loop = (): void => {
    this.raf = requestAnimationFrame(this.loop);
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!this.renderer || !w || !h) return;
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
    if (!this.dragging && performance.now() - this.touchedAt > 4000) this.yaw += 0.006;
    this.renderOnce();
  };

  private place(): void {
    const d = this.fitDist * this.zoom;
    this.camera.position.set(0, this.lookY + Math.sin(this.pitch) * d, Math.cos(this.pitch) * d);
    this.camera.lookAt(0, this.lookY, 0);
    this.holder.rotation.y = this.yaw;
  }

  /** ตัวช่วยทดสอบ: วาดหนึ่งภาพทันที */
  renderOnce(): void {
    if (!this.renderer) return;
    this.place();
    this.renderer.render(this.scene, this.camera);
  }
}
