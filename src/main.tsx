import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { listenForInstallPrompt } from './lib/install';
import { isNativeApp } from './lib/backend';
import './styles.css';

listenForInstallPrompt();

// Le service worker permet l'installation et l'ouverture hors ligne (version web uniquement).
if (!isNativeApp && 'serviceWorker' in navigator && import.meta.env.PROD) {
  import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true })).catch(() => undefined);
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
