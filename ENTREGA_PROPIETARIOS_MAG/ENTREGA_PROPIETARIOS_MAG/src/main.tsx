import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const setupServiceWorker = async () => {
  if (!('serviceWorker' in navigator)) return;

  let refreshing = false;

  try {
    const key = 'entrega_sw:reloaded';
    if (sessionStorage.getItem(key) === '1') refreshing = true;

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      try {
        sessionStorage.setItem(key, '1');
      } catch {}
      window.location.reload();
    });
  } catch {}

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      registrations.map((registration) => {
        const scriptUrl =
          registration.active?.scriptURL ??
          registration.waiting?.scriptURL ??
          registration.installing?.scriptURL ??
          '';
        if (scriptUrl.includes('coi-serviceworker')) {
          return registration.unregister();
        }
        return Promise.resolve(false);
      }),
    );
  } catch {}

  try {
    const registration = await navigator.serviceWorker.register('./entrega-sw.js', {scope: './'});
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

    await registration.update();
  } catch (error) {
    console.error('No se pudo registrar el service worker de Entregas.', error);
  }
};

setupServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
