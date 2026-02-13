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

  // Extract layers from entityRoot
  useEffect(() => {
    if (entityRoot) {
      const layerMap = new Map<string, string>()
      
      entityRoot.traverse((obj) => {
        const layerName = obj.userData?.layer
        if (layerName) {
           if (!layerMap.has(layerName)) {
             let color = '#ffffff'
             if ((obj as any).material) {
               const mat = (obj as any).material
               if (Array.isArray(mat)) {
                 if (mat[0]?.color) color = '#' + mat[0].color.getHexString()
               } else if (mat.color) {
                 color = '#' + mat.color.getHexString()
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
       if (obj.userData?.layer) {
          const shouldBeVisible = layerVisibility[obj.userData.layer] !== false
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
