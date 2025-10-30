const CACHE_NAME = 'portal-bim-alcabama-v1';
// Lista de archivos que queremos guardar en caché para que la app funcione offline.
const urlsToCache = [
  'home.html', // Ruta relativa a la ubicación del Service Worker
  'inse.html', 
  'blue_project_plans.html', // Ruta corregida
  'https://cdn.tailwindcss.com?plugins=forms,typography',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;800&display=swap',
  'https://fonts.googleapis.com/css2?family=Source+Sans+Pro:wght@900&display=swap',
  'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200',
  'https://i.postimg.cc/wMDNvJB5/Portal-BIM-Alcabama-7-1.png',
  'https://i.postimg.cc/mgpPTVwf/Portal-BIM-Alcabama-7-2.png',
  'https://i.postimg.cc/3RNgrPXN/1752525357-ciien-00000-mejora-de-color.png'
];

// Evento de instalación: se abre el caché y se guardan los archivos.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache abierto');
        return cache.addAll(urlsToCache);
      })
  );
});

// Evento fetch: intercepta las peticiones.
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Si el archivo está en caché, lo devuelve. Si no, lo busca en la red.
        return response || fetch(event.request);
      })
  );
});
