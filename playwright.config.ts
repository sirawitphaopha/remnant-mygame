import { defineConfig } from '@playwright/test';

// เล่นเกมอัตโนมัติด้วยโครมแบบไม่มีหน้าต่าง · 🔴 ใช้บนเครื่องคลาวด์เท่านั้น
// ห้ามรันบนเครื่องพี่กัน (สกิล testing-proof 5.6 "ห้ามรันเบราว์เซอร์เบื้องหลัง ยกเว้นบนคลาวด์")
// บนเครื่องพี่กันให้เล่นทดสอบในโครมของพี่กันผ่าน Claude in Chrome ตาม CLAUDE.md
if (!process.env.CI) {
  throw new Error('ชุดเล่นอัตโนมัติรันได้เฉพาะเครื่องคลาวด์ (ตั้ง CI=1) · บนเครื่องพี่กันให้ทดสอบในโครมผ่าน Claude in Chrome');
}

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.e2e.ts',
  timeout: 600_000,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3700',
    browserName: 'chromium',
    viewport: { width: 960, height: 540 },
    launchOptions: { args: ['--enable-unsafe-swiftshader'] },
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3700',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
