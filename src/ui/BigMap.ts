import type { ExploreMap } from '../core/explore';
import type { MapMarker } from './Hud';
import type { MapImage } from './MapImage';
import { onLangChange, t } from './strings';

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

  show(x: number, z: number, heading: number, markers: MapMarker[]): void {
    this.root.hidden = false;
    this.draw(x, z, heading, markers);
  }

  hide(): void {
    this.root.hidden = true;
  }

  private draw(x: number, z: number, heading: number, markers: MapMarker[]): void {
    if (this.explore.dirty) this.map.refresh(this.explore);
    this.sub.textContent = `${t('mapSub')} ${Math.round(this.explore.fraction() * 100)}% · 1 × 1 ${t('km')}`;
    const c = this.canvas.getContext('2d')!;
    const S = this.canvas.width;
    const k = S / 1000;
    c.fillStyle = '#050b0c';
    c.fillRect(0, 0, S, S);
    c.imageSmoothingEnabled = true;
    c.drawImage(this.map.revealed, 0, 0, S, S);
    c.strokeStyle = 'rgba(111,240,224,.08)';
    c.lineWidth = 1;
    for (let g = 0; g <= 1000; g += 100) {
      c.beginPath(); c.moveTo(g * k, 0); c.lineTo(g * k, S); c.stroke();
      c.beginPath(); c.moveTo(0, g * k); c.lineTo(S, g * k); c.stroke();
    }
    const px = (v: number) => (v + 500) * k;
    c.font = '600 22px "Chakra Petch", "Sarabun", sans-serif';
    c.textAlign = 'center';
    for (const m of markers) {
      const X = px(m.x);
      const Z = px(m.z);
      c.fillStyle = c.strokeStyle = COLOR[m.kind];
      if (m.kind === 'ship') {
        c.beginPath(); c.arc(X, Z, 11, 0, Math.PI * 2); c.fill();
        c.fillText(t('ship'), X, Z + 36);
      } else if (m.kind === 'bag') {
        c.fillRect(X - 9, Z - 9, 18, 18);
      } else {
        c.lineWidth = 4;
        c.beginPath(); c.moveTo(X - 10, Z - 10); c.lineTo(X + 10, Z + 10); c.moveTo(X + 10, Z - 10); c.lineTo(X - 10, Z + 10); c.stroke();
      }
    }
    c.save();
    c.translate(px(x), px(z));
    c.rotate(-heading);
    c.fillStyle = '#fff';
    c.beginPath(); c.moveTo(0, -18); c.lineTo(-12, 13); c.lineTo(0, 7); c.lineTo(12, 13); c.closePath(); c.fill();
    c.restore();
  }
}
