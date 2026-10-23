import { describe, expect, it } from 'vitest';
import { ATTACK_RANGE, LEASH, SPECIES, SPECIES_BY_ID, chaseWant, currentSpeed, decide, inkHit, newMind } from '../src/core/animals';
import { ECO_BY_ID } from '../src/core/ecology';
import { KIND_BY_ID } from '../src/core/catalog';

const sp = (id: string) => SPECIES_BY_ID.get(id)!;

describe('สัตว์', () => {
  it('มี 14 ชนิด ครบในรายการสแกน', () => {
    expect(SPECIES).toHaveLength(14);
    for (const s of SPECIES) expect(KIND_BY_ID.get(s.id)?.category, s.id).toBe('animal');
  });
  it('ตัวดุมีแค่หมาป่ากับหมี อยู่ป่าลึกเท่านั้น', () => {
    const fierce = SPECIES.filter((s) => s.aggro > 0).map((s) => s.id).sort();
    expect(fierce).toEqual(['bear', 'wolf']);
    for (const id of fierce) expect(ECO_BY_ID.get(id)?.wild).toBe(true);
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
  it('ผู้เล่นอยู่คนละชั้น (ในถ้ำ บนหลังคา) ระยะเป็นอนันต์ หมาป่าไม่ไล่ (รายงานตรวจข้อ 99)', () => {
    expect(decide(newMind(), sp('wolf'), 0.1, Infinity, 5)).toBe('wander');
  });
  it('ไล่ถึงระยะตีแล้วหยุด ไม่วิ่งทับตัวผู้เล่น (รายงานตรวจข้อ 100)', () => {
    expect(chaseWant(ATTACK_RANGE * 0.5, 4.6)).toBe(0);
    expect(chaseWant(10, 4.6)).toBeCloseTo(4.6);
    expect(chaseWant(ATTACK_RANGE * 0.8 + 0.5, 4.6)).toBeLessThan(4.6);
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
