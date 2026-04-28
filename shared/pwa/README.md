# Base Offline

Esta carpeta define el estandar de cache offline para las apps publicadas del repositorio.

## Regla

Toda pagina nueva debe salir con:

1. Un `service worker` basado en `shared/pwa/sw-template.js`.
2. Registro del worker en `src/main.tsx` con `SKIP_WAITING` y recarga por `controllerchange`.
3. `manifest.webmanifest`, `icon.svg` y `meta[name="x-app-version"]` en `index.html`.
4. `base: './'` en `vite.config.*` cuando la app se publique en subcarpetas de GitHub Pages.

## Politica De Cache

- Navegaciones: `network-first` con fallback a `index.html`.
- Assets locales: `cache-first` con revalidacion en background.
- JSON y datos locales: `network-first` con respaldo en cache.
- Solo se cachea contenido del mismo origen y dentro del scope publicado.

## Apps Ya Alineadas

- `CANTIDADES`
- `STATUS`
- `PUBLICACIONES`
- `ENTREGA_PROPIETARIOS_MAG/ENTREGA_PROPIETARIOS_MAG`

## Checklist Rapido

1. Copiar `sw-template.js` a `public/sw.js` o al nombre del worker de la app.
2. Registrar el worker desde `src/main.*` con `scope: './'`.
3. Agregar `manifest.webmanifest` e `icon.svg` a `public/`.
4. Agregar banner/versionado en `index.html`.
5. Validar `npm run build` y revisar que el output publicado no use rutas absolutas erradas.
