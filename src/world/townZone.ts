import { WORLD } from '../config/game';
import { TOWN } from './layout';
import { Simplex2 } from './noise';

// เขตของเมืองเก่าหลังมนุษย์หายไปราวพันปี (รอบสอง ช่วง 8 ตามที่พี่กันเล่า)
// เดินจากยานผ่านทุ่งหญ้าที่เคยเป็นนา เข้าเมืองที่ต้นไม้ขึ้นรกครึ้ม ถัดออกไปเป็นป่าที่กลืนบ้านรอบนอก มีซากบ้านอยู่ในป่า
// ขอบเขตไม่กลม ยืดตามถนนสายหลักเหนือใต้ เว้าแหว่งตามสัญญาณรบกวน

const zn = new Simplex2(WORLD.seed + 919);

/** ใจกลางเมือง (ร้านค้า ตึกราชการ) */
export const TOWN_CORE = 92;
/** ย่านบ้านรอบใจกลาง */
export const TOWN_RES = 168;
/** ขอบนอกสุดของซากบ้านในป่า (ฝั่งตะวันตกเป็นทุ่งนาเก่าแทน) */
export const TOWN_FOREST = 330;

export type TownZone = 'core' | 'res' | 'forest' | 'field' | 'out';

/** ระยะจากกลางเมืองแบบไม่กลม หน่วยเมตร */
export function townDist(x: number, z: number): number {
  const dx = x - TOWN.x;
  const dz = (z - TOWN.z) * 0.8;
  const a = Math.atan2(dz, dx);
  const wob = 1 + 0.22 * zn.noise(Math.cos(a) * 1.3 + 4, Math.sin(a) * 1.3 - 2) + 0.07 * zn.noise(x / 40, z / 40);
  return Math.hypot(dx, dz) / wob;
}

/** ฝั่งตะวันตกของเมือง (ทางมาจากยาน) 0 ถึง 1 */
export function townWest(x: number, z: number): number {
  const dx = x - TOWN.x;
  const dz = z - TOWN.z;
  const c = -dx / (Math.hypot(dx, dz) || 1);
  return Math.max(0, Math.min(1, (c - 0.25) / 0.35));
}

export function townZone(x: number, z: number): TownZone {
  const d = townDist(x, z);
  if (d < TOWN_CORE) return 'core';
  if (d < TOWN_RES) return 'res';
  if (d < TOWN_FOREST) return townWest(x, z) > 0.5 ? 'field' : 'forest';
  return 'out';
}
