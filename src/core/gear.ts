// อุปกรณ์ แถบล่าง 9 ช่อง และแขน 4 ข้าง · กติกาล้วน

export type GearId = 'scanner' | 'flashlight' | 'inkGun' | 'glueGun' | 'climber' | 'oxygenTank' | 'bag';
export type BagSize = 'small' | 'medium' | 'large';

/** น้ำหนัก (กก.) และความจุของอุปกรณ์ · ทุกอย่างมีน้ำหนัก รวมอุปกรณ์ (พี่กันเคาะ) */
export const GEAR = {
  scanner: { kg: 1.2 },
  flashlight: { kg: 0.6, /** แบตหมดภายในกี่วินาทีที่เปิดค้าง */ drainSeconds: 240, /** ชาร์จแดดเต็มภายในกี่วินาที */ sunChargeSeconds: 180 },
  inkGun: { kg: 1.8, max: 10, /** หมึกหนึ่งนัดหนักเท่าไร */ shotKg: 0.05 },
  glueGun: { kg: 1.1, max: 6, shotKg: 0.08 },
  climber: { kg: 2.0 },
  oxygenTank: { kg: 1.5, max: 2, /** เติมออกซิเจนในโหลได้กี่ส่วน */ refill: 1 },
  bag: {
    small: { kg: 0.5, capKg: 6 },
    medium: { kg: 1.0, capKg: 12 },
    large: { kg: 2.2, capKg: 20 },
  },
} as const;

/** น้ำหนักที่ตัวชุดแบกได้โดยไม่มีกระเป๋า (มือ 4 ข้างกับเข็มขัด) */
export const SUIT_CARRY_KG = 13;

export interface GearSlot {
  kind: 'gear';
  id: GearId;
  /** หมึก กาว จำนวนถังออกซิเจน */
  amount?: number;
  /** แบตไฟฉาย 0 ถึง 1 */
  charge?: number;
  on?: boolean;
  bag?: BagSize;
}

export interface ItemSlot {
  kind: 'item';
  itemId: string;
  kg: number;
  /** ชิ้นพิเศษที่มีบันทึกส่วนตัว (ชั้น 3) · ฝากเข้ายานแล้วปลดชั้น 3 ให้ */
  special?: boolean;
}

export type Slot = GearSlot | ItemSlot | null;

/** ของที่พกอยู่: แถบล่าง 9 ช่อง · แขน 4 ข้างชี้ไปที่ช่องในแถบ (null = มือว่าง) */
export interface Loadout {
  belt: Slot[];
  /** ลำดับแขน: 0 บนขวา (คลิกซ้าย · แขนหลัก) 1 บนซ้าย (คลิกขวา) 2 ล่างขวา (Q) 3 ล่างซ้าย (R) */
  arms: (number | null)[];
}

/** แพ็กเกจเริ่มต้น (พี่กันเคาะ "ประมาณนี้ก่อนได้") */
export function starterPack(): Loadout {
  return {
    belt: [
      { kind: 'gear', id: 'scanner' },
      { kind: 'gear', id: 'flashlight', charge: 1, on: false },
      { kind: 'gear', id: 'inkGun', amount: 5 },
      { kind: 'gear', id: 'glueGun', amount: 3 },
      { kind: 'gear', id: 'climber' },
      { kind: 'gear', id: 'oxygenTank', amount: 1 },
      { kind: 'gear', id: 'bag', bag: 'medium' },
      null,
      null,
    ],
    arms: [0, 1, 2, 3],
  };
}

export function emptyLoadout(): Loadout {
  return { belt: Array(9).fill(null), arms: [null, null, null, null] };
}

export function slotKg(s: Slot): number {
  if (!s) return 0;
  if (s.kind === 'item') return s.kg;
  switch (s.id) {
    case 'bag': return GEAR.bag[s.bag ?? 'medium'].kg;
    case 'inkGun': return GEAR.inkGun.kg + (s.amount ?? 0) * GEAR.inkGun.shotKg;
    case 'glueGun': return GEAR.glueGun.kg + (s.amount ?? 0) * GEAR.glueGun.shotKg;
    case 'oxygenTank': return GEAR.oxygenTank.kg * (s.amount ?? 0);
    default: return GEAR[s.id].kg;
  }
}

/** แขนไหนถือช่องนี้อยู่ (-1 = ไม่มี) */
export function armOf(l: Loadout, slot: number): number {
  return l.arms.indexOf(slot);
}

/** กดเลข: เอาของช่องนั้นเข้าแขนหลัก · ถ้าแขนอื่นถืออยู่ สลับกัน */
export function equipToArm(l: Loadout, slot: number, arm = 0): void {
  if (slot < 0 || slot >= l.belt.length || !l.belt[slot]) return;
  const other = armOf(l, slot);
  if (other === arm) return;
  if (other >= 0) l.arms[other] = l.arms[arm];
  l.arms[arm] = slot;
}

/** ของที่แขนนั้นถืออยู่ */
export function held(l: Loadout, arm: number): Slot {
  const s = l.arms[arm];
  return s === null || s === undefined ? null : l.belt[s];
}

/** มีอุปกรณ์ชิ้นนี้อยู่ในแขนข้างไหนไหม */
export function holding(l: Loadout, id: GearId): GearSlot | null {
  for (let a = 0; a < 4; a++) {
    const s = held(l, a);
    if (s && s.kind === 'gear' && s.id === id) return s;
  }
  return null;
}

/** หาช่องของอุปกรณ์ชนิดนั้นในแถบ */
export function findGear(l: Loadout, id: GearId): GearSlot | null {
  for (const s of l.belt) if (s && s.kind === 'gear' && s.id === id) return s;
  return null;
}

/** ที่เลือกในหน้ายานก่อนออกเดินทาง · ยานจำลองได้ไม่จำกัด */
export interface ShipChoice {
  scanner: boolean;
  flashlight: boolean;
  inkGun: boolean;
  ink: number;
  glueGun: boolean;
  glue: number;
  climber: boolean;
  tanks: number;
  bags: BagSize[];
}

export function starterChoice(): ShipChoice {
  return { scanner: true, flashlight: true, inkGun: true, ink: 5, glueGun: true, glue: 3, climber: true, tanks: 1, bags: ['medium'] };
}

/** จำนวนช่องที่ของที่เลือกจะใช้ในแถบล่าง */
export function choiceSlots(c: ShipChoice): number {
  return [c.scanner, c.flashlight, c.inkGun, c.glueGun, c.climber, c.tanks > 0].filter(Boolean).length + c.bags.length;
}

/** สร้างของที่จะพกจากที่เลือก · เรียงอุปกรณ์ก่อน กระเป๋าท้ายสุด · แขนถืออุปกรณ์ 4 ชิ้นแรก */
export function buildLoadout(c: ShipChoice): Loadout {
  const belt: Slot[] = [];
  if (c.scanner) belt.push({ kind: 'gear', id: 'scanner' });
  if (c.flashlight) belt.push({ kind: 'gear', id: 'flashlight', charge: 1, on: false });
  if (c.inkGun) belt.push({ kind: 'gear', id: 'inkGun', amount: Math.max(0, Math.min(GEAR.inkGun.max, c.ink)) });
  if (c.glueGun) belt.push({ kind: 'gear', id: 'glueGun', amount: Math.max(0, Math.min(GEAR.glueGun.max, c.glue)) });
  if (c.climber) belt.push({ kind: 'gear', id: 'climber' });
  if (c.tanks > 0) belt.push({ kind: 'gear', id: 'oxygenTank', amount: Math.min(GEAR.oxygenTank.max, c.tanks) });
  for (const b of c.bags) belt.push({ kind: 'gear', id: 'bag', bag: b });
  while (belt.length < 9) belt.push(null);
  belt.length = 9;
  const arms: (number | null)[] = [null, null, null, null];
  let a = 0;
  belt.forEach((s, i) => {
    if (a < 4 && s && s.kind === 'gear' && s.id !== 'bag' && s.id !== 'climber' && s.id !== 'oxygenTank') arms[a++] = i;
  });
  return { belt, arms };
}
