// ตารางช่องหาของใกล้ตัว (รอบสอง ช่วง 12) · ใช้หาเป้าสแกน ต้นไม้ที่กระรอกปีน ต้นผลไม้ที่หมีกิน
// เดิมวนต้นไม้กับหินทั้งแมพทุกเฟรมที่สแกน (รายงานตรวจข้อ 121 132) · ตอนนี้ดูแค่ช่องรอบตัว

export class PointGrid<T extends { x: number; z: number }> {
  private grid = new Map<number, T[]>();

  constructor(private cell = 32) {}

  private key(i: number, j: number): number {
    return (i + 2000) * 8192 + (j + 2000);
  }

  add(item: T): void {
    const k = this.key(Math.floor(item.x / this.cell), Math.floor(item.z / this.cell));
    let list = this.grid.get(k);
    if (!list) this.grid.set(k, (list = []));
    list.push(item);
  }

  /** ของในรัศมี r รอบจุด (ใส่ out ซ้ำได้ ไม่สร้างอาร์เรย์ใหม่) */
  near(x: number, z: number, r: number, out: T[] = []): T[] {
    out.length = 0;
    const i0 = Math.floor((x - r) / this.cell);
    const i1 = Math.floor((x + r) / this.cell);
    const j0 = Math.floor((z - r) / this.cell);
    const j1 = Math.floor((z + r) / this.cell);
    const r2 = r * r;
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const list = this.grid.get(this.key(i, j));
        if (!list) continue;
        for (const it of list) if ((it.x - x) ** 2 + (it.z - z) ** 2 <= r2) out.push(it);
      }
    }
    return out;
  }

  /** ของที่ใกล้ที่สุดที่ผ่านเงื่อนไข ในรัศมี r */
  nearest(x: number, z: number, r: number, ok: (it: T) => boolean = () => true): T | null {
    let best: T | null = null;
    let bd = r * r;
    for (const it of this.near(x, z, r)) {
      const d = (it.x - x) ** 2 + (it.z - z) ** 2;
      if (d <= bd && ok(it)) { bd = d; best = it; }
    }
    return best;
  }
}
