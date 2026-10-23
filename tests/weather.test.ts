import { describe, expect, it } from 'vitest';
import { WEATHER, weatherAt } from '../src/core/weather';
import { DAY_SECONDS } from '../src/core/time';

// อากาศ (รอบสอง ช่วง 7)
describe('อากาศ', () => {
  it('เวลาเดิมอากาศเดิม · ฝนตกราว 1 ใน 4 ของเวลา', () => {
    expect(weatherAt(12345).rain).toBe(weatherAt(12345).rain);
    let rainy = 0;
    const N = 4000;
    for (let i = 0; i < N; i++) if (weatherAt(i * DAY_SECONDS * 0.05).rain > 0.1) rainy++;
    expect(rainy / N).toBeGreaterThan(0.15);
    expect(rainy / N).toBeLessThan(0.4);
  });
  it('ฝนเริ่มและหยุดแบบค่อยเป็นค่อยไป ไม่กระโดด', () => {
    let worst = 0;
    let prev = weatherAt(0).rain;
    for (let s = 1; s < DAY_SECONDS * 20; s += 1) {
      const r = weatherAt(s).rain;
      worst = Math.max(worst, Math.abs(r - prev));
      prev = r;
    }
    // เปลี่ยนไม่เกิน 1.5% ต่อวินาที (ฝนเริ่มเต็มที่ในราวสองนาที)
    expect(worst).toBeLessThan(0.015);
  });
  it('ฝนหนักมีฟ้าร้อง ฝนเบาไม่มี · เมฆครึ้มเมื่อฝนตก', () => {
    expect(weatherAt(0, 1).thunder).toBeGreaterThan(0);
    expect(weatherAt(0, WEATHER.stormFrom - 0.1).thunder).toBe(0);
    expect(weatherAt(0, 0.8).cloud).toBeGreaterThan(0.8);
  });
});
