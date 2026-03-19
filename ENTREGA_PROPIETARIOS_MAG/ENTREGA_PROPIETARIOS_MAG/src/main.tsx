import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const setupServiceWorker = async () => {
  if (!('serviceWorker' in navigator)) return;

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
    await navigator.serviceWorker.register('./entrega-sw.js', {scope: './'});
  } catch {}
};

setupServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
