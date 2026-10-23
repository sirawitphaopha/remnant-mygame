import { WORLD } from '../config/game';
import type { SlopeGround } from '../player/Player';
import { caveAt, type Cave } from '../world/caves';
import type { Structures } from '../world/structures';
import type { Terrain } from '../world/Terrain';

/**
 * พื้นที่ตัวละครเหยียบ รวมทุกอย่าง: ภูมิประเทศ พื้นถ้ำ หลังคา พื้นสะพาน
 * อยู่ในถ้ำ = ใช้พื้นถ้ำแทนภูเขาข้างบน · ผนังถ้ำเดินทะลุไม่ได้
 */
export class WorldGround implements SlopeGround {
  contextY = Infinity;

  constructor(private terrain: Terrain, private structures: Structures, private caves: Cave[]) {}

  /** อยู่ระดับพื้นถ้ำตรงนั้นไหม */
  private cave(x: number, z: number, y: number) {
    const c = caveAt(this.caves, x, z);
    if (!c) return null;
    return y < c.floor + 1.4 && y > c.floor - 3 ? c : null;
  }

  heightAt(x: number, z: number): number {
    const y = this.contextY;
    const c = this.cave(x, z, y);
    if (c) return c.floor;
    const t = this.terrain.heightAt(x, z);
    const s = this.structures.floorAt(x, z, Math.max(y, t));
    return Math.max(t, s);
  }

  /** พื้นใต้จุดนี้ ณ ความสูง y (วางซาก กระเป๋า หมึก ให้อยู่ชั้นเดียวกับที่อยู่จริง ทั้งในถ้ำและบนหลังคา) */
  groundAt(x: number, z: number, y: number): number {
    const keep = this.contextY;
    this.contextY = y + 0.4;
    const h = this.heightAt(x, z);
    this.contextY = keep;
    return h;
  }

  waterAt(x: number, z: number): number {
    return this.terrain.heightAt(x, z) < WORLD.waterLevel ? WORLD.waterLevel : -Infinity;
  }

  normalAt(x: number, z: number): [number, number, number] {
    const y = this.contextY;
    if (this.cave(x, z, y)) return [0, 1, 0];
    const t = this.terrain.heightAt(x, z);
    if (this.structures.floorAt(x, z, Math.max(y, t)) > t + 0.05) return [0, 1, 0];
    return this.terrain.normalAt(x, z);
  }

  /** ในถ้ำแล้วเดินออกนอกอุโมงค์ (ตรงนั้นเป็นหิน) = ผนัง */
  blocked(x: number, z: number): boolean {
    const y = this.contextY;
    if (!isFinite(y)) return false;
    const t = this.terrain.heightAt(x, z);
    if (t < y + 2) return false;
    return !this.cave(x, z, y);
  }

  pushOut(x: number, z: number, r: number, feetY: number) {
    return this.structures.push(x, z, r, feetY);
  }
}
