import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const setupServiceWorker = async () => {
  if (!('serviceWorker' in navigator)) return;

  try {
    let reloaded = false;
    const key = 'entrega_sw:reloaded';
    if (sessionStorage.getItem(key) === '1') reloaded = true;

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloaded) return;
      reloaded = true;
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
    await registration.update();
  } catch {}
};

setupServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
