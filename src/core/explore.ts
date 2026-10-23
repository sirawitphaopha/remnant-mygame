// แผนที่ที่เคยเดินผ่าน · แบ่งแมพเป็นช่องละ 8 เมตร เดินผ่านแล้วเปิดรอบตัว 40 เมตร
import { WORLD } from '../config/game';

/** จำนวนช่องคิดจากขนาดแมพ (แมพ 3 กม. = 375 ช่องต่อแถว) · เดิมเขียนตายตัว 125 ขยายแมพแล้วแผนที่มืด */
export const EXPLORE = { cell: 8, cells: WORLD.size / 8, reveal: 40 } as const;

export class ExploreMap {
  readonly bits = new Uint8Array(EXPLORE.cells * EXPLORE.cells);
  /** ช่องที่เปิดใหม่ตั้งแต่ครั้งล่าสุดที่วาด (ให้หน้าจอวาดเฉพาะส่วนใหม่) */
  dirty = true;

  constructor(private half: number = WORLD.half) {}

  /** เปิดแผนที่รอบจุดนั้น · คืนจำนวนช่องที่เปิดใหม่ */
  reveal(x: number, z: number, radius: number = EXPLORE.reveal): number {
    const c = EXPLORE.cell;
    const n = EXPLORE.cells;
    const ci = (x + this.half) / c;
    const cj = (z + this.half) / c;
    const r = radius / c;
    let opened = 0;
    for (let j = Math.floor(cj - r); j <= Math.ceil(cj + r); j++) {
      for (let i = Math.floor(ci - r); i <= Math.ceil(ci + r); i++) {
        if (i < 0 || j < 0 || i >= n || j >= n) continue;
        if ((i + 0.5 - ci) ** 2 + (j + 0.5 - cj) ** 2 > r * r) continue;
        const k = j * n + i;
        if (!this.bits[k]) {
          this.bits[k] = 1;
          opened++;
        }
      }
    }
    if (opened) this.dirty = true;
    return opened;
  }

  isOpen(x: number, z: number): boolean {
    const n = EXPLORE.cells;
    const i = Math.floor((x + this.half) / EXPLORE.cell);
    const j = Math.floor((z + this.half) / EXPLORE.cell);
    return i >= 0 && j >= 0 && i < n && j < n && this.bits[j * n + i] === 1;
  }

  /** สัดส่วนที่สำรวจแล้ว 0 ถึง 1 */
  fraction(): number {
    let s = 0;
    for (const b of this.bits) s += b;
    return s / this.bits.length;
  }

  /** เก็บเป็นข้อความสั้น ๆ ไว้บันทึกในเบราว์เซอร์ */
  serialize(): string {
    let out = '';
    for (let i = 0; i < this.bits.length; i += 8) {
      let v = 0;
      for (let b = 0; b < 8; b++) v |= (this.bits[i + b] ?? 0) << b;
      out += String.fromCharCode(v + 32);
    }
    return out;
  }

  load(s: string): void {
    for (let i = 0; i < s.length; i++) {
      const v = s.charCodeAt(i) - 32;
      for (let b = 0; b < 8; b++) if (i * 8 + b < this.bits.length) this.bits[i * 8 + b] = (v >> b) & 1;
    }
    this.dirty = true;
  }
}
