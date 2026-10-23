import type { DeathCause } from '../core/body';
import { onLangChange, t, type StrKey } from './strings';

// ภาพบนจอตามสภาพร่างกาย: ขอบจอแดง โหลร้าว น้ำแข็งเกาะกระจก · หน้าตอนตาย

const CRACKS = [
  'M1600 120 L1480 180 L1440 260 L1380 290 M1480 180 L1520 280 M1440 260 L1460 340',
  'M0 760 L90 720 L150 650 M90 720 L120 800 M150 650 L210 630',
  'M1550 900 L1500 800 L1420 760 M1500 800 L1530 720',
  'M40 0 L120 90 L110 180 M120 90 L210 110 M110 180 L60 230',
];

export class BodyFx {
  private hurt: HTMLDivElement;
  private frost: HTMLDivElement;
  private crack: SVGSVGElement;
  private paths: SVGPathElement[] = [];

  constructor(parent: HTMLElement) {
    this.frost = document.createElement('div');
    this.frost.className = 'fx-frost';
    this.hurt = document.createElement('div');
    this.hurt.className = 'fx-hurt';
    this.crack = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.crack.setAttribute('class', 'fx-crack');
    this.crack.setAttribute('viewBox', '0 0 1600 900');
    this.crack.setAttribute('preserveAspectRatio', 'none');
    for (const d of CRACKS) {
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', d);
      p.style.display = 'none';
      this.crack.appendChild(p);
      this.paths.push(p);
    }
    parent.prepend(this.frost, this.hurt, this.crack);
  }

  update(cracks: number, hurt: number, warmth: number): void {
    this.hurt.style.opacity = String(Math.min(1, cracks * 0.14 + hurt * 0.5));
    this.frost.style.opacity = String(Math.max(0, Math.min(1, (1 - warmth) * 1.15)));
    this.paths.forEach((p, i) => (p.style.display = i < cracks ? '' : 'none'));
  }
}

const TITLE: Record<DeathCause, StrKey> = { fall: 'deathFall', animal: 'deathAnimal', drown: 'deathDrown', gas: 'deathGas', cold: 'deathCold' };
const CAUSE: Record<DeathCause, StrKey> = { fall: 'causeFall', animal: 'causeAnimal', drown: 'causeDrown', gas: 'causeGas', cold: 'causeCold' };
const QUOTE: Record<DeathCause, StrKey> = { fall: 'quoteFall', animal: 'quoteAnimal', drown: 'quoteDrown', gas: 'quoteGas', cold: 'quoteCold' };

/** หน้าตอนตาย · บอกสาเหตุ · ยานจำลองร่างใหม่ · ของตกอยู่ที่ซาก */
export class DeathScreen {
  readonly root: HTMLDivElement;
  private cause: DeathCause = 'fall';
  private body = 1;
  private gear = 0;
  private items = 0;
  private progress = 0;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'death';
    this.root.hidden = true;
    parent.appendChild(this.root);
    onLangChange(() => { if (!this.root.hidden) this.render(); });
  }

  get open(): boolean { return !this.root.hidden; }

  show(cause: DeathCause, bodyNumber: number, gear: number, items: number): void {
    Object.assign(this, { cause, body: bodyNumber, gear, items, progress: 0 });
    this.root.hidden = false;
    this.render();
  }

  setProgress(p: number): void {
    this.progress = p;
    const bar = this.root.querySelector('.meter i') as HTMLElement | null;
    const num = this.root.querySelector('.pct') as HTMLElement | null;
    if (bar) bar.style.width = `${Math.round(p * 100)}%`;
    if (num) num.textContent = `${Math.round(p * 100)}%`;
  }

  hide(): void { this.root.hidden = true; }

  private render(): void {
    const c = this.cause;
    this.root.innerHTML = `
      <div class="death-box">
        <h2>${t(TITLE[c])}</h2>
        <div class="cause">${t(CAUSE[c])} · ${t('bodyN')} ${this.body} ${t('ended')}</div>
        <div class="quote">${t(QUOTE[c])}</div>
        <div class="clone">${t('cloning')}<div class="meter"><i style="width:${Math.round(this.progress * 100)}%"></i></div><span class="pct num">${Math.round(this.progress * 100)}%</span></div>
        <div class="lost"><span>${t('allDropped')}</span><span>${t('gearN')} ${this.gear} ${t('pieces')}</span><span>${t('itemsN')} ${this.items} ${t('pieces')}</span><span>${t('deathMarked')}</span></div>
      </div>`;
  }
}
