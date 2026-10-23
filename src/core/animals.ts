// สัตว์ 12 ชนิด · นิสัย ที่อยู่ เวลา และผลของหมึก (ต้องสแกนก่อนถึงรู้) · กติกาล้วน
// พี่กันเคาะ: ส่วนใหญ่ขี้กลัว มีตัวดุไม่กี่ชนิดอยู่ป่าลึก · หมึกไม่ทำให้ตาย บางตัวตกใจ บางตัวเฉย บางตัวดุกว่าเดิม หมึกเหนียวทำให้ช้าลง

export type Habitat = 'meadow' | 'forest' | 'deep' | 'water' | 'shore' | 'sky' | 'town';
export type InkReaction = 'flee' | 'ignore' | 'enraged';
export type Movement = 'walk' | 'fly' | 'swim' | 'hop' | 'flutter' | 'glow';
export type Active = 'day' | 'night' | 'always';

export interface Species {
  id: string;
  move: Movement;
  habitat: Habitat;
  active: Active;
  /** จำนวนรอบตัวผู้เล่น */
  count: number;
  speed: number;
  /** เข้าใกล้เท่านี้แล้ววิ่งหนี (0 = ไม่หนี) */
  flee: number;
  /** เข้าใกล้เท่านี้แล้วไล่ทำร้าย (0 = ไม่ดุ) */
  aggro: number;
  ink: InkReaction;
  /** ความสูงลำตัวไว้เล็งสแกน */
  height: number;
  size: number;
}

export const SPECIES: Species[] = [
  { id: 'deer', move: 'walk', habitat: 'meadow', active: 'always', count: 4, speed: 7, flee: 22, aggro: 0, ink: 'flee', height: 1.1, size: 1 },
  { id: 'rabbit', move: 'hop', habitat: 'meadow', active: 'always', count: 5, speed: 6, flee: 12, aggro: 0, ink: 'flee', height: 0.25, size: 1 },
  { id: 'fox', move: 'walk', habitat: 'forest', active: 'always', count: 2, speed: 6, flee: 8, aggro: 0, ink: 'ignore', height: 0.45, size: 1 },
  { id: 'crow', move: 'fly', habitat: 'town', active: 'day', count: 4, speed: 8, flee: 10, aggro: 0, ink: 'flee', height: 0, size: 1 },
  { id: 'eagle', move: 'fly', habitat: 'sky', active: 'day', count: 1, speed: 10, flee: 0, aggro: 0, ink: 'ignore', height: 0, size: 1 },
  // ปลาย้ายไประบบฝูงปลา (render/Fish.ts รอบสอง ช่วง 6) เก็บชนิดไว้ให้คอลเลกชัน
  { id: 'fish', move: 'swim', habitat: 'water', active: 'always', count: 0, speed: 2.5, flee: 5, aggro: 0, ink: 'flee', height: 0, size: 1 },
  { id: 'frog', move: 'hop', habitat: 'shore', active: 'always', count: 4, speed: 3, flee: 3, aggro: 0, ink: 'ignore', height: 0.12, size: 1 },
  { id: 'butterfly', move: 'flutter', habitat: 'meadow', active: 'day', count: 10, speed: 1.5, flee: 0, aggro: 0, ink: 'ignore', height: 0, size: 1 },
  { id: 'firefly', move: 'glow', habitat: 'meadow', active: 'night', count: 40, speed: 0.6, flee: 0, aggro: 0, ink: 'ignore', height: 0, size: 1 },
  { id: 'owl', move: 'fly', habitat: 'forest', active: 'night', count: 2, speed: 6, flee: 9, aggro: 0, ink: 'flee', height: 0, size: 1 },
  { id: 'wolf', move: 'walk', habitat: 'deep', active: 'always', count: 3, speed: 4.6, flee: 0, aggro: 24, ink: 'ignore', height: 0.7, size: 1 },
  { id: 'bear', move: 'walk', habitat: 'deep', active: 'always', count: 1, speed: 4.6, flee: 0, aggro: 18, ink: 'enraged', height: 1.2, size: 1 },
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
