import type { Settings } from '../storage/save';
import { onLangChange, t, type StrKey } from './strings';

// หน้าเริ่มเกม (มอคอัปหน้า 1) กับหน้าหยุดเกมและตั้งค่า (มอคอัปหน้า 9)

export interface TitleActions {
  continueGame(): void;
  newGame(): void;
  openCollection(): void;
  openSettings(): void;
  /** คืน true ถ้าบันทึกสำเร็จ (ยังไม่ได้เล่น = ไม่ได้บันทึกอะไร) */
  quit(): boolean;
}

export interface ContinueInfo { body: number; day: number; found: number }

export class TitleScreen {
  readonly root: HTMLDivElement;
  private info: ContinueInfo | null = null;
  private confirmNew = false;
  /** ข้อความใต้เมนู เก็บเป็นชื่อคำ เปลี่ยนภาษาแล้ววาดเป็นภาษาใหม่ */
  private note: StrKey | null = null;

  constructor(parent: HTMLElement, private act: TitleActions) {
    this.root = document.createElement('div');
    this.root.className = 'title-screen';
    parent.appendChild(this.root);
    this.root.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
      if (!b) return;
      const a = b.dataset.act;
      if (a !== 'new' && this.confirmNew) { this.confirmNew = false; this.render(); }
      if (a === 'continue') this.act.continueGame();
      else if (a === 'new') {
        if (this.info && !this.confirmNew) { this.confirmNew = true; this.render(); return; }
        this.confirmNew = false;
        this.act.newGame();
      } else if (a === 'collection') this.act.openCollection();
      else if (a === 'settings') this.act.openSettings();
      else if (a === 'quit') { this.note = this.act.quit() ? 'quitNote' : 'quitNoSave'; this.render(); }
    });
    onLangChange(() => this.render());
  }

  get open(): boolean { return !this.root.hidden; }

  /** ข้อความใต้เมนู (เช่น บันทึกเก่าย้ายมาโลกใหม่แล้ว) */
  notice(key: StrKey): void {
    this.note = key;
    this.render();
  }

  show(info: ContinueInfo | null): void {
    this.info = info;
    this.note = null;
    this.root.hidden = false;
    this.render();
  }

  hide(): void { this.root.hidden = true; }

  private render(): void {
    const i = this.info;
    this.root.innerHTML = `
      <div class="title-wrap">
        <h1>${t('gameTitle')}</h1>
        <div class="tag">${t('tagline')}</div>
        <nav class="menu">
          ${i ? `<button type="button" class="first" data-act="continue">${t('continueGame')}<small>${t('bodyN')} ${i.body} · ${t('dayN')} ${i.day} · ${t('discoveries')} ${i.found} ${t('things')}</small></button>` : ''}
          <button type="button" class="${i ? '' : 'first'}" data-act="new">${t('newGame')}${this.confirmNew ? `<small class="warn">${t('newGameConfirm')}</small>` : ''}</button>
          ${i ? `<button type="button" data-act="collection">${t('tabCollection')}</button>` : ''}
          <button type="button" data-act="settings">${t('settings')}</button>
          <button type="button" data-act="quit">${t('quitGame')}</button>
        </nav>
        ${this.note ? `<div class="title-note">${t(this.note)}</div>` : ''}
      </div>
      <div class="version">${t('demoVer')} ${__APP_VERSION__}</div>`;
  }
}

export interface SettingsActions {
  change(s: Settings): void;
  resume(): void;
  toTitle(): void;
}

const KEYS: [string | StrKey, StrKey][] = [
  ['W A S D', 'kMove'], ['keyMouse', 'kLook'], ['Shift', 'kRun'], ['Space', 'kJump'], ['E', 'kInteract'], ['keyLR', 'kArmsTop'], ['Q / R', 'kArmsLow'],
  ['keyNums', 'kNum'], ['keyWheel', 'kWheel'], ['keyTabI', 'kBag'], ['M', 'kMap'], ['V', 'kShoulder'], ['L', 'kJarLight'], ['G', 'kBeacon'], ['Esc', 'kEsc'],
];

export class SettingsScreen {
  readonly root: HTMLDivElement;
  private s!: Settings;
  private fromTitle = false;

  constructor(parent: HTMLElement, private act: SettingsActions) {
    this.root = document.createElement('div');
    this.root.className = 'overlay';
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    this.root.hidden = true;
    this.root.innerHTML = '<div class="holo settings"></div>';
    parent.appendChild(this.root);
    this.root.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
      if (!b) return;
      const v = b.dataset.v;
      switch (b.dataset.act) {
        case 'quality': this.s.quality = v as Settings['quality']; this.act.change({ ...this.s }); break;
        case 'lang': this.s.lang = v as Settings['lang']; this.act.change({ ...this.s }); break;
        case 'coords': this.s.coords = v === 'on'; this.act.change({ ...this.s }); break;
        case 'resume': this.act.resume(); return;
        case 'title': this.act.toTitle(); return;
      }
      this.render();
    });
    this.root.addEventListener('input', (e) => {
      const r = e.target as HTMLInputElement;
      if (!r.dataset.range) return;
      (this.s as unknown as Record<string, number>)[r.dataset.range] = Number(r.value) / 100;
      this.act.change({ ...this.s });
    });
    onLangChange(() => { if (this.open) this.render(); });
  }

  get open(): boolean { return !this.root.hidden; }

  show(s: Settings, fromTitle: boolean): void {
    this.s = { ...s };
    this.fromTitle = fromTitle;
    this.root.hidden = false;
    this.render();
  }

  hide(): void { this.root.hidden = true; }

  private render(): void {
    const s = this.s;
    const seg = (act: string, cur: string, opts: [string, StrKey][]) =>
      `<div class="seg">${opts.map(([v, k]) => `<button type="button" class="tab ${cur === v ? 'on' : ''}" data-act="${act}" data-v="${v}">${t(k)}</button>`).join('')}</div>`;
    const range = (key: keyof Settings, label: StrKey) =>
      `<label class="setrow"><span>${t(label)}</span><input type="range" min="0" max="100" value="${Math.round((s[key] as number) * 100)}" data-range="${key}" aria-label="${t(label)}"></label>`;
    const keyLabel = (k: string) => (/^[a-z]/.test(k) ? t(k as StrKey) : k);
    (this.root.querySelector('.holo') as HTMLElement).innerHTML = `
      <div class="holo-head"><h2>${this.fromTitle ? t('settings') : t('paused')}</h2><span class="spacer"></span>
        ${this.fromTitle ? '' : `<button type="button" class="btn" data-act="title">${t('toTitle')}</button>`}
        <button type="button" class="btn primary" data-act="resume">${this.fromTitle ? t('close') : t('resume')}</button></div>
      <div class="cols set-cols">
        <div class="panel"><h4>${t('gfxAudio')}</h4>
          <div class="setrow"><span>${t('language')}</span>${seg('lang', s.lang, [['th', 'langThai'], ['en', 'langEnglish']])}</div>
          <div class="setrow"><span>${t('quality')}</span>${seg('quality', s.quality, [['low', 'qLow'], ['medium', 'qMed'], ['high', 'qHigh']])}</div>
          ${range('viewDistance', 'viewDist')}${range('nature', 'natureVol')}${range('gear', 'gearVol')}${range('sensitivity', 'mouseSens')}
          <div class="setrow"><span>${t('showCoords')}</span>${seg('coords', s.coords ? 'on' : 'off', [['on', 'coordsOn'], ['off', 'coordsOff']])}</div>
          <div class="setrow"><span>${t('progress')}</span><span class="note">${t('autoSaved')}</span></div>
        </div>
        <div class="panel"><h4>${t('controls')}</h4>
          <div class="keys">${KEYS.map(([k, d]) => `<kbd>${keyLabel(k)}</kbd><span>${t(d)}</span>`).join('')}</div>
        </div>
      </div>`;
  }
}
