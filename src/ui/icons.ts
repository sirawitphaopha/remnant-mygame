// ไอคอนวาดด้วยเส้น ไม่ใช้ตัวอักษรพิเศษหรืออีโมจิ (เครื่องที่ไม่มีฟอนต์จะเห็นเป็นกล่องเปล่า)

const wrap = (body: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const ICONS: Record<string, string> = {
  scanner: wrap('<rect x="7" y="9" width="10" height="11" rx="2"/><path d="M12 9V5"/><path d="M8.5 4.5a5 5 0 0 1 7 0"/><path d="M6 2.5a8.5 8.5 0 0 1 12 0"/><circle cx="12" cy="14.5" r="2"/>'),
  flashlight: wrap('<path d="M8 3h8l-1.5 5h-5z"/><rect x="9.5" y="8" width="5" height="12" rx="1.2"/><path d="M12 12v2"/>'),
  inkGun: wrap('<path d="M4 9h11a3 3 0 0 1 3 3v0a3 3 0 0 1-3 3H11l-1.5 5H7l1-5H4z"/><path d="M18 12h2.5"/><circle cx="21.2" cy="12" r=".8"/>'),
  glueGun: wrap('<path d="M5 8h10v5H9l-1 6H5.5l.8-6H5z"/><path d="M15 9.5h4l1.5 1.5-1.5 1.5h-4"/><path d="M11 5v3"/>'),
  climber: wrap('<path d="M6 21l4-9"/><path d="M10 12l5-8 3 2-2 3"/><path d="M14 21l-2-6"/><path d="M16 9l3 1"/>'),
  oxygenTank: wrap('<rect x="8" y="6" width="8" height="15" rx="3"/><path d="M10 6V4h4v2"/><path d="M12 2v2"/><path d="M10.5 11h3"/>'),
  bag: wrap('<path d="M6 8h12l1 12H5z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/><path d="M9 12h6"/>'),
  item: wrap('<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5"/><path d="M12 12v9"/><path d="M12 12L4 7.5"/>'),
  ship: wrap('<path d="M12 3c3 2 4 6 4 10l2 4H6l2-4c0-4 1-8 4-10z"/><circle cx="12" cy="10" r="1.5"/>'),
  close: wrap('<path d="M6 6l12 12M18 6L6 18"/>'),
};
