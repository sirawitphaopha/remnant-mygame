import '@fontsource/chakra-petch/300.css';
import '@fontsource/chakra-petch/400.css';
import '@fontsource/chakra-petch/400-italic.css';
import '@fontsource/chakra-petch/500.css';
import '@fontsource/chakra-petch/600.css';
import '@fontsource/sarabun/400.css';
import '@fontsource/sarabun/400-italic.css';
import '@fontsource/roboto-mono/400.css';
import './styles/main.css';
import './styles/hud.css';
import { App } from './app/App';
import { generateTerrain, type TerrainData } from './world/terrainGen';
import { readSettings } from './storage/save';
import { setLang, t } from './ui/strings';

// ตั้งภาษากับชื่อแท็บก่อนสร้างโลก (เดิมระหว่างโหลดเป็น "ร่องรอย · Remnant" สองภาษา)
setLang(readSettings().lang);
document.title = t('gameTitle');

// หน้ารอสร้างโลก · ภูมิประเทศ 3 × 3 กม. สร้างใน Web Worker (ราว 5 วินาที) หน้าเว็บไม่ค้าง มีแถบความคืบหน้า
const ui = document.getElementById('ui')!;
const loading = document.createElement('div');
loading.className = 'loading';
loading.innerHTML = `<h1>${t('gameTitle')}</h1><p>${t('loadingLand')}</p><div class="bar"><i></i></div><div class="pct num">0%</div>`;
ui.appendChild(loading);
const bar = loading.querySelector('i')!;
const pct = loading.querySelector('.pct')!;
const show = (f: number) => {
  bar.style.width = `${Math.round(f * 100)}%`;
  pct.textContent = `${Math.round(f * 100)}%`;
};

function terrainInWorker(): Promise<TerrainData> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./world/terrain.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<{ progress?: number; data?: TerrainData }>) => {
      if (e.data.progress !== undefined) show(e.data.progress * 0.8);
      if (e.data.data) { worker.terminate(); resolve(e.data.data); }
    };
    worker.onerror = (e) => { worker.terminate(); reject(e); };
    worker.postMessage('go');
  });
}

async function boot(): Promise<void> {
  let data: TerrainData;
  try {
    data = await terrainInWorker();
  } catch {
    // เบราว์เซอร์ที่ไม่มี Web Worker แบบโมดูล สร้างในเธรดหลักแทน (หน้าค้างระหว่างสร้าง)
    data = generateTerrain();
  }
  // ป่า เมือง ของในโลก สร้างในเธรดหลัก รอให้ข้อความใหม่ขึ้นจอก่อน
  loading.querySelector('p')!.textContent = t('loadingLife');
  show(0.85);
  await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 30)));
  const app = new App(document.getElementById('game')!, ui, data);
  loading.remove();
  app.start();
}
void boot();
