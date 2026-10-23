import * as THREE from 'three';
import type { CircleColliders } from '../world/colliders';

export interface CameraTarget {
  x: number;
  y: number;
  z: number;
  heading: number;
  speed: number;
  running: boolean;
  state: 'ground' | 'air' | 'swim' | 'climb';
  stepPhase: number;
}

export interface CameraWorld {
  heightAt(x: number, z: number): number;
  colliders?: CircleColliders;
  /** ชนกำแพงตึกหรือถ้ำ (ช่วง 8) · คืนสัดส่วนระยะที่ชน 1 = ไม่ชน */
  blockers?: (from: THREE.Vector3, to: THREE.Vector3) => number;
}

/** ค่ากล้องทั้งหมด · ยกแบบ Red Dead Redemption 2 */
export const CAM = {
  pivotHeight: 1.55,
  shoulder: 0.58,
  aimShoulder: 0.5,
  dist: { walk: 3.3, run: 4.1, aim: 1.55, swim: 3.8, climb: 4.4 },
  fov: { walk: 58, run: 65, aim: 46 },
  /** ปล่อยเมาส์นานเท่านี้แล้วเดินอยู่ กล้องค่อย ๆ หมุนกลับไปข้างหลัง */
  recenterAfter: 1.6,
  recenterRate: 1.1,
  bob: { walk: 0.018, run: 0.045 },
};

/**
 * กล้องบุคคลที่สามแบบ RDR2
 * ตามหลังเยื้องไหล่ขวา (ตัวละครค่อนซ้าย) · ตามแบบหน่วง · ปล่อยเมาส์แล้วหมุนกลับข้างหลังเอง
 * วิ่งถอยห่างมุมกว้าง · เล็งซูมชิดไหล่ สลับไหล่ได้ · ไม่ทะลุพื้น ต้นไม้ หิน กำแพง · โยกตามก้าว
 */
export class CameraRig {
  yaw = 0;
  pitch = -0.12;
  /** 1 = ไหล่ขวา -1 = ไหล่ซ้าย */
  side = 1;
  aim = 0;
  private dist = CAM.dist.walk;
  private shoulderNow = CAM.shoulder;
  private pivot = new THREE.Vector3();
  private pos = new THREE.Vector3();
  private hit = 1;
  private tmpA = new THREE.Vector3();
  private tmpB = new THREE.Vector3();

  constructor(public camera: THREE.PerspectiveCamera) {}

  rotate(dx: number, dy: number, sensitivity = 0.0022): void {
    this.yaw -= dx * sensitivity;
    this.pitch = Math.max(-1.25, Math.min(0.85, this.pitch - dy * sensitivity));
  }

  swapShoulder(): void {
    this.side = -this.side;
  }

  /** ทิศหน้าของกล้องบนพื้นราบ ใช้แปลงปุ่ม WASD เป็นทิศในโลก */
  forward(): { x: number; z: number } {
    return { x: -Math.sin(this.yaw), z: -Math.cos(this.yaw) };
  }

  /** ทิศที่กล้องมอง (ใช้เล็งสแกน) */
  viewDir(out = new THREE.Vector3()): THREE.Vector3 {
    return out.set(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
  }

  snap(t: CameraTarget): void {
    this.yaw = t.heading;
    this.pivot.set(t.x, t.y + CAM.pivotHeight, t.z);
    this.pos.copy(this.pivot).add(new THREE.Vector3(Math.sin(this.yaw), 0.4, Math.cos(this.yaw)).multiplyScalar(this.dist));
  }

  update(dt: number, t: CameraTarget, world: CameraWorld, aiming: boolean, mouseIdle: number): void {
    const cam = this.camera;
    this.aim += ((aiming ? 1 : 0) - this.aim) * Math.min(1, dt * 9);

    // หมุนกลับไปข้างหลังเองเมื่อปล่อยเมาส์และกำลังเดิน
    if (mouseIdle > CAM.recenterAfter && t.speed > 0.6 && !aiming && t.state !== 'climb') {
      let d = t.heading - this.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yaw += d * Math.min(1, CAM.recenterRate * dt * Math.min(1, t.speed / 2));
      this.pitch += (-0.12 - this.pitch) * Math.min(1, dt * 0.6);
    }

    // จุดหมุนตามตัวละครแบบหน่วง (แนวตั้งหน่วงกว่า กล้องไม่เด้งตามก้าว)
    const py = t.y + (t.state === 'swim' ? CAM.pivotHeight + 0.35 : CAM.pivotHeight);
    this.pivot.x += (t.x - this.pivot.x) * (1 - Math.exp(-dt * 14));
    this.pivot.z += (t.z - this.pivot.z) * (1 - Math.exp(-dt * 14));
    this.pivot.y += (py - this.pivot.y) * (1 - Math.exp(-dt * 8));

    const base = t.state === 'swim' ? CAM.dist.swim : t.state === 'climb' ? CAM.dist.climb : t.running ? CAM.dist.run : CAM.dist.walk;
    const wantDist = base + (CAM.dist.aim - base) * this.aim;
    this.dist += (wantDist - this.dist) * (1 - Math.exp(-dt * (wantDist < this.dist ? 7 : 2.5)));
    const wantShoulder = (CAM.shoulder + (CAM.aimShoulder - CAM.shoulder) * this.aim) * this.side;
    this.shoulderNow += (wantShoulder - this.shoulderNow) * (1 - Math.exp(-dt * 6));
    const wantFov = (t.running ? CAM.fov.run : CAM.fov.walk) * (1 - this.aim) + CAM.fov.aim * this.aim;
    cam.fov += (wantFov - cam.fov) * (1 - Math.exp(-dt * 4));
    cam.updateProjectionMatrix();

    const cy = Math.cos(this.pitch);
    const rightX = Math.cos(this.yaw);
    const rightZ = -Math.sin(this.yaw);
    const shoulderPt = this.tmpA.set(this.pivot.x + rightX * this.shoulderNow, this.pivot.y, this.pivot.z + rightZ * this.shoulderNow);
    const want = this.tmpB.set(
      shoulderPt.x + Math.sin(this.yaw) * cy * this.dist,
      shoulderPt.y - Math.sin(this.pitch) * this.dist,
      shoulderPt.z + Math.cos(this.yaw) * cy * this.dist,
    );

    // กล้องไม่ทะลุ: เดินตามเส้นจากไหล่ไปหากล้อง หาจุดชนแรก
    let hit = 1;
    const steps = 14;
    for (let i = 1; i <= steps; i++) {
      const f = i / steps;
      const x = shoulderPt.x + (want.x - shoulderPt.x) * f;
      const y = shoulderPt.y + (want.y - shoulderPt.y) * f;
      const z = shoulderPt.z + (want.z - shoulderPt.z) * f;
      if (y < world.heightAt(x, z) + 0.35) { hit = Math.max(0, f - 1 / steps); break; }
    }
    if (world.colliders) hit = Math.min(hit, world.colliders.segment(shoulderPt.x, shoulderPt.z, shoulderPt.y, want.x, want.z, want.y, world.heightAt, 0.3));
    if (world.blockers) hit = Math.min(hit, world.blockers(shoulderPt, want));
    // ชนแล้วขยับเข้าทันที พ้นแล้วค่อย ๆ ถอยกลับ
    this.hit = hit < this.hit ? hit : this.hit + (hit - this.hit) * (1 - Math.exp(-dt * 3));
    const f = Math.max(0.12, this.hit * 0.95);
    this.pos.set(shoulderPt.x + (want.x - shoulderPt.x) * f, shoulderPt.y + (want.y - shoulderPt.y) * f, shoulderPt.z + (want.z - shoulderPt.z) * f);

    // โยกตามจังหวะก้าว
    const bobAmp = t.state === 'ground' ? (t.running ? CAM.bob.run : CAM.bob.walk) * Math.min(1, t.speed / 1.5) : 0;
    const bob = Math.sin(t.stepPhase * 2) * bobAmp;
    const sway = Math.cos(t.stepPhase) * bobAmp * 0.6;

    cam.position.set(this.pos.x + rightX * sway, this.pos.y + bob, this.pos.z + rightZ * sway);
    const v = this.viewDir();
    cam.lookAt(cam.position.x + v.x * 20, cam.position.y + v.y * 20, cam.position.z + v.z * 20);
  }
}
