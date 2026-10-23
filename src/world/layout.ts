// ผังโลก 1 × 1 กม. · พิกัด x ไปทางตะวันออก, z ไปทางใต้ (ทิศเหนือคือ -z)
// จุดสำคัญวางเองทีละจุด ส่วนภูเขากับป่าให้สัญญาณรบกวนปั้น

export interface P2 { x: number; z: number }

/** ยานกับจุดเกิด · ที่ราบเล็กทางตะวันตกเฉียงใต้ */
export const SHIP: P2 & { radius: number; height: number } = { x: -200, z: 210, radius: 22, height: 11 };
export const SPAWN_POINT: P2 & { heading: number } = { x: -196, z: 196, heading: Math.PI * 0.8 };

/** เมืองพังในหุบเขา */
export const TOWN: P2 & { radius: number; height: number } = { x: 40, z: -10, radius: 95, height: 7 };

/** แม่น้ำ ไหลจากภูเขาทิศเหนือ ผ่านข้างเมือง ลงทะเลสาบทางตะวันออกเฉียงใต้ */
export const RIVER: P2[] = [
  { x: -40, z: -500 }, { x: -20, z: -390 }, { x: 30, z: -300 }, { x: 110, z: -210 },
  { x: 160, z: -120 }, { x: 170, z: -30 }, { x: 150, z: 60 }, { x: 175, z: 150 }, { x: 235, z: 225 },
];
export const RIVER_WIDTH = 7;

/** ทะเลสาบ */
export const LAKE: P2 & { radius: number } = { x: 265, z: 265, radius: 80 };

/** ถนนเก่า จากใกล้ยาน เข้าเมือง ข้ามสะพาน ออกทางตะวันออก */
export const ROAD: P2[] = [
  { x: -230, z: 260 }, { x: -170, z: 180 }, { x: -110, z: 110 }, { x: -50, z: 50 },
  { x: 10, z: 0 }, { x: 90, z: -40 }, { x: 165, z: -70 }, { x: 240, z: -100 }, { x: 330, z: -140 },
];
export const ROAD_WIDTH = 4.5;

/** สะพานพัง ตรงที่ถนนข้ามแม่น้ำ */
export const BRIDGE: P2 & { angle: number } = { x: 163, z: -69, angle: Math.atan2(-30, 75) };

/** ถ้ำ 2 แห่ง · ปากถ้ำหันออกทาง dir (เรเดียน ทิศเดียวกับ heading ของตัวละคร) */
export const CAVES: (P2 & { dir: number; depth: number })[] = [
  { x: -150, z: -255, dir: Math.PI * 0.95, depth: 70 },
  { x: 340, z: 40, dir: -Math.PI * 0.5, depth: 55 },
];

/** ป่าลึกที่มีสัตว์ดุ ทางตะวันตกเฉียงเหนือ */
export const DEEP_FOREST: P2 & { radius: number } = { x: -260, z: -120, radius: 170 };

export function distToPolyline(x: number, z: number, pts: P2[]): number {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const l2 = dx * dx + dz * dz;
    let t = ((x - a.x) * dx + (z - a.z) * dz) / l2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px = a.x + dx * t - x;
    const pz = a.z + dz * t - z;
    const d = px * px + pz * pz;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}
