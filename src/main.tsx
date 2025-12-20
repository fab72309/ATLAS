import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initAnalytics } from './utils/firebase';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';

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

initAnalytics().catch((err) => {
  // eslint-disable-next-line no-console
  console.warn('[Analytics] init skipped', err);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>
);
