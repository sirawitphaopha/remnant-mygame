import { MOVE, WORLD } from '../config/game';
import type { Ground } from '../world/Ground';

export type MoveState = 'ground' | 'air' | 'swim' | 'climb';

export interface MoveIntent {
  /** ทิศที่อยากไป ในพิกัดโลก ยาวไม่เกิน 1 */
  x: number;
  z: number;
  run: boolean;
  jump: boolean;
}

/** ตำแหน่งและการเคลื่อนที่ของตัวละคร · ไม่แตะภาพ */
export class Player {
  x = 0;
  y = 0;
  z = 0;
  vx = 0;
  vy = 0;
  vz = 0;
  /** ทิศที่ตัวละครหันหน้า (เรเดียน 0 = หันไป -z) */
  heading = 0;
  state: MoveState = 'ground';
  /** ความเร็วแนวราบตอนนี้ ใช้กับท่าเดินและกล้อง */
  speed = 0;
  running = false;

  constructor(private ground: Ground) {}

  place(x: number, z: number, heading: number): void {
    this.x = x;
    this.z = z;
    this.y = this.ground.heightAt(x, z);
    this.heading = heading;
    this.vx = this.vy = this.vz = 0;
    this.state = 'ground';
  }

  update(dt: number, intent: MoveIntent): void {
    const len = Math.hypot(intent.x, intent.z);
    const want = len > 0.01 ? (intent.run ? MOVE.runSpeed : MOVE.walkSpeed) : 0;
    this.running = intent.run && len > 0.01;
    const dirX = len > 0.01 ? intent.x / len : 0;
    const dirZ = len > 0.01 ? intent.z / len : 0;

    // หันตัวตามทิศที่เดินแบบนุ่ม
    if (len > 0.01) {
      const target = Math.atan2(-dirX, -dirZ);
      let d = target - this.heading;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.heading += d * Math.min(1, MOVE.turnRate * dt);
    }

    const k = Math.min(1, MOVE.accel * dt);
    this.vx += (dirX * want - this.vx) * k;
    this.vz += (dirZ * want - this.vz) * k;

    if (this.state === 'ground' && intent.jump) {
      this.vy = MOVE.jumpSpeed;
      this.state = 'air';
    }
    this.vy -= MOVE.gravity * dt;

    this.x = clamp(this.x + this.vx * dt, -WORLD.half + 2, WORLD.half - 2);
    this.z = clamp(this.z + this.vz * dt, -WORLD.half + 2, WORLD.half - 2);
    this.y += this.vy * dt;

    const floor = this.ground.heightAt(this.x, this.z);
    if (this.y <= floor) {
      this.y = floor;
      this.vy = 0;
      this.state = 'ground';
    }
    this.speed = Math.hypot(this.vx, this.vz);
  }
}

function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v;
}
