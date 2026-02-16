# Documentación Técnica: Panel de Control de Capas DXF

## Descripción General
El Panel de Control de Capas es una interfaz interactiva integrada en el componente `DwgRenderer` que permite a los usuarios gestionar la visibilidad de las capas contenidas en archivos DXF/DWG. Este componente facilita la navegación en planos complejos mediante herramientas de filtrado, selección y persistencia de configuración.

## Características Implementadas

### 1. Extracción y Visualización de Capas
- **Extracción Automática**: Al cargar un archivo, el sistema recorre la estructura de objetos (Scene Graph) de Three.js para identificar todas las capas únicas presentes en la propiedad `userData.layer`.
- **Detección de Color**: Se identifica el color representativo de cada capa analizando el material del primer objeto encontrado en dicha capa. Si no se encuentra un color explícito, se asigna blanco por defecto.
- **Lista Visual**: Muestra el nombre de la capa y un indicador circular con su color real.

### 2. Gestión de Visibilidad
- **Toggle Individual**: Cada capa tiene un checkbox para activar/desactivar su visibilidad.
- **Acciones Globales**:
  - **Seleccionar Todas**: Restaura la visibilidad de todas las capas (alias de Encender Todas).
  - **Encender Todas**: Restaura la visibilidad de todas las capas.
  - **Apagar Todas**: Oculta todas las capas, manteniendo obligatoriamente **al menos una visible** para evitar un lienzo vacío accidental.
- **Validación**: El sistema impide desactivar la última capa visible, asegurando que el usuario siempre tenga referencia visual.

### 3. Búsqueda y Filtrado
- **Barra de Búsqueda**: Permite filtrar la lista de capas por nombre en tiempo real, facilitando la localización en archivos con cientos de capas.

### 4. Persistencia
- **Almacenamiento Local**: La configuración de visibilidad se guarda automáticamente en `localStorage` usando una clave única basada en el nombre del archivo (`dwg_layer_config_${fileName}`).
- **Restauración**: Al volver a cargar el mismo archivo, se restaura el estado de las capas previamente configurado.

## Estructura de Datos

### Estado del Componente
```typescript
interface LayerInfo {
  name: string;   // Nombre de la capa (ej: "Muros", "Cotas")
  color: string;  // Color hexadecimal (ej: "#ff0000")
}

// Lista de todas las capas disponibles
const [layers, setLayers] = useState<LayerInfo[]>([])

// Mapa de visibilidad (Nombre -> Visible)
const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean>>({})

// Término de búsqueda
const [layerSearch, setLayerSearch] = useState('')
```

### Lógica de Renderizado
El efecto `useEffect` observa cambios en `layerVisibility` y actualiza la propiedad `.visible` de los objetos de Three.js:

```typescript
useEffect(() => {
  if (!entityRoot) return
  entityRoot.traverse((obj) => {
     if (obj.userData?.layer) {
        // Si la capa no está explícitamente en false, es visible
        const shouldBeVisible = layerVisibility[obj.userData.layer] !== false
        obj.visible = shouldBeVisible
     }
  })
}, [layerVisibility, entityRoot])
```

## Estructura DXF Soportada
El sistema espera que los objetos cargados (Líneas, Polilíneas, Arcos, etc.) tengan la propiedad `userData.layer` poblada. Esto es estándar en convertidores como `LibreDwg` y `three-dxf-loader`.

- **Entidades**: `THREE.Line`, `THREE.Mesh`
- **Propiedades Requeridas**: 
  - `obj.userData.layer`: String con el nombre de la capa.
  - `obj.material.color`: (Opcional) Para la detección de color en la lista.

## Guía de Uso
1. **Abrir Panel**: Clic en el icono de capas (hojas apiladas) en la esquina superior izquierda.
2. **Filtrar**: Escribir en el campo "Buscar capa..." para reducir la lista.
3. **Alternar**: Clic en el checkbox o nombre de la capa.
4. **Operaciones Masivas**: Usar los iconos de "Ojo" (Ver todo) u "Ojo Tachado" (Ocultar todo) en la cabecera del panel.

## Consideraciones de Rendimiento
- La actualización de visibilidad es eficiente ya que solo modifica la propiedad `visible` de los objetos sin reconstruir la geometría ni la escena.
- Para archivos con miles de objetos, la operación de `traverse` es muy rápida (ms).
