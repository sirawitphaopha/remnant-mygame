import { RUIN_PLACES } from '../world/ruins';
import { WORLD } from '../config/game';
import type { ExploreMap } from '../core/explore';
import { BRIDGE, CAVES, LAKE, REGIONS, TOWN } from '../world/layout';
import type { MapMarker } from './Hud';
import { MAP_PX, type MapImage } from './MapImage';
import { onLangChange, t, tf, type StrKey } from './strings';

/** ชื่อที่บนแผนที่ใหญ่ (ขึ้นเฉพาะที่ที่เคยไปแล้ว ไม่เฉลยล่วงหน้า) */
const PLACES: { key: StrKey; x: number; z: number }[] = [
  { key: 'placeTown', x: TOWN.x, z: TOWN.z },
  { key: 'placeLake', x: LAKE.x, z: LAKE.z },
  { key: 'placeCave1', x: CAVES[0].x, z: CAVES[0].z + 20 },
  { key: 'placeCave2', x: CAVES[1].x + 20, z: CAVES[1].z },
  { key: 'placeBridge', x: BRIDGE.x, z: BRIDGE.z - 25 },
  { key: 'placeMountains', x: 0, z: -1200 },
  { key: 'placeRedwood', x: REGIONS.redwood.x, z: REGIONS.redwood.z },
  { key: 'placeRainforest', x: 130, z: -380 },
  { key: 'placeDeciduous', x: REGIONS.deciduous.x, z: REGIONS.deciduous.z },
  { key: 'placeFlowers', x: REGIONS.flowers.x, z: REGIONS.flowers.z },
  { key: 'placeOrchard', x: REGIONS.orchard.x, z: REGIONS.orchard.z },
  { key: 'placeWetland', x: REGIONS.wetland.x + 150, z: REGIONS.wetland.z + 120 },
  { key: 'placeDense', x: REGIONS.dense.x, z: REGIONS.dense.z },
  // ซากอารยธรรมนอกเมือง (ช่วง 10)
  ...RUIN_PLACES.map((p) => ({ key: p.key as StrKey, x: p.at.x, z: p.at.z })),
];
const ZOOMS = [1, 2, 4, 8];

const COLOR = { ship: '#6ff0e0', death: '#ff7070', oldBody: 'rgba(255,255,255,.55)', bag: '#c7a5ff' } as const;

// สัญลักษณ์วาดเป็นเส้น ไม่ใช้ตัวอักษรพิเศษ
const svgCross = (c: string) => `<svg viewBox="0 0 12 12" width="14" height="14"><path d="M2 2l8 8M10 2l-8 8" stroke="${c}" stroke-width="2.2"/></svg>`;
const svgArrow = () => '<svg viewBox="0 0 12 12" width="14" height="14"><path d="M6 1l4.5 10L6 8 1.5 11z" fill="#fff"/></svg>';

/** แผนที่จอใหญ่ (กด M) · เปิดเฉพาะที่เคยไป */
export class BigMap {
  readonly root: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private sub: HTMLSpanElement;
  private title: HTMLHeadingElement;
  private closeBtn: HTMLButtonElement;
  private legend: HTMLDivElement;
  private notes: HTMLParagraphElement;
  onClose: () => void = () => {};

  constructor(parent: HTMLElement, private map: MapImage, private explore: ExploreMap) {
    this.root = document.createElement('div');
    this.root.className = 'overlay';
    this.root.hidden = true;
    this.root.innerHTML = `
      <div class="holo">
        <div class="holo-head"><h2></h2><span class="sub"></span><span class="spacer"></span><button class="btn" type="button"></button></div>
        <div class="bigmap">
          <div class="panel map"><canvas width="1000" height="1000"></canvas></div>
          <div class="panel"><h4></h4><div class="legend-list"></div><p class="map-note"></p></div>
        </div>
      </div>`;
    parent.appendChild(this.root);
    this.canvas = this.root.querySelector('canvas')!;
    this.title = this.root.querySelector('h2')!;
    this.sub = this.root.querySelector('.sub')!;
    this.closeBtn = this.root.querySelector('button')!;
    this.legend = this.root.querySelector('.legend-list')!;
    this.notes = this.root.querySelector('.map-note')!;
    this.closeBtn.addEventListener('click', () => this.onClose());
    this.bindPointer();
    this.applyLang();
    onLangChange(() => this.applyLang());
  }

  private applyLang(): void {
    this.title.textContent = t('map');
    this.closeBtn.innerHTML = `${t('close')}<kbd>M</kbd>`;
    (this.root.querySelector('h4') as HTMLElement).textContent = t('legend');
    this.legend.innerHTML = `
      <i style="background:${COLOR.ship}"></i><span>${t('legShip')}</span>
      ${svgArrow()}<span>${t('legMe')}</span>
      ${svgCross(COLOR.death)}<span>${t('legDeath')}</span>
      ${svgCross(COLOR.oldBody)}<span>${t('legOldBody')}</span>
      <i style="background:${COLOR.bag};border-radius:2px"></i><span>${t('legBag')}</span>`;
    this.notes.innerHTML = `${t('mapNote1')}<br>${t('mapNote2')}`;
  }

  get open(): boolean {
    return !this.root.hidden;
  }

  /** ซูม 1 2 4 8 เท่า · จุดกลางมุมมอง (เมตร) */
  private zoom = 1;
  private cx = 0;
  private cz = 0;
  private last: { x: number; z: number; heading: number; markers: MapMarker[] } = { x: 0, z: 0, heading: 0, markers: [] };
  /** จุดใต้เมาส์บนแผนที่ (เมตร) ไว้ขึ้นพิกัด · null = เมาส์ไม่อยู่บนแผนที่ */
  private hover: { x: number; z: number; sx: number; sy: number } | null = null;

  show(x: number, z: number, heading: number, markers: MapMarker[]): void {
    this.root.hidden = false;
    this.zoom = 1;
    this.cx = 0;
    this.cz = 0;
    this.last = { x, z, heading, markers };
    this.draw();
  }

  /** ลูกกลิ้งซูมเข้าหาจุดใต้เมาส์ · ลากเลื่อน · ดับเบิลคลิกกลับทั้งแมพ */
  private bindPointer(): void {
    const cv = this.canvas;
    const toWorld = (e: MouseEvent) => {
      const r = cv.getBoundingClientRect();
      const V = WORLD.size / this.zoom;
      return { x: this.cx - V / 2 + ((e.clientX - r.left) / r.width) * V, z: this.cz - V / 2 + ((e.clientY - r.top) / r.height) * V };
    };
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      const at = toWorld(e);
      const i = ZOOMS.indexOf(this.zoom);
      const next = ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, i + (e.deltaY < 0 ? 1 : -1)))];
      if (next === this.zoom) return;
      // จุดใต้เมาส์อยู่ที่เดิมหลังซูม
      const k = this.zoom / next;
      this.cx = at.x + (this.cx - at.x) * k;
      this.cz = at.z + (this.cz - at.z) * k;
      this.zoom = next;
      this.clamp();
      this.draw();
    }, { passive: false });
    let drag: { x: number; y: number } | null = null;
    cv.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', (e) => {
      // พิกัดตรงจุดที่เมาส์ชี้ (พี่กันขอ 26 ต.ค. 2569 ไว้บอกตำแหน่งที่อยากให้แก้)
      if (!drag) {
        const r = cv.getBoundingClientRect();
        const at = toWorld(e);
        this.hover = { x: at.x, z: at.z, sx: ((e.clientX - r.left) / r.width) * cv.width, sy: ((e.clientY - r.top) / r.height) * cv.height };
        this.draw();
        return;
      }
      const r = cv.getBoundingClientRect();
      const V = WORLD.size / this.zoom;
      this.cx -= ((e.clientX - drag.x) / r.width) * V;
      this.cz -= ((e.clientY - drag.y) / r.height) * V;
      drag = { x: e.clientX, y: e.clientY };
      this.clamp();
      this.draw();
    });
    const end = () => { drag = null; };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
    cv.addEventListener('pointerleave', () => { this.hover = null; this.draw(); });
    cv.addEventListener('dblclick', () => { this.zoom = 1; this.cx = this.cz = 0; this.draw(); });
  }

  private clamp(): void {
    const lim = WORLD.half - WORLD.size / this.zoom / 2;
    this.cx = Math.max(-lim, Math.min(lim, this.cx));
    this.cz = Math.max(-lim, Math.min(lim, this.cz));
  }

  hide(): void {
    this.root.hidden = true;
  }

  private draw(): void {
    const { x, z, heading, markers } = this.last;
    if (this.explore.dirty) this.map.refresh(this.explore);
    const km = WORLD.size / 1000;
    this.sub.textContent = `${t('mapSub')} ${Math.round(this.explore.fraction() * 100)}% · ${km} × ${km} ${t('km')} · ${t('mapYou')} X ${Math.round(x)} · Y ${Math.round(-z)} · ${t('mapZoomHint')}`;
    const c = this.canvas.getContext('2d')!;
    const S = this.canvas.width;
    const V = WORLD.size / this.zoom;
    const left = this.cx - V / 2;
    const top = this.cz - V / 2;
    const k = S / V;
    c.fillStyle = '#050b0c';
    c.fillRect(0, 0, S, S);
    c.imageSmoothingEnabled = this.zoom < 4;
    c.drawImage(this.map.revealed, (left + WORLD.half) / MAP_PX, (top + WORLD.half) / MAP_PX, V / MAP_PX, V / MAP_PX, 0, 0, S, S);
    // ตาราง 500 ม. (ซูมมาก 100 ม.)
    const gridStep = this.zoom >= 4 ? 100 : 500;
    c.strokeStyle = 'rgba(111,240,224,.08)';
    c.lineWidth = 1;
    for (let g = -WORLD.half; g <= WORLD.half; g += gridStep) {
      const gx = (g - left) * k;
      const gz = (g - top) * k;
      c.beginPath(); c.moveTo(gx, 0); c.lineTo(gx, S); c.stroke();
      c.beginPath(); c.moveTo(0, gz); c.lineTo(S, gz); c.stroke();
    }
    // เลขพิกัดกำกับเส้นตาราง: X ตามขอบบน · Y ตามขอบซ้าย (Y เหนือบวก = −z ในโค้ด) · กลางแมพคือ 0 0
    // ภาพแผนที่ 1000 จุดถูกย่อลงราวครึ่งหนึ่งตอนแสดงบนจอ ตัวเลขจึงต้องใหญ่ในภาพ (เดิม 15 จุด บนจอเหลือราว 6 จุด อ่านไม่ออก)
    c.font = '600 30px "Roboto Mono", monospace';
    c.fillStyle = 'rgba(111,240,224,.75)';
    c.textBaseline = 'top';
    c.textAlign = 'center';
    for (let g = -WORLD.half; g <= WORLD.half; g += gridStep) {
      const gx = (g - left) * k;
      if (gx > 50 && gx < S - 50) c.fillText(String(g), gx, 8);
    }
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    for (let g = -WORLD.half; g <= WORLD.half; g += gridStep) {
      const gz = (g - top) * k;
      if (gz > 50 && gz < S - 24) c.fillText(String(-g), 8, gz);
    }
    c.textBaseline = 'alphabetic';
    const px = (v: number) => (v - left) * k;
    const pz = (v: number) => (v - top) * k;
    // ชื่อที่ (เฉพาะที่เคยไป)
    c.textAlign = 'center';
    c.font = '500 20px "Chakra Petch", "Sarabun", sans-serif';
    c.lineWidth = 4;
    c.strokeStyle = 'rgba(5,11,12,.8)';
    c.fillStyle = 'rgba(233,244,242,.82)';
    for (const p of PLACES) {
      if (!this.explore.isOpen(p.x, p.z)) continue;
      c.strokeText(t(p.key), px(p.x), pz(p.z));
      c.fillText(t(p.key), px(p.x), pz(p.z));
    }
    c.font = '600 20px "Chakra Petch", "Sarabun", sans-serif';
    for (const m of markers) {
      const X = px(m.x);
      const Z = pz(m.z);
      c.fillStyle = c.strokeStyle = COLOR[m.kind];
      let label = '';
      if (m.kind === 'ship') {
        c.beginPath(); c.arc(X, Z, 11, 0, Math.PI * 2); c.fill();
        label = t('ship');
      } else if (m.kind === 'bag') {
        c.fillRect(X - 9, Z - 9, 18, 18);
        label = t('bagMark');
      } else {
        c.lineWidth = 4;
        c.beginPath(); c.moveTo(X - 10, Z - 10); c.lineTo(X + 10, Z + 10); c.moveTo(X + 10, Z - 10); c.lineTo(X - 10, Z + 10); c.stroke();
        if (m.n) label = tf('mapBodyN', { n: m.n });
      }
      if (label) {
        c.lineWidth = 4;
        c.strokeStyle = 'rgba(5,11,12,.8)';
        c.strokeText(label, X, Z + 34);
        c.fillText(label, X, Z + 34);
      }
    }
    c.save();
    c.translate(px(x), pz(z));
    c.rotate(-heading);
    c.fillStyle = '#fff';
    c.beginPath(); c.moveTo(0, -18); c.lineTo(-12, 13); c.lineTo(0, 7); c.lineTo(12, 13); c.closePath(); c.fill();
    c.restore();
    // พิกัดตรงจุดที่เมาส์ชี้ กากบาทเล็ก ๆ กับป้ายเลข
    if (this.hover) {
      const h = this.hover;
      const label = `X ${Math.round(h.x)} · Y ${Math.round(-h.z)}`;
      c.strokeStyle = '#fff';
      c.lineWidth = 4;
      c.beginPath(); c.moveTo(h.sx - 18, h.sy); c.lineTo(h.sx + 18, h.sy); c.moveTo(h.sx, h.sy - 18); c.lineTo(h.sx, h.sy + 18); c.stroke();
      c.font = '600 38px "Roboto Mono", monospace';
      const w = c.measureText(label).width + 28;
      const bx = Math.min(S - w - 6, h.sx + 26);
      const by = Math.max(6, h.sy - 74);
      c.fillStyle = 'rgba(5,11,12,.88)';
      c.fillRect(bx, by, w, 54);
      c.fillStyle = '#e9f4f2';
      c.textAlign = 'left';
      c.textBaseline = 'middle';
      c.fillText(label, bx + 14, by + 28);
      c.textBaseline = 'alphabetic';
    }
  }
}
