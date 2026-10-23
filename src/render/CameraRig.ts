import * as THREE from 'three';

export interface CameraTarget {
  x: number;
  y: number;
  z: number;
  heading: number;
  speed: number;
  running: boolean;
}

/** กล้องบุคคลที่สาม · ช่วง 0 ตามหลังแบบง่าย ช่วง 3 ทำเป็นแบบ RDR2 */
export class CameraRig {
  yaw = 0;
  pitch = -0.15;
  private pos = new THREE.Vector3();
  private look = new THREE.Vector3();

  constructor(public camera: THREE.PerspectiveCamera) {}

  rotate(dx: number, dy: number, sensitivity = 0.0022): void {
    this.yaw -= dx * sensitivity;
    this.pitch = Math.max(-1.2, Math.min(0.9, this.pitch - dy * sensitivity));
  }

  update(dt: number, t: CameraTarget): void {
    const dist = 4.2;
    const cx = t.x + Math.sin(this.yaw) * Math.cos(this.pitch) * dist;
    const cz = t.z + Math.cos(this.yaw) * Math.cos(this.pitch) * dist;
    const cy = t.y + 1.6 - Math.sin(this.pitch) * dist;
    const k = 1 - Math.exp(-dt * 12);
    this.pos.lerp(new THREE.Vector3(cx, cy, cz), k);
    this.look.set(t.x, t.y + 1.5, t.z);
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);
  }

  /** ทิศหน้าของกล้องบนพื้นราบ ใช้แปลงปุ่ม WASD เป็นทิศในโลก */
  forward(): { x: number; z: number } {
    return { x: -Math.sin(this.yaw), z: -Math.cos(this.yaw) };
  }

  snap(t: CameraTarget): void {
    this.yaw = t.heading;
    this.pos.set(t.x + Math.sin(this.yaw) * 4.2, t.y + 2.2, t.z + Math.cos(this.yaw) * 4.2);
  }
}
