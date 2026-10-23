import { DAY_SECONDS } from './time';

// อากาศในเกม (รอบสอง ช่วง 7) · กติกาล้วน ไม่แตะภาพ · ผลเดิมทุกครั้งที่เวลาเดิม (บันทึกแค่เวลาก็พอ)
// แบ่งวันเป็นช่วงละ 0.3 วัน (ราว 7 นาทีจริง) แต่ละช่วงสุ่มว่าฝนตกไหม ราว 1 ใน 4 ของเวลา · เปลี่ยนช่วงค่อย ๆ เปลี่ยน
// พี่กันเคาะ: ฝนมีผลแค่ภาพกับเสียง ไม่ทำให้หนาวเร็วขึ้น ไม่ลื่น (แผนรอบสอง แคลร์ตัดสินเอง) · ไฟฉายชาร์จแดดไม่ได้ตอนฝนตก

export interface Weather {
  /** ฝน 0 ถึง 1 */
  rain: number;
  /** เมฆครึ้ม 0 ถึง 1 (มาก่อนฝน หายหลังฝน) */
  cloud: number;
  /** โอกาสฟ้าร้องต่อวินาที (เฉพาะฝนหนัก) */
  thunder: number;
}

export const WEATHER = {
  /** ความยาวหนึ่งช่วงอากาศ (เป็นวันในเกม) */
  block: 0.3,
  /** สัดส่วนช่วงที่ฝนตก */
  rainChance: 0.27,
  /** ฝนหนักเกินนี้มีฟ้าร้อง */
  stormFrom: 0.75,
} as const;

function hash(n: number): number {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** ความแรงฝนของช่วงที่ k (0 = ไม่ตก) */
function blockRain(k: number): number {
  const r = hash(k * 7 + 3);
  if (r > WEATHER.rainChance) return 0;
  return 0.45 + 0.55 * hash(k * 13 + 1);
}

const smooth = (x: number) => x * x * (3 - 2 * x);

/** อากาศ ณ เวลาเกม (วินาทีตั้งแต่เริ่มวันแรก) · force = บังคับฝน (ตัวช่วยทดสอบ) */
export function weatherAt(totalSeconds: number, force?: number): Weather {
  if (force !== undefined) return { rain: force, cloud: Math.min(1, force * 1.3), thunder: force > WEATHER.stormFrom ? 0.05 : 0 };
  const blocks = totalSeconds / DAY_SECONDS / WEATHER.block;
  const k = Math.floor(blocks);
  const f = blocks - k;
  const here = blockRain(k);
  // ขอบช่วง 15% แรกกับท้ายค่อย ๆ เปลี่ยนจากช่วงข้างเคียง
  let rain = here;
  if (f < 0.15) rain = blockRain(k - 1) + (here - blockRain(k - 1)) * smooth(0.5 + f / 0.3);
  else if (f > 0.85) rain = here + (blockRain(k + 1) - here) * smooth((f - 0.85) / 0.3);
  // เมฆครึ้มนำหน้าฝนกับค้างหลังฝน
  const cloud = Math.min(1, Math.max(rain * 1.3, 0.6 * Math.max(blockRain(k - 1), blockRain(k + 1)) * (f < 0.3 || f > 0.7 ? 1 : 0.5)));
  return { rain, cloud, thunder: rain > WEATHER.stormFrom ? 0.04 * (rain - WEATHER.stormFrom) / (1 - WEATHER.stormFrom) + 0.01 : 0 };
}
