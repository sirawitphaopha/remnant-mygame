import { describe, expect, it } from 'vitest';
import { WorldGround } from '../src/app/WorldGround';
import { HERO } from '../src/config/scale';
import { buildCaves, caveAt, caveCenter, caveFeatures, insideTunnel, overCave } from '../src/world/caves';
import { Structures } from '../src/world/structures';
import { Terrain } from '../src/world/Terrain';

// ถ้ำ 2 แห่ง (รอบสอง ช่วง 11) · ถ้ำหินปูนกับถ้ำเหมืองเก่า
const t = new Terrain();
const caves = buildCaves(t);
const [lime, mine] = caves;

describe('ถ้ำ', () => {
  it('ถ้ำแรกเป็นถ้ำหินปูน ถ้ำสองเป็นเหมืองเก่า ก๊าซพิษอยู่ส่วนลึกของเหมืองเท่านั้น', () => {
    expect(lime.kind).toBe('limestone');
    expect(mine.kind).toBe('mine');
    expect(lime.gasFrom).toBeGreaterThan(1);
    expect(mine.gasFrom).toBeGreaterThan(0.4);
    expect(mine.gasFrom).toBeLessThan(0.9);
    const deep = mine.points[mine.points.length - 1];
    const at = caveAt(caves, deep.x, deep.z)!;
    expect(at.cave.id).toBe(1);
    expect(at.f).toBeGreaterThan(mine.gasFrom);
    expect(caveAt(caves, 0, 0)).toBeNull();
  });

  it('อุโมงค์อยู่ใต้ภูเขาจริง ผนังที่มองเห็นไม่โผล่พ้นผิวดิน (ยกเว้นช่วงปากถ้ำกับปล่องหลุมยุบ)', () => {
    for (const c of caves) {
      for (let f = 0.12; f <= 1; f += 0.01) {
        if (c.kind === 'limestone' && Math.abs(f - 0.4) < 0.08) continue;
        const p = caveCenter(c, f);
        // เพดานที่วาดสูงสุดราว 2.03 เท่าของรัศมี (วงรี 1.25 เท่า ยกขึ้น 0.55 ผนังนูนได้ 1.18)
        for (const side of [-1, 0, 1]) {
          const x = p.x - p.dz * side * p.r;
          const z = p.z + p.dx * side * p.r;
          expect(t.heightAt(x, z) - (p.y + p.r * 2.1), `ถ้ำ ${c.id} f ${f.toFixed(2)} ข้าง ${side}`).toBeGreaterThan(0.5);
        }
      }
    }
  });

  it('ของในถ้ำครบตามแบบ', () => {
    const count = (c: typeof lime, k: string) => caveFeatures(c).filter((f) => f.kind === k).length;
    for (const k of ['stalactite', 'stalagmite', 'column', 'root', 'moss', 'fern', 'bat']) expect(count(lime, k), k).toBeGreaterThan(2);
    for (const k of ['pool', 'sinkhole']) expect(count(lime, k), k).toBe(1);
    for (const k of ['timber', 'beam', 'lantern', 'collapse', 'crate']) expect(count(mine, k), k).toBeGreaterThan(2);
    expect(count(mine, 'cart')).toBe(2);
    expect(count(mine, 'stove')).toBe(1);
    expect(count(mine, 'cot')).toBe(2);
    // หลุมยุบเปิดถึงผิวดินจริง
    const sink = caveFeatures(lime).find((f) => f.kind === 'sinkhole')!;
    expect(sink.h).toBeGreaterThan(8);
  });

  it('เดินจากปากถ้ำถึงห้องปลายถ้ำได้ทั้งสองแห่ง โดยไม่ชนหินงอก ค้ำยัน รถเข็น กองหินถล่ม', () => {
    for (const c of caves) {
      const solids = caveFeatures(c).filter((f) => f.solid > 0);
      const STEP = 0.25;
      const start = caveCenter(c, 0.02);
      const goal = caveCenter(c, 0.97);
      const free = (x: number, z: number) => {
        const at = caveAt(caves, x, z);
        if (!at || at.cave !== c) return false;
        return !solids.some((s) => Math.hypot(s.x - x, s.z - z) < s.solid + HERO.radius);
      };
      const key = (i: number, j: number) => `${i},${j}`;
      const i0 = Math.round(start.x / STEP);
      const j0 = Math.round(start.z / STEP);
      const seen = new Set([key(i0, j0)]);
      const queue = [[i0, j0]];
      let reached = false;
      while (queue.length && !reached) {
        const [i, j] = queue.shift()!;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ni = i + di;
          const nj = j + dj;
          const k = key(ni, nj);
          if (seen.has(k)) continue;
          seen.add(k);
          const x = ni * STEP;
          const z = nj * STEP;
          if (!free(x, z)) continue;
          if (Math.hypot(x - goal.x, z - goal.z) < 1) reached = true;
          queue.push([ni, nj]);
        }
      }
      expect(reached, `ถ้ำ ${c.id}`).toBe(true);
    }
  });

  it('ผนังถ้ำกันได้ตลอดทาง เดินออกข้างอุโมงค์ขึ้นไปยืนบนเนินไม่ได้ (ข้อ 82)', () => {
    const ground = new WorldGround(t, new Structures(), caves);
    for (const c of caves) {
      for (let f = 0.04; f < 0.95; f += 0.03) {
        const p = caveCenter(c, f);
        ground.contextY = p.y;
        for (const side of [-1, 1]) {
          const d = p.r * 0.8 + 0.1;
          const x = p.x - p.dz * side * d;
          const z = p.z + p.dx * side * d;
          if (caveAt(caves, x, z)) continue; // ห้องกว้างตรงนั้นยังเป็นพื้นถ้ำ
          expect(ground.blocked(x, z), `ถ้ำ ${c.id} f ${f.toFixed(2)} ข้าง ${side}`).toBe(true);
        }
      }
    }
  });

  it('ต้นไม้กับหินขึ้นเหนืออุโมงค์ไม่ได้ (ข้อ 83) · กล้องอยู่ได้เฉพาะในโพรง (ข้อ 87)', () => {
    for (const c of caves) {
      for (let f = 0; f <= 1; f += 0.1) {
        const p = caveCenter(c, f);
        expect(overCave(caves, p.x, p.z)).toBe(true);
        const at = caveAt(caves, p.x, p.z)!;
        expect(insideTunnel(at, p.y + 1.5)).toBe(true);
        expect(insideTunnel(at, p.y + p.r * 2.2)).toBe(false);
      }
    }
    expect(overCave(caves, lime.points[8].x + 40, lime.points[8].z + 40)).toBe(false);
  });
});
