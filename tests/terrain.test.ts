import { describe, expect, it } from 'vitest';
import { WORLD } from '../src/config/game';
import { LAKE, RIVER, SHIP, TOWN } from '../src/world/layout';
import { Terrain } from '../src/world/Terrain';

const t = new Terrain();

describe('ภูมิประเทศ', () => {
  it('แมพเดิมทุกครั้ง', () => {
    const t2 = new Terrain();
    expect(t2.heightAt(123.4, -56.7)).toBe(t.heightAt(123.4, -56.7));
  });
  it('แม่น้ำกับทะเลสาบต่ำกว่าระดับน้ำ', () => {
    for (const p of RIVER.slice(1, -1)) expect(t.heightAt(p.x, p.z)).toBeLessThan(WORLD.waterLevel);
    expect(t.heightAt(LAKE.x, LAKE.z)).toBeLessThan(WORLD.waterLevel - 2);
  });
  it('เมืองกับที่จอดยานอยู่บนบก ที่จอดยานราบ', () => {
    expect(t.heightAt(TOWN.x, TOWN.z)).toBeGreaterThan(WORLD.waterLevel + 2);
    expect(t.heightAt(SHIP.x, SHIP.z)).toBeGreaterThan(WORLD.waterLevel + 2);
    expect(t.slopeAt(SHIP.x, SHIP.z)).toBeLessThan(0.05);
  });
  it('มีภูเขาสูงทางทิศเหนือ', () => {
    let max = 0;
    for (let x = -400; x <= 400; x += 20) max = Math.max(max, t.heightAt(x, -450));
    expect(max).toBeGreaterThan(70);
  });
});
