import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Ensure HashRouter has a starting hash on iOS WebView (Capacitor) to prevent blank screen
if (!window.location.hash) {
  window.location.hash = '/';
}

// Early bootstrap log and visual marker
try {
  // eslint-disable-next-line no-console
  console.log('[BOOT] main.tsx executing. Hash=', window.location.hash);
  const rootEl = document.getElementById('root');
  if (rootEl && !rootEl.hasChildNodes()) {
    rootEl.textContent = 'Chargement A.T.L.A.S…';
  }
  window.addEventListener('error', (e) => {
    // eslint-disable-next-line no-console
    console.error('[GLOBAL ERROR]', e.error || e.message || e);
  });
} catch (e) {
  // eslint-disable-next-line no-console
  console.error('[BOOT ERROR]', e);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
