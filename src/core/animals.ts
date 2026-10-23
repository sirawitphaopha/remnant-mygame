// สัตว์ 14 ชนิด · นิสัยต่อผู้เล่น และผลของหมึก (ต้องสแกนก่อนถึงรู้) · กติกาล้วน
// พี่กันเคาะ: ส่วนใหญ่ขี้กลัว มีตัวดุไม่กี่ชนิดอยู่ป่าลึก · หมึกไม่ทำให้ตาย บางตัวตกใจ บางตัวเฉย บางตัวดุกว่าเดิม หมึกเหนียวทำให้ช้าลง
// ถิ่น เวลาออกหากิน ฝูง อาหาร อยู่ในระบบนิเวศ core/ecology.ts (รอบสอง ช่วง 12) · ปลาอยู่ในระบบฝูงปลา render/Fish.ts

export type InkReaction = 'flee' | 'ignore' | 'enraged';
/** walk เดิน · fly บิน · hop กระโดด · flutter ผีเสื้อ · glow หิ่งห้อย · climb ปีนต้นไม้ (กระรอก) · flock บินเป็นฝูง (นกกิ้งโครง) · buzz บินวนดอกไม้ (ผึ้ง) */
export type Movement = 'walk' | 'fly' | 'hop' | 'flutter' | 'glow' | 'climb' | 'flock' | 'buzz';

export interface Species {
  id: string;
  move: Movement;
  speed: number;
  /** เข้าใกล้เท่านี้แล้ววิ่งหนี (0 = ไม่หนี) */
  flee: number;
  /** เข้าใกล้เท่านี้แล้วไล่ทำร้าย (0 = ไม่ดุ) */
  aggro: number;
  ink: InkReaction;
  /** ความสูงลำตัวไว้เล็งสแกน */
  height: number;
  /** รัศมีตัวชน (ชนต้นไม้ หิน ตึก เหมือนผู้เล่น) */
  radius: number;
}

export const SPECIES: Species[] = [
  { id: 'deer', move: 'walk', speed: 7, flee: 22, aggro: 0, ink: 'flee', height: 1.1, radius: 0.4 },
  { id: 'rabbit', move: 'hop', speed: 6, flee: 12, aggro: 0, ink: 'flee', height: 0.25, radius: 0.15 },
  { id: 'fox', move: 'walk', speed: 6, flee: 8, aggro: 0, ink: 'ignore', height: 0.45, radius: 0.25 },
  { id: 'crow', move: 'fly', speed: 8, flee: 10, aggro: 0, ink: 'flee', height: 0, radius: 0.15 },
  { id: 'eagle', move: 'fly', speed: 10, flee: 0, aggro: 0, ink: 'ignore', height: 0, radius: 0.3 },
  { id: 'frog', move: 'hop', speed: 3, flee: 3, aggro: 0, ink: 'ignore', height: 0.12, radius: 0.08 },
  { id: 'butterfly', move: 'flutter', speed: 1.5, flee: 0, aggro: 0, ink: 'ignore', height: 0, radius: 0 },
  { id: 'firefly', move: 'glow', speed: 0.6, flee: 0, aggro: 0, ink: 'ignore', height: 0, radius: 0 },
  { id: 'owl', move: 'fly', speed: 6, flee: 9, aggro: 0, ink: 'flee', height: 0, radius: 0.2 },
  { id: 'wolf', move: 'walk', speed: 4.6, flee: 0, aggro: 24, ink: 'ignore', height: 0.7, radius: 0.35 },
  { id: 'bear', move: 'walk', speed: 4.6, flee: 0, aggro: 18, ink: 'enraged', height: 1.2, radius: 0.6 },
  { id: 'starling', move: 'flock', speed: 11, flee: 14, aggro: 0, ink: 'flee', height: 0, radius: 0 },
  { id: 'squirrel', move: 'climb', speed: 5, flee: 9, aggro: 0, ink: 'flee', height: 0.15, radius: 0.1 },
  { id: 'bee', move: 'buzz', speed: 3, flee: 0, aggro: 0, ink: 'ignore', height: 0, radius: 0 },
];

export const SPECIES_BY_ID = new Map(SPECIES.map((s) => [s.id, s]));

/** โดนหมึก: เหนียวจนช้าลงกี่วินาที และช้าลงเหลือเท่าไร */
export const INK = { stickySeconds: 8, slowTo: 0.35, enragedBoost: 1.25, fleeSeconds: 10, enragedSeconds: 30 } as const;

/** ไล่แล้วไม่เกินระยะนี้จากที่อยู่ จะเลิกไล่กลับไป */
export const LEASH = 45;
/** ตีหนึ่งครั้งแล้วรอกี่วินาทีก่อนตีอีก */
export const ATTACK_COOLDOWN = 1.4;
export const ATTACK_RANGE = 1.7;

export interface AnimalMind {
  mode: 'wander' | 'flee' | 'chase' | 'return';
  /** เหนียวหมึกเหลือกี่วินาที */
  sticky: number;
  /** ตกใจวิ่งหนีเหลือกี่วินาที */
  scared: number;
  enraged: boolean;
  /** ดุเพราะหมึกเหลือกี่วินาที (หมดแล้วกลับมาเคารพระยะกลับบ้าน) */
  rage: number;
  cooldown: number;
}

export function newMind(): AnimalMind {
  return { mode: 'wander', sticky: 0, scared: 0, enraged: false, rage: 0, cooldown: 0 };
}

/** โดนหมึก */
export function inkHit(m: AnimalMind, s: Species): void {
  m.sticky = INK.stickySeconds;
  if (s.ink === 'flee') { m.scared = INK.fleeSeconds; m.mode = 'flee'; }
  if (s.ink === 'enraged') { m.enraged = true; m.rage = INK.enragedSeconds; }
}

/** ความเร็วตอนนี้ (หมึกเหนียวทำให้ช้า ดุขึ้นเร็วขึ้น) */
export function currentSpeed(m: AnimalMind, _s: Species, base: number): number {
  let v = base;
  if (m.enraged) v *= INK.enragedBoost;
  if (m.sticky > 0) v *= INK.slowTo;
  return v;
}

/**
 * ตัดสินใจหนึ่งก้าว: หนี ไล่ เดินเล่น หรือกลับบ้าน
 * @param dist ระยะถึงผู้เล่น · fromHome ระยะจากที่อยู่
 */
export function decide(m: AnimalMind, s: Species, dt: number, dist: number, fromHome: number): AnimalMind['mode'] {
  m.sticky = Math.max(0, m.sticky - dt);
  m.scared = Math.max(0, m.scared - dt);
  m.cooldown = Math.max(0, m.cooldown - dt);
  if (m.enraged) {
    m.rage = Math.max(0, m.rage - dt);
    if (m.rage <= 0) m.enraged = false;
  }
  const aggro = s.aggro * (m.enraged ? 1.5 : 1);
  if (m.scared > 0) return (m.mode = 'flee');
  if (aggro > 0) {
    if (fromHome > LEASH && !m.enraged) return (m.mode = 'return');
    if (dist < aggro) return (m.mode = 'chase');
    if (m.mode === 'chase' && dist < aggro * 1.6) return m.mode;
    return (m.mode = fromHome > 15 ? 'return' : 'wander');
  }
  if (s.flee > 0 && dist < s.flee) return (m.mode = 'flee');
  if (m.mode === 'flee' && dist < s.flee * 2.2) return m.mode;
  return (m.mode = 'wander');
}

/**
 * ความเร็วที่อยากวิ่งตอนไล่ · ถึงระยะตีแล้วหยุด ไม่วิ่งทับตัวผู้เล่นแล้วหมุนไปมา (รายงานตรวจข้อ 100)
 * ช่วงใกล้ระยะตีค่อย ๆ ผ่อนความเร็ว
 */
export function chaseWant(dist: number, speed: number, stopAt = ATTACK_RANGE * 0.8): number {
  if (dist <= stopAt) return 0;
  return speed * Math.min(1, (dist - stopAt) / 1.5);
}
