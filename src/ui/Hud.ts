import type { ExploreMap } from '../core/explore';
import { ICONS } from './icons';
import type { MapImage } from './MapImage';
import { onLangChange, t, type StrKey } from './strings';

export interface ArmView {
  /** ปุ่มที่ใช้แขนนี้ */
  key: 'keyLeft' | 'keyRight' | 'Q' | 'R';
  name: string;
  sub: string;
  main: boolean;
  /** กำลังทำงาน เช่น ไฟฉายเปิดอยู่ */
  active: boolean;
  empty: boolean;
}

export interface SlotView {
  icon: string;
  label: string;
  inArm: boolean;
  count?: string;
  empty: boolean;
}

export type MarkerKind = 'ship' | 'death' | 'oldBody' | 'bag';
export interface MapMarker { kind: MarkerKind; x: number; z: number }

export interface HudView {
  yaw: number;
  x: number;
  z: number;
  heading: number;
  stamina: number;
  exhausted: boolean;
  /** null = ไม่แสดง (โผล่เฉพาะตอนกำลังลด) */
  oxygen: number | null;
  /** null = ไม่แสดง (โผล่เฉพาะตอนเปิดไฟฉาย) */
  battery: number | null;
  arms: ArmView[];
  belt: SlotView[];
  markers: MapMarker[];
  prompt: { key: string; text: string } | null;
  reticle: boolean;
}

const MARKER_COLOR: Record<MarkerKind, string> = { ship: '#6ff0e0', death: '#ff7070', oldBody: 'rgba(255,255,255,.55)', bag: '#c7a5ff' };
const COMPASS: [StrKey, number][] = [
  ['compassN', 0], ['compassNE', 45], ['compassE', 90], ['compassSE', 135], ['compassS', 180], ['compassSW', 225], ['compassW', 270], ['compassNW', 315],
];
const ARM_NAMES: StrKey[] = ['armUR', 'armUL', 'armLR', 'armLL'];

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, parent?: HTMLElement): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  parent?.appendChild(e);
  return e;
}

/** ส่วนบนจอระหว่างเล่น · วาดใหม่จากข้อมูลที่ได้ทุกเฟรม (ไม่เก็บสถานะเกมเอง) */
export class Hud {
  readonly root: HTMLDivElement;
  private compass: HTMLDivElement;
  private compassMarks: { el: HTMLSpanElement; deg: number }[] = [];
  private mini: HTMLCanvasElement;
  private miniHint: HTMLDivElement;
  private bars: Record<'stamina' | 'oxygen' | 'battery', { row: HTMLDivElement; fill: HTMLDivElement; label: HTMLSpanElement }>;
  private armEls: HTMLDivElement[] = [];
  private slotEls: HTMLDivElement[] = [];
  private beltHint: HTMLDivElement;
  private toastBox: HTMLDivElement;
  private promptEl: HTMLDivElement;
  private reticleEl: HTMLDivElement;
  private lastArms = '';
  private lastBelt = '';
  private lastPrompt = '';
  private toasts: { el: HTMLDivElement; until: number }[] = [];
  private now = 0;

  constructor(parent: HTMLElement, private map: MapImage, private explore: ExploreMap) {
    this.root = el('div', 'hud', parent);
    this.toastBox = el('div', 'toasts', this.root);

    this.compass = el('div', 'compass', this.root);
    for (const [key, deg] of COMPASS) {
      const m = el('span', 'mark' + (deg === 0 ? ' n' : ''), this.compass);
      m.dataset.key = key;
      this.compassMarks.push({ el: m, deg });
    }
    for (let d = 15; d < 360; d += 15) {
      if (d % 45 === 0) continue;
      const m = el('span', 'mark tick', this.compass);
      m.textContent = '|';
      this.compassMarks.push({ el: m, deg: d });
    }
    el('div', 'compass-pointer', this.root);

    const mm = el('div', 'minimap', this.root);
    this.mini = el('canvas', '', mm);
    this.mini.width = this.mini.height = 336;
    this.miniHint = el('div', 'minimap-hint', this.root);

    const bars = el('div', 'bars', this.root);
    const mk = (cls: string) => {
      const row = el('div', 'bar ' + cls, bars);
      const label = el('span', '', row);
      const track = el('div', 'track', row);
      const fill = el('div', 'fill', track);
      return { row, fill, label };
    };
    this.bars = { stamina: mk('stamina'), oxygen: mk('o2'), battery: mk('bat') };

    const belt = el('div', 'belt', this.root);
    const arms = el('div', 'arms', belt);
    for (let i = 0; i < 4; i++) this.armEls.push(el('div', 'arm', arms));
    const hot = el('div', 'hotbar', belt);
    for (let i = 0; i < 9; i++) this.slotEls.push(el('div', 'slot', hot));
    this.beltHint = el('div', 'belt-hint', belt);

    this.promptEl = el('div', 'prompt', this.root);
    this.promptEl.hidden = true;
    this.reticleEl = el('div', 'reticle', this.root);
    this.reticleEl.hidden = true;

    this.applyLang();
    onLangChange(() => {
      // ข้อความสั้นที่ค้างอยู่เป็นภาษาเดิม ล้างทิ้ง ไม่ให้สองภาษาปนกัน
      for (const x of this.toasts) x.el.remove();
      this.toasts = [];
      this.applyLang();
    });
  }

  private applyLang(): void {
    for (const m of this.compassMarks) if (m.el.dataset.key) m.el.textContent = t(m.el.dataset.key as StrKey);
    this.miniHint.textContent = t('minimapHint');
    this.bars.stamina.label.textContent = t('stamina');
    this.bars.oxygen.label.textContent = t('oxygen');
    this.bars.battery.label.textContent = t('battery');
    this.beltHint.textContent = t('beltHint');
    this.lastArms = this.lastBelt = this.lastPrompt = '';
  }

  /** ข้อความสั้นมุมซ้ายบน หายเองตามเวลา */
  toast(html: string, kind: '' | 'warn' | 'danger' = '', seconds = 4): void {
    const e = el('div', 'toast ' + kind, this.toastBox);
    e.innerHTML = html;
    this.toasts.push({ el: e, until: this.now + seconds });
    while (this.toasts.length > 4) this.toasts.shift()!.el.remove();
  }

  update(v: HudView, now: number): void {
    this.now = now;
    this.toasts = this.toasts.filter((x) => (x.until > now ? true : (x.el.remove(), false)));

    // เข็มทิศ: ทิศที่กล้องหันอยู่ตรงกลาง
    const w = this.compass.clientWidth || 440;
    const bearing = (-v.yaw * 180) / Math.PI;
    for (const m of this.compassMarks) {
      let rel = m.deg - bearing;
      rel = ((rel + 540) % 360) - 180;
      const vis = Math.abs(rel) < 95;
      m.el.style.display = vis ? '' : 'none';
      if (vis) m.el.style.left = `${w / 2 + (rel / 95) * (w / 2)}px`;
    }

    // แถบ
    const setBar = (b: { row: HTMLDivElement; fill: HTMLDivElement }, val: number | null) => {
      b.row.hidden = val === null;
      if (val === null) return;
      b.fill.style.width = `${Math.max(0, Math.min(1, val)) * 100}%`;
      b.row.classList.toggle('low', val < 0.35 && val >= 0.15);
      b.row.classList.toggle('critical', val < 0.15);
    };
    setBar(this.bars.stamina, v.stamina);
    this.bars.stamina.row.classList.toggle('critical', v.exhausted);
    setBar(this.bars.oxygen, v.oxygen);
    setBar(this.bars.battery, v.battery);

    // แขน (วาดใหม่เฉพาะตอนเปลี่ยน)
    const armsKey = JSON.stringify(v.arms);
    if (armsKey !== this.lastArms) {
      this.lastArms = armsKey;
      v.arms.forEach((a, i) => {
        const e = this.armEls[i];
        e.className = 'arm' + (a.main ? ' main' : '') + (a.active ? ' active' : '') + (a.empty ? ' empty' : '');
        const key = a.key === 'keyLeft' || a.key === 'keyRight' ? t(a.key) : a.key;
        const sub = `${t(ARM_NAMES[i])}${a.main ? ' · ' + t('main') : ''}${a.sub ? ' · ' + a.sub : ''}`;
        e.innerHTML = `<kbd>${key}</kbd><span class="what">${a.empty ? t('empty') : a.name}<small>${sub}</small></span>`;
      });
    }
    const beltKey = JSON.stringify(v.belt);
    if (beltKey !== this.lastBelt) {
      this.lastBelt = beltKey;
      v.belt.forEach((s, i) => {
        const e = this.slotEls[i];
        e.className = 'slot' + (s.inArm ? ' inarm' : '') + (s.empty ? ' empty' : '');
        e.innerHTML = `<span class="n">${i + 1}</span>${s.empty ? '' : ICONS[s.icon] ?? ICONS.item}${s.count ? `<span class="count">${s.count}</span>` : ''}${s.empty ? '' : `<span class="label">${s.label}</span>`}`;
      });
    }
    const promptKey = v.prompt ? v.prompt.key + v.prompt.text : '';
    if (promptKey !== this.lastPrompt) {
      this.lastPrompt = promptKey;
      this.promptEl.hidden = !v.prompt;
      if (v.prompt) this.promptEl.innerHTML = `<kbd>${v.prompt.key}</kbd> ${v.prompt.text}`;
    }
    this.reticleEl.hidden = !v.reticle;

    this.drawMinimap(v);
  }

  private drawMinimap(v: HudView): void {
    if (this.explore.dirty) this.map.refresh(this.explore);
    const c = this.mini.getContext('2d')!;
    const S = this.mini.width;
    const radiusM = 120;
    const pxPerM = S / 2 / radiusM;
    c.save();
    c.fillStyle = '#0a1414';
    c.fillRect(0, 0, S, S);
    c.translate(S / 2, S / 2);
    c.rotate(v.yaw);
    c.scale(pxPerM * 2, pxPerM * 2); // 1 จุดของภาพแผนที่ = 2 เมตร
    c.imageSmoothingEnabled = true;
    c.drawImage(this.map.revealed, -(v.x + 500) / 2, -(v.z + 500) / 2);
    c.restore();
    // เครื่องหมาย
    for (const m of v.markers) {
      const dx = m.x - v.x;
      const dz = m.z - v.z;
      const cs = Math.cos(v.yaw);
      const sn = Math.sin(v.yaw);
      let rx = (dx * cs - dz * sn) * pxPerM;
      let rz = (dx * sn + dz * cs) * pxPerM;
      const d = Math.hypot(rx, rz);
      const max = S / 2 - 12;
      if (d > max) { rx = (rx / d) * max; rz = (rz / d) * max; }
      c.fillStyle = MARKER_COLOR[m.kind];
      c.beginPath();
      if (m.kind === 'death' || m.kind === 'oldBody') {
        c.strokeStyle = MARKER_COLOR[m.kind];
        c.lineWidth = 3;
        c.moveTo(S / 2 + rx - 7, S / 2 + rz - 7); c.lineTo(S / 2 + rx + 7, S / 2 + rz + 7);
        c.moveTo(S / 2 + rx + 7, S / 2 + rz - 7); c.lineTo(S / 2 + rx - 7, S / 2 + rz + 7);
        c.stroke();
      } else if (m.kind === 'bag') {
        c.fillRect(S / 2 + rx - 6, S / 2 + rz - 6, 12, 12);
      } else {
        c.arc(S / 2 + rx, S / 2 + rz, 8, 0, Math.PI * 2);
        c.fill();
      }
    }
    // ตัวฉัน: ลูกศรตามทิศที่ตัวละครหัน (เทียบกับกล้อง)
    c.save();
    c.translate(S / 2, S / 2);
    c.rotate(-(v.heading - v.yaw));
    c.fillStyle = '#fff';
    c.beginPath();
    c.moveTo(0, -14); c.lineTo(-9, 10); c.lineTo(0, 5); c.lineTo(9, 10);
    c.closePath();
    c.fill();
    c.restore();
  }
}
