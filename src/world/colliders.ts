// สิ่งกีดขวางทรงกระบอก (ลำต้นไม้ ก้อนหิน เสา) · เก็บในตารางช่องละ 16 เมตร หาเร็ว

export interface Circle {
  x: number;
  z: number;
  r: number;
  /** สูงจากพื้นเท่าไร ตัวละครกระโดดข้ามของที่เตี้ยกว่านี้ได้ */
  top: number;
  /** ยืนบนยอดได้ (หิน ขอนไม้ ตอไม้) · y0 = ความสูงพื้นที่โคน */
  stand?: boolean;
  y0?: number;
  /** ใช้กันนับซ้ำตอนหา (ของหนึ่งชิ้นอยู่ได้หลายช่องตาราง) */
  mark?: number;
}

const CELL = 16;
/** ความสูงตัวละครโดยประมาณ ตัวอยู่ต่ำกว่าโคนสิ่งกีดขวางเกินนี้ = อยู่คนละชั้น (เช่นในถ้ำใต้ก้อนหินบนเนิน) */
const BODY = 1.6;

export class CircleColliders {
  private grid = new Map<number, Circle[]>();
  private stamp = 0;
  // อาร์เรย์ใช้ซ้ำแยกต่อฟังก์ชัน (push เรียกหาพื้นซึ่งเรียก standAt ซ้อนอยู่ข้างใน ใช้อาร์เรย์เดียวกันจะทับกัน)
  private scratchPush: Circle[] = [];
  private scratchStand: Circle[] = [];
  private scratchSeg: Circle[] = [];

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
    // กันนับซ้ำด้วยเลขรอบ (เดิม out.includes วนเทียบทุกชิ้นซ้ำ ช้าเมื่อของหนาแน่น)
    const s = ++this.stamp;
    const i0 = Math.floor((x - r) / CELL);
    const i1 = Math.floor((x + r) / CELL);
    const j0 = Math.floor((z - r) / CELL);
    const j1 = Math.floor((z + r) / CELL);
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const list = this.grid.get(this.key(i, j));
        if (!list) continue;
        for (const c of list) {
          if (c.mark === s) continue;
          c.mark = s;
          if ((c.x - x) ** 2 + (c.z - z) ** 2 < (c.r + r) ** 2) out.push(c);
        }
      }
    }
    return out;
  }

  /**
   * ยอดของสิ่งที่ยืนบนได้ (หิน ขอนไม้) ใต้จุดนี้ ถ้าเท้าสูงถึงยอดแล้ว · ไม่มีคืน -Infinity
   * เดิมกระโดดขึ้นหินแล้วจมลงในหิน (พื้นไม่รู้จักยอดหิน) แล้วถูกดีดออก 1.2 ม. ในเฟรมเดียว
   */
  standAt(x: number, z: number, feetY: number): number {
    let best = -Infinity;
    for (const c of this.near(x, z, 0.1, this.scratchStand)) {
      if (!c.stand || c.y0 === undefined) continue;
      const topY = c.y0 + c.top;
      if (feetY < topY - 0.35 || (c.x - x) ** 2 + (c.z - z) ** 2 > (c.r * 0.85) ** 2) continue;
      if (topY > best) best = topY;
    }
    return best;
  }

  /**
   * ดันจุด (x, z) รัศมี r ออกจากสิ่งกีดขวาง · คืนตำแหน่งใหม่
   * @param feetY ความสูงเท้าเทียบพื้น ถ้าสูงกว่ายอดของสิ่งนั้นก็ไม่ชน (ยืนบนหิน)
   */
  push(x: number, z: number, r: number, feetAbove: (c: Circle) => number): { x: number; z: number; hit: boolean } {
    let hit = false;
    for (const c of this.near(x, z, r + 0.5, this.scratchPush)) {
      // เท้าสูงกว่ายอด (ยืนบนหิน) หรือทั้งตัวอยู่ต่ำกว่าโคน (ในถ้ำใต้หินบนเนิน) = ไม่ชน
      const fa = feetAbove(c);
      if (fa > c.top - 0.25 || fa < -BODY) continue;
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
    for (const c of this.near(midX, midZ, len / 2 + pad, this.scratchSeg)) {
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
      const base = c.y0 ?? groundAt(c.x, c.z);
      if (y > base + c.top || y < base - 0.3) continue;
      best = t;
    }
    return best;
  }
}
