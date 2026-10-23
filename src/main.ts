import '@fontsource/chakra-petch/300.css';
import '@fontsource/chakra-petch/400.css';
import '@fontsource/chakra-petch/600.css';
import '@fontsource/sarabun/400.css';
import '@fontsource/roboto-mono/400.css';
import './styles/main.css';
import './styles/hud.css';
import { App } from './app/App';

const app = new App(document.getElementById('game')!, document.getElementById('ui')!);
app.start();
