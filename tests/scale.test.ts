import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { HERO, STREET } from '../src/config/scale';
import { HeroModel } from '../src/render/models/hero';
import { busModel, carModel, lampModel, mailboxModel } from '../src/render/models/props';

// สัดส่วนของจริง (รอบสอง ช่วง 2) · โมเดลที่ปั้นด้วยโค้ดต้องมีขนาดตรงกับ src/config/scale.ts

/** ขนาดตัวของ ไม่นับมอสที่ขึ้นทับ (userData.moss) และไม่นับการเอียงของซาก */
const size = (o: THREE.Object3D) => {
  o.rotation.set(0, 0, 0);
  o.updateMatrixWorld(true);
  const box = new THREE.Box3();
  o.traverse((c) => { if ((c as THREE.Mesh).isMesh && !c.userData.moss) box.expandByObject(c); });
  return box.getSize(new THREE.Vector3());
};

describe('ขนาดของจริง', () => {
  it('เอเลี่ยนสูง 1.5 ม. ถึงยอดโหล · กลางโหลอยู่ที่ความสูงหัวที่ใช้เช็กก๊าซ', () => {
    const h = new HeroModel();
    const box = new THREE.Box3().setFromObject(h.root);
    expect(box.max.y).toBeCloseTo(HERO.height, 1);
    const jar = new THREE.Vector3();
    h.jarGlass.getWorldPosition(jar);
    expect(Math.abs(jar.y - HERO.headHeight)).toBeLessThan(0.03);
  });
  it('รถเก๋ง รถบัส เสาไฟ ตู้ไปรษณีย์', () => {
    const car = size(carModel(1));
    // สนิมยื่นออกนอกตัวรถได้ไม่เกิน 10 ซม.
    expect(Math.abs(car.z - STREET.car.length)).toBeLessThan(0.1);
    expect(Math.abs(car.x - STREET.car.width)).toBeLessThan(0.1);
    expect(Math.abs(car.y - STREET.car.height)).toBeLessThan(0.08);
    const bus = size(busModel());
    expect(Math.abs(bus.z - STREET.bus.length)).toBeLessThan(0.1);
    expect(Math.abs(bus.y - STREET.bus.height)).toBeLessThan(0.08);
    expect(Math.abs(size(lampModel()).y - STREET.lampHeight)).toBeLessThan(0.1);
    expect(Math.abs(size(mailboxModel()).y - STREET.mailboxHeight)).toBeLessThan(0.05);
  });
});
