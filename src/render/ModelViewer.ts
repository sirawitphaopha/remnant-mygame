import * as THREE from 'three';
import { busModel, carModel, droppedBagModel, lampModel, mailboxModel, signModel, smallItemModel } from './models/props';
import { plantGeometry, rockGeometry, treeGeometry } from './models/plants';
import { HeroModel } from './models/hero';

/** สร้างโมเดลของชนิดนั้นไว้โชว์ในคอลเลกชัน */
export function kindModel(kind: string): THREE.Object3D {
  const lam = new THREE.MeshLambertMaterial({ vertexColors: true });
  switch (kind) {
    case 'pine': case 'oak': case 'birch': case 'dead':
      return new THREE.Mesh(treeGeometry(kind, 'near'), lam);
    case 'rock':
      return new THREE.Mesh(rockGeometry(1), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
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
    default:
      return smallItemModel(kind);
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
      this.holder.clear();
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
