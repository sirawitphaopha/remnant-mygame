import { STREET } from '../config/scale';
import * as THREE from 'three';
import type { CircleColliders } from '../world/colliders';
import type { Prop } from '../world/props';
import { busModel, carModel, lampModel, mailboxModel, shipModel, signModel, smallItemModel } from './models/props';

export interface PlacedProp {
  prop: Prop;
  object: THREE.Object3D;
  /** เก็บไปแล้ว (ของชิ้นเล็ก) */
  taken: boolean;
  y: number;
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
      const y = heightAt(p.x, p.z);
      switch (p.kind) {
        case 'car': obj = carModel(Number(p.key.split('-')[1])); break;
        case 'bus': obj = busModel(); break;
        case 'lamp': obj = lampModel(); break;
        case 'mailbox': obj = mailboxModel(); break;
        case 'sign': obj = signModel(p.text ?? ''); break;
        default: obj = smallItemModel(p.kind);
      }
      obj.position.set(p.x, y, p.z);
      obj.rotation.y = p.rot;
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
      if (p.kind === 'lamp') colliders.add({ x: p.x, z: p.z, r: 0.16, top: STREET.lampHeight });
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
