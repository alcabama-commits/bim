# Repositorio de Vistas (Viewpoints)

Esta carpeta contiene las vistas persistentes del proyecto. Cada vista se almacena como un archivo JSON individual.
El archivo `index.json` se genera automáticamente durante el proceso de construcción (`npm run build`) y contiene un índice de todas las vistas disponibles.

## Estructura del Archivo JSON
```json
{
  "id": "uuid",
  "userId": "email@example.com",
  "title": "Vista Ejemplo",
  "description": "Descripción opcional",
  "date": 1678886400000,
  "camera": { ... },
  "selection": { ... },
  "hidden": { ... },
  "annotations": [ ... ],
  "clippingPlanes": [ ... ],
  "loadedModels": [ ... ]
}
```

## Cómo añadir una vista
1. Utiliza la aplicación para crear y configurar la vista deseada.
2. Haz clic en el botón "Exportar a Repositorio" en el panel de vistas.
3. Guarda el archivo JSON descargado en esta carpeta (`public/VISTAS`).
4. Haz commit y push de los cambios al repositorio.
5. **IMPORTANTE**: Si estás probando localmente, debes ejecutar `npm run build` o reiniciar el servidor de desarrollo para que `index.json` se actualice y la vista aparezca en la lista.

## Nota sobre index.json
No edites manualmente `index.json`. Este archivo es generado automáticamente por el script de construcción de Vite (`vite.config.js`). Si añades un archivo JSON a esta carpeta, el índice se regenerará en la próxima compilación.
