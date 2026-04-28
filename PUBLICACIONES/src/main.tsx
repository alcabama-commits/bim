import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if ('serviceWorker' in navigator) {
  let refreshing = false;

  const registerServiceWorker = async () => {
    try {
      const registration = await navigator.serviceWorker.register('./sw.js', { scope: './' });

      const promptUpdate = () => {
        const waiting = registration.waiting;
        if (!waiting) return;
        waiting.postMessage({ type: 'SKIP_WAITING' });
      };

      if (registration.waiting) promptUpdate();

      registration.addEventListener('updatefound', () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            promptUpdate();
          }
        });
      });

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });
    } catch (error) {
      console.error('No se pudo registrar el service worker de PUBLICACIONES.', error);
    }
  };

  window.addEventListener('load', () => {
    void registerServiceWorker();
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
