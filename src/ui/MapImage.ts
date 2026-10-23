import { WORLD } from '../config/game';
import type { ExploreMap } from '../core/explore';
import { EXPLORE } from '../core/explore';
import { RIVER, ROAD, ROAD_WIDTH, TOWN } from '../world/layout';
import type { Terrain } from '../world/Terrain';

/** ภาพแผนที่ทั้งแมพ (1 จุด = 2 เมตร) วาดครั้งเดียวจากความสูงพื้น · แล้วคลุมด้วยส่วนที่ยังไม่เคยไป */
export class MapImage {
  readonly base: HTMLCanvasElement;
  readonly revealed: HTMLCanvasElement;
  private mask: HTMLCanvasElement;
  readonly size: number;

  constructor(terrain: Terrain) {
    const n = terrain.n;
    this.size = n;
    this.base = document.createElement('canvas');
    this.base.width = this.base.height = n;
    const ctx = this.base.getContext('2d')!;
    const img = ctx.createImageData(n, n);
    const hs = terrain.heights;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const h = hs[j * n + i];
        // แรเงาเนินจากทิศตะวันตกเฉียงเหนือ ให้เห็นภูเขาเป็นสามมิติ
        const hx = hs[j * n + Math.min(n - 1, i + 1)] - h;
        const hz = hs[Math.min(n - 1, j + 1) * n + i] - h;
        const shade = Math.max(0.55, Math.min(1.25, 1 - (hx + hz) * 0.08));
        let r: number, g: number, b: number;
        if (h < WORLD.waterLevel) {
          const d = Math.min(1, (WORLD.waterLevel - h) / 5);
          r = 52 - d * 20; g = 110 - d * 30; b = 140 - d * 20;
        } else if (h > 70) { r = 120; g = 116; b = 108; }
        else if (h > 40) { r = 86; g = 98; b = 70; }
        else { r = 60; g = 86; b = 52; }
        if (h >= WORLD.waterLevel) { r *= shade; g *= shade; b *= shade; }
        const k = (j * n + i) * 4;
        img.data[k] = r;
        img.data[k + 1] = g;
        img.data[k + 2] = b;
        img.data[k + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    // ถนน แม่น้ำ เมือง วาดทับด้วยเส้น (เร็วกว่าเช็กทีละจุด)
    const toPx = (v: number) => (v + WORLD.half) / 2;
    ctx.strokeStyle = 'rgba(180,170,150,.85)';
    ctx.lineWidth = ROAD_WIDTH / 2;
    ctx.beginPath();
    ROAD.forEach((p, i) => (i ? ctx.lineTo(toPx(p.x), toPx(p.z)) : ctx.moveTo(toPx(p.x), toPx(p.z))));
    ctx.stroke();
    ctx.strokeStyle = 'rgba(70,140,175,.9)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    RIVER.forEach((p, i) => (i ? ctx.lineTo(toPx(p.x), toPx(p.z)) : ctx.moveTo(toPx(p.x), toPx(p.z))));
    ctx.stroke();
    // บล็อกตึกในเมือง (ช่วง 8 วางตึกจริง ตรงนี้วาดเป็นลานคอนกรีต)
    ctx.fillStyle = 'rgba(125,128,122,.55)';
    ctx.beginPath();
    ctx.arc(toPx(TOWN.x), toPx(TOWN.z), (TOWN.radius * 0.55) / 2, 0, Math.PI * 2);
    ctx.fill();

    this.mask = document.createElement('canvas');
    this.mask.width = this.mask.height = EXPLORE.cells;
    this.revealed = document.createElement('canvas');
    this.revealed.width = this.revealed.height = n;
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
