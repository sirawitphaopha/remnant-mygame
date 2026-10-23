import { KINDS, kind as kindOf, type Category, type Kind } from '../core/catalog';
import { SPECIES_BY_ID } from '../core/animals';
import { GEAR, buildLoadout, choiceSlots, held, slotKg, type Loadout, type ShipChoice } from '../core/gear';
import { bagCap, bagContents, carriedKg, carryLimit, contentsKg, isBag } from '../core/inventory';
import type { ScanLog } from '../core/scanlog';
import { ICONS } from './icons';
import { getLang, onLangChange, t, type StrKey } from './strings';

/** ช่องดูโมเดล (สร้างจากชั้นภาพ ส่งเข้ามา) */
export interface Viewer {
  canvas: HTMLCanvasElement;
  show(kind: string): void;
  stop(): void;
}

export interface BodyView { cracks: number; oxygen: number; cold: boolean }

const ARM_KEYS = ['keyLeft', 'keyRight', 'Q', 'R'] as const;
const ARM_NAMES: StrKey[] = ['armUR', 'armUL', 'armLR', 'armLL'];
const CATS: { id: Category | 'all'; key: StrKey }[] = [
  { id: 'all', key: 'catAll' }, { id: 'human', key: 'catHuman' }, { id: 'animal', key: 'catAnimal' }, { id: 'plant', key: 'catPlant' }, { id: 'self', key: 'catSelf' },
];

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const L = (x: { th: string; en: string }) => x[getLang()];
const kg = (v: number) => `${v.toFixed(1)} ${t('kg')}`;

export function kindName(id: string): string {
  const k = kindOf(id);
  return k ? L(k.name) : id;
}

/** ชื่อที่ขึ้นตามที่รู้: ยังไม่รู้ความจริงใช้ชื่อที่เอเลี่ยนตั้ง รู้แล้วใช้ชื่อจริง */
export function shownName(k: Kind, truth: boolean | number): string {
  return truth === true || (typeof truth === 'number' && truth >= 2) ? L(k.name) : L(k.alienName);
}

function layersHtml(k: Kind, log: ScanLog): string {
  const count = log.count(k.id);
  const truth = log.truth(k.id);
  const hasLog = log.log(k.id);
  const dots = [0, 1, 2].map((i) => `<i class="${i < count ? 'on' : ''}"></i>`).join('');
  // สัตว์: ผลของหมึก ต้องสแกนก่อนถึงรู้
  const sp = SPECIES_BY_ID.get(k.id);
  const ink = sp && count > 0 ? `<div class="layer"><span class="lt">${t('inkLabel')}</span>${t(sp.ink === 'flee' ? 'inkFlee' : sp.ink === 'enraged' ? 'inkEnraged' : 'inkIgnore')}</div>` : '';
  return ink + `
    <div class="layer"><span class="lt">${t('layer1')}</span>${esc(L(k.guess))}</div>
    <div class="layer ${truth ? '' : 'locked'}"><span class="lt">${t('layer2')} <span class="dots">${dots}</span></span>${truth ? esc(L(k.truth)) : t('lockTruth')}</div>
    <div class="layer personal ${hasLog ? '' : 'locked'}"><span class="lt">${t('layer3')}</span>${k.log ? (hasLog ? esc(L(k.log)) : t('lockLog')) : t('noLog')}</div>`;
}

function el(html: string): HTMLDivElement {
  const d = document.createElement('div');
  d.className = 'overlay';
  d.hidden = true;
  d.innerHTML = html;
  return d;
}

// ================= หน้ากระเป๋าและคอลเลกชัน (Tab หรือ I) =================
export interface InventoryActions {
  equip(slot: number, arm: number): void;
  dropBag(slot: number): void;
  nestBag(slot: number): void;
  unnestBag(slot: number, index: number): void;
  close(): void;
}

export class InventoryScreen {
  readonly root: HTMLDivElement;
  tab: 'bag' | 'collection' = 'bag';
  private bagSlot = -1;
  private selectedItem: string | null = null;
  private selectedBelt: number | null = null;
  private cat: Category | 'all' = 'all';
  private selectedKind: string | null = null;
  private data!: { loadout: Loadout; log: ScanLog; body: BodyView };

  constructor(parent: HTMLElement, private viewer: Viewer, private act: InventoryActions) {
    this.root = el('<div class="holo inv"></div>');
    parent.appendChild(this.root);
    this.root.addEventListener('click', (e) => this.onClick(e));
    this.root.addEventListener('dragstart', (e) => {
      const s = (e.target as HTMLElement).closest('[data-belt]') as HTMLElement | null;
      if (s && e.dataTransfer) e.dataTransfer.setData('text/plain', s.dataset.belt!);
    });
    this.root.addEventListener('dragover', (e) => { if ((e.target as HTMLElement).closest('[data-arm]')) e.preventDefault(); });
    this.root.addEventListener('drop', (e) => {
      const a = (e.target as HTMLElement).closest('[data-arm]') as HTMLElement | null;
      const slot = e.dataTransfer?.getData('text/plain');
      if (a && slot) { e.preventDefault(); this.act.equip(Number(slot), Number(a.dataset.arm)); this.render(); }
    });
    onLangChange(() => { if (this.open) this.render(); });
  }

  get open(): boolean { return !this.root.hidden; }

  show(tab: 'bag' | 'collection', data: { loadout: Loadout; log: ScanLog; body: BodyView }): void {
    this.tab = tab;
    this.data = data;
    if (this.bagSlot < 0 || !isBag(data.loadout.belt[this.bagSlot])) this.bagSlot = data.loadout.belt.findIndex((s) => isBag(s));
    this.root.hidden = false;
    this.render();
  }

  hide(): void {
    this.root.hidden = true;
    this.viewer.stop();
  }

  private onClick(e: MouseEvent): void {
    const tgt = e.target as HTMLElement;
    const b = tgt.closest('[data-act]') as HTMLElement | null;
    if (!b) return;
    const v = b.dataset.v ?? '';
    switch (b.dataset.act) {
      case 'tab': this.tab = v as 'bag' | 'collection'; break;
      case 'close': this.act.close(); return;
      case 'bag': this.bagSlot = Number(v); this.selectedItem = null; break;
      case 'item': this.selectedItem = v; break;
      case 'belt': this.selectedBelt = this.selectedBelt === Number(v) ? null : Number(v); break;
      case 'arm': if (this.selectedBelt !== null) { this.act.equip(this.selectedBelt, Number(v)); this.selectedBelt = null; } break;
      case 'drop': this.act.dropBag(this.bagSlot); this.bagSlot = this.data.loadout.belt.findIndex((s) => isBag(s)); break;
      case 'nest': this.act.nestBag(this.bagSlot); this.bagSlot = this.data.loadout.belt.findIndex((s) => isBag(s)); break;
      case 'unnest': this.act.unnestBag(this.bagSlot, Number(v)); break;
      case 'cat': this.cat = v as Category | 'all'; break;
      case 'kind': this.selectedKind = v; break;
    }
    this.render();
  }

  render(): void {
    const head = `
      <div class="holo-head">
        <div class="tabs">
          <button type="button" class="tab ${this.tab === 'bag' ? 'on' : ''}" data-act="tab" data-v="bag">${t('tabBag')}</button>
          <button type="button" class="tab ${this.tab === 'collection' ? 'on' : ''}" data-act="tab" data-v="collection">${t('tabCollection')}</button>
        </div>
        ${this.tab === 'collection' ? `<div class="tabs">${CATS.map((c) => `<button type="button" class="tab ${this.cat === c.id ? 'on' : ''}" data-act="cat" data-v="${c.id}">${t(c.key)}</button>`).join('')}</div>` : ''}
        <span class="spacer"></span>
        <button type="button" class="btn" data-act="close">${t('closeTab')}<kbd>Tab</kbd></button>
      </div>`;
    const holo = this.root.querySelector('.holo') as HTMLDivElement;
    holo.innerHTML = head + (this.tab === 'bag' ? this.bagHtml() : this.collectionHtml());
    const vh = holo.querySelector('.viewer-host');
    const kindToShow = this.tab === 'bag' ? this.selectedItem : this.selectedKind;
    if (vh && kindToShow) {
      vh.prepend(this.viewer.canvas);
      this.viewer.show(kindToShow);
    } else this.viewer.stop();
  }

  private bagHtml(): string {
    const l = this.data.loadout;
    const bags = l.belt.map((s, i) => (isBag(s) ? i : -1)).filter((i) => i >= 0);
    const c = this.bagSlot >= 0 ? bagContents(l, this.bagSlot) : null;
    const bag = this.bagSlot >= 0 ? l.belt[this.bagSlot] : null;
    const gearKg = l.belt.reduce((s, x) => s + slotKg(x), 0);
    const total = carriedKg(l);
    const limit = carryLimit(l);
    const items = c?.items ?? [];
    const bagTitle = bag && isBag(bag) ? `${t(bag.bag === 'small' ? 'bagSmall' : bag.bag === 'large' ? 'bagLarge' : 'bagMedium')} · ${kg(contentsKg(c!))} / ${kg(bagCap(bag.bag ?? 'medium'))}` : t('noBag');
    const sel = this.selectedItem ? kindOf(this.selectedItem) : null;
    return `
      <div class="cols inv-bag">
        <div class="panel">
          ${bags.length > 1 ? `<div class="tabs small">${bags.map((i) => `<button type="button" class="tab ${i === this.bagSlot ? 'on' : ''}" data-act="bag" data-v="${i}">${t('bagOf')} ${i + 1}</button>`).join('')}</div>` : ''}
          <h4>${bagTitle}</h4>
          <div class="grid-slots">
            ${items.map((it) => `<button type="button" class="gslot ${this.selectedItem === it.itemId ? 'sel' : ''}" data-act="item" data-v="${it.itemId}">${ICONS.item}<span class="gname">${esc(shownName(kindOf(it.itemId)!, this.data.log.truth(it.itemId)))}</span><span class="kg">${it.kg.toFixed(2)}</span></button>`).join('')}
            ${(c?.bags ?? []).map((nb, i) => `<button type="button" class="gslot nested" data-act="unnest" data-v="${i}">${ICONS.bag}<span class="tag">${t('nested')}</span><span class="gname">${t('unnestBag')}</span><span class="kg">${(GEAR.bag[nb.size].kg + contentsKg(nb.contents)).toFixed(1)}</span></button>`).join('')}
            ${Array(Math.max(0, 10 - items.length - (c?.bags.length ?? 0))).fill('<div class="gslot blank"></div>').join('')}
          </div>
          <div class="wbar"><span class="a" style="width:${(gearKg / limit) * 100}%"></span><span class="b" style="width:${((total - gearKg) / limit) * 100}%"></span></div>
          <div class="legend"><span><i style="background:var(--holo)"></i>${t('gearKg')} ${kg(gearKg)}</span><span><i style="background:#c7a5ff"></i>${t('itemsKg')} ${kg(total - gearKg)}</span><span>${t('totalKg')} ${kg(total)} / ${kg(limit)}</span></div>
          ${bag ? `<div class="row-btns"><button type="button" class="btn" data-act="drop">${t('dropBag')}</button>${bags.length > 1 ? `<button type="button" class="btn" data-act="nest">${t('nestBag')}</button>` : ''}</div>` : ''}
        </div>
        <div class="panel">
          <h4>${sel ? esc(shownName(sel, this.data.log.truth(sel.id))) : t('pickHint')}</h4>
          <div class="viewer-host">${sel ? `<span class="turn">${t('dragRotate')}</span>` : ''}</div>
          ${sel ? `<div class="layers">${layersHtml(sel, this.data.log)}</div>` : ''}
        </div>
        <div class="panel">
          <h4>${t('armSlots')}</h4>
          <div class="arm-list">${[0, 1, 2, 3].map((a) => {
            const s = held(l, a);
            const name = s ? (s.kind === 'gear' ? (s.id === 'bag' ? t('short_bag') : t(s.id as StrKey)) : kindName(s.itemId)) : t('empty');
            const key = a < 2 ? t(ARM_KEYS[a] as StrKey) : ARM_KEYS[a];
            return `<button type="button" class="arm ${a === 0 ? 'main' : ''} ${this.selectedBelt !== null ? 'target' : ''}" data-act="arm" data-arm="${a}" data-v="${a}"><kbd>${key}</kbd><span class="what">${esc(name)}<small>${t(ARM_NAMES[a])}</small></span></button>`;
          }).join('')}</div>
          <div class="belt-mini">${l.belt.map((s, i) => `<button type="button" draggable="${s ? 'true' : 'false'}" class="slot ${s ? '' : 'empty'} ${l.arms.includes(i) ? 'inarm' : ''} ${this.selectedBelt === i ? 'sel' : ''}" data-act="belt" data-belt="${i}" data-v="${i}"><span class="n">${i + 1}</span>${s ? (s.kind === 'gear' ? ICONS[s.id] : ICONS.item) : ''}</button>`).join('')}</div>
          <h4 style="margin-top:14px">${t('body')}</h4>
          <div class="body-stat">${this.data.body.cracks ? `${t('jarCracks')} ${this.data.body.cracks}` : t('jarOk')}<br>${t('jarO2')} ${Math.round(this.data.body.oxygen * 100)}%<br>${t('temp')} ${this.data.body.cold ? t('tempCold') : t('tempOk')}</div>
        </div>
      </div>`;
  }

  private collectionHtml(): string {
    const log = this.data.log;
    const list = KINDS.filter((k) => this.cat === 'all' || k.category === this.cat);
    const sel = this.selectedKind ? kindOf(this.selectedKind) : null;
    const known = (k: Kind) => log.known(k.id);
    return `
      <div class="cols inv-coll">
        <div class="panel"><div class="coll-grid">
          ${list.map((k) => {
            const r = log.records.get(k.id);
            return known(k)
              ? `<button type="button" class="citem ${this.selectedKind === k.id ? 'on' : ''}" data-act="kind" data-v="${k.id}">${ICONS[k.small ? 'item' : 'scanner']}<span>${esc(shownName(k, log.truth(k.id)))}</span><span class="st">${t('layer1').split(' ')[0]} ${log.layer(k.id)}${r && r.deposited ? ` · ${t('deposited')} ${r.deposited}` : ''}</span></button>`
              : `<div class="citem unknown">${ICONS.item}<span>${t('unknown')}</span></div>`;
          }).join('')}
        </div></div>
        <div class="panel">
          ${sel && known(sel) ? `
            <h4>${esc(shownName(sel, log.truth(sel.id)))} · ${sel.small ? t('smallObj') : t('largeObj')}</h4>
            <div class="viewer-host"><span class="turn">${t('dragRotate')}</span></div>
            <div class="layers">${layersHtml(sel, log)}</div>` : `<h4>${t('notFound')}</h4>`}
        </div>
      </div>`;
  }
}

// ================= หน้ายาน =================
export interface ShipActions {
  depart(choice: ShipChoice): void;
}

export class ShipScreen {
  readonly root: HTMLDivElement;
  choice!: ShipChoice;
  private note = '';

  constructor(parent: HTMLElement, private act: ShipActions) {
    this.root = el('<div class="holo ship"></div>');
    parent.appendChild(this.root);
    this.root.addEventListener('click', (e) => this.onClick(e));
    onLangChange(() => { if (this.open) this.render(); });
  }

  get open(): boolean { return !this.root.hidden; }

  show(choice: ShipChoice, note: string): void {
    this.choice = choice;
    this.note = note;
    this.root.hidden = false;
    this.render();
  }

  hide(): void { this.root.hidden = true; }

  private onClick(e: MouseEvent): void {
    const b = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
    if (!b) return;
    const c = this.choice;
    const v = b.dataset.v ?? '';
    const full = choiceSlots(c) >= 9;
    switch (b.dataset.act) {
      case 'toggle': {
        const k = v as 'scanner' | 'flashlight' | 'inkGun' | 'glueGun' | 'climber';
        if (!c[k] && full) { this.note = t('slotsFull'); break; }
        c[k] = !c[k];
        break;
      }
      case 'ink': c.ink = Math.max(0, Math.min(GEAR.inkGun.max, c.ink + Number(v))); if (c.ink > 0) c.inkGun = true; break;
      case 'glue': c.glue = Math.max(0, Math.min(GEAR.glueGun.max, c.glue + Number(v))); if (c.glue > 0) c.glueGun = true; break;
      case 'tanks': {
        const next = Math.max(0, Math.min(GEAR.oxygenTank.max, c.tanks + Number(v)));
        if (c.tanks === 0 && next > 0 && full) { this.note = t('slotsFull'); break; }
        c.tanks = next;
        break;
      }
      case 'bag': {
        const size = v as 'small' | 'medium' | 'large';
        const i = c.bags.indexOf(size);
        if (i >= 0) c.bags.splice(i, 1);
        else if (full) this.note = t('slotsFull');
        else c.bags.push(size);
        break;
      }
      case 'starter': this.choice = { scanner: true, flashlight: true, inkGun: true, ink: 5, glueGun: true, glue: 3, climber: true, tanks: 1, bags: ['medium'] }; break;
      case 'depart': this.act.depart(this.choice); return;
    }
    this.render();
  }

  render(): void {
    const c = this.choice;
    const l = buildLoadout(c);
    const total = carriedKg(l);
    const limit = carryLimit(l);
    const row = (act: string, v: string, icon: string, name: string, sub: string, taken: boolean, kgv: number, extra = '') =>
      `<div class="stock-row ${taken ? 'taken' : ''}"><button type="button" class="stock-main" data-act="${act}" data-v="${v}">${ICONS[icon]}<span>${name}<small>${sub}</small></span></button>${extra}<span class="w">${kgv.toFixed(1)} ${t('kg')}</span></div>`;
    const stepper = (act: string, value: number, max: number) =>
      `<span class="stepper"><button type="button" class="btn mini" data-act="${act}" data-v="-1" aria-label="−">−</button><span class="num">${value}/${max}</span><button type="button" class="btn mini" data-act="${act}" data-v="1" aria-label="+">+</button></span>`;
    const tk = (b: boolean) => (b ? t('taken') : t('notTaken'));
    const holo = this.root.querySelector('.holo') as HTMLDivElement;
    holo.innerHTML = `
      <div class="holo-head"><h2>${t('shipTitle')}</h2><span class="sub">${t('shipSub')}</span><span class="spacer"></span>
        <button type="button" class="btn" data-act="starter">${t('starter')}</button>
        <button type="button" class="btn primary" data-act="depart">${t('depart')}</button></div>
      ${this.note ? `<div class="ship-note">${esc(this.note)}</div>` : ''}
      <div class="cols ship-cols">
        <div class="panel"><h4>${t('shipStock')}</h4><div class="stock">
          ${row('toggle', 'scanner', 'scanner', t('scanner'), tk(c.scanner), c.scanner, GEAR.scanner.kg)}
          ${row('toggle', 'flashlight', 'flashlight', t('flashlight'), `${tk(c.flashlight)} · ${t('charge')} 100%`, c.flashlight, GEAR.flashlight.kg)}
          ${row('toggle', 'inkGun', 'inkGun', t('inkGun'), tk(c.inkGun), c.inkGun, GEAR.inkGun.kg + c.ink * GEAR.inkGun.shotKg, stepper('ink', c.ink, GEAR.inkGun.max))}
          ${row('toggle', 'glueGun', 'glueGun', t('glueGun'), tk(c.glueGun), c.glueGun, GEAR.glueGun.kg + c.glue * GEAR.glueGun.shotKg, stepper('glue', c.glue, GEAR.glueGun.max))}
          ${row('toggle', 'climber', 'climber', t('climber'), tk(c.climber), c.climber, GEAR.climber.kg)}
          ${row('tanks', '1', 'oxygenTank', t('oxygenTank'), `${c.tanks} ${t('tanks')}`, c.tanks > 0, GEAR.oxygenTank.kg * c.tanks, stepper('tanks', c.tanks, GEAR.oxygenTank.max))}
          ${(['small', 'medium', 'large'] as const).map((b) => row('bag', b, 'bag', t(b === 'small' ? 'bagSmall' : b === 'large' ? 'bagLarge' : 'bagMedium'), `${t('capKg')} ${GEAR.bag[b].capKg} ${t('kg')}`, c.bags.includes(b), GEAR.bag[b].kg)).join('')}
        </div></div>
        <div class="panel"><h4>${t('willCarry')}</h4>
          <div class="grid-slots">${l.belt.map((s, i) => `<div class="gslot ${s ? '' : 'blank'}"><span class="tag">${i + 1}</span>${s ? (s.kind === 'gear' ? ICONS[s.id] : ICONS.item) : ''}<span class="kg">${s ? slotKg(s).toFixed(1) : ''}</span></div>`).join('')}</div>
          <h4 style="margin-top:14px">${t('armsOnDepart')}</h4>
          <div class="arm-list">${[0, 1, 2, 3].map((a) => {
            const s = held(l, a);
            const key = a < 2 ? t(ARM_KEYS[a] as StrKey) : ARM_KEYS[a];
            return `<div class="arm ${a === 0 ? 'main' : ''}"><kbd>${key}</kbd><span class="what">${s && s.kind === 'gear' ? t(s.id as StrKey) : t('empty')}</span></div>`;
          }).join('')}</div>
        </div>
        <div class="panel"><h4>${t('carryWeight')}</h4>
          <div class="weight-big num">${total.toFixed(1)} <small>/ ${limit.toFixed(0)} ${t('kg')}</small></div>
          <div class="wbar"><span class="a" style="width:${(total / limit) * 100}%"></span></div>
          <p class="note">${t('weightNote')}</p>
          <h4 style="margin-top:14px">${t('warmth')}</h4><div class="body-stat">${t('warmOk')}</div>
        </div>
      </div>`;
  }
}

// ================= การ์ดผลสแกน =================
export class ScanCard {
  readonly root: HTMLDivElement;
  private until = 0;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'scan-card';
    this.root.hidden = true;
    parent.appendChild(this.root);
  }

  show(kindId: string, log: ScanLog, unlocked: boolean, now: number): void {
    const k = kindOf(kindId);
    if (!k) return;
    const truth = log.truth(kindId);
    this.root.innerHTML = `
      <div class="kind">${unlocked ? `${t('newLayer')} · ` : ''}${k.small ? t('smallObj') : t('largeObj')}</div>
      <h3>${esc(shownName(k, truth))}${truth ? '' : ` <small>${t('scanned')} ${log.count(kindId)}/3</small>`}</h3>
      ${layersHtml(k, log)}`;
    this.root.hidden = false;
    this.until = now + 9;
  }

  update(now: number): void {
    if (!this.root.hidden && now > this.until) this.root.hidden = true;
  }
}
