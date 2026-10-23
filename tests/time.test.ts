import { describe, expect, it } from 'vitest';
import { DAY_SECONDS, MOON_CYCLE_DAYS, clockText, skyAt } from '../src/core/time';

describe('เวลาในเกม', () => {
  it('เที่ยงวันดวงอาทิตย์อยู่สูง เที่ยงคืนอยู่ใต้ขอบฟ้า', () => {
    expect(skyAt(DAY_SECONDS * 0.5).sunHeight).toBeGreaterThan(0.8);
    expect(skyAt(0).sunHeight).toBeLessThan(-0.8);
  });
  it('ดวงอาทิตย์ขึ้นทางตะวันออก ตกทางตะวันตก', () => {
    expect(skyAt(DAY_SECONDS * 0.26).sun[0]).toBeGreaterThan(0.9);
    expect(skyAt(DAY_SECONDS * 0.74).sun[0]).toBeLessThan(-0.9);
  });
  it('ข้างขึ้นข้างแรมครบรอบทุก 8 วัน เต็มดวงกลางรอบ', () => {
    expect(skyAt(0).moonLight).toBeCloseTo(0, 5);
    expect(skyAt(DAY_SECONDS * MOON_CYCLE_DAYS * 0.5).moonLight).toBeCloseTo(1, 5);
    expect(skyAt(DAY_SECONDS * MOON_CYCLE_DAYS).moonLight).toBeCloseTo(0, 5);
  });
  it('คืนเดือนเต็ม ดวงจันทร์อยู่บนฟ้าตอนเที่ยงคืน', () => {
    const s = skyAt(DAY_SECONDS * (MOON_CYCLE_DAYS * 0.5));
    expect(s.moon[1]).toBeGreaterThan(0.8);
  });
  it('หมอกหนาตอนเช้าตรู่ ไม่มีตอนบ่าย', () => {
    expect(skyAt(DAY_SECONDS * (6.3 / 24)).fog).toBeGreaterThan(0.9);
    expect(skyAt(DAY_SECONDS * (15 / 24)).fog).toBe(0);
  });
  it('นาฬิกา', () => {
    expect(clockText(7.5 / 24)).toBe('07:30');
  });
});
