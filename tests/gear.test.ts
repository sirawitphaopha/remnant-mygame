import { describe, expect, it } from 'vitest';
import { equipToArm, held, holding, slotKg, starterPack } from '../src/core/gear';

describe('อุปกรณ์และ 4 แขน', () => {
  it('แพ็กเกจเริ่มต้นมีครบ 7 อย่าง ถือ 4 อย่างไว้ในแขน', () => {
    const l = starterPack();
    expect(l.belt.filter(Boolean)).toHaveLength(7);
    expect(l.arms).toEqual([0, 1, 2, 3]);
    expect(holding(l, 'scanner')).not.toBeNull();
    expect(holding(l, 'climber')).toBeNull();
  });
  it('กดเลขเอาของเข้าแขนหลัก ถ้าแขนอื่นถืออยู่ให้สลับกัน', () => {
    const l = starterPack();
    equipToArm(l, 4);
    expect(l.arms[0]).toBe(4);
    expect(holding(l, 'climber')).not.toBeNull();
    equipToArm(l, 1);
    expect(l.arms[0]).toBe(1);
    expect(l.arms[1]).toBe(4);
  });
  it('กดเลขช่องว่างไม่มีผล', () => {
    const l = starterPack();
    equipToArm(l, 8);
    expect(l.arms).toEqual([0, 1, 2, 3]);
  });
  it('อุปกรณ์ทุกชิ้นมีน้ำหนัก แพ็กเริ่มต้นราว 9 กก.', () => {
    const l = starterPack();
    const kg = l.belt.reduce((s, x) => s + slotKg(x), 0);
    expect(kg).toBeGreaterThan(8.5);
    expect(kg).toBeLessThan(10);
    expect(held(l, 0)).toMatchObject({ id: 'scanner' });
  });
});

import { buildLoadout, choiceSlots, starterChoice } from '../src/core/gear';
describe('หน้ายาน เลือกของก่อนออกเดินทาง', () => {
  it('แพ็กเกจเริ่มต้นได้ของเหมือน starterPack', () => {
    const l = buildLoadout(starterChoice());
    expect(l.belt.filter(Boolean)).toHaveLength(7);
    expect(choiceSlots(starterChoice())).toBe(7);
    expect(l.arms.every((x) => x !== null)).toBe(true);
  });
  it('จำนวนหมึก กาว ถัง ไม่เกินที่รับได้', () => {
    const l = buildLoadout({ ...starterChoice(), ink: 99, glue: 99, tanks: 9 });
    expect(l.belt.find((s) => s && s.kind === 'gear' && s.id === 'inkGun')).toMatchObject({ amount: 10 });
    expect(l.belt.find((s) => s && s.kind === 'gear' && s.id === 'oxygenTank')).toMatchObject({ amount: 2 });
  });
});
