import { MOVE, WORLD } from '../config/game';
import { newStamina, spendJump, stepStamina, type Activity, type StaminaState } from '../core/stamina';
import type { CircleColliders } from '../world/colliders';
import type { Ground } from '../world/Ground';

export type MoveState = 'ground' | 'air' | 'swim' | 'climb';

export interface MoveIntent {
  /** ทิศที่อยากไป ในพิกัดโลก ยาวไม่เกิน 1 */
  x: number;
  z: number;
  run: boolean;
  jump: boolean;
  /** ถือที่ปีนป่ายอยู่ไหม */
  climbGear: boolean;
  /** น้ำหนักที่แบก ÷ น้ำหนักที่รับได้ */
  loadRatio: number;
}

/** พื้นที่ชันเกินนี้เดินขึ้นไม่ได้ ต้องปีน (ค่าแกน y ของเวกเตอร์ตั้งฉากพื้น 0.72 ≈ 44 องศา) */
const WALKABLE_NY = 0.72;
/** ปีนถึงตรงที่ราบกว่านี้ ปีนขึ้นไปยืนได้ */
const TOP_NY = 0.8;
/** น้ำลึกเกินนี้ต้องว่าย */
const SWIM_DEPTH = 1.3;

export interface SlopeGround extends Ground {
  normalAt(x: number, z: number): [number, number, number];
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
  readonly stamina: StaminaState = newStamina();
  /** หัวจมน้ำอยู่ไหม (ใช้กับออกซิเจนในช่วง 7) */
  underwater = false;
  /** กำลังจมเพราะหมดแรงตอนว่ายน้ำ */
  sinking = false;
  /** ตกลงพื้นครั้งล่าสุดจากความสูงเท่าไร (ช่วง 7 ใช้คิดโหลร้าว) · อ่านแล้วตั้งเป็น 0 */
  lastFall = 0;
  /** นับจังหวะก้าว ใช้กับท่าเดินและกล้องโยก */
  stepPhase = 0;
  private fallTop = 0;
  /** ทิศผนังที่กำลังปีน (เวกเตอร์ตั้งฉากพื้น ชี้ออกจากผนัง) */
  private wall: [number, number, number] = [0, 1, 0];
  private activity: Activity = 'idle';
  private grade = 0;
  private climbStartY = 0;
  /** กำลังไถลลงเนินชัน (หลุดจากผนังหรือตกลงบนเนินชัน) */
  sliding = false;

  constructor(private ground: SlopeGround, private colliders?: CircleColliders) {}

  place(x: number, z: number, heading: number): void {
    this.x = x;
    this.z = z;
    this.y = this.ground.heightAt(x, z);
    this.heading = heading;
    this.vx = this.vy = this.vz = 0;
    this.state = 'ground';
    this.sinking = false;
    this.underwater = false;
  }

  /** ความลึกน้ำตรงนั้น (ติดลบ = บนบก) */
  private depthAt(x: number, z: number): number {
    return WORLD.waterLevel - this.ground.heightAt(x, z);
  }

  private walkable(x: number, z: number): boolean {
    return this.ground.normalAt(x, z)[1] >= WALKABLE_NY;
  }

  update(dt: number, intent: MoveIntent): void {
    const len = Math.min(1, Math.hypot(intent.x, intent.z));
    const dirX = len > 0.01 ? intent.x / Math.hypot(intent.x, intent.z) : 0;
    const dirZ = len > 0.01 ? intent.z / Math.hypot(intent.x, intent.z) : 0;
    const st = this.stamina;
    const canRun = intent.run && !st.exhausted;

    if (this.state === 'climb') this.updateClimb(dt, intent, dirX, dirZ, len);
    else this.updateMove(dt, intent, dirX, dirZ, len, canRun);

    stepStamina(st, dt, this.activity, this.grade, intent.loadRatio);
    this.speed = Math.hypot(this.vx, this.vz);
    this.stepPhase += dt * (this.state === 'climb' ? 2.2 : this.speed * 1.9);
    // หัว (โหลแก้ว) ตอนว่ายอยู่ราว 0.9 + 0.1 ม. เหนือจุดยืน ตอนยืนอยู่ 1.75 ม.
    const headY = this.y + (this.state === 'swim' ? 1.0 : 1.75);
    this.underwater = headY < WORLD.waterLevel && this.depthAt(this.x, this.z) > 0;
  }

  private updateMove(dt: number, intent: MoveIntent, dirX: number, dirZ: number, len: number, canRun: boolean): void {
    const depth = this.depthAt(this.x, this.z);
    const inWater = depth > SWIM_DEPTH;
    if (inWater && this.state !== 'air') this.state = 'swim';
    if (!inWater && this.state === 'swim') {
      this.state = 'ground';
      this.sinking = false;
    }

    let want: number;
    if (this.state === 'swim') {
      this.sinking = this.stamina.exhausted;
      want = len > 0.01 ? (this.sinking ? 0.4 : canRun ? 1.7 : MOVE.swimSpeed) : 0;
    } else {
      want = len > 0.01 ? (canRun ? MOVE.runSpeed : MOVE.walkSpeed) : 0;
      if (depth > 0.35) want *= 0.6; // ลุยน้ำตื้นช้าลง
    }
    this.running = canRun && len > 0.01 && this.state !== 'swim';

    if (len > 0.01) {
      const target = Math.atan2(-dirX, -dirZ);
      let d = target - this.heading;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.heading += d * Math.min(1, MOVE.turnRate * dt);
    }
    const k = this.sliding ? 0 : Math.min(1, (this.state === 'air' ? 1.5 : MOVE.accel) * dt);
    this.vx += (dirX * want - this.vx) * k;
    this.vz += (dirZ * want - this.vz) * k;

    // กระโดด
    if (intent.jump && this.state === 'ground' && spendJump(this.stamina, intent.loadRatio)) {
      this.vy = MOVE.jumpSpeed;
      this.state = 'air';
      this.fallTop = this.y;
    }

    const oldFloor = this.ground.heightAt(this.x, this.z);
    let nx = clamp(this.x + this.vx * dt, -WORLD.half + 3, WORLD.half - 3);
    let nz = clamp(this.z + this.vz * dt, -WORLD.half + 3, WORLD.half - 3);

    // ชันเกินเดินขึ้นไม่ได้: ถือที่ปีนป่ายอยู่ = เริ่มปีน ไม่ถือ = ไปต่อไม่ได้
    if (this.state === 'ground' && !this.walkable(nx, nz) && this.ground.heightAt(nx, nz) > oldFloor + 0.05) {
      if (intent.climbGear && len > 0.01) {
        this.startClimb(nx, nz);
        return;
      }
      nx = this.x;
      nz = this.z;
      this.vx *= 0.2;
      this.vz *= 0.2;
    }

    if (this.colliders) {
      const feet = this.y;
      const res = this.colliders.push(nx, nz, MOVE.radius, (c) => feet - this.ground.heightAt(c.x, c.z));
      nx = res.x;
      nz = res.z;
    }
    const moved = Math.hypot(nx - this.x, nz - this.z);
    this.x = nx;
    this.z = nz;
    const floor = this.ground.heightAt(nx, nz);
    this.grade = moved > 1e-4 ? Math.max(0, (floor - oldFloor) / moved) : 0;

    if (this.state === 'swim') {
      // ว่ายแบบลำตัวนอนราบ โหลแก้วโผล่พ้นน้ำครึ่งหนึ่ง · หมดแรงแล้วค่อย ๆ จม
      const surfaceY = WORLD.waterLevel - 0.95;
      if (this.sinking) this.y = Math.max(floor, Math.min(this.y, surfaceY) - 0.45 * dt);
      else this.y += (surfaceY - this.y) * Math.min(1, 4 * dt);
      this.vy = 0;
      this.activity = this.sinking ? 'fall' : len > 0.01 ? 'swim' : 'swim';
      return;
    }

    // ยืนบนผนังชันไม่ได้ (หลุดจากการปีน หรือตกลงบนเนินชัน) = ไถลลงตามเนินจนถึงที่ราบ
    const nHere = this.ground.normalAt(nx, nz);
    if (this.state === 'ground' && nHere[1] < WALKABLE_NY) {
      if (!this.sliding) { this.sliding = true; this.fallTop = Math.max(this.y, floor); }
      const hl = Math.hypot(nHere[0], nHere[2]) || 1;
      const g = MOVE.gravity * (1 - nHere[1]) * 1.6;
      this.vx += (nHere[0] / hl) * g * dt;
      this.vz += (nHere[2] / hl) * g * dt;
      this.y = floor;
      this.activity = 'fall';
      return;
    }
    if (this.sliding && this.state === 'ground') {
      this.sliding = false;
      this.lastFall = this.fallTop - floor;
      this.vx *= 0.3;
      this.vz *= 0.3;
    }

    if (this.state === 'ground') {
      // เดินลงเนินแล้วติดพื้น ไม่ลอย · ถ้าพื้นต่ำลงมากกว่าก้าวหนึ่งคือหล่นจากขอบ
      if (floor < this.y - 0.6) {
        this.state = 'air';
        this.fallTop = this.y;
        this.vy = 0;
      } else {
        this.y = floor;
        this.vy = 0;
      }
    }
    if (this.state === 'air') {
      this.vy -= MOVE.gravity * dt;
      this.y += this.vy * dt;
      this.fallTop = Math.max(this.fallTop, this.y);
      if (this.y <= floor) {
        this.y = floor;
        this.vy = 0;
        // ตกลงบนเนินชัน: ยังไม่จบ ไถลต่อ นับความสูงรวม
        if (this.ground.normalAt(this.x, this.z)[1] < WALKABLE_NY) this.sliding = true;
        else this.lastFall = this.fallTop - floor;
        this.state = this.depthAt(this.x, this.z) > SWIM_DEPTH ? 'swim' : 'ground';
        if (this.state === 'swim') this.lastFall = 0; // ตกลงน้ำไม่เจ็บ
      }
      if (this.depthAt(this.x, this.z) > SWIM_DEPTH && this.y < WORLD.waterLevel - 0.95) {
        this.state = 'swim';
        this.lastFall = 0;
      }
    }
    this.activity = this.state === 'air' ? 'fall' : len < 0.01 ? 'idle' : this.running ? 'run' : 'walk';
  }

  private startClimb(nx: number, nz: number): void {
    this.state = 'climb';
    this.x = nx;
    this.z = nz;
    this.y = this.ground.heightAt(nx, nz);
    this.climbStartY = this.y;
    this.wall = this.ground.normalAt(nx, nz);
    this.vx = this.vz = this.vy = 0;
  }

  private updateClimb(dt: number, intent: MoveIntent, dirX: number, dirZ: number, len: number): void {
    const n = this.ground.normalAt(this.x, this.z);
    this.wall = n;
    // ทิศขึ้นผนังบนแผนที่ = ตรงข้ามกับทิศที่ผนังหันออก
    const hx = -n[0];
    const hz = -n[2];
    const hl = Math.hypot(hx, hz) || 1;
    const upX = hx / hl;
    const upZ = hz / hl;
    this.heading = Math.atan2(-upX, -upZ);
    const sideX = -upZ;
    const sideZ = upX;
    // แปลงปุ่ม: ดันไปทางผนัง = ขึ้น ถอยหลัง = ลง ซ้ายขวา = เลียบผนัง
    const fwd = dirX * upX + dirZ * upZ;
    const side = dirX * sideX + dirZ * sideZ;
    const sp = 0.7 * len;
    // ปีนไปตามผิวผนัง: ผนังยิ่งชัน ระยะบนแผนที่ยิ่งสั้น (ส่วนที่เหลือคือขึ้นในแนวตั้ง)
    const steep = Math.max(0.08, n[1]);
    let nx = this.x + (upX * fwd + sideX * side) * sp * steep * dt;
    let nz = this.z + (upZ * fwd + sideZ * side) * sp * steep * dt;
    nx = clamp(nx, -WORLD.half + 3, WORLD.half - 3);
    nz = clamp(nz, -WORLD.half + 3, WORLD.half - 3);
    const oldY = this.y;
    this.x = nx;
    this.z = nz;
    this.y = this.ground.heightAt(nx, nz);
    this.grade = 0;
    this.activity = 'climb';
    this.vx = this.vz = 0;

    const fall = (push: number) => {
      this.state = 'air';
      this.fallTop = this.y;
      this.vx = n[0] * push;
      this.vz = n[2] * push;
      this.vy = push > 1 ? 2.5 : 0;
    };
    if (!intent.climbGear || this.stamina.exhausted) { fall(0.8); return; }
    if (intent.jump) { fall(2.5); return; }
    // ถึงยอด: พื้นตรงนั้นราบพอยืนได้ (ต้องปีนขึ้นมาแล้วจริง ไม่ใช่เพิ่งแตะผนัง)
    if (n[1] >= TOP_NY && this.y > this.climbStartY + 0.6) {
      this.state = 'ground';
      return;
    }
    // ปีนลงจนถึงพื้นราบข้างล่าง
    if (fwd < -0.3 && this.walkable(this.x - upX * 0.6, this.z - upZ * 0.6) && this.y < oldY) this.state = 'ground';
  }

  /** ทิศผนังที่ปีนอยู่ (ไว้ให้ท่าปีนหันหน้าเข้าผนัง) */
  get wallNormal(): [number, number, number] {
    return this.wall;
  }
}

function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v;
}
