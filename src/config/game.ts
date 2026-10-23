// ค่าสมดุลทั้งเกมอยู่ที่นี่ที่เดียว · หน่วยระยะเป็นเมตร เวลาเป็นวินาที น้ำหนักเป็นกิโลกรัม

/** ขนาดโลก 1 × 1 กม. จุดกึ่งกลางอยู่ที่ (0, 0) */
export const WORLD = {
  size: 1000,
  half: 500,
  seed: 20261023,
  waterLevel: 2,
} as const;

/** การเคลื่อนที่ของตัวละคร · อิงความเร็วคนจริง */
export const MOVE = {
  walkSpeed: 1.5,
  runSpeed: 4.2,
  sprintSpeed: 6.0,
  swimSpeed: 1.1,
  climbSpeed: 0.7,
  jumpSpeed: 4.6,
  gravity: 9.81,
  turnRate: 10,
  accel: 8,
  radius: 0.35,
  height: 1.8,
} as const;

/** จุดเริ่มเกม · ยานจอดอยู่ข้างหลัง */
export const SPAWN = { x: -140, z: 160, heading: Math.PI * 0.85 } as const;
