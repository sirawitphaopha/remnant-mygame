// เวลาในเกม · กติกาล้วน ไม่แตะภาพ

/** หนึ่งวันเต็มในเกมยาวกี่วินาทีจริง (24 นาที) */
export const DAY_SECONDS = 24 * 60;
/** ดวงจันทร์ครบรอบข้างขึ้นข้างแรมทุกกี่วันในเกม */
export const MOON_CYCLE_DAYS = 8;
/** เปิดเกมใหม่เริ่มตอน 07:00 */
export const START_TIME = 7 / 24;

export interface SkyState {
  /** เวลาในวัน 0 ถึง 1 (0 = เที่ยงคืน 0.5 = เที่ยงวัน) */
  timeOfDay: number;
  day: number;
  /** ทิศดวงอาทิตย์ (เวกเตอร์หนึ่งหน่วย y ขึ้น) */
  sun: [number, number, number];
  moon: [number, number, number];
  /** ความสูงดวงอาทิตย์ -1 ถึง 1 */
  sunHeight: number;
  /** ความสว่างดวงจันทร์ 0 = เดือนมืด 1 = เต็มดวง */
  moonLight: number;
  /** มุมข้างขึ้นข้างแรม 0 ถึง 1 (0.5 = เต็มดวง) */
  moonPhase: number;
  /** ความหนาของหมอก 0 ถึง 1 (หนาสุดตอนเช้าตรู่) */
  fog: number;
}

const TILT = 0.38; // ทางเดินดวงอาทิตย์เอียงไปทางทิศใต้

function dirFromAngle(a: number): [number, number, number] {
  // a = 0 ขึ้นทางตะวันออก, π/2 อยู่บนหัว, π ตกทางตะวันตก
  const x = Math.cos(a);
  const y = Math.sin(a) * Math.cos(TILT);
  const z = Math.sin(a) * Math.sin(TILT);
  return [x, y, z];
}

/** คำนวณท้องฟ้าจากเวลาเกมทั้งหมด (วินาทีตั้งแต่เริ่มวันแรก 00:00) */
export function skyAt(totalSeconds: number): SkyState {
  const days = totalSeconds / DAY_SECONDS;
  const day = Math.floor(days);
  const timeOfDay = days - day;
  const sunAngle = (timeOfDay - 0.25) * Math.PI * 2;
  const sun = dirFromAngle(sunAngle);
  const moonPhase = (days / MOON_CYCLE_DAYS) % 1;
  // ดวงจันทร์ขึ้นช้ากว่าดวงอาทิตย์ตามข้างขึ้น · เต็มดวงขึ้นตอนดวงอาทิตย์ตก
  const moon = dirFromAngle(sunAngle - moonPhase * Math.PI * 2);
  const moonLight = (1 - Math.cos(moonPhase * Math.PI * 2)) / 2;
  const hour = timeOfDay * 24;
  const fog = Math.max(0, 1 - Math.abs(hour - 6.3) / 2.6) ** 1.5;
  return { timeOfDay, day, sun, moon, sunHeight: sun[1], moonLight, moonPhase, fog };
}

/** เวลาแบบนาฬิกา เช่น 07:30 */
export function clockText(timeOfDay: number): string {
  const m = Math.floor(timeOfDay * 24 * 60) % (24 * 60);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
