// สิ่งกีดขวางทรงกระบอก (ลำต้นไม้ ก้อนหิน เสา) · เก็บในตารางช่องละ 16 เมตร หาเร็ว

export interface Circle {
  x: number;
  z: number;
  r: number;
  /** สูงจากพื้นเท่าไร ตัวละครกระโดดข้ามของที่เตี้ยกว่านี้ได้ */
  top: number;
}

const CELL = 16;

export class CircleColliders {
  private grid = new Map<number, Circle[]>();

  private key(i: number, j: number): number {
    return (i + 1000) * 4096 + (j + 1000);
  }

  add(c: Circle): void {
    const i0 = Math.floor((c.x - c.r) / CELL);
    const i1 = Math.floor((c.x + c.r) / CELL);
    const j0 = Math.floor((c.z - c.r) / CELL);
    const j1 = Math.floor((c.z + c.r) / CELL);
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const k = this.key(i, j);
        let list = this.grid.get(k);
        if (!list) this.grid.set(k, (list = []));
        list.push(c);
      }
    }
  }

  /** ของทั้งหมดที่อยู่ในรัศมี r รอบจุด */
  near(x: number, z: number, r: number, out: Circle[] = []): Circle[] {
    out.length = 0;
    const i0 = Math.floor((x - r) / CELL);
    const i1 = Math.floor((x + r) / CELL);
    const j0 = Math.floor((z - r) / CELL);
    const j1 = Math.floor((z + r) / CELL);
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const list = this.grid.get(this.key(i, j));
        if (!list) continue;
        for (const c of list) if (!out.includes(c) && (c.x - x) ** 2 + (c.z - z) ** 2 < (c.r + r) ** 2) out.push(c);
      }
    }
    return out;
  }

  /**
   * ดันจุด (x, z) รัศมี r ออกจากสิ่งกีดขวาง · คืนตำแหน่งใหม่
   * @param feetY ความสูงเท้าเทียบพื้น ถ้าสูงกว่ายอดของสิ่งนั้นก็ไม่ชน (ยืนบนหิน)
   */
  push(x: number, z: number, r: number, feetAbove: (c: Circle) => number): { x: number; z: number; hit: boolean } {
    let hit = false;
    for (const c of this.near(x, z, r + 0.5)) {
      if (feetAbove(c) > c.top - 0.25) continue;
      const dx = x - c.x;
      const dz = z - c.z;
      const d = Math.hypot(dx, dz);
      const min = c.r + r;
      if (d < min && d > 1e-6) {
        x = c.x + (dx / d) * min;
        z = c.z + (dz / d) * min;
        hit = true;
      }
    }
    return { x, z, hit };
  }

  /** เส้นตรงจาก a ไป b ชนสิ่งกีดขวางไหม · คืนสัดส่วนระยะที่ชนครั้งแรก (1 = ไม่ชน) ใช้กับกล้อง */
  segment(ax: number, az: number, ay: number, bx: number, bz: number, by: number, groundAt: (x: number, z: number) => number, pad: number): number {
    let best = 1;
    const len = Math.hypot(bx - ax, bz - az);
    const midX = (ax + bx) / 2;
    const midZ = (az + bz) / 2;
    for (const c of this.near(midX, midZ, len / 2 + pad)) {
      const dx = bx - ax;
      const dz = bz - az;
      const fx = ax - c.x;
      const fz = az - c.z;
      const rr = c.r + pad;
      const A = dx * dx + dz * dz;
      if (A < 1e-9) continue;
      const B = 2 * (fx * dx + fz * dz);
      const C = fx * fx + fz * fz - rr * rr;
      const disc = B * B - 4 * A * C;
      if (disc < 0) continue;
      const t = (-B - Math.sqrt(disc)) / (2 * A);
      if (t < 0 || t > best) continue;
      const y = ay + (by - ay) * t;
      if (y > groundAt(c.x, c.z) + c.top) continue;
      best = t;
    }
    return best;
  }
}
