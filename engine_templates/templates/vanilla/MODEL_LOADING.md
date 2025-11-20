# Carga de Modelos IFC

Este visor ahora soporta cargar modelos IFC y Fragments desde URLs, lo que te permite integrarlo fácilmente en tu sitio web.

## Formas de Cargar Modelos

### 1. Configuración en `config.ts` (Recomendado para modelos fijos)

Edita el archivo `src/config.ts` y agrega tus modelos en el array `initialModels`:

```typescript
export const initialModels: ModelConfig[] = [
  {
    url: "/models/mi-edificio.ifc",
    type: "ifc",
    name: "Mi Edificio"
  },
  {
    url: "https://tu-servidor.com/modelos/estructura.frag",
    type: "frag",
    name: "Estructura"
  }
];
```

Los modelos se cargarán automáticamente al iniciar la aplicación si `autoLoadInitialModels` está en `true`.

### 2. Parámetros en la URL (Dinámico)

Puedes cargar modelos pasando parámetros en la URL:

#### Opción A: Un solo parámetro `model`
```
https://tu-sitio.com/?model=url1.ifc,url2.frag,url3.ifc
```

#### Opción B: Parámetros separados por tipo
```
https://tu-sitio.com/?ifc=modelo1.ifc,modelo2.ifc&frag=estructura.frag
```

### 3. Carga Manual (Desde la UI)

También puedes usar el botón "Add" en el panel de modelos para cargar archivos manualmente.

## Ejemplos de Uso

### Ejemplo 1: Modelo local en tu servidor

```typescript
// En config.ts
export const initialModels: ModelConfig[] = [
  {
    url: "/public/models/edificio.ifc",
    type: "ifc",
    name: "Edificio Principal"
  }
];
```

### Ejemplo 2: Modelo desde un servidor remoto

```typescript
// En config.ts
export const initialModels: ModelConfig[] = [
  {
    url: "https://cdn.tu-servidor.com/modelos/proyecto.ifc",
    type: "ifc",
    name: "Proyecto Completo"
  }
];
```

### Ejemplo 3: Múltiples modelos

```typescript
// En config.ts
export const initialModels: ModelConfig[] = [
  {
    url: "/models/estructura.ifc",
    type: "ifc",
    name: "Estructura"
  },
  {
    url: "/models/instalaciones.ifc",
    type: "ifc",
    name: "Instalaciones"
  },
  {
    url: "/models/arquitectura.frag",
    type: "frag",
    name: "Arquitectura"
  }
];
```

### Ejemplo 4: Desde URL con parámetros

Si tienes una página que genera URLs dinámicamente:

```html
<!-- En tu HTML -->
<a href="viewer.html?model=/models/proyecto-123.ifc">Ver Proyecto 123</a>
<a href="viewer.html?ifc=/models/edificio.ifc&frag=/models/detalles.frag">Ver Completo</a>
```

## Configuración Avanzada

En `src/config.ts` puedes ajustar:

- `autoLoadInitialModels`: Si es `true`, carga automáticamente los modelos de `initialModels`
- `urlParamsOverrideConfig`: Si es `true`, los parámetros URL tienen prioridad sobre la configuración

## Notas Importantes

1. **CORS**: Si cargas modelos desde un servidor diferente, asegúrate de que el servidor tenga CORS habilitado.

2. **Tamaño de archivos**: Los archivos IFC pueden ser grandes. Considera usar compresión o formatos optimizados como Fragments.

3. **Nombres de modelos**: Si no especificas un nombre, se extraerá automáticamente de la URL.

4. **Errores**: Los errores de carga se mostrarán en la consola del navegador.

## API Programática

También puedes cargar modelos programáticamente desde tu código:

```typescript
import { loadIfcFromUrl, loadFragmentsFromUrl } from "./model-loader";

// Cargar un modelo IFC
await loadIfcFromUrl(ifcLoader, "https://ejemplo.com/modelo.ifc", "Mi Modelo");

// Cargar un modelo Fragments
await loadFragmentsFromUrl(fragments, "https://ejemplo.com/modelo.frag", "Mi Modelo");
```


