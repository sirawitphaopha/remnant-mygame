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
import { readSettings } from './storage/save';
import { setLang, t } from './ui/strings';

// ตั้งภาษากับชื่อแท็บก่อนสร้างโลก (เดิมระหว่างโหลดเป็น "ร่องรอย · Remnant" สองภาษา)
setLang(readSettings().lang);
document.title = t('gameTitle');

const app = new App(document.getElementById('game')!, document.getElementById('ui')!);
app.start();
