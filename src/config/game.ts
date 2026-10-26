// ค่าสมดุลทั้งเกมอยู่ที่นี่ที่เดียว · หน่วยระยะเป็นเมตร เวลาเป็นวินาที น้ำหนักเป็นกิโลกรัม
// ขนาดของจริง (ตัวละคร ตึก รถ สัตว์) อยู่ที่ scale.ts
import { HERO } from './scale';

/** ขนาดโลก 3 × 3 กม. (รอบสอง) จุดกึ่งกลางอยู่ที่ (0, 0) · เดินข้ามราว 19 นาที (เดินเร็วขึ้นตามที่พี่กันสั่ง 26 ต.ค. 2569) */
export const WORLD = {
  size: 3000,
  half: 1500,
  seed: 20261023,
  waterLevel: 2,
} as const;

/** การเคลื่อนที่ของตัวละคร · อิงความเร็วคนจริง ยกเว้นเดิน */
export const MOVE = {
  /** เดิมเท่าคนเดิน 1.5 ม./วิ พี่กันลองเล่นแล้วว่าอืดจนรำคาญ (26 ต.ค. 2569) จึงเป็นเดินเร็ว 2.6 */
  walkSpeed: 2.6,
  runSpeed: 4.2,
  sprintSpeed: 6.0,
  swimSpeed: 1.1,
  climbSpeed: 0.7,
  jumpSpeed: 4.6,
  gravity: 9.81,
  turnRate: 10,
  accel: 8,
  radius: HERO.radius,
  height: HERO.height,
  /** ความสูงหัว (กลางโหลแก้ว) จากเท้า ใช้เช็กก๊าซกับจมน้ำ */
  headHeight: HERO.headHeight,
} as const;
