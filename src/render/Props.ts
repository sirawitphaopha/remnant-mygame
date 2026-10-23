import { STREET } from '../config/scale';
import * as THREE from 'three';
import type { CircleColliders } from '../world/colliders';
import type { Prop } from '../world/props';
import { flattenStatic } from './models/build';
import { applyDetail } from './detail';
import { busModel, carModel, lampModel, mailboxModel, shipModel, signModel, smallItemModel } from './models/props';

export interface PlacedProp {
  prop: Prop;
  object: THREE.Object3D;
  /** เก็บไปแล้ว (ของชิ้นเล็ก) */
  taken: boolean;
  y: number;
}

const aged = new WeakSet<THREE.Material>();
const RUST = new THREE.Color(0x4e3426);

/** ตัวเลข 0 ถึง 1 คงที่ตามรหัสของ (ไว้สุ่มท่าเอียงแบบเดิมทุกครั้ง) */
function keyHash(key: string, salt = 0): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10007) / 10007;
}

/**
 * พันปีผ่านไป: เหล็กสนิมกินจนสีเดิมแทบไม่เหลือ กระจกแตกหายหมด (ใช้กับรถ รถบัส เสาไฟ ป้าย ตู้ไปรษณีย์)
 * วัสดุใช้ร่วมกันหลายชิ้น ปรับครั้งเดียวต่อวัสดุ
 */
function ageMetal(obj: THREE.Object3D): void {
  const glass: THREE.Object3D[] = [];
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || m.userData.moss) return;
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
      if (mat.transparent) { glass.push(m); continue; }
      if (aged.has(mat)) continue;
      aged.add(mat);
      const c = (mat as THREE.MeshLambertMaterial).color;
      if (!c) continue;
      if ((mat as THREE.MeshLambertMaterial).map) c.multiplyScalar(0.6);
      else {
        c.lerp(RUST, 0.72);
        // ลายสนิมด่างกับผิวพอง
        applyDetail(mat, 'rust');
      }
    }
  });
  for (const g of glass) g.removeFromParent();
}

/** วางของมนุษย์ทั้งหมดลงในฉาก · ของใหญ่เป็นสิ่งกีดขวาง ของชิ้นเล็กเก็บได้ */
export class Props {
  readonly group = new THREE.Group();
  readonly all: PlacedProp[] = [];
  readonly byKey = new Map<string, PlacedProp>();
  readonly ship: THREE.Group;

  constructor(props: Prop[], heightAt: (x: number, z: number) => number, colliders: CircleColliders, shipPos: { x: number; z: number; y: number }) {
    for (const p of props) {
      let obj: THREE.Object3D;
      const y = p.y ?? heightAt(p.x, p.z);
      switch (p.kind) {
        case 'car': obj = carModel(p.variant ?? 0); break;
        case 'bus': obj = busModel(); break;
        case 'lamp': obj = lampModel(); break;
        case 'mailbox': obj = mailboxModel(); break;
        case 'sign': obj = signModel(p.text ?? ''); break;
        default: obj = smallItemModel(p.kind);
      }
      const metal = p.kind === 'car' || p.kind === 'bus' || p.kind === 'lamp' || p.kind === 'sign' || p.kind === 'mailbox';
      if (metal) ageMetal(obj);
      // ของนิ่งทุกชิ้น รวมชิ้นส่วนที่ใช้วัสดุเดียวกัน วาดน้อยครั้งลง
      flattenStatic(obj);
      obj.position.set(p.x, y, p.z);
      obj.rotation.order = 'YXZ';
      obj.rotation.y = p.rot;
      const h1 = keyHash(p.key, 1);
      const h2 = keyHash(p.key, 2);
      const fallen = p.kind === 'lamp' && p.variant === 1;
      // รถจมดินลงไปครึ่งล้อ ยางผุหาย ตัวรถเอียง · เสาไฟล้มนอนกับพื้น ที่ยังยืนก็เอียง · ป้ายกับตู้เอียง
      if (p.kind === 'car' || p.kind === 'bus') {
        obj.position.y -= 0.22 + h1 * 0.25;
        obj.rotation.x = (h1 - 0.5) * 0.12;
        obj.rotation.z = (h2 - 0.5) * 0.14;
      } else if (fallen) {
        obj.rotation.x = -Math.PI / 2 + 0.04;
        obj.position.y += 0.1;
      } else if (p.kind === 'lamp') obj.rotation.x = (h1 - 0.5) * 0.4;
      else if (p.kind === 'sign' || p.kind === 'mailbox') obj.rotation.x = (h1 - 0.5) * 0.35;
      this.group.add(obj);
      const placed = { prop: p, object: obj, taken: false, y };
      this.all.push(placed);
      this.byKey.set(p.key, placed);
      // ของใหญ่กันไม่ให้เดินทะลุ
      const fx = -Math.sin(p.rot);
      const fz = -Math.cos(p.rot);
      // ตัวชนเป็นวงกลมเรียงตามความยาวรถ (ขนาดจาก src/config/scale.ts)
      if (p.kind === 'car') for (const o of [-1.35, 0, 1.35]) colliders.add({ x: p.x + fx * o, z: p.z + fz * o, r: 0.92, top: STREET.car.height });
      if (p.kind === 'bus') for (const o of [-4.6, -1.55, 1.55, 4.6]) colliders.add({ x: p.x + fx * o, z: p.z + fz * o, r: 1.28, top: STREET.bus.height });
      if (p.kind === 'lamp' && !fallen) colliders.add({ x: p.x, z: p.z, r: 0.16, top: STREET.lampHeight });
      if (p.kind === 'mailbox') colliders.add({ x: p.x, z: p.z, r: 0.3, top: STREET.mailboxHeight });
      if (p.kind === 'sign') colliders.add({ x: p.x, z: p.z, r: 0.1, top: 3 });
    }
    this.ship = shipModel();
    this.ship.position.set(shipPos.x, shipPos.y, shipPos.z);
    this.group.add(this.ship);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.5;
      colliders.add({ x: shipPos.x + Math.cos(a) * 4.2, z: shipPos.z + Math.sin(a) * 4.2, r: 0.7, top: 3 });
    }
  }

  take(key: string): void {
    const p = this.byKey.get(key);
    if (!p) return;
    p.taken = true;
    p.object.visible = false;
  }

  /** วางของชิ้นเล็กกลับลงโลก (ตอนตาย ของกระจายรอบซาก) */
  restore(key: string): void {
    const p = this.byKey.get(key);
    if (!p) return;
    p.taken = false;
    p.object.visible = true;
  }
}
