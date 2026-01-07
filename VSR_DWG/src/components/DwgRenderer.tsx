import React, { useEffect, useRef, useState } from 'react'
import type { Calibration, Tool, DimensionItem, AreaItem, SnapSettings } from '../types'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js'
import { DXFLoader } from 'three-dxf-loader'
import { LibreDwg, Dwg_File_Type } from '@mlightcad/libredwg-web'

interface Props {
  file: File | null
  tool: Tool
  showGrid: boolean
  isBlueprint: boolean
  calibration: Calibration | null
  onCalibrationComplete: (c: Calibration) => void
  onDocInfo: (info: string) => void
  snapSettings: SnapSettings
}

const DwgRenderer: React.FC<Props> = ({
  file, tool, showGrid, isBlueprint, calibration, onCalibrationComplete, onDocInfo, snapSettings
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const controlsTargetRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [renderer, setRenderer] = useState<THREE.WebGLRenderer | null>(null)
  const [scene] = useState(() => new THREE.Scene())
  const [camera] = useState(() => new THREE.OrthographicCamera(-50, 50, 50, -50, -1000000, 1000000))
  const [controls, setControls] = useState<OrbitControls | null>(null)
  const [gridHelper, setGridHelper] = useState<THREE.GridHelper | null>(null)
  const [entityRoot, setEntityRoot] = useState<THREE.Object3D | null>(null)
  const [points, setPoints] = useState<THREE.Vector3[]>([])
  const [snap, setSnap] = useState<{ type: 'endpoint' | 'midpoint', pos: THREE.Vector3 } | null>(null)
  const [snapCandidates, setSnapCandidates] = useState<{pos: THREE.Vector3, type: 'endpoint' | 'midpoint'}[]>([])
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [loadingText, setLoadingText] = useState<string>('')
  const loadTimeoutRef = useRef<number | null>(null)
  const [dimensions, setDimensions] = useState<DimensionItem[]>([])
  const [polyPoints, setPolyPoints] = useState<THREE.Vector3[]>([])
  const [areas, setAreas] = useState<AreaItem[]>([])
  const [debugStats, setDebugStats] = useState<string>('')
  const [zoomLevel, setZoomLevel] = useState<number>(1)
  
  // Layout Management
  const [layouts, setLayouts] = useState<string[]>([])
  const [activeLayout, setActiveLayout] = useState<string>('Model')
  const [parsedData, setParsedData] = useState<{ type: 'dwg' | 'dxf', data: any } | null>(null)

  const extractSnapPoints = (root: THREE.Object3D) => {
    root.updateMatrixWorld(true)
    const candidates: {pos: THREE.Vector3, type: 'endpoint' | 'midpoint'}[] = []
    const stats: Record<string, number> = {}
     let loggedDebug = false

     root.traverse((obj) => {
      stats[obj.type] = (stats[obj.type] || 0) + 1
      
      const processGeometry = (geometry: THREE.BufferGeometry, matrix: THREE.Matrix4, isLine: boolean) => {
          const pos = geometry.attributes.position
          const index = geometry.index
          
          if (!pos) {
            if (!loggedDebug) console.warn('Geometry has no position attribute:', obj)
            return
          }

          const isLineSeg = (obj as any).isLineSegments
          
          if (!loggedDebug && isLine && isLineSeg) {
            console.log('DEBUG LineSegments:', {
              posCount: pos.count,
              indexCount: index ? index.count : 'no index',
              uuid: obj.uuid,
              posArray: pos.array ? pos.array.length : 'no array'
            })
            // Log first few points to see if they are valid
            if (pos.count > 0) {
              console.log('First point:', pos.getX(0), pos.getY(0), pos.getZ(0))
            }
            loggedDebug = true
          }

          const getPoint = (i: number) => {
            return new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(matrix)
          }
          
          const add = (p: THREE.Vector3, type: 'endpoint' | 'midpoint') => {
             // Force Z to 0 for 2D snapping
             p.z = 0
             candidates.push({ pos: p, type })
          }

          if (isLine) {
             // Existing Line Logic
             if (isLineSeg) {
                const count = index ? index.count : pos.count
                for (let i = 0; i < count; i += 2) {
                  const idx1 = index ? index.getX(i) : i
                  const idx2 = index ? index.getX(i+1) : i+1
                  if (idx1 < pos.count && idx2 < pos.count) {
                    const p1 = getPoint(idx1)
                    const p2 = getPoint(idx2)
                    add(p1, 'endpoint')
                    add(p2, 'endpoint')
                    add(p1.clone().add(p2).multiplyScalar(0.5), 'midpoint')
                  }
                }
             } else {
                // Line Strip / Loop
                const count = index ? index.count : pos.count
                // For LineLoop, we should close the loop, but for now treat as strip
                const isLoop = (obj as any).isLineLoop
                const segments = isLoop ? count : count - 1
                
                for (let i = 0; i < segments; i++) {
                  const idx1 = index ? index.getX(i) : i
                  const idx2 = index ? index.getX((i+1) % count) : (i+1)
                  
                  if (idx1 < pos.count && idx2 < pos.count) {
                    const p1 = getPoint(idx1)
                    const p2 = getPoint(idx2)
                    add(p1, 'endpoint')
                    add(p2, 'endpoint')
                    add(p1.clone().add(p2).multiplyScalar(0.5), 'midpoint')
                  }
                }
             }
          } else {
             // Mesh Logic (Vertices as endpoints)
             // Only add vertices as endpoints, no midpoints for now to avoid noise
             for (let i = 0; i < pos.count; i++) {
               add(getPoint(i), 'endpoint')
             }
          }
      }

      // Check using boolean flags to support multiple Three.js instances
      const isLine = (obj as any).isLine || (obj as any).isLineSegments || (obj as any).isLineLoop
      const isMesh = (obj as any).isMesh

      if (isLine) {
         if ((obj as any).geometry) processGeometry((obj as any).geometry, obj.matrixWorld, true)
      } else if (isMesh) {
         if ((obj as any).geometry) processGeometry((obj as any).geometry, obj.matrixWorld, false)
      }
    })
    
    // console.log(`Extracted ${candidates.length} snap points`)
    console.log(`Snap Candidates Extracted: ${candidates.length}`, candidates.slice(0, 5))
    console.log('Scene Objects:', stats)
    setDebugStats(JSON.stringify(stats).replace(/[{"}]/g, '').replace(/,/g, ', '))
    setSnapCandidates(candidates)
  }

  const fitToView = () => {
    if (!entityRoot || !camera || !controls || !containerRef.current) return

    const box = new THREE.Box3().setFromObject(entityRoot)
    if (box.isEmpty()) return

    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    const maxSize = Math.max(size.x, size.y)
    
    // Expand view slightly (1.2x)
    const viewSize = maxSize * 1.2
    
    const w = containerRef.current.clientWidth
    const h = containerRef.current.clientHeight
    const aspect = w / h
    
    // Update camera frustum centered on 0,0 relative to camera position
    // We want the total width/height to cover viewSize
    const halfH = viewSize / 2
    const halfW = halfH * aspect
    
    camera.left = -halfW
    camera.right = halfW
    camera.top = halfH
    camera.bottom = -halfH
    
    // Reset Zoom to 1 so base frustum matches drawing size
    camera.zoom = 1
    if (controls.object instanceof THREE.OrthographicCamera) {
      controls.object.zoom = 1
    }
    setZoomLevel(1)
    
    // Move camera and controls to center of object
    camera.position.set(center.x, center.y, 100)
    camera.updateProjectionMatrix()
    
    controls.target.set(center.x, center.y, 0)
    controls.update()
  }



  // Helper to create line from points
  const createLine = (pts: THREE.Vector3[], closed: boolean, container: THREE.Object3D) => {
    if (pts.length < 2) return
    if (closed) pts.push(pts[0])
    const material = new THREE.LineBasicMaterial({ color: 0xffffff })
    const geo = new THREE.BufferGeometry().setFromPoints(pts)
    container.add(new THREE.Line(geo, material))
  }

  // Function to parse entities into a container (DWG)
  const parseDwgEntities = (entities: any, container: THREE.Object3D, db: any) => {
    if (!entities) return

    const material = new THREE.LineBasicMaterial({ color: 0xffffff })

    // LINES
    ;((entities.lines || []) as any[]).forEach((ln: any) => {
       createLine([
         new THREE.Vector3(ln.start.x, ln.start.y, 0),
         new THREE.Vector3(ln.end.x, ln.end.y, 0)
       ], false, container)
    })
    
    // LWPOLYLINES
    ;((entities.lwpolylines || []) as any[]).forEach((pl: any) => {
      if (!pl.vertices) return
      const pts = pl.vertices.map((v: any) => new THREE.Vector3(v.x, v.y, 0))
      createLine(pts, pl.flag === 1 || pl.closed === true, container)
    })

    // POLYLINES
    ;((entities.polylines || []) as any[]).forEach((pl: any) => {
      if (!pl.vertices) return
      const pts = pl.vertices.map((v: any) => new THREE.Vector3(v.x, v.y, 0))
      createLine(pts, pl.flag === 1 || pl.closed === true, container)
    })

    // ARCS
    ;((entities.arcs || []) as any[]).forEach((arc: any) => {
      const segs = 64
      const curve = new THREE.EllipseCurve(
        arc.center.x, arc.center.y,
        arc.radius, arc.radius,
        arc.startAngle, arc.endAngle, false, 0
      )
      const pts = curve.getPoints(segs).map(p => new THREE.Vector3(p.x, p.y, 0))
      const geo = new THREE.BufferGeometry().setFromPoints(pts)
      container.add(new THREE.Line(geo, material))
    })

    // CIRCLES
    ;((entities.circles || []) as any[]).forEach((c: any) => {
      const segs = 64
      const curve = new THREE.EllipseCurve(
        c.center.x, c.center.y,
        c.radius, c.radius, 0, Math.PI * 2, false, 0
      )
      const pts = curve.getPoints(segs).map(p => new THREE.Vector3(p.x, p.y, 0))
      const geo = new THREE.BufferGeometry().setFromPoints(pts)
      container.add(new THREE.Line(geo, material))
    })
    
    // INSERTS (Block References)
    ;((entities.inserts || []) as any[]).forEach((ins: any) => {
      // Find block definition
      const blockName = ins.name
      if (!db.blocks || !db.blocks[blockName]) return
      
      const blockDef = db.blocks[blockName]
      const blockGroup = new THREE.Group()
      
      // Apply Insert Transformations
      blockGroup.position.set(ins.insertion_point.x, ins.insertion_point.y, 0)
      if (ins.scale) {
        blockGroup.scale.set(ins.scale.x, ins.scale.y, ins.scale.z || 1)
      }
      if (ins.rotation) {
        blockGroup.rotation.z = ins.rotation * (Math.PI / 180) // Assuming degrees in JSON
      }
      
      // Recursive parse
      parseDwgEntities(blockDef, blockGroup, db)
      
      container.add(blockGroup)
    })
  }

  // Function to parse DXF entities (similar to DWG but for DXF structure)
  const parseDxfEntities = (entities: any[], container: THREE.Object3D, data: any) => {
    if (!entities) return
    
    const material = new THREE.LineBasicMaterial({ color: 0xffffff })

    entities.forEach((ent: any) => {
      if (ent.type === 'LINE') {
        if (ent.vertices && ent.vertices.length >= 2) {
            const pts = ent.vertices.map((v: any) => new THREE.Vector3(v.x, v.y, 0))
            createLine(pts, false, container)
        }
      } else if (ent.type === 'LWPOLYLINE' || ent.type === 'POLYLINE') {
        if (ent.vertices) {
            const pts = ent.vertices.map((v: any) => new THREE.Vector3(v.x, v.y, 0))
            createLine(pts, ent.closed, container)
        }
      } else if (ent.type === 'CIRCLE') {
        const curve = new THREE.EllipseCurve(ent.center.x, ent.center.y, ent.radius, ent.radius, 0, Math.PI * 2, false, 0)
        const pts = curve.getPoints(64).map(p => new THREE.Vector3(p.x, p.y, 0))
        const geo = new THREE.BufferGeometry().setFromPoints(pts)
        container.add(new THREE.Line(geo, material))
      } else if (ent.type === 'ARC') {
        const curve = new THREE.EllipseCurve(ent.center.x, ent.center.y, ent.radius, ent.radius, ent.startAngle, ent.endAngle, false, 0)
        const pts = curve.getPoints(64).map(p => new THREE.Vector3(p.x, p.y, 0))
        const geo = new THREE.BufferGeometry().setFromPoints(pts)
        container.add(new THREE.Line(geo, material))
      } else if (ent.type === 'INSERT') {
        const blockName = ent.name
        if (!data.blocks || !data.blocks[blockName]) return
        const block = data.blocks[blockName]
        const group = new THREE.Group()
        
        if (ent.position) group.position.set(ent.position.x, ent.position.y, 0)
        if (ent.scale) group.scale.set(ent.scale.x, ent.scale.y, ent.scale.z || 1)
        if (ent.rotation) group.rotation.z = ent.rotation * (Math.PI / 180)
        
        parseDxfEntities(block.entities, group, data)
        container.add(group)
      }
    })
  }

  // Effect to rebuild scene when active layout changes
  useEffect(() => {
    if (!parsedData || !renderer) return
    
    setLoading(true)
    
    // Clean up previous scene
    if (entityRoot) {
      scene.remove(entityRoot)
      setEntityRoot(null)
      setSnapCandidates([])
      setPoints([])
      setDimensions([])
      setAreas([])
      setPolyPoints([])
    }

    const root = new THREE.Group()

    if (parsedData.type === 'dwg') {
      const db = parsedData.data
      let entitiesToParse = db // Default to Model Space (root)
      
      if (activeLayout !== 'Model') {
        // Find the block for this layout
        // activeLayout is the Block Name (e.g., *Paper_Space)
        if (db.blocks && db.blocks[activeLayout]) {
           entitiesToParse = db.blocks[activeLayout]
        } else {
           console.warn(`Layout block ${activeLayout} not found, falling back to Model`)
        }
      }
      
      parseDwgEntities(entitiesToParse, root, db)
    } else if (parsedData.type === 'dxf') {
      const data = parsedData.data
      
      if (activeLayout === 'Model') {
          const entity = data.entity || data
          if (entity && (entity.isObject3D || entity instanceof THREE.Object3D)) {
             root.add(entity.clone())
          } else {
             // Fallback: parse raw entities if entity object is missing but we have raw data
             if (data.entities) {
                parseDxfEntities(data.entities, root, data)
             }
          }
      } else {
          // DXF Layout (Paper Space)
          // Look for block with layout name
          if (data.blocks && data.blocks[activeLayout]) {
             const block = data.blocks[activeLayout]
             parseDxfEntities(block.entities, root, data)
          } else {
             console.warn(`DXF Layout block ${activeLayout} not found`)
          }
      }
    }

    scene.add(root)
    setEntityRoot(root)
    
    // Update world matrix and snap points
    root.updateMatrixWorld(true)
    extractSnapPoints(root)
    
    // Auto-fit
    setTimeout(() => fitToView(), 100)
    setLoading(false)

  }, [activeLayout, parsedData])

  useEffect(() => {
    if (entityRoot) {
      // console.log('EntityRoot changed, extracting snap points...')
      // extractSnapPoints(entityRoot)
      
      // Auto-Fit handled in the layout effect
    }
  }, [entityRoot])

  useEffect(() => {
    if (!canvasRef.current || renderer) return
    const r = new THREE.WebGLRenderer({ canvas: canvasRef.current, antialias: true })
    r.setPixelRatio(window.devicePixelRatio)
    r.setSize(containerRef.current?.clientWidth || 800, containerRef.current?.clientHeight || 600)
    r.setClearColor(0x0b1220, 1)
    setRenderer(r)

    camera.position.set(0, 0, 10)
    camera.zoom = 1
    camera.updateProjectionMatrix()

    const ambient = new THREE.AmbientLight(0xffffff, 1.0)
    scene.add(ambient)

    const ctrls = new OrbitControls(camera, controlsTargetRef.current!)
    setControls(ctrls)

    const animate = () => {
      ctrls.update()
      r.render(scene, camera)
      requestAnimationFrame(animate)
    }
    animate()

    const onResize = () => {
      const w = containerRef.current?.clientWidth || 800
      const h = containerRef.current?.clientHeight || 600
      r.setSize(w, h)
      
      // Update camera frustum maintaining current scale
      const aspect = w / h
      const frustumHeight = camera.top - camera.bottom
      const frustumWidth = frustumHeight * aspect
      
      const cy = (camera.top + camera.bottom) / 2
      const cx = (camera.left + camera.right) / 2
      
      camera.left = cx - frustumWidth / 2
      camera.right = cx + frustumWidth / 2
      camera.top = cy + frustumHeight / 2
      camera.bottom = cy - frustumHeight / 2
      
      camera.updateProjectionMatrix()
    }
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      ctrls.dispose()
      r.dispose()
    }
  }, []) // Empty dependency array to run only once on mount

  // Update controls configuration
  useEffect(() => {
    if (!controls) return
    controls.enabled = true
    controls.enableRotate = false
    controls.enableZoom = false // Disable built-in zoom to handle manually
    controls.screenSpacePanning = true
    controls.zoomSpeed = 0.025
    controls.panSpeed = 1.0
    controls.minZoom = 0.1
    controls.maxZoom = 10
    controls.enableDamping = true
    controls.dampingFactor = 0.1
    // Strictly lock camera to 2D view (top-down)
    controls.minPolarAngle = Math.PI / 2
    controls.maxPolarAngle = Math.PI / 2
    controls.minAzimuthAngle = 0
    controls.maxAzimuthAngle = 0
    
    // Listen to zoom changes
    const onChange = () => {
      if (controls.object instanceof THREE.OrthographicCamera) {
        setZoomLevel(controls.object.zoom)
      }
    }
    controls.addEventListener('change', onChange)

    // Update mouse buttons based on tool
    if (tool === 'hand') {
      controls.mouseButtons = {
        LEFT: THREE.MOUSE.PAN,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN
      }
    } else {
      controls.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE, // Disabled via enableRotate=false
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN
      }
    }
    
    controls.update()
    
    return () => {
      controls.removeEventListener('change', onChange)
    }
  }, [controls, tool])

  useEffect(() => {
    if (!renderer || !entityRoot) return

    const ensureContrast = (obj: any) => {
      if (!obj.material) return

      const updateMat = (m: any) => {
        if (m.color) {
          // Special case: Pure black -> White
          if (m.color.getHex() === 0x000000) {
            m.color.setHex(0xffffff)
            return
          }

          // Ensure visibility: Lighten dark colors
          const hsl = { h: 0, s: 0, l: 0 }
          m.color.getHSL(hsl)
          
          // If lightness is too low (dark), boost it significantly
          // This ensures visibility on dark background (original)
          // AND visibility on white background (inverted) because inverted light = dark
          if (hsl.l < 0.35) {
            m.color.setHSL(hsl.h, hsl.s, 0.6)
          }
        }
      }

      if (Array.isArray(obj.material)) {
        obj.material.forEach(updateMat)
      } else {
        updateMat(obj.material)
      }
    }

    if (isBlueprint) {
      renderer.domElement.style.filter = 'invert(1) hue-rotate(180deg) brightness(1.1) contrast(1.25)'
      entityRoot.traverse(ensureContrast)
    } else {
      renderer.domElement.style.filter = ''
      entityRoot.traverse(ensureContrast)
    }
  }, [isBlueprint, renderer, entityRoot])

  useEffect(() => {
    if (!renderer) return
    if (showGrid && !gridHelper) {
      const gh = new THREE.GridHelper(1000, 100, 0x334155, 0x334155)
      ;(gh.material as THREE.LineBasicMaterial).opacity = 0.2
      ;(gh.material as THREE.LineBasicMaterial).transparent = true
      scene.add(gh)
      setGridHelper(gh)
    } else if (!showGrid && gridHelper) {
      scene.remove(gridHelper)
      setGridHelper(null)
    }
  }, [showGrid, gridHelper, scene, renderer])

  useEffect(() => {
    if (!file || !renderer) return
    setLoading(true)
    setErrorMsg(null)
    setPoints([])
    if (entityRoot) {
      scene.remove(entityRoot)
      setEntityRoot(null)
      setSnapCandidates([])
    }

    const run = async () => {
      const maxSizeBytes = 20 * 1024 * 1024
      if (file.size > maxSizeBytes) {
        setLoading(false)
        setErrorMsg('Archivo demasiado grande (>20MB). Usa un DXF más liviano o divide el plano.')
        return
      }
      if (file.name.toLowerCase().endsWith('.dwg')) {
        setLoadingText('Cargando DWG')
        try {
          const libPath = (import.meta as any).env?.BASE_URL
            ? (import.meta as any).env.BASE_URL + 'libredwg/'
            : './libredwg/'
          await Promise.race([
            (async () => {
              const lib = await LibreDwg.create(libPath)
              const buf = await file.arrayBuffer()
              const dwg = lib.dwg_read_data(buf as ArrayBuffer, Dwg_File_Type.DWG) as any
              const db: any = lib.convert(dwg as number)
              console.log('DWG Database:', Object.keys(db || {}), db)
              
              // Extract Layouts (Paper Spaces)
              const layoutNames = ['Model']
              if (db.blocks) {
                const paperSpaces = Object.keys(db.blocks).filter(k => k.toLowerCase().startsWith('*paper_space'))
                // Try to map *Paper_Space0 -> Layout1 etc if possible, but raw names are safer for now
                // Usually *Paper_Space is active, others are numbered
                paperSpaces.forEach(ps => {
                   // Clean up name for display if possible, or just use raw
                   layoutNames.push(ps) 
                })
              }
              setLayouts(layoutNames)
              setActiveLayout('Model')
              setParsedData({ type: 'dwg', data: db })
              
              onDocInfo(`DWG cargado. ${layoutNames.length > 1 ? `Layouts: ${layoutNames.length - 1}` : ''}`)
            })(),
            new Promise((_, reject) => {
              loadTimeoutRef.current = window.setTimeout(() => reject(new Error('DWG_TIMEOUT')), 20000)
            })
          ])
        } catch (e) {
          const msg = (e as Error)?.message === 'DWG_TIMEOUT'
            ? 'Tiempo de carga excedido. Verifica que el DWG sea válido.'
            : 'Error al procesar DWG en navegador. Prueba otro archivo.'
          setErrorMsg(msg)
        } finally {
          if (loadTimeoutRef.current) {
            clearTimeout(loadTimeoutRef.current)
            loadTimeoutRef.current = null
          }
          setLoading(false)
        }
        return
      }

    const url = URL.createObjectURL(file)
    setLoadingText('Cargando DXF')
    
    const fontUrl = (import.meta as any).env?.BASE_URL
      ? (import.meta as any).env.BASE_URL + 'fonts/helvetiker_regular.typeface.json'
      : './fonts/helvetiker_regular.typeface.json'

    const fontLoader = new FontLoader()
    fontLoader.load(fontUrl, (font) => {
      const loadWithDXFLoader = () => {
        const loader = new DXFLoader()
        loader.setFont(font)
        loader.setEnableLayer(true)
        loader.setConsumeUnits(true)
        loader.setDefaultColor(0xffffff)
        if (loadTimeoutRef.current) {
          clearTimeout(loadTimeoutRef.current)
        }
        loadTimeoutRef.current = window.setTimeout(() => {
          setLoading(false)
          setErrorMsg('Tiempo de carga excedido. Verifica que el DXF sea válido.')
          URL.revokeObjectURL(url)
        }, 15000)
 
        loader.load(url, (data: any) => {
          console.log('DXF loaded data:', data)
          
          // Extract Layouts (Paper Spaces) for DXF
          const layoutNames = ['Model']
          if (data.blocks) {
            const paperSpaces = Object.keys(data.blocks).filter(k => k.toLowerCase().startsWith('*paper_space'))
            paperSpaces.forEach(ps => layoutNames.push(ps))
          }
          
          setLayouts(layoutNames)
          setActiveLayout('Model')
          setParsedData({ type: 'dxf', data: data })
          
          const root = data?.entity || data
          if (root) {
             onDocInfo(`DXF cargado. Tamaño: - unidades`)
          } else {
             console.error('No entity found in DXF data')
          }

          setLoading(false)
          if (loadTimeoutRef.current) {
            clearTimeout(loadTimeoutRef.current)
            loadTimeoutRef.current = null
          }
          URL.revokeObjectURL(url)
        }, undefined, async (err: any) => {
          console.warn('DXFLoader failed, trying viewer', err)
          setLoading(false)
          try {
            const mod = await import('three-dxf-viewer')
            const viewer = new (mod as any).DXFViewer()
            const dxfObj = await viewer.getFromFile(file, fontUrl)
            if (dxfObj) {
               setLayouts(['Model'])
               setActiveLayout('Model')
               setParsedData({ type: 'dxf', data: dxfObj })
               onDocInfo(`DXF cargado (viewer).`)
            }
          } catch (e) {
            console.error('Viewer loader failed', e)
            setErrorMsg('Error al procesar DXF. Prueba con otro archivo o convertir desde CAD.')
          } finally {
            URL.revokeObjectURL(url)
            setLoading(false)
          }
        })
      }
 
      ;(async () => {
        try {
          const mod = await import('three-dxf-viewer')
          const viewer = new (mod as any).DXFViewer()
          const timeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('DXF_VIEWER_TIMEOUT')), 12000)
          )
          const dxfObj = await Promise.race([
            viewer.getFromFile(file, fontUrl),
            timeout
          ])
          if (dxfObj && (dxfObj as any).isObject3D) {
             setLayouts(['Model'])
             setActiveLayout('Model')
             setParsedData({ type: 'dxf', data: dxfObj })
             
             setErrorMsg(null)
             onDocInfo(`DXF cargado (viewer).`)
             setLoading(false)
             URL.revokeObjectURL(url)
          } else {
            console.warn('Viewer returned invalid object, falling back to DXFLoader')
            loadWithDXFLoader()
          }
        } catch (e) {
          if ((e as Error).message === 'DXF_VIEWER_TIMEOUT') {
            console.warn('Viewer timeout, falling back to DXFLoader')
          } else {
            console.error('Viewer failed, falling back to DXFLoader', e)
          }
          loadWithDXFLoader()
        }
      })()
    }, undefined, (err) => {
      console.error('Font loading failed', err)
      setLoading(false)
      setErrorMsg('Error cargando fuente de texto (verifica conexión o archivos locales).')
      URL.revokeObjectURL(url)
    })
    }
    run()
  }, [file, renderer])

  const ndcToWorldOnPlaneZ0 = (event: React.MouseEvent) => {
    if (!renderer) return null
    const rect = renderer.domElement.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    const ray = new THREE.Raycaster()
    ray.setFromCamera(new THREE.Vector2(x, y), camera)
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
    const p = new THREE.Vector3()
    ray.ray.intersectPlane(plane, p)
    return p
  }

  const getMouseWorldPos = (clientX: number, clientY: number) => {
    if (!renderer || !camera) return null
    const rect = renderer.domElement.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return null
    
    const x = ((clientX - rect.left) / rect.width) * 2 - 1
    const y = -((clientY - rect.top) / rect.height) * 2 + 1
    
    // Use Raycaster to intersect Z=0 plane
    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(new THREE.Vector2(x, y), camera)
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
    const target = new THREE.Vector3()
    const hit = raycaster.ray.intersectPlane(plane, target)
    return hit ? target : null
  }

  const [debugInfo, setDebugInfo] = useState<{pos: string, candidates: number, zoom: string}>({ pos: '', candidates: 0, zoom: '' })

  const onMouseMove = (e: React.MouseEvent) => {
    // console.log('MouseMove', tool, snapCandidates.length)
    if (!renderer || !camera) return

    // Update Debug Info
    const mousePos = getMouseWorldPos(e.clientX, e.clientY)
    if (mousePos) {
       setDebugInfo({
         pos: `${mousePos.x.toFixed(2)}, ${mousePos.y.toFixed(2)}`,
         candidates: snapCandidates.length,
         zoom: camera.zoom.toFixed(2)
       })
    }

    if (!entityRoot || (tool !== 'measure' && tool !== 'calibrate' && tool !== 'dimension' && tool !== 'area')) {
      if (snap) setSnap(null)
      return
    }

    if (!mousePos) return

    // New Geometry-Based Snap Logic
    if (snapCandidates.length > 0 && (snapSettings.enableEndpoint || snapSettings.enableMidpoint)) {
       const vector = mousePos
       // vector is already on Z=0 plane
       
       const rect = renderer.domElement.getBoundingClientRect()
       const visibleHeight = (camera.top - camera.bottom) / camera.zoom
       const unitsPerPixel = visibleHeight / rect.height
       const threshold = (snapSettings.thresholdPx || 10) * unitsPerPixel * 1.5 // default 10px if undefined
       
       // console.log('Snap Check', { pos: vector, candidates: snapCandidates.length, threshold })

       let best = { type: 'none', pos: new THREE.Vector3(), dist: Infinity }
       const prio = (t: string) => (t === 'endpoint' ? 2 : t === 'midpoint' ? 1 : 0)

       for (const cand of snapCandidates) {
         if (cand.type === 'endpoint' && !snapSettings.enableEndpoint) continue
         if (cand.type === 'midpoint' && !snapSettings.enableMidpoint) continue

         const d = vector.distanceTo(cand.pos)
         if (d < threshold) {
            if (best.type === 'none' || d < best.dist || (Math.abs(d - best.dist) < threshold * 0.1 && prio(cand.type) > prio(best.type))) {
               best = { type: cand.type, pos: cand.pos, dist: d } as any
            }
         }
       }

       if (best.type !== 'none') {
         if (!snap || snap.type !== best.type || !snap.pos.equals(best.pos)) {
              setSnap(best as any)
         }
         return 
       }
    }
    
    if (snap) setSnap(null)
  }

  const onMouseDown = (e: React.MouseEvent) => {
    // Allow Pan (Right Click) and Zoom (Middle Click) to pass through to OrbitControls
    if (e.button !== 0) return // Only act on Left Click for tools

    if (!renderer) return
    
    // Calculate world position (considering snap)
    const getPos = () => {
      if (snap) return snap.pos
      return getMouseWorldPos(e.clientX, e.clientY)
    }

    if (tool === 'area') {
      const p = getPos()
      if (!p) return
      setPolyPoints(prev => [...prev, new THREE.Vector3(p.x, p.y, 0)])
      return
    }
    if (tool === 'measure' || tool === 'calibrate' || tool === 'dimension') {
      const p = getPos()
      if (!p) return
      if (points.length >= 2) {
        setPoints([p])
      } else {
        const next = [...points, p]
        setPoints(next)
        if (next.length === 2) {
          if (tool === 'calibrate') {
            const worldDist = next[0].distanceTo(next[1])
            const val = prompt('Establecer escala: ¿Cuántos metros mide esta línea en la realidad?', '1.0')
            if (val) {
              onCalibrationComplete({ world: worldDist, realValue: parseFloat(val), unit: 'm' })
            }
          } else if (tool === 'dimension') {
            const d = next[0].distanceTo(next[1])
            const text = calibration ? `${((d / calibration.world) * calibration.realValue).toFixed(3)} ${calibration.unit}` : `${d.toFixed(3)} u`
            const item: DimensionItem = { ax: next[0].x, ay: next[0].y, bx: next[1].x, by: next[1].y, text }
            setDimensions(prev => [...prev, item])
            setPoints([])
          }
        }
      }
    }
  }

  const onDoubleClick = () => {
    if (!renderer) return
    if (tool !== 'area') return
    if (polyPoints.length < 3) return
    const areaWorld = (() => {
      let sum = 0
      for (let i = 0; i < polyPoints.length; i++) {
        const a = polyPoints[i]
        const b = polyPoints[(i + 1) % polyPoints.length]
        sum += a.x * b.y - b.x * a.y
      }
      return Math.abs(sum) * 0.5
    })()
    const factor = calibration ? (calibration.realValue / calibration.world) : null
    const text = factor
      ? `${(areaWorld * factor * factor).toFixed(3)} ${calibration!.unit}²`
      : `${areaWorld.toFixed(3)} u²`
    const item: AreaItem = {
      pts: polyPoints.map(p => ({ x: p.x, y: p.y })),
      text
    }
    setAreas(prev => [...prev, item])
    setPolyPoints([])
  }

  const projectToScreen = (v: THREE.Vector3) => {
    if (!renderer) return { x: 0, y: 0 }
    const p = v.clone().project(camera)
    const w = renderer.domElement.clientWidth
    const h = renderer.domElement.clientHeight
    return { x: (p.x + 1) * 0.5 * w, y: (1 - (p.y + 1) * 0.5) * h }
  }

  const displayDist = () => {
    if (points.length !== 2) return null
    const d = points[0].distanceTo(points[1])
    if (calibration) {
      const real = (d / calibration.world) * calibration.realValue
      return `${real.toFixed(3)} ${calibration.unit}`
    }
    return `${d.toFixed(3)} u`
  }

  const handleManualZoom = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!camera || !controls) return
    let newZoom = parseFloat(e.target.value)
    
    // Clamp zoom if coming from input
    if (isNaN(newZoom)) return
    if (newZoom < 0.1) newZoom = 0.1
    if (newZoom > 10) newZoom = 10

    camera.zoom = newZoom
    camera.updateProjectionMatrix()
    controls.update()
    setZoomLevel(newZoom)
  }

  const handleZoomInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!camera || !controls) return
    const val = parseFloat(e.target.value)
    if (!isNaN(val)) {
        // Convert percentage to zoom level
        let zoom = val / 100
        if (zoom < 0.1) zoom = 0.1
        if (zoom > 10) zoom = 10

        camera.zoom = zoom
        camera.updateProjectionMatrix()
        controls.update()
        setZoomLevel(zoom)
    }
  }

  const handleWheel = (e: React.WheelEvent) => {
    if (!camera || !controls) return
    
    // Manual zoom handling to prevent massive jumps
    // Use exponential decay based on deltaY magnitude to handle both
    // notched mice (delta ~100) and trackpads (delta ~1-10) gracefully
    const sensitivity = 0.0005 
    const delta = e.deltaY
    const zoomFactor = Math.exp(-delta * sensitivity)
    
    let newZoom = camera.zoom * zoomFactor
    
    if (newZoom < 0.1) newZoom = 0.1
    if (newZoom > 10) newZoom = 10
    
    camera.zoom = newZoom
    camera.updateProjectionMatrix()
    controls.update()
    setZoomLevel(newZoom)
  }

  return (
    <div
      ref={containerRef}
      className={`relative flex-1 overflow-hidden bg-slate-900 h-full ${tool === 'hand' ? 'cursor-grab' : 'cursor-crosshair'}`}
    >
      {/* Fit to View Button */}
      <button 
        onClick={fitToView}
        className="absolute top-2 right-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded shadow-lg text-sm font-medium z-50 flex items-center gap-2"
        title="Centrar dibujo"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
        </svg>
        Centrar
      </button>

      {/* Zoom Slider */}
      <div className="absolute top-1/2 right-4 transform -translate-y-1/2 flex flex-col items-center bg-slate-800/80 p-2 rounded-xl z-50 gap-2 shadow-xl border border-slate-700">
         <div className="flex flex-col items-center gap-1 mb-2">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider">Zoom</span>
            <input 
              type="number" 
              value={Math.round(zoomLevel * 100)} 
              onChange={handleZoomInput}
              className="w-12 bg-slate-900 text-white text-xs text-center rounded border border-slate-600 py-1 focus:border-blue-500 outline-none"
            />
            <span className="text-xs text-slate-400">%</span>
         </div>
         <input 
            type="range" 
            min="0.1" 
            max="10" 
            step="0.1"
            value={zoomLevel} 
            onChange={handleManualZoom}
            className="h-40 w-2 appearance-none bg-slate-600 rounded-lg outline-none slider-vertical"
            style={{ writingMode: 'bt-lr', WebkitAppearance: 'slider-vertical' } as any}
            {...{ orient: "vertical" } as any}
         />
      </div>

      {/* Layout Selector */}
      {layouts.length > 1 && (
        <div className="absolute top-2 left-1/2 transform -translate-x-1/2 z-50 flex items-center gap-2 bg-slate-800 p-1 rounded-lg border border-slate-700 shadow-xl">
          <span className="text-[10px] text-slate-400 font-bold px-2 uppercase">Layout:</span>
          <select 
            value={activeLayout}
            onChange={(e) => setActiveLayout(e.target.value)}
            className="bg-slate-900 text-white text-xs px-2 py-1 rounded border border-slate-600 focus:border-yellow-500 outline-none cursor-pointer hover:bg-slate-700 transition-colors"
          >
            {layouts.map(l => (
              <option key={l} value={l}>
                {l === 'Model' ? 'Modelo (Model Space)' : l.replace(/^\*Paper_Space/, 'Layout ')}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Debug Info Overlay */}
      <div className="absolute top-2 left-2 bg-black/70 text-white p-2 text-xs rounded pointer-events-none z-50">
        <div>Pos: {debugInfo.pos}</div>
        <div>Zoom: {debugInfo.zoom}</div>
        <div>Snaps: {debugInfo.candidates}</div>
        <div>Objects: {debugStats || 'None'}</div>
        <div>Tool: {tool}</div>
        <div>Status: {snap ? `SNAP: ${snap.type}` : 'No Snap'}</div>
      </div>

      <div
        ref={controlsTargetRef}
        className="absolute inset-0 w-full h-full"
        onContextMenu={(e) => e.preventDefault()}
        onMouseDown={onMouseDown}
        onDoubleClick={onDoubleClick}
        onMouseMove={onMouseMove}
        onWheel={handleWheel}
      >
        <canvas ref={canvasRef} className="w-full h-full block" />

      {/* Snap Marker */}
      {snap && renderer && (() => {
        const s = projectToScreen(snap.pos)
        // Ensure s.x and s.y are valid numbers
        if (isNaN(s.x) || isNaN(s.y)) return null
        
        const color = "#facc15" // Yellow-400
        
        return (
          <svg className="absolute inset-0 pointer-events-none w-full h-full z-10">
            {snap.type === 'endpoint' && (
              <rect x={s.x - 5} y={s.y - 5} width="10" height="10" stroke={color} strokeWidth="2" fill="none" />
            )}
            {snap.type === 'midpoint' && (
               <polygon points={`${s.x},${s.y - 6} ${s.x - 5},${s.y + 4} ${s.x + 5},${s.y + 4}`} stroke={color} strokeWidth="2" fill="none" />
            )}
          </svg>
        )
      })()}

      {polyPoints.length > 0 && renderer && tool === 'area' && (
        <svg className="absolute inset-0 pointer-events-none w-full h-full z-10">
          {(() => {
            const color = "#22c55e"
            const pts = polyPoints.map(p => projectToScreen(p))
            return (
              <>
                {pts.map((p, i) => (
                  i > 0 ? <line key={`seg-${i}`} x1={pts[i-1].x} y1={pts[i-1].y} x2={p.x} y2={p.y} stroke={color} strokeWidth="2" /> : null
                ))}
                {(() => {
                  const last = pts[pts.length - 1]
                  const target = (() => {
                    if (snap) return projectToScreen(snap.pos)
                    const p = ndcToWorldOnPlaneZ0({ clientX: 0, clientY: 0 } as any)
                    return p ? projectToScreen(p) : last
                  })()
                  return <line x1={last.x} y1={last.y} x2={target.x} y2={target.y} stroke={color} strokeWidth="2" strokeDasharray="4,3" />
                })()}
              </>
            )
          })()}
        </svg>
      )}

      {areas.length > 0 && renderer && (
        <svg className="absolute inset-0 pointer-events-none w-full h-full z-10">
          {areas.map((ar, i) => {
            const spts = ar.pts.map(p => projectToScreen(new THREE.Vector3(p.x, p.y, 0)))
            const path = spts.map(p => `${p.x},${p.y}`).join(' ')
            const cx = spts.reduce((acc, p) => acc + p.x, 0) / spts.length
            const cy = spts.reduce((acc, p) => acc + p.y, 0) / spts.length
            const color = "#22c55e"
            return (
              <g key={`area-${i}`}>
                <polygon points={path} fill="rgba(34,197,94,0.15)" stroke={color} strokeWidth="2" />
                <g transform={`translate(${cx}, ${cy - 12})`}>
                  <rect x="-60" y="-12" width="120" height="24" rx="12" fill="#000" stroke={color} strokeWidth="2" />
                  <text fontSize="12" fontWeight="900" textAnchor="middle" fill={color} dy="5" className="font-mono">
                    {ar.text}
                  </text>
                </g>
              </g>
            )
          })}
        </svg>
      )}

      {dimensions.length > 0 && renderer && (
        <svg className="absolute inset-0 pointer-events-none w-full h-full z-10">
          {dimensions.map((dim, i) => {
            const a = projectToScreen(new THREE.Vector3(dim.ax, dim.ay, 0))
            const b = projectToScreen(new THREE.Vector3(dim.bx, dim.by, 0))
            const dx = b.x - a.x
            const dy = b.y - a.y
            const len = Math.sqrt(dx*dx + dy*dy)
            if (!isFinite(len) || len < 1) return null
            const ux = dx / len
            const uy = dy / len
            const px = -uy
            const py = ux
            const off = 16
            const a1 = { x: a.x + px * off, y: a.y + py * off }
            const b1 = { x: b.x + px * off, y: b.y + py * off }
            const arrowLen = 10
            const arrowWing = 5
            const inUx = ux
            const inUy = uy
            const outUx = -ux
            const outUy = -uy
            const aHead1 = { x: a1.x + inUx * arrowLen + px * arrowWing, y: a1.y + inUy * arrowLen + py * arrowWing }
            const aHead2 = { x: a1.x + inUx * arrowLen - px * arrowWing, y: a1.y + inUy * arrowLen - py * arrowWing }
            const bHead1 = { x: b1.x + outUx * arrowLen + px * arrowWing, y: b1.y + outUy * arrowLen + py * arrowWing }
            const bHead2 = { x: b1.x + outUx * arrowLen - px * arrowWing, y: b1.y + outUy * arrowLen - py * arrowWing }
            const mid = { x: (a1.x + b1.x) / 2, y: (a1.y + b1.y) / 2 - 10 }
            const color = "#facc15"
            return (
              <g key={i}>
                <line x1={a.x} y1={a.y} x2={a1.x} y2={a1.y} stroke={color} strokeWidth="2" />
                <line x1={b.x} y1={b.y} x2={b1.x} y2={b1.y} stroke={color} strokeWidth="2" />
                <line x1={a1.x} y1={a1.y} x2={b1.x} y2={b1.y} stroke={color} strokeWidth="2" />
                <line x1={a1.x} y1={a1.y} x2={aHead1.x} y2={aHead1.y} stroke={color} strokeWidth="2" />
                <line x1={a1.x} y1={a1.y} x2={aHead2.x} y2={aHead2.y} stroke={color} strokeWidth="2" />
                <line x1={b1.x} y1={b1.y} x2={bHead1.x} y2={bHead1.y} stroke={color} strokeWidth="2" />
                <line x1={b1.x} y1={b1.y} x2={bHead2.x} y2={bHead2.y} stroke={color} strokeWidth="2" />
                <g transform={`translate(${mid.x}, ${mid.y})`}>
                  <rect x="-50" y="-12" width="100" height="24" rx="12" fill="#000" stroke={color} strokeWidth="2" />
                  <text fontSize="12" fontWeight="900" textAnchor="middle" fill={color} dy="5" className="font-mono">
                    {dim.text}
                  </text>
                </g>
              </g>
            )
          })}
        </svg>
      )}

      {points.length > 0 && renderer && (
        <svg className="absolute inset-0 pointer-events-none w-full h-full">
          {points.map((p, i) => {
            const s = projectToScreen(p)
            return <circle key={i} cx={s.x} cy={s.y} r="6" fill="#facc15" stroke="#000" strokeWidth="2" />
          })}
          {points.length === 2 && (() => {
            const a = projectToScreen(points[0])
            const b = projectToScreen(points[1])
            const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - 20 }
            return (
              <>
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#facc15" strokeWidth="3" strokeDasharray="6,4" />
                <g transform={`translate(${mid.x}, ${mid.y})`}>
                  <rect x="-50" y="-12" width="100" height="24" rx="12" fill="#000" stroke="#facc15" strokeWidth="2" />
                  <text fontSize="12" fontWeight="900" textAnchor="middle" fill="#facc15" dy="5" className="font-mono">
                    {displayDist()}
                  </text>
                </g>
              </>
            )
          })()}
        </svg>
      )}

      </div>

      <div 
        className="absolute top-14 right-2 z-[100] flex flex-col gap-2 pointer-events-auto"
      >
        {dimensions.length > 0 && (
          <button
            onClick={() => setDimensions([])}
            className="text-xs text-white px-3 py-1.5 rounded bg-red-900/80 border border-red-700 hover:bg-red-800 shadow-lg transition-colors flex items-center gap-2 backdrop-blur-sm cursor-pointer"
            title="Borrar todas las cotas"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Borrar Cotas
          </button>
        )}
        {areas.length > 0 && (
          <button
            onClick={() => setAreas([])}
            className="text-xs text-white px-3 py-1.5 rounded bg-red-900/80 border border-red-700 hover:bg-red-800 shadow-lg transition-colors flex items-center gap-2 backdrop-blur-sm cursor-pointer"
            title="Borrar todas las áreas"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Borrar Áreas
          </button>
        )}
      </div>
      {loading && (
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50">
          <div className="flex flex-col items-center gap-6">
            <div className="w-16 h-16 border-4 border-yellow-500/30 border-t-yellow-500 animate-spin rounded-full"></div>
            <div className="text-center">
              <span className="block text-yellow-500 font-mono text-xs tracking-widest uppercase mb-1">{loadingText}</span>
              <span className="text-slate-500 text-[10px] uppercase font-bold tracking-widest">Preparando geometría...</span>
            </div>
          </div>
        </div>
      )}
      {errorMsg && (
        <div className="absolute bottom-6 left-6 bg-red-600/20 border border-red-600 px-4 py-2 rounded-xl z-50">
          <span className="text-[11px] text-red-200">{errorMsg}</span>
        </div>
      )}
    </div>
  )
}

export default DwgRenderer
