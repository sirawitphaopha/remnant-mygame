/** พื้นที่ตัวละครเหยียบ · ช่วง 0 เป็นพื้นเรียบ ช่วง 1 แทนด้วยภูมิประเทศจริง */
export interface Ground {
  /** ความสูงพื้นดินที่จุด (x, z) */
  heightAt(x: number, z: number): number;
  /** ความสูงผิวน้ำที่จุดนั้น · ไม่มีน้ำคืน -Infinity */
  waterAt(x: number, z: number): number;
}

export const flatGround: Ground = {
  heightAt: () => 0,
  waterAt: () => -Infinity,
};
