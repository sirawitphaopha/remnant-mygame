import { MOVE, WORLD } from '../config/game';
import { HERO } from '../config/scale';
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
/** ไถล: แรงต้าน (ต่อวินาที) กับความเร็วสูงสุด */
const SLIDE = { drag: 0.35, maxSpeed: 12 } as const;
const TOP_NY = 0.8;
/** น้ำลึกเกินนี้ต้องว่าย */
const SWIM_DEPTH = HERO.swimDepth;

export interface SlopeGround extends Ground {
  normalAt(x: number, z: number): [number, number, number];
  /** ความสูงเท้าตอนเริ่มเฟรม ให้พื้นรู้ว่าอยู่ในถ้ำหรือบนหลังคา */
  contextY?: number;
  /** ตรงนั้นเป็นผนังถ้ำหรือหิน เดินเข้าไปไม่ได้ ปีนไม่ได้ */
  blocked?(x: number, z: number): boolean;
  /** ดันออกจากผนังตึก · คืนกล่องที่ชน (ไว้เริ่มปีนผนังตึก) */
  pushOut?(x: number, z: number, r: number, feetY: number): { x: number; z: number; hit: { y1: number } | null };
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
  /** กำลังปีนผนังตึก (ยอดผนังสูงเท่านี้) · null = ปีนหน้าผาธรรมชาติ */
  private wallTop: number | null = null;
  private wallDir: [number, number] = [0, 0];
  /** ไถลที่เริ่มจากเดินลงเนินเอง (ไม่ได้ตกจากที่สูง) คิดเจ็บจากความเร็วตอนจบ ไม่ใช่ความสูงทั้งเนิน */
  private slideFromWalk = false;
  /** ปีนมานานแค่ไหน (เพิ่งแตะผนังยังไม่นับว่าถึงยอด) */
  private climbTime = 0;

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
    // ล้างสถานะการเคลื่อนที่ทั้งหมด (เดิมตายระหว่างไถลแล้วเกิดใหม่ เฟรมแรกนับเป็นตก 40 ม. ตายซ้ำที่ยาน)
    this.sliding = false;
    this.slideFromWalk = false;
    this.fallTop = this.y;
    this.lastFall = 0;
    this.wallTop = null;
    this.activity = 'idle';
    this.stepPhase = 0;
    this.grade = 0;
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
    this.ground.contextY = this.y;

    if (this.state === 'climb' && this.wallTop !== null) this.updateWallClimb(dt, intent, dirX, dirZ, len);
    else if (this.state === 'climb') this.updateClimb(dt, intent, dirX, dirZ, len);
    else this.updateMove(dt, intent, dirX, dirZ, len, canRun);

    stepStamina(st, dt, this.activity, this.grade, intent.loadRatio);
    this.speed = Math.hypot(this.vx, this.vz);
    this.stepPhase += dt * (this.state === 'climb' ? 2.2 : this.speed * 1.9);
    // หัว (กลางโหลแก้ว) ตอนว่ายกับตอนยืน (src/config/scale.ts)
    const headY = this.y + (this.state === 'swim' ? HERO.swimHeadHeight : HERO.headHeight);
    this.underwater = headY < WORLD.waterLevel && this.depthAt(this.x, this.z) > 0;
  }

  private updateMove(dt: number, intent: MoveIntent, dirX: number, dirZ: number, len: number, canRun: boolean): void {
    const depth = this.depthAt(this.x, this.z);
    const inWater = depth > SWIM_DEPTH;
    if (inWater && this.state !== 'air') {
      // ไถลหรือตกลงน้ำ: จบการไถล ไม่นับเป็นตก (เดิมไถลลงน้ำแล้วบังคับทิศไม่ได้ ขึ้นฝั่งโดนนับว่าตก)
      if (this.state !== 'swim') { this.sliding = false; this.lastFall = 0; }
      this.state = 'swim';
    }
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
      if (depth > HERO.wadeDepth) want *= 0.6; // ลุยน้ำเกินเข่าช้าลง
      // ยิ่งหนักยิ่งเดินช้า (DESIGN 7.5) แบกเกินครึ่งเริ่มช้า แบกเต็มช้าลง 30%
      want *= 1 - 0.3 * Math.max(0, Math.min(1, (intent.loadRatio - 0.5) / 0.5));
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
    // ชนขอบแมพ: ความเร็วแกนนั้นเป็นศูนย์ (เดิมไถลติดขอบแล้วความเร็วโตไม่หยุด)
    if (nx !== this.x + this.vx * dt) this.vx = 0;
    if (nz !== this.z + this.vz * dt) this.vz = 0;

    // ผนังถ้ำหรือในหิน: ไปต่อไม่ได้
    if (this.ground.blocked?.(nx, nz)) {
      nx = this.x;
      nz = this.z;
      this.vx *= 0.2;
      this.vz *= 0.2;
    }
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
      const res = this.colliders.push(nx, nz, MOVE.radius, (c) => feet - (c.y0 ?? this.ground.heightAt(c.x, c.z)));
      nx = res.x;
      nz = res.z;
    }
    if (this.ground.pushOut) {
      const res = this.ground.pushOut(nx, nz, MOVE.radius, this.y);
      // ชนผนังตึกขณะถือที่ปีนป่ายและดันเข้าหา = เริ่มปีนผนังตึก
      if (res.hit && intent.climbGear && len > 0.01 && this.state === 'ground' && res.hit.y1 > this.y + 1.2) {
        this.state = 'climb';
        this.wallTop = res.hit.y1;
        this.wallDir = [dirX, dirZ];
        this.x = res.x;
        this.z = res.z;
        this.vx = this.vz = this.vy = 0;
        this.heading = Math.atan2(-dirX, -dirZ);
        return;
      }
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
      const surfaceY = WORLD.waterLevel - HERO.swimFloat;
      if (this.sinking) this.y = Math.max(floor, Math.min(this.y, surfaceY) - 0.45 * dt);
      else this.y += (surfaceY - this.y) * Math.min(1, 4 * dt);
      this.vy = 0;
      this.activity = this.sinking ? 'fall' : len > 0.01 ? 'swim' : 'swim';
      return;
    }

    // ยืนบนผนังชันไม่ได้ (หลุดจากการปีน หรือตกลงบนเนินชัน) = ไถลลงตามเนินจนถึงที่ราบ
    const nHere = this.ground.normalAt(nx, nz);
    if (this.state === 'ground' && nHere[1] < WALKABLE_NY) {
      if (!this.sliding) { this.sliding = true; this.slideFromWalk = true; this.fallTop = Math.max(this.y, floor); }
      const hl = Math.hypot(nHere[0], nHere[2]) || 1;
      const g = MOVE.gravity * (1 - nHere[1]) * 1.6;
      this.vx += (nHere[0] / hl) * g * dt;
      this.vz += (nHere[2] / hl) * g * dt;
      // แรงต้านพื้นกับความเร็วสูงสุดตอนไถล
      const drag = Math.max(0, 1 - SLIDE.drag * dt);
      this.vx *= drag;
      this.vz *= drag;
      const sv = Math.hypot(this.vx, this.vz);
      if (sv > SLIDE.maxSpeed) { this.vx *= SLIDE.maxSpeed / sv; this.vz *= SLIDE.maxSpeed / sv; }
      this.y = floor;
      this.activity = 'fall';
      return;
    }
    if (this.sliding && this.state === 'ground') {
      this.sliding = false;
      // ไถลเพราะเดินลงเนินเอง: เจ็บเท่ากับตกจากความสูงที่ให้ความเร็วเท่านี้ (v² / 2g) · ไถลต่อจากการตก: นับความสูงรวม
      const v = Math.hypot(this.vx, this.vz);
      this.lastFall = this.slideFromWalk ? (v * v) / (2 * MOVE.gravity) : this.fallTop - floor;
      this.slideFromWalk = false;
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
        if (this.ground.normalAt(this.x, this.z)[1] < WALKABLE_NY) { this.sliding = true; this.slideFromWalk = false; }
        else this.lastFall = this.fallTop - floor;
        this.state = this.depthAt(this.x, this.z) > SWIM_DEPTH ? 'swim' : 'ground';
        if (this.state === 'swim') this.lastFall = 0; // ตกลงน้ำไม่เจ็บ
      }
      if (this.depthAt(this.x, this.z) > SWIM_DEPTH && this.y < WORLD.waterLevel - HERO.swimFloat) {
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
    this.climbTime = 0;
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
    const sp = 0.9 * len;
    // ปีนไปตามผิวผนัง: ผนังยิ่งชัน ระยะบนแผนที่ยิ่งสั้น (ส่วนที่เหลือคือขึ้นในแนวตั้ง)
    const steep = Math.max(0.08, n[1]);
    let nx = this.x + (upX * fwd + sideX * side) * sp * steep * dt;
    let nz = this.z + (upZ * fwd + sideZ * side) * sp * steep * dt;
    nx = clamp(nx, -WORLD.half + 3, WORLD.half - 3);
    nz = clamp(nz, -WORLD.half + 3, WORLD.half - 3);
    // ปีนแล้วชนหินกับต้นไม้เหมือนตอนเดิน (เดิมไต่ทะลุเนื้อหิน)
    if (this.colliders) {
      const feet = this.y;
      const res = this.colliders.push(nx, nz, MOVE.radius, (c) => feet - (c.y0 ?? this.ground.heightAt(c.x, c.z)));
      nx = res.x;
      nz = res.z;
    }
    this.climbTime += dt;
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
    // ปีนเลียบเข้าที่ราบ (ปากถ้ำ ข้างตึก) ก็ยืนได้ ไม่ค้างในท่าปีน
    if (n[1] >= TOP_NY && (this.y > this.climbStartY + 0.6 || this.climbTime > 0.4)) {
      this.state = 'ground';
      return;
    }
    // ปีนลงจนถึงพื้นราบข้างล่าง
    if (fwd < -0.3 && this.walkable(this.x - upX * 0.6, this.z - upZ * 0.6) && this.y < oldY) this.state = 'ground';
  }

  /** ปีนผนังตึกขึ้นตรง ๆ · ดันไปทางผนัง = ขึ้น ถอยหลัง = ลง ถึงยอดแล้วก้าวขึ้นหลังคา */
  private updateWallClimb(dt: number, intent: MoveIntent, dirX: number, dirZ: number, len: number): void {
    const [wx, wz] = this.wallDir;
    const fwd = len > 0.01 ? dirX * wx + dirZ * wz : 0;
    this.y += fwd * 0.9 * dt;
    this.activity = 'climb';
    this.grade = 0;
    const floor = this.ground.heightAt(this.x, this.z);
    const fall = (push: number) => {
      this.state = 'air';
      this.wallTop = null;
      this.fallTop = this.y;
      this.vx = -wx * push;
      this.vz = -wz * push;
      this.vy = push > 1 ? 2.5 : 0;
    };
    if (!intent.climbGear || this.stamina.exhausted) { fall(0.8); return; }
    if (intent.jump) { fall(2.5); return; }
    if (this.y <= floor) {
      this.y = floor;
      this.state = 'ground';
      this.wallTop = null;
      return;
    }
    if (this.y >= this.wallTop! - 0.1) {
      // ก้าวขึ้นไปยืนบนหลังคา
      this.x += wx * 0.9;
      this.z += wz * 0.9;
      this.y = this.wallTop!;
      this.state = 'ground';
      this.wallTop = null;
    }
  }

  /** ทิศผนังที่ปีนอยู่ (ไว้ให้ท่าปีนหันหน้าเข้าผนัง) */
  get wallNormal(): [number, number, number] {
    return this.wall;
  }
}

function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v;
}
