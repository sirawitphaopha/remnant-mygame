import { describe, expect, it } from 'vitest';
import { LEASH, SPECIES, SPECIES_BY_ID, currentSpeed, decide, inkHit, newMind } from '../src/core/animals';
import { KIND_BY_ID } from '../src/core/catalog';

const sp = (id: string) => SPECIES_BY_ID.get(id)!;

describe('สัตว์', () => {
  it('มี 12 ชนิด ครบในรายการสแกน', () => {
    expect(SPECIES).toHaveLength(12);
    for (const s of SPECIES) expect(KIND_BY_ID.get(s.id)?.category, s.id).toBe('animal');
  });
  it('ตัวดุมีแค่หมาป่ากับหมี อยู่ป่าลึก', () => {
    const fierce = SPECIES.filter((s) => s.aggro > 0).map((s) => s.id).sort();
    expect(fierce).toEqual(['bear', 'wolf']);
    for (const id of fierce) expect(sp(id).habitat).toBe('deep');
  });
  it('กวางเห็นคนใกล้แล้วหนี', () => {
    const m = newMind();
    expect(decide(m, sp('deer'), 0.1, 10, 0)).toBe('flee');
    expect(decide(newMind(), sp('deer'), 0.1, 60, 0)).toBe('wander');
  });
  it('หมาป่าไล่เมื่อเข้าใกล้ ไกลจากที่อยู่เกินแล้วกลับ', () => {
    expect(decide(newMind(), sp('wolf'), 0.1, 15, 5)).toBe('chase');
    expect(decide(newMind(), sp('wolf'), 0.1, 15, LEASH + 5)).toBe('return');
  });
  it('หมึก: กวางตกใจหนี · หมาป่าเฉยแต่ช้าลง · หมีดุกว่าเดิม', () => {
    const d = newMind();
    inkHit(d, sp('deer'));
    expect(decide(d, sp('deer'), 0.1, 50, 0)).toBe('flee');
    const w = newMind();
    inkHit(w, sp('wolf'));
    expect(currentSpeed(w, sp('wolf'), 4.6)).toBeLessThan(2.5);
    expect(decide(w, sp('wolf'), 0.1, 10, 0)).toBe('chase');
    const b = newMind();
    inkHit(b, sp('bear'));
    expect(b.enraged).toBe(true);
    expect(decide(b, sp('bear'), 0.1, 24, 0)).toBe('chase');
  });
});
