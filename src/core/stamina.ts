// แรงของตัวละคร · คิดตามการออกแรงจริงของคน (พี่กันสั่ง "คำนวณแรงตามการออกแรงจริงของมนุษย์")
// หน่วยแรง 0 ถึง 100 · ค่าใช้แรงต่อวินาทีเทียบจากการใช้พลังงานคนจริง (เดินราบเบามาก วิ่งหนัก ปีนหนักที่สุด)

export type Activity = 'idle' | 'walk' | 'run' | 'swim' | 'climb' | 'fall';

export const STAMINA = {
  max: 100,
  /** ใช้แรงต่อวินาที */
  cost: { idle: 0, walk: 0, run: 7, swim: 4.5, climb: 6, fall: 0 } as Record<Activity, number>,
  /** เดินขึ้นเนิน ใช้แรงเพิ่มตามความชัน (ต่อความชัน 100%) */
  uphill: 9,
  /** กระโดดหนึ่งครั้ง */
  jump: 8,
  /** ฟื้นแรงต่อวินาที */
  recover: { idle: 14, walk: 7 },
  /** หยุดใช้แรงแล้วรอกี่วินาทีก่อนเริ่มฟื้น */
  recoverDelay: 0.8,
  /** แบกเกิน 70% ของที่แบกไหว เดินราบก็เหนื่อย (ต่อวินาที ที่แบกเต็ม) */
  heavyWalk: 4,
  /** แรงหมดแล้วต้องฟื้นถึงเท่านี้ก่อนวิ่งได้อีก */
  exhaustedUntil: 25,
} as const;

export interface StaminaState {
  value: number;
  /** หมดแรงอยู่ วิ่งและกระโดดไม่ได้จนกว่าจะฟื้นถึงเกณฑ์ */
  exhausted: boolean;
  sinceUse: number;
}

export function newStamina(): StaminaState {
  return { value: STAMINA.max, exhausted: false, sinceUse: 99 };
}

/**
 * คิดแรงหนึ่งก้าวเวลา
 * @param grade ความชันที่กำลังเดินขึ้น (0 = ราบ, 1 = ขึ้น 45 องศา) ติดลบ = ลงเนิน
 * @param loadRatio น้ำหนักที่แบก ÷ น้ำหนักที่รับได้ (0 ถึง 1 ขึ้นไป) ยิ่งหนักยิ่งเหนื่อยไว
 */
export function stepStamina(s: StaminaState, dt: number, act: Activity, grade: number, loadRatio: number): void {
  const load = 1 + Math.max(0, loadRatio) * 0.9;
  let cost = STAMINA.cost[act];
  if ((act === 'walk' || act === 'run') && grade > 0) cost += STAMINA.uphill * grade * (act === 'run' ? 1.6 : 1);
  if (act === 'walk' && loadRatio > 0.7) cost += STAMINA.heavyWalk * Math.min(1, (loadRatio - 0.7) / 0.3);
  cost *= load;
  if (cost > 0.01) {
    s.value -= cost * dt;
    s.sinceUse = 0;
  } else {
    s.sinceUse += dt;
    if (s.sinceUse > STAMINA.recoverDelay) {
      const r = act === 'idle' ? STAMINA.recover.idle : act === 'walk' ? STAMINA.recover.walk : 0;
      s.value += (r / load) * dt;
    }
  }
  clamp(s);
}

export function spendJump(s: StaminaState, loadRatio: number): boolean {
  if (s.exhausted || s.value < 3) return false;
  s.value -= STAMINA.jump * (1 + Math.max(0, loadRatio) * 0.9);
  s.sinceUse = 0;
  clamp(s);
  return true;
}

function clamp(s: StaminaState): void {
  if (s.value <= 0) {
    s.value = 0;
    s.exhausted = true;
  }
  if (s.value > STAMINA.max) s.value = STAMINA.max;
  if (s.exhausted && s.value >= STAMINA.exhaustedUntil) s.exhausted = false;
}
