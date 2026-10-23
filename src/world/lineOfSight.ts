import type { Structures } from './structures';
import type { Terrain } from './Terrain';

// มองเห็นกันไหม (รอบสอง ช่วง 12 · รายงานตรวจข้อ 121) · กติกาล้วน ไม่แตะภาพ
// ใช้ตอนหาเป้าสแกน: ผนังตึก หลังคา พื้นชั้นบน กับภูเขา บังได้ · อยู่ในถ้ำมองเห็นแต่ของในถ้ำ

export interface P3 { x: number; y: number; z: number }

/**
 * จาก o มองเห็นจุด (x, y, z) ไหม
 * @param wall เช็กผนังตึกด้วย (ตึกเองเป็นเป้าสแกน ไม่ต้องเช็กว่าบังตัวเอง)
 */
export function inSight(t: Terrain, st: Structures, o: P3, x: number, y: number, z: number, wall = true): boolean {
  const len = Math.hypot(x - o.x, y - o.y, z - o.z);
  // ชนกล่องก่อนถึงของเกิน 0.6 ม. = มีอะไรขวาง (ของที่วางบนพื้นห้อง เส้นอาจแตะพื้นช่วงท้าย)
  if (wall && st.segment(o.x, o.y, o.z, x, y, z, 0.02) < 1 - 0.6 / Math.max(0.6, len)) return false;
  const inCave = o.y < t.heightAt(o.x, o.z) - 1;
  const targetInCave = y < t.heightAt(x, z) - 1;
  if (inCave || targetInCave) return inCave === targetInCave;
  // เส้นจากตาถึงของต้องไม่มุดใต้ผิวดิน (เว้นช่วงท้ายใกล้ของ ของบนพื้นอยู่ชิดดิน)
  const steps = Math.ceil(len / 1.5);
  for (let k = 1; k < steps; k++) {
    const f = k / steps;
    if (len * (1 - f) < 1.2) break;
    if (t.heightAt(o.x + (x - o.x) * f, o.z + (z - o.z) * f) > o.y + (y - o.y) * f + 0.15) return false;
  }
  return true;
}
