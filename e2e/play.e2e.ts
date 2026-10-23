import { expect, test, type Page } from '@playwright/test';

// เล่นเดโมแทนคนตั้งแต่เปิดหน้าจนปิดแล้วเปิดใหม่: เริ่มเกม เดิน เก็บของ ตาย เกิดใหม่ เปลี่ยนภาษา เล่นต่อ
// ใช้ตัวช่วยตอน dev (__remnant) หยุดลูปจริงแล้วเดินเวลาเอง ผลเหมือนเล่นจริงทุกเฟรม

type Game = {
  paused: boolean;
  started: boolean;
  bodyNumber: number;
  corpses: unknown[];
  player: { x: number; z: number };
  interact: unknown;
  props: { byKey: Map<string, { taken: boolean; prop: { x: number; z: number } }> };
  hud: { root: HTMLElement };
  settingsScreen: { open: boolean };
  shipScreen: { open: boolean };
  input: { simulate(code: string, down: boolean): void };
  advance(s: number): void;
  teleport(x: number, z: number, heading?: number): void;
  startDeath(cause: string): void;
  save(): boolean;
};

async function ready(page: Page): Promise<void> {
  await page.waitForFunction(() => (window as unknown as { __remnant?: unknown }).__remnant !== undefined, null, { timeout: 90_000 });
  await page.evaluate(() => { (window as unknown as { __remnant: Game }).__remnant.paused = true; });
}

const run = <T>(page: Page, fn: (a: Game) => T) =>
  page.evaluate(`(${fn.toString()})(window.__remnant)`) as Promise<T>;

test('เล่นเดโมครบ แล้วปิดเปิดใหม่ ความคืบหน้ายังอยู่', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  // โครมแบบไม่มีหน้าต่างวาดภาพด้วยซีพียู ช้ามาก จึงตั้งภาพระดับต่ำไว้ก่อน (ตั้งครั้งเดียว ไม่ทับภาษาที่เปลี่ยนทีหลัง)
  await page.addInitScript(() => {
    if (!localStorage.getItem('remnant.settings.v1')) localStorage.setItem('remnant.settings.v1', JSON.stringify({ quality: 'low' }));
  });
  const t0 = Date.now();
  const mark = (what: string) => console.log(`${((Date.now() - t0) / 1000).toFixed(1)} วินาที · ${what}`);

  await page.goto('/');
  await ready(page);
  mark('เปิดหน้าแล้ว');

  // หน้าเริ่มเกม ยังไม่มีบันทึก จึงไม่มีปุ่มเล่นต่อ
  await expect(page.getByRole('button', { name: 'เริ่มสำรวจใหม่' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^เล่นต่อ/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'เริ่มสำรวจใหม่' }).click();
  expect(await run(page, (a) => a.started)).toBe(true);

  // เดินหน้า 2 วินาที
  const moved = await run(page, (a) => {
    const x0 = a.player.x, z0 = a.player.z;
    a.input.simulate('KeyW', true);
    a.advance(2);
    a.input.simulate('KeyW', false);
    a.advance(0.2);
    return Math.hypot(a.player.x - x0, a.player.z - z0);
  });
  expect(moved).toBeGreaterThan(2);
  mark(`เดินได้ ${moved.toFixed(1)} เมตร`);

  // เก็บตุ๊กตาหมีด้วยปุ่ม E
  const took = await run(page, (a) => {
    const it = a.props.byKey.get('item-7')!;
    for (const [dx, dz] of [[0.8, 0], [-0.8, 0], [0, 0.8], [0, -0.8]]) {
      a.teleport(it.prop.x + dx, it.prop.z + dz, Math.atan2(-dx, -dz));
      a.advance(0.3);
      if (a.interact) break;
    }
    a.input.simulate('KeyE', true);
    a.advance(0.1);
    a.input.simulate('KeyE', false);
    a.advance(0.2);
    return it.taken;
  });
  expect(took).toBe(true);
  mark('เก็บตุ๊กตาหมีแล้ว');

  // ตก ตาย แล้วยานจำลองร่างใหม่ ของตกที่ซาก
  const after = await run(page, (a) => {
    a.startDeath('fall');
    a.advance(12);
    return { body: a.bodyNumber, corpses: a.corpses.length };
  });
  expect(after).toEqual({ body: 2, corpses: 1 });
  mark('ตายแล้วเกิดใหม่เป็นร่างที่ 2');
  if (await run(page, (a) => a.shipScreen.open)) {
    await page.keyboard.press('Escape');
    await run(page, (a) => a.advance(0.2));
  }

  // Esc หยุดเกม แล้วเปลี่ยนเป็นภาษาอังกฤษ บนจอต้องไม่มีอักษรไทยเหลือ
  await page.keyboard.press('Escape');
  await run(page, (a) => a.advance(0.2));
  expect(await run(page, (a) => a.settingsScreen.open)).toBe(true);
  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.getByRole('heading', { name: 'Paused' })).toBeVisible();
  await page.keyboard.press('Escape');
  const hudThai = await run(page, (a) => { a.advance(0.5); return /[฀-๿]/.test(a.hud.root.innerText); });
  expect(hudThai).toBe(false);
  mark('เปลี่ยนเป็นอังกฤษ ไม่มีอักษรไทยค้าง');

  // ปิดหน้าแล้วเปิดใหม่ หน้าแรกเป็นภาษาอังกฤษ มีปุ่มเล่นต่อ
  expect(await run(page, (a) => a.save())).toBe(true);
  await page.reload();
  await ready(page);
  mark('เปิดหน้าใหม่แล้ว');
  const cont = page.getByRole('button', { name: /^Continue/ });
  await expect(cont).toBeVisible();
  await expect(cont).toContainText('Body 2');
  await cont.click();
  const restored = await run(page, (a) => {
    a.advance(0.3);
    return { body: a.bodyNumber, corpses: a.corpses.length, teddyGone: a.props.byKey.get('item-7')!.taken };
  });
  expect(restored).toEqual({ body: 2, corpses: 1, teddyGone: true });
  mark('เล่นต่อ ของเดิมครบ');

  // เปลี่ยนกลับเป็นไทย ไม่ให้ภาษาค้างเป็นอังกฤษในรอบหน้า (โปรไฟล์นี้ทิ้งอยู่แล้ว แต่ทดสอบปุ่มด้วย)
  await page.keyboard.press('Escape');
  await run(page, (a) => a.advance(0.2));
  await page.getByRole('button', { name: 'ไทย' }).click();
  await expect(page.getByRole('heading', { name: 'หยุดเกม' })).toBeVisible();

  expect(errors).toEqual([]);
  mark('จบ ไม่มีข้อผิดพลาด');
});
