import * as THREE from 'three';

// ลำแสงสแกน (พี่กันสั่ง 26 ต.ค. 2569 "มีเเสงพุ่งออกไปด้วย ให้เหมือนการเเสกน")
// จากหัวเครื่องสแกนในมือไปถึงจุดที่เล็ง · กรวยสีฟ้าเรือง ปลายแคบที่มือ กว้างที่ของ มีเส้นแกนสว่างตรงกลาง กับดวงแสงที่จุดชน
// ใช้วัสดุแบบบวกแสง ไม่เขียนความลึก ไม่บังของอื่น

const HOLO = 0x6ff0e0;

export class ScanBeam {
  readonly group = new THREE.Group();
  private cone: THREE.Mesh;
  private core: THREE.Mesh;
  private dot: THREE.Mesh;
  private coneMat: THREE.MeshBasicMaterial;
  private coreMat: THREE.MeshBasicMaterial;
  private dotMat: THREE.MeshBasicMaterial;
  private dir = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);

  constructor() {
    const mat = (opacity: number) => new THREE.MeshBasicMaterial({ color: HOLO, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.coneMat = mat(0.22);
    this.coreMat = mat(0.7);
    this.dotMat = mat(0.6);
    // ยาว 1 หน่วยตามแกน Y เริ่มที่ 0 (มือ) ถึง 1 (ของ) แล้วยืดตามระยะจริง
    this.cone = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.015, 1, 14, 1, true).translate(0, 0.5, 0), this.coneMat);
    this.core = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1, 6, 1, true).translate(0, 0.5, 0), this.coreMat);
    this.dot = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), this.dotMat);
    for (const m of [this.cone, this.core, this.dot]) {
      m.frustumCulled = false;
      m.renderOrder = 5;
    }
    this.group.add(this.cone, this.core, this.dot);
    this.group.visible = false;
  }

  /**
   * from = หัวเครื่องสแกน · to = จุดที่เส้นเล็งชนของ · null = ไม่ได้สแกน (ซ่อน)
   * done = สแกนเสร็จแล้ว แสงนิ่งและจางลง
   */
  update(from: THREE.Vector3 | null, to: THREE.Vector3 | null, done: boolean, time: number): void {
    if (!from || !to) {
      this.group.visible = false;
      return;
    }
    this.dir.subVectors(to, from);
    const len = this.dir.length();
    if (len < 0.05) {
      this.group.visible = false;
      return;
    }
    this.dir.divideScalar(len);
    this.group.visible = true;
    for (const m of [this.cone, this.core]) {
      m.position.copy(from);
      m.quaternion.setFromUnitVectors(this.up, this.dir);
      m.scale.set(1, len, 1);
    }
    // กว้างที่ปลายตามระยะ ของไกลลำแสงบานกว้างขึ้นนิดหน่อย
    const spread = Math.min(1.6, 0.6 + len * 0.06);
    this.cone.scale.x = this.cone.scale.z = spread;
    this.dot.position.copy(to);
    // กระพริบเร็ว ๆ ตอนกำลังสแกน · เสร็จแล้วนิ่งและจาง
    const flick = done ? 0.45 : 0.75 + 0.25 * Math.sin(time * 38) * Math.sin(time * 13);
    this.coneMat.opacity = 0.22 * flick;
    this.coreMat.opacity = 0.75 * flick;
    this.dotMat.opacity = 0.6 * flick;
    this.dot.scale.setScalar(done ? 1.2 : 0.8 + 0.3 * Math.abs(Math.sin(time * 9)));
  }
}
