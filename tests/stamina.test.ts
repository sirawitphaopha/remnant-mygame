import { describe, expect, it } from 'vitest';
import { newStamina, spendJump, stepStamina } from '../src/core/stamina';

function run(act: Parameters<typeof stepStamina>[2], seconds: number, grade = 0, load = 0) {
  const s = newStamina();
  for (let t = 0; t < seconds; t += 0.1) stepStamina(s, 0.1, act, grade, load);
  return s;
}

describe('แรง', () => {
  it('เดินราบไม่เหนื่อย', () => {
    expect(run('walk', 60).value).toBe(100);
  });
  it('วิ่งราบหมดแรงราว 14 วินาที', () => {
    expect(run('run', 10).value).toBeGreaterThan(20);
    expect(run('run', 15).exhausted).toBe(true);
  });
  it('เดินขึ้นเนินเหนื่อยกว่าเดินราบ แบกของหนักเหนื่อยกว่าตัวเปล่า', () => {
    expect(run('walk', 10, 0.5).value).toBeLessThan(100);
    expect(run('run', 8, 0, 1).value).toBeLessThan(run('run', 8, 0, 0).value);
  });
  it('ปีนหนักกว่าว่ายน้ำ', () => {
    expect(run('climb', 5).value).toBeLessThan(run('swim', 5).value);
  });
  it('หมดแรงแล้วยังกระโดดได้ แต่เตี้ยลงและไม่กินแรง (พี่กันสั่ง 26 ต.ค. 2569 วิ่งต้องกระโดดได้)', () => {
    const s = run('run', 20);
    const before = s.value;
    expect(spendJump(s, 0)).toBeLessThan(1);
    expect(spendJump(s, 0)).toBeGreaterThan(0.5);
    expect(s.value).toBe(before);
    for (let t = 0; t < 4; t += 0.1) stepStamina(s, 0.1, 'idle', 0, 0);
    expect(s.exhausted).toBe(false);
    expect(spendJump(s, 0)).toBe(1);
  });
});
