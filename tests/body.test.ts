import { describe, expect, it } from 'vitest';
import { BODY, Body, type BodyEnv } from '../src/core/body';

const env = (o: Partial<BodyEnv> = {}): BodyEnv => ({ underwater: false, gas: false, cold: 0, shelter: false, ...o });
function run(b: Body, seconds: number, e: BodyEnv) {
  for (let t = 0; t < seconds && !b.dead; t += 0.1) b.update(0.1, e);
}

describe('ร่างกาย ตายได้ 5 แบบ', () => {
  it('จมน้ำ: ใต้น้ำนานเกิน 45 วินาที', () => {
    const b = new Body();
    run(b, 30, env({ underwater: true }));
    expect(b.dead).toBeNull();
    expect(b.draining).toBe(true);
    run(b, 20, env({ underwater: true }));
    expect(b.dead).toBe('drown');
  });
  it('ก๊าซพิษในถ้ำ', () => {
    const b = new Body();
    run(b, 60, env({ gas: true }));
    expect(b.dead).toBe('gas');
  });
  it('ขึ้นจากน้ำแล้วออกซิเจนเติมเอง', () => {
    const b = new Body();
    run(b, 30, env({ underwater: true }));
    run(b, 10, env());
    expect(b.oxygen).toBe(1);
  });
  it('ตกต่ำไม่เป็นไร ปานกลางร้าว สูงมากแตก', () => {
    const b = new Body();
    expect(b.fall(3)).toBe(0);
    expect(b.fall(7)).toBe(1);
    expect(b.fall(12)).toBe(2);
    expect(b.dead).toBeNull();
    const c = new Body();
    c.fall(BODY.shatterFrom + 0.5);
    expect(c.dead).toBe('fall');
  });
  it('สัตว์ทำร้ายจนโหลร้าวครบแล้วแตก · ปืนกาวอุดได้', () => {
    const b = new Body();
    b.hit(); b.hit(); b.hit();
    expect(b.seal()).toBe(true);
    expect(b.cracks).toBe(2);
    b.hit(); b.hit();
    expect(b.dead).toBe('animal');
  });
  it('หนาวตายกลางคืนถ้าไม่อุ่น · ใกล้ยานอุ่นขึ้น', () => {
    const b = new Body();
    run(b, 100, env({ cold: 1 }));
    expect(b.warmth).toBeLessThan(0.5);
    run(b, 30, env({ shelter: true }));
    expect(b.warmth).toBe(1);
    run(b, 200, env({ cold: 1 }));
    expect(b.dead).toBe('cold');
  });
  it('ถังออกซิเจนเติมได้เฉพาะตอนไม่เต็ม', () => {
    const b = new Body();
    expect(b.refill()).toBe(false);
    run(b, 20, env({ underwater: true }));
    expect(b.refill()).toBe(true);
    expect(b.oxygen).toBe(1);
  });
});
