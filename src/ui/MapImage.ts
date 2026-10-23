import { WORLD } from '../config/game';
import type { ExploreMap } from '../core/explore';
import { EXPLORE } from '../core/explore';
import { MOUNTAINS, RIVER, ROADS, ROAD_WIDTH, TOWN } from '../world/layout';
import type { Terrain } from '../world/Terrain';
import { BIOME } from '../world/terrainGen';

/** 1 จุดของภาพแผนที่ = 4 เมตร (แมพ 3 กม. ได้ภาพ 750 × 750) */
export const MAP_PX = 4;

/** สีแผนที่ตามชนิดพื้นที่ (แบบแผนที่กระดาษ ไม่ต้องเหมือนสีพื้นในเกม) */
const MAP_COLOR: Record<number, [number, number, number]> = {
  [BIOME.shore]: [150, 140, 110],
  [BIOME.meadow]: [78, 100, 58],
  [BIOME.flowers]: [96, 104, 66],
  [BIOME.tallGrass]: [104, 108, 62],
  [BIOME.farmland]: [118, 108, 70],
  [BIOME.wetland]: [62, 90, 70],
  [BIOME.town]: [96, 100, 86],
  [BIOME.redwood]: [70, 58, 42],
  [BIOME.rainforest]: [36, 70, 40],
  [BIOME.deciduous]: [82, 84, 48],
  [BIOME.orchard]: [74, 96, 52],
  [BIOME.dense]: [46, 70, 42],
  [BIOME.alpine]: [112, 112, 86],
  [BIOME.rock]: [118, 114, 106],
  [BIOME.snow]: [214, 220, 226],
};

/** ภาพแผนที่ทั้งแมพ วาดครั้งเดียวจากความสูงกับชนิดพื้นที่ · แล้วคลุมด้วยส่วนที่ยังไม่เคยไป */
export class MapImage {
  readonly base: HTMLCanvasElement;
  readonly revealed: HTMLCanvasElement;
  private mask: HTMLCanvasElement;
  readonly size: number;

  constructor(terrain: Terrain) {
    const n = WORLD.size / MAP_PX;
    this.size = n;
    this.base = document.createElement('canvas');
    this.base.width = this.base.height = n;
    const ctx = this.base.getContext('2d')!;
    const img = ctx.createImageData(n, n);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x = -WORLD.half + (i + 0.5) * MAP_PX;
        const z = -WORLD.half + (j + 0.5) * MAP_PX;
        const h = terrain.heightAt(x, z);
        // แรเงาเนินจากทิศตะวันตกเฉียงเหนือ ให้เห็นภูเขาเป็นสามมิติ
        const hx = terrain.heightAt(x + MAP_PX, z) - h;
        const hz = terrain.heightAt(x, z + MAP_PX) - h;
        const shade = Math.max(0.5, Math.min(1.3, 1 - (hx + hz) * 0.045));
        let r: number, g: number, b: number;
        if (h < WORLD.waterLevel) {
          const d = Math.min(1, (WORLD.waterLevel - h) / 5);
          r = 52 - d * 20; g = 110 - d * 30; b = 140 - d * 20;
        } else {
          [r, g, b] = MAP_COLOR[terrain.biomeAt(x, z)] ?? MAP_COLOR[BIOME.meadow];
          // เส้นชั้นความสูงจาง ๆ ทุก 100 ม. บนภูเขา
          if (h > 60 && Math.floor(h / 100) !== Math.floor((h + Math.abs(hx) + Math.abs(hz)) / 100)) { r *= 0.8; g *= 0.8; b *= 0.8; }
          if (h > MOUNTAINS.snowLine && terrain.biomeAt(x, z) !== BIOME.rock) { r = r * 0.4 + 130; g = g * 0.4 + 134; b = b * 0.4 + 138; }
          r *= shade; g *= shade; b *= shade;
        }
        const k = (j * n + i) * 4;
        img.data[k] = r;
        img.data[k + 1] = g;
        img.data[k + 2] = b;
        img.data[k + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    // ถนน แม่น้ำ เมือง วาดทับด้วยเส้น (เร็วกว่าเช็กทีละจุด)
    const toPx = (v: number) => (v + WORLD.half) / MAP_PX;
    ctx.strokeStyle = 'rgba(180,170,150,.85)';
    ctx.lineWidth = Math.max(1.5, (ROAD_WIDTH * 2) / MAP_PX);
    for (const road of ROADS) {
      ctx.beginPath();
      road.forEach((p, i) => (i ? ctx.lineTo(toPx(p.x), toPx(p.z)) : ctx.moveTo(toPx(p.x), toPx(p.z))));
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(70,140,175,.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    RIVER.forEach((p, i) => (i ? ctx.lineTo(toPx(p.x), toPx(p.z)) : ctx.moveTo(toPx(p.x), toPx(p.z))));
    ctx.stroke();
    // ลานคอนกรีตในเมือง (ตึกวาดทับด้วย drawBoxes)
    ctx.fillStyle = 'rgba(125,128,122,.45)';
    ctx.beginPath();
    ctx.arc(toPx(TOWN.x), toPx(TOWN.z), (TOWN.radius * 0.55) / MAP_PX, 0, Math.PI * 2);
    ctx.fill();

    this.mask = document.createElement('canvas');
    this.mask.width = this.mask.height = EXPLORE.cells;
    this.revealed = document.createElement('canvas');
    this.revealed.width = this.revealed.height = n;
  }

  /** วาดตึกกับสะพานลงบนภาพแผนที่ (กล่องหมุนได้) */
  drawBoxes(boxes: { x: number; z: number; hx: number; hz: number; rot: number }[]): void {
    const ctx = this.base.getContext('2d')!;
    ctx.fillStyle = 'rgba(150,152,146,.95)';
    for (const b of boxes) {
      ctx.save();
      ctx.translate((b.x + WORLD.half) / MAP_PX, (b.z + WORLD.half) / MAP_PX);
      ctx.rotate(-b.rot);
      ctx.fillRect(-b.hx / MAP_PX, -b.hz / MAP_PX, (b.hx * 2) / MAP_PX, (b.hz * 2) / MAP_PX);
      ctx.restore();
    }
  }

  /** วาดส่วนที่เคยไปใหม่ (เรียกเมื่อแผนที่ที่สำรวจเปลี่ยน) */
  refresh(explore: ExploreMap): void {
    const m = this.mask.getContext('2d')!;
    const img = m.createImageData(EXPLORE.cells, EXPLORE.cells);
    for (let k = 0; k < explore.bits.length; k++) {
      img.data[k * 4] = img.data[k * 4 + 1] = img.data[k * 4 + 2] = 255;
      img.data[k * 4 + 3] = explore.bits[k] ? 255 : 0;
    }
    m.putImageData(img, 0, 0);
    const r = this.revealed.getContext('2d')!;
    r.globalCompositeOperation = 'source-over';
    r.clearRect(0, 0, this.size, this.size);
    r.imageSmoothingEnabled = true;
    r.drawImage(this.mask, 0, 0, this.size, this.size);
    r.globalCompositeOperation = 'source-in';
    r.drawImage(this.base, 0, 0);
    r.globalCompositeOperation = 'source-over';
    explore.dirty = false;
  }
}
