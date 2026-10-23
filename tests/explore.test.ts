import { describe, expect, it } from 'vitest';
import { ExploreMap } from '../src/core/explore';

describe('แผนที่ที่เคยเดินผ่าน', () => {
  it('เริ่มมืดทั้งแมพ เดินแล้วเปิดรอบตัว', () => {
    const m = new ExploreMap();
    expect(m.isOpen(0, 0)).toBe(false);
    m.reveal(0, 0);
    expect(m.isOpen(0, 0)).toBe(true);
    expect(m.isOpen(30, 0)).toBe(true);
    expect(m.isOpen(80, 0)).toBe(false);
  });
  it('บันทึกแล้วโหลดกลับได้เหมือนเดิม', () => {
    const m = new ExploreMap();
    m.reveal(-200, 210);
    m.reveal(100, -50);
    const m2 = new ExploreMap();
    m2.load(m.serialize());
    expect(Array.from(m2.bits)).toEqual(Array.from(m.bits));
  });
});
