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
      if ((ALL_TREE_KINDS as string[]).includes(tree)) { const m = treeModel(tree, 'near'); return woodAndLeaves(m.wood, m.leaves, m.style); }
      if ((SHRUB_IDS as readonly string[]).includes(kind) && !(FLOWER_IDS as string[]).includes(kind)) { const m = shrubModel(kind as ShrubId); return woodAndLeaves(m.wood, m.leaves, m.style); }
      if ((FLOWER_IDS as string[]).includes(kind) || (RIVER_PLANT_IDS as string[]).includes(kind)) return new THREE.Mesh(flowerGeometry(kind as TilePlantId).clone(), new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
      const rock = ROCK_OF.get(kind);
      if (rock) return new THREE.Mesh(rockModel(rock, 0).clone(), new THREE.MeshLambertMaterial({ vertexColors: true }));
      return smallItemModel(kind);
    }
  }
}

/** ช่องดูโมเดลหมุนได้ในหน้าคอลเลกชัน · ลากเมาส์เพื่อหมุน */
export class ModelViewer {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(35, 1, 0.01, 200);
  private holder = new THREE.Group();
  private yaw = 0.6;
  private dragging = false;
  private lastX = 0;
  private current = '';
  private raf = 0;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'model-viewer';
    this.scene.add(new THREE.HemisphereLight(0xdfefff, 0x334444, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(3, 5, 4);
    this.scene.add(key, this.holder);
    this.canvas.addEventListener('pointerdown', (e) => { this.dragging = true; this.lastX = e.clientX; this.canvas.setPointerCapture(e.pointerId); });
    this.canvas.addEventListener('pointermove', (e) => { if (this.dragging) { this.yaw += (e.clientX - this.lastX) * 0.01; this.lastX = e.clientX; } });
    this.canvas.addEventListener('pointerup', () => { this.dragging = false; });
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
      const obj = kindModel(kind);
      const box = new THREE.Box3().setFromObject(obj);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      obj.position.sub(center);
      const r = Math.max(size.x, size.y, size.z);
      this.camera.position.set(0, r * 0.25, r * 2.4);
      this.camera.lookAt(0, 0, 0);
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
    if (!this.dragging) this.yaw += 0.006;
    this.holder.rotation.y = this.yaw;
    this.renderer.render(this.scene, this.camera);
  };

  /** ตัวช่วยทดสอบ: วาดหนึ่งภาพทันที */
  renderOnce(): void {
    if (!this.renderer) return;
    this.holder.rotation.y = this.yaw;
    this.renderer.render(this.scene, this.camera);
  }
}
