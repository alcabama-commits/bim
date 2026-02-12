## Diagnóstico
- Hay **dos sistemas de snap** activos y ambos mutan `valid.point`, lo que genera “saltos” e inconsistencia: el **snap global** (`applySnappingToIntersection`) y el snap dentro de `getIntersection` en [main.ts](file:///c:/Users/DELL/Documents/GitHub/bim/VSR_IFC/src/main.ts).
- El snap global además usa un umbral muy grande en píxeles (150px) y candidatos discutibles (esquinas del bounding box), lo que provoca selección de puntos no deseados y mediciones imprecisas.

## Cambios propuestos
1. **Unificar el snap en un solo lugar**
   - Elegir un único flujo (recomendado: mantener el snap dentro de `getIntersection` y **desactivar/neutralizar** el snap global para evitar doble “snapeo”).
2. **Eliminar candidatos que causan imprecisión**
   - Quitar **esquinas de bounding box** como candidatos en el snap global.
   - Evitar la búsqueda “todos los vértices” por evento; limitar candidatos al entorno local del triángulo impactado.
3. **Mejorar criterio de selección para que sea fácil y preciso**
   - Cambiar de “distancia en píxeles” pura a un criterio estable:
     - Primero: elegir el mejor candidato en pantalla.
     - Desempate: preferir el candidato más cercano en profundidad al punto de impacto (evita saltar a vértices lejanos del mismo objeto).
   - Añadir **histeresis (sticky snap)**: si ya está snapeado a un vértice, mantenerlo mientras el mouse no se aleje más de X px (reduce jitter).
4. **Ajuste fino de umbral**
   - Definir `SNAP_THRESHOLD_PX` único para todo (ej. 35–45 por defecto) y permitir subirlo sin perder precisión gracias al “sticky + desempate”.
5. **Validación de candidatos inválidos**
   - Filtrar candidatos no finitos y evitar que el parche de `BufferAttribute.getX/Y/Z` genere puntos falsos (ej. (0,0,0)).

## Verificación
- Probar 3 casos: esquina de viga/columna, intersección de bordes cercanos y zoom-out.
- Validar que el punto visual (cursor) coincide con el punto usado para medir (longitud/pendiente/área).
- Confirmar en consola (temporalmente) el ID del vértice elegido y que no cambia al mover ligeramente el mouse.

## Entregables
- Ajustes en un único archivo: [main.ts](file:///c:/Users/DELL/Documents/GitHub/bim/VSR_IFC/src/main.ts) (sin crear archivos nuevos).