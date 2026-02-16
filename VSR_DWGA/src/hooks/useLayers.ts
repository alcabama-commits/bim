import { useState, useEffect } from 'react'
import * as THREE from 'three'

export interface LayerInfo {
  name: string
  color: string
}

export const useLayers = (entityRoot: THREE.Object3D | null, file: File | null) => {
  const [layers, setLayers] = useState<LayerInfo[]>([])
  const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean>>({})

  // Load persisted layer configuration
  useEffect(() => {
    if (file) {
      const key = `dwg_layer_config_${file.name}`
      const saved = localStorage.getItem(key)
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          setLayerVisibility(parsed)
        } catch (e) {
          console.error('Failed to load layer config', e)
        }
      }
    }
  }, [file])

  // Save layer configuration
  useEffect(() => {
    if (file && Object.keys(layerVisibility).length > 0) {
      const key = `dwg_layer_config_${file.name}`
      localStorage.setItem(key, JSON.stringify(layerVisibility))
    }
  }, [layerVisibility, file])

  const resolveLayerName = (obj: THREE.Object3D): { name: string, isColorFallback: boolean } | null => {
    let layerName: any = null

    // 1. Direct userData.layer
    if (obj.userData?.layer) layerName = obj.userData.layer

    // 2. Nested in 'entity' property (dxf-parser structure)
    if (!layerName && obj.userData?.entity?.layer) layerName = obj.userData.entity.layer

    // 2b. Other common DXF keys
    if (!layerName && (obj as any).userData?.properties?.layer) layerName = (obj as any).userData.properties.layer
    if (!layerName && (obj as any).userData?.attribs?.layer) layerName = (obj as any).userData.attribs.layer
    if (!layerName && (obj as any).userData?.dxf?.layer) layerName = (obj as any).userData.dxf.layer

    // 3. Direct property on object
    if (!layerName && (obj as any).layer) layerName = (obj as any).layer

    // 4. Resolve object-style layer ( {name: 'Layer1', ...} )
    if (typeof layerName === 'object' && layerName !== null) {
       if (layerName.name) layerName = layerName.name
       else if (layerName.toString) layerName = layerName.toString()
    }

    if (layerName && typeof layerName === 'string') {
        return { name: layerName, isColorFallback: false }
    }

    // 5. FALLBACK: Use Color if no layer found
    // This handles cases where layer info is missing but visual grouping is possible
    let colorHex: string | null = null
    if ((obj as any).material) {
        const mat = (obj as any).material
        if (Array.isArray(mat)) {
            if (mat[0]?.color) colorHex = '#' + mat[0].color.getHexString()
        } else if (mat.color) {
            colorHex = '#' + mat.color.getHexString()
        }
    }
    // If no material color, try vertex colors from geometry
    if (!colorHex && (obj as any).geometry?.attributes?.color) {
      const attr = (obj as any).geometry.attributes.color
      if (attr && attr.count >= 1 && attr.itemSize >= 3) {
        const r = Math.max(0, Math.min(255, Math.round(attr.getX(0) * 255)))
        const g = Math.max(0, Math.min(255, Math.round(attr.getY(0) * 255)))
        const b = Math.max(0, Math.min(255, Math.round(attr.getZ(0) * 255)))
        const hex = ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')
        colorHex = '#' + hex
      }
    }

    if (colorHex) {
        return { name: `Color ${colorHex.toUpperCase()}`, isColorFallback: true }
    }

    return null
  }

  // Extract layers from entityRoot
  useEffect(() => {
    if (entityRoot) {
      const layerMap = new Map<string, string>()
      
      console.log('useLayers: traversing entityRoot', entityRoot)
      let debugCount = 0
      
      entityRoot.traverse((obj) => {
        // Resolve the layer name (either explicit or color-based)
        const result = resolveLayerName(obj)
        
        // Store the resolved ID on the object for stability and performance
        // This ensures that even if we change material colors later (e.g. contrast),
        // the layer ID remains constant.
        if (result) {
            obj.userData.layerId = result.name
        } else {
            obj.userData.layerId = null
        }

        if (debugCount < 10) {
           console.log('useLayers: object debug', { 
             type: obj.type, 
             userDataKeys: obj.userData ? Object.keys(obj.userData) : [],
             userDataEntity: obj.userData?.entity,
             layerProp: (obj as any).layer,
             resolved: result
           })
           debugCount++
        }

        if (result) {
             const layerName = result.name
             if (!layerMap.has(layerName)) {
               let color = '#ffffff'
               
               // If it's a color fallback, use the color itself as the badge color
               if (result.isColorFallback) {
                   const hex = layerName.replace('Color ', '')
                   if (hex.startsWith('#')) color = hex
               } else {
                   // Try to find color for standard layers
                   // 1. From material
                   if ((obj as any).material) {
                     const mat = (obj as any).material
                     if (Array.isArray(mat)) {
                       if (mat[0]?.color) color = '#' + mat[0].color.getHexString()
                     } else if (mat.color) {
                       color = '#' + mat.color.getHexString()
                     }
                   }
                   // 2. From DXF color index (sometimes in userData)
                   if (color === '#ffffff' && obj.userData?.color) {
                      // We could convert index to hex, but for now stick to white if not simple
                   }
               }
 
               layerMap.set(layerName, color)
           }
        }
      })

      const sortedLayers = Array.from(layerMap.entries())
        .map(([name, color]) => ({ name, color }))
        .sort((a, b) => a.name.localeCompare(b.name))
        
      setLayers(sortedLayers)
      
      // Init visibility
      setLayerVisibility(prev => {
         const next = { ...prev }
         sortedLayers.forEach(l => {
            if (next[l.name] === undefined) next[l.name] = true
         })
         return next
      })
    }
  }, [entityRoot])

  // Apply Layer Visibility
  useEffect(() => {
    if (!entityRoot) return
    entityRoot.traverse((obj) => {
       const layerName = obj.userData.layerId
       if (layerName) {
          const shouldBeVisible = layerVisibility[layerName] !== false
          obj.visible = shouldBeVisible
       }
    })
  }, [layerVisibility, entityRoot])

  const toggleLayer = (layerName: string, force?: boolean) => {
    setLayerVisibility(prev => {
      const current = prev[layerName] !== false
      const nextVal = force !== undefined ? force : !current
      
      // Validation: If turning off, check if it's the last one
      if (!nextVal) {
        const visibleCount = layers.filter(l => prev[l.name] !== false).length
        if (visibleCount <= 1 && current) {
           return prev // Do nothing
        }
      }
      
      return { ...prev, [layerName]: nextVal }
    })
  }

  const showAll = () => {
    const newVis = { ...layerVisibility }
    layers.forEach(l => newVis[l.name] = true)
    setLayerVisibility(newVis)
  }

  const hideAll = () => {
    const newVis = { ...layerVisibility }
    layers.forEach(l => newVis[l.name] = false)
    if (layers.length > 0) {
       newVis[layers[0].name] = true
    }
    setLayerVisibility(newVis)
  }

  return {
    layers,
    layerVisibility,
    setLayerVisibility,
    toggleLayer,
    showAll,
    hideAll
  }
}
