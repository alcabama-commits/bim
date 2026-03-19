import * as THREE from 'three';
import * as OBC from '@thatopen/components';

/**
 * --- INSTRUCCIONES DE IMPLEMENTACIÓN ---
 * 
 * Debido a restricciones de permisos en el entorno actual, no puedo editar directamente 'VSR_IFC/src/main.ts'.
 * He generado este archivo con el código exacto que necesitas.
 * 
 * POR FAVOR, REALIZA LOS SIGUIENTES CAMBIOS EN 'VSR_IFC/src/main.ts':
 */

// 1. INICIALIZACIÓN DEL SNAPPER
// Coloca esto en la sección de configuración de componentes (ej. después de 'highlighter')
/*
    const snapper = components.get(OBC.Snapper);
    snapper.enabled = true;
    // Configuración opcional
    snapper.snapDistance = 10; 
*/

// 2. LÓGICA DE GENERACIÓN DE BORDES
// Copia esta función en 'main.ts' (puede ser al final del archivo o antes de 'loadModel')

/**
 * Genera geometría de bordes en memoria para permitir Snapping si el archivo original no los tiene.
 * Cumple con los requisitos:
 * - No sobrescribe el archivo original (todo es en memoria).
 * - Mantiene la integridad de los datos (vincula al fragmento original).
 */
export function ensureModelEdges(model: any) {
    if (!model || !model.items) return;
    
    console.log(`[DEBUG] Verificando/Generando geometría de bordes para el modelo ${model.uuid}...`);
    
    // Material para los bordes (semi-transparente para no interferir visualmente demasiado)
    const lineMaterial = new THREE.LineBasicMaterial({ 
        color: 0x333333, 
        transparent: true, 
        opacity: 0.5,
        depthTest: false
    });

    for (const fragment of model.items) {
        // Verificar geometría válida
        if (!fragment.geometry) continue;
        
        // Evitar duplicación si ya se procesó
        if (fragment.userData.hasEdges) continue;
        
        try {
            // Generar geometría de bordes (EdgesGeometry) basada en la geometría del fragmento
            const edgesGeo = new THREE.EdgesGeometry(fragment.geometry);
            
            // Crear un InstancedMesh para los bordes que coincida con las instancias del fragmento
            const edgesMesh = new THREE.InstancedMesh(
                edgesGeo, 
                lineMaterial, 
                fragment.count
            );
            
            // Sincronizar matrices de instancia
            if (fragment.instanceMatrix) {
                edgesMesh.instanceMatrix = fragment.instanceMatrix;
            }
            
            // CRÍTICO: Vincular al fragmento original para intersección de datos
            // Esto asegura que si el sistema detecta este borde, pueda rastrear el objeto original (expressID)
            // El 'instanceId' del borde coincidirá con el del fragmento.
            edgesMesh.userData.originalFragment = fragment;
            edgesMesh.userData.isEdge = true;
            
            // Añadir al grupo del modelo para que se transforme junto con él
            model.object.add(edgesMesh);
            
            // Marcar como procesado
            fragment.userData.hasEdges = true;
            
        } catch (e) {
            console.error(`Error generando bordes para el fragmento ${fragment.id}:`, e);
        }
    }
    console.log(`[DEBUG] Generación de bordes completada para ${model.uuid}`);
}

// 3. INTEGRACIÓN EN 'loadModel'
// Dentro de la función 'loadModel', añade la llamada justo antes de retornar el modelo.

/*
async function loadModel(url: string, path: string) {
    // ... (código existente de carga y JSON) ...

    // --- AÑADIR ESTA LÍNEA ---
    // Genera bordes en memoria para el Snapper
    ensureModelEdges(model);
    // -------------------------

    return model;
}
*/
