import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { registerServiceWorker } from './bootstrap/serviceWorker';
import { installTestBridge } from './bootstrap/testBridge';
import './styles/global.css';
import './styles/asset-system.css';
import './styles/audio-settings.css';

registerServiceWorker();
installTestBridge();

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Missing #root element.');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
