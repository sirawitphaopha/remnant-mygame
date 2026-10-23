import { GEAR, held, type GearSlot, type Loadout } from '../core/gear';
import type { ArmView, SlotView } from '../ui/Hud';
import { t, type StrKey } from '../ui/strings';

const ARM_KEYS: ArmView['key'][] = ['keyLeft', 'keyRight', 'Q', 'R'];

function gearName(g: GearSlot): string {
  if (g.id === 'bag') return t(g.bag === 'small' ? 'bagSmall' : g.bag === 'large' ? 'bagLarge' : 'bagMedium');
  return t(g.id as StrKey);
}

function gearSub(g: GearSlot): string {
  switch (g.id) {
    case 'flashlight': return `${g.on ? t('on') : t('off')} · ${t('charge')} ${Math.round((g.charge ?? 0) * 100)}%`;
    case 'inkGun': return `${t('ink')} ${g.amount ?? 0}/${GEAR.inkGun.max}`;
    case 'glueGun': return `${t('glue')} ${g.amount ?? 0}/${GEAR.glueGun.max}`;
    case 'oxygenTank': return `${g.amount ?? 0} ${t('tanks')}`;
    default: return '';
  }
}

function gearCount(g: GearSlot): string | undefined {
  switch (g.id) {
    case 'inkGun':
    case 'glueGun':
    case 'oxygenTank':
      return String(g.amount ?? 0);
    case 'flashlight':
      return `${Math.round((g.charge ?? 0) * 100)}%`;
    default:
      return undefined;
  }
}

/** ชื่อของชิ้นเล็กที่เก็บมา (ช่วง 6 ผูกกับรายการของจริง) */
export type ItemNamer = (itemId: string) => string;

export function armViews(l: Loadout, itemName: ItemNamer): ArmView[] {
  return ARM_KEYS.map((key, i) => {
    const s = held(l, i);
    if (!s) return { key, name: '', sub: '', main: i === 0, active: false, empty: true };
    if (s.kind === 'item') return { key, name: itemName(s.itemId), sub: `${s.kg.toFixed(1)} kg`, main: i === 0, active: false, empty: false };
    return { key, name: gearName(s), sub: gearSub(s), main: i === 0, active: s.id === 'flashlight' && !!s.on, empty: false };
  });
}

export function beltViews(l: Loadout, itemName: ItemNamer): SlotView[] {
  return l.belt.map((s, i) => {
    const inArm = l.arms.includes(i);
    if (!s) return { icon: '', label: '', inArm: false, empty: true };
    if (s.kind === 'item') return { icon: 'item', label: itemName(s.itemId), inArm, empty: false };
    return { icon: s.id, label: t(`short_${s.id}` as StrKey), inArm, count: gearCount(s), empty: false };
  });
}
