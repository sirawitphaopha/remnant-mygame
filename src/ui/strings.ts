// ข้อความบนจอทุกคำอยู่ที่นี่ · ไทยกับอังกฤษ เลือกได้ในหน้าตั้งค่า ไม่ปนสองภาษาในจอเดียว

export type Lang = 'th' | 'en';

const th = {
  // ส่วนบนจอ
  stamina: 'แรง',
  oxygen: 'ออกซิเจน',
  battery: 'แบตไฟฉาย',
  minimapHint: 'กด M ดูแผนที่จอใหญ่',
  compassN: 'น.', compassNE: 'ตอ.น.', compassE: 'อ.', compassSE: 'ตอ.ต.', compassS: 'ต.', compassSW: 'ตต.ต.', compassW: 'ตต.', compassNW: 'ตต.น.',
  armUR: 'แขนบนขวา', armUL: 'แขนบนซ้าย', armLR: 'แขนล่างขวา', armLL: 'แขนล่างซ้าย',
  main: 'หลัก',
  empty: 'ว่าง',
  keyLeft: 'คลิกซ้าย', keyRight: 'คลิกขวา',
  beltHint: 'จุดฟ้ามุมช่อง = ถืออยู่ในแขน · กดเลขเอาของเข้าแขนหลัก',
  // อุปกรณ์
  scanner: 'เครื่องสแกน', flashlight: 'ไฟฉาย', inkGun: 'ปืนปลาหมึก', glueGun: 'ปืนกาว', climber: 'ที่ปีนป่าย', oxygenTank: 'ถังออกซิเจน',
  bagSmall: 'กระเป๋าใบเล็ก', bagMedium: 'กระเป๋าใบกลาง', bagLarge: 'กระเป๋าใบใหญ่',
  short_scanner: 'สแกน', short_flashlight: 'ไฟฉาย', short_inkGun: 'ปืนหมึก', short_glueGun: 'ปืนกาว', short_climber: 'ที่ปีน', short_oxygenTank: 'ออกซิเจน', short_bag: 'กระเป๋า',
  on: 'เปิดอยู่', off: 'ปิดอยู่',
  ink: 'หมึก', glue: 'กาว', tanks: 'ถัง', charge: 'แบต',
  // ใช้อุปกรณ์
  scanning: 'กำลังสแกน', scanNothing: 'ไม่มีอะไรให้สแกนตรงนี้', scanSent: 'ส่งผลสแกนเข้ายานแล้ว',
  lightEmpty: 'แบตไฟฉายหมด รอแดดชาร์จ', noInk: 'หมึกหมด', noGlue: 'กาวหมด', noCracks: 'โหลไม่มีรอยร้าว', sealed: 'อุดรอยร้าวแล้ว',
  oxygenFull: 'ออกซิเจนในโหลเต็มอยู่แล้ว', oxygenRefilled: 'เติมออกซิเจนในโหลแล้ว', noTanks: 'ถังออกซิเจนหมด',
  bagHint: 'กด Tab หรือ I เพื่อเปิดกระเป๋า', charging: 'กำลังชาร์จแดด',
  // แผนที่
  map: 'แผนที่', mapSub: 'สำรวจแล้ว', close: 'ปิด',
  legend: 'สัญลักษณ์', legShip: 'ยาน', legMe: 'ตัวฉัน', legDeath: 'จุดตายล่าสุด · ของยังอยู่', legOldBody: 'ซากเก่า · ของหายแล้ว', legBag: 'กระเป๋าที่ส่งสัญญาณ',
  mapNote1: 'กระเป๋าที่วางแล้วลืมกดส่งสัญญาณ จะไม่ขึ้นบนแผนที่ ต้องเดินหาเอง',
  mapNote2: 'พื้นที่มืดคือที่ยังไม่เคยไป',
  ship: 'ยาน',
  km: 'กม.',
} as const;

export type StrKey = keyof typeof th;

const en: Record<StrKey, string> = {
  stamina: 'Stamina',
  oxygen: 'Oxygen',
  battery: 'Battery',
  minimapHint: 'Press M for full map',
  compassN: 'N', compassNE: 'NE', compassE: 'E', compassSE: 'SE', compassS: 'S', compassSW: 'SW', compassW: 'W', compassNW: 'NW',
  armUR: 'Upper right', armUL: 'Upper left', armLR: 'Lower right', armLL: 'Lower left',
  main: 'main',
  empty: 'Empty',
  keyLeft: 'L-Click', keyRight: 'R-Click',
  beltHint: 'Blue dot = held in an arm · press a number to equip to main arm',
  scanner: 'Scanner', flashlight: 'Flashlight', inkGun: 'Ink Gun', glueGun: 'Glue Gun', climber: 'Climbing Gear', oxygenTank: 'Oxygen Tank',
  bagSmall: 'Small Bag', bagMedium: 'Medium Bag', bagLarge: 'Large Bag',
  short_scanner: 'Scan', short_flashlight: 'Light', short_inkGun: 'Ink', short_glueGun: 'Glue', short_climber: 'Climb', short_oxygenTank: 'Oxygen', short_bag: 'Bag',
  on: 'On', off: 'Off',
  ink: 'Ink', glue: 'Glue', tanks: 'tanks', charge: 'Battery',
  scanning: 'Scanning', scanNothing: 'Nothing to scan here', scanSent: 'Scan uploaded to ship',
  lightEmpty: 'Flashlight battery empty. Wait for sunlight', noInk: 'Out of ink', noGlue: 'Out of glue', noCracks: 'The jar has no cracks', sealed: 'Crack sealed',
  oxygenFull: 'Jar oxygen is already full', oxygenRefilled: 'Jar oxygen refilled', noTanks: 'No oxygen tanks left',
  bagHint: 'Press Tab or I to open your bag', charging: 'Solar charging',
  map: 'Map', mapSub: 'Explored', close: 'Close',
  legend: 'LEGEND', legShip: 'Ship', legMe: 'Me', legDeath: 'Last death · items still there', legOldBody: 'Old remains · items gone', legBag: 'Beaconed bag',
  mapNote1: "Bags dropped without a beacon won't show on the map. You'll have to find them yourself.",
  mapNote2: 'Dark areas are unexplored.',
  ship: 'Ship',
  km: 'km',
};

const TABLE: Record<Lang, Record<StrKey, string>> = { th, en };

let lang: Lang = 'th';
const listeners = new Set<() => void>();

export function getLang(): Lang {
  return lang;
}

export function setLang(l: Lang): void {
  lang = l;
  if (typeof document !== 'undefined') document.documentElement.lang = l;
  listeners.forEach((f) => f());
}

export function onLangChange(f: () => void): void {
  listeners.add(f);
}

/** ข้อความตามภาษาที่เลือก */
export function t(key: StrKey): string {
  return TABLE[lang][key];
}

/** ใช้ตอนทดสอบ: ทุกคำต้องมีครบสองภาษา */
export function allKeys(): StrKey[] {
  return Object.keys(th) as StrKey[];
}

export function tableFor(l: Lang): Record<StrKey, string> {
  return TABLE[l];
}
