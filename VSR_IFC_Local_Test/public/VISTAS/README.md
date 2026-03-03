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
