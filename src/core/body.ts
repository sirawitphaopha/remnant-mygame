// ร่างกาย: ออกซิเจนในโหล รอยร้าว ความหนาว ความตาย · กติกาล้วน
// พี่กันเคาะ: ตายได้ 5 แบบ ตกที่สูง · จมน้ำ · ออกซิเจนหมดในถ้ำ · สัตว์ดุ · หนาว

export type DeathCause = 'fall' | 'drown' | 'gas' | 'animal' | 'cold';

export const BODY = {
  /** ออกซิเจนในโหลหมดภายในกี่วินาทีตอนอยู่ใต้น้ำหรือในก๊าซพิษ */
  oxygenSeconds: 45,
  /** กลับขึ้นที่โล่งแล้วเติมเต็มภายในกี่วินาที */
  oxygenRefillSeconds: 8,
  /** โหลร้าวกี่จุดแล้วแตก */
  maxCracks: 4,
  /** ตกสูงเท่านี้ขึ้นไปเริ่มร้าว (เมตร) · ราวตึก 2 ชั้น */
  crackFrom: 5,
  /** ตกสูงเท่านี้ร้าวเพิ่มอีกจุด */
  crackMore: 10,
  /** ตกสูงเท่านี้ขึ้นไปโหลแตก (ราวตึก 5 ชั้น) */
  shatterFrom: 15,
  /** อยู่กลางคืนที่หนาวที่สุดโดยไม่อุ่นกี่วินาทีถึงหนาวตาย */
  freezeSeconds: 170,
  /** อุ่นเต็มภายในกี่วินาทีเมื่ออยู่ใกล้ยานหรือใต้หลังคา */
  warmSeconds: 20,
} as const;

export interface BodyEnv {
  /** หัวจมน้ำ */
  underwater: boolean;
  /** อยู่ในก๊าซพิษในถ้ำลึก */
  gas: boolean;
  /** ความหนาวรอบตัว 0 = ไม่หนาว 1 = หนาวที่สุด */
  cold: number;
  /** ที่อุ่น: ใกล้ยาน ใต้หลังคา */
  shelter: boolean;
}

export class Body {
  oxygen = 1;
  cracks = 0;
  /** ความอุ่น 1 = ปกติ 0 = หนาวตาย */
  warmth = 1;
  dead: DeathCause | null = null;
  /** เพิ่งเจ็บ (ใช้ทำขอบจอแดงวาบ) ค่อย ๆ จางลง */
  hurt = 0;
  /** ออกซิเจนกำลังลดอยู่ไหม (แถบออกซิเจนโผล่เฉพาะตอนนี้) */
  draining = false;

  reset(): void {
    this.oxygen = 1;
    this.cracks = 0;
    this.warmth = 1;
    this.dead = null;
    this.hurt = 0;
    this.draining = false;
  }

  update(dt: number, env: BodyEnv): void {
    if (this.dead) return;
    this.hurt = Math.max(0, this.hurt - dt * 0.8);
    // ออกซิเจน: เครื่องกรองดึงจากอากาศเติมน้ำในโหล · ใต้น้ำกับก๊าซพิษดึงไม่ได้
    this.draining = env.underwater || env.gas;
    if (this.draining) this.oxygen -= dt / BODY.oxygenSeconds;
    else this.oxygen += dt / BODY.oxygenRefillSeconds;
    // โหลร้าวรั่วนิด ๆ
    if (this.cracks > 0 && this.draining) this.oxygen -= (dt * this.cracks) / 400;
    this.oxygen = Math.max(0, Math.min(1, this.oxygen));
    if (this.oxygen <= 0) {
      this.dead = env.gas && !env.underwater ? 'gas' : 'drown';
      return;
    }
    // ความหนาว
    if (env.shelter) this.warmth += dt / BODY.warmSeconds;
    else if (env.cold > 0.05) this.warmth -= (dt * env.cold) / BODY.freezeSeconds;
    else this.warmth += dt / (BODY.warmSeconds * 3);
    this.warmth = Math.max(0, Math.min(1, this.warmth));
    if (this.warmth <= 0) this.dead = 'cold';
  }

  /** ตกลงพื้นจากความสูงเท่านี้ · คืนจำนวนรอยร้าวที่เพิ่ม */
  fall(height: number): number {
    if (this.dead || height < BODY.crackFrom) return 0;
    if (height >= BODY.shatterFrom) {
      this.cracks = BODY.maxCracks;
      this.dead = 'fall';
      this.hurt = 1;
      return BODY.maxCracks;
    }
    const add = height >= BODY.crackMore ? 2 : 1;
    this.addCracks(add, 'fall');
    return add;
  }

  /** โดนสัตว์ทำร้าย */
  hit(cracks = 1): void {
    this.addCracks(cracks, 'animal');
  }

  private addCracks(n: number, cause: DeathCause): void {
    this.cracks = Math.min(BODY.maxCracks, this.cracks + n);
    this.hurt = 1;
    if (this.cracks >= BODY.maxCracks) this.dead = cause;
  }

  /** ปืนกาวอุดรอยร้าวหนึ่งจุด */
  seal(): boolean {
    if (this.cracks <= 0 || this.dead) return false;
    this.cracks--;
    return true;
  }

  /** ถังออกซิเจนเติมโหล */
  refill(amount = 1): boolean {
    if (this.oxygen >= 0.995 || this.dead) return false;
    this.oxygen = Math.min(1, this.oxygen + amount);
    return true;
  }
}
