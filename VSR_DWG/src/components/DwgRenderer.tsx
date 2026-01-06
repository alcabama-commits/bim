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
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [renderer, setRenderer] = useState<THREE.WebGLRenderer | null>(null)
  const [scene] = useState(() => new THREE.Scene())
  const [camera] = useState(() => new THREE.OrthographicCamera(-50, 50, 50, -50, -100000, 100000))
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

  useEffect(() => {
    if (entityRoot) {
      console.log('EntityRoot changed, extracting snap points...')
      extractSnapPoints(entityRoot)
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

    const ctrls = new OrbitControls(camera, containerRef.current!)
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
    controls.screenSpacePanning = true
    controls.zoomSpeed = 0.5
    controls.panSpeed = 1.0
    controls.minZoom = 0.001
    controls.maxZoom = 10000
    controls.enableDamping = true
    controls.dampingFactor = 0.2
    // Strictly lock camera to 2D view (top-down)
    controls.minPolarAngle = Math.PI / 2
    controls.maxPolarAngle = Math.PI / 2
    controls.minAzimuthAngle = 0
    controls.maxAzimuthAngle = 0
    
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
              
              const root = new THREE.Group()
              const material = new THREE.LineBasicMaterial({ color: 0xffffff })
              
              // Helper to create line from points
              const createLine = (pts: THREE.Vector3[], closed: boolean, container: THREE.Object3D) => {
                if (pts.length < 2) return
                if (closed) pts.push(pts[0])
                const geo = new THREE.BufferGeometry().setFromPoints(pts)
                container.add(new THREE.Line(geo, material))
              }

              // Function to parse entities into a container
              const parseEntities = (entities: any, container: THREE.Object3D) => {
                if (!entities) return

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
                  parseEntities(blockDef, blockGroup)
                  
                  container.add(blockGroup)
                })
              }

              // Parse Root Entities
              parseEntities(db, root)

              scene.add(root)
              setEntityRoot(root)
              // Extract snap points immediately after creating the root
              // We need to update matrix world to get correct coordinates if root had transforms (it doesn't, but safe)
              root.updateMatrixWorld(true)
              extractSnapPoints(root)

              const box = new THREE.Box3().setFromObject(root)
              const center = box.getCenter(new THREE.Vector3())
              const size = box.getSize(new THREE.Vector3())
              const maxSize = Math.max(size.x, size.y)
              const viewSize = maxSize * 0.6
              const w = renderer.domElement.clientWidth
              const h = renderer.domElement.clientHeight
              const aspect = w / h
              camera.left = -viewSize * aspect
              camera.right = viewSize * aspect
              camera.top = viewSize
              camera.bottom = -viewSize
              camera.position.set(center.x, center.y, 10)
              camera.zoom = 1
              camera.updateProjectionMatrix()
              controls?.target.set(center.x, center.y, 0)
              controls?.update()
              onDocInfo(`DWG cargado. Tamaño: ${size.x.toFixed(2)} x ${size.y.toFixed(2)} unidades`)
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
          const root = data?.entity || data
          if (root) {
            if (!root.isObject3D && !root.traverse) {
              console.error('Loaded object is not a valid Object3D', root)
            } else {
              scene.add(root)
              setEntityRoot(root)
              // Extract snap points
              root.updateMatrixWorld(true)
              extractSnapPoints(root)

              const box = new THREE.Box3().setFromObject(root)
              const center = box.getCenter(new THREE.Vector3())
              const size = box.getSize(new THREE.Vector3())
              const maxSize = Math.max(size.x, size.y)
              const viewSize = maxSize * 0.6
              const w = renderer.domElement.clientWidth
              const h = renderer.domElement.clientHeight
              const aspect = w / h
              camera.left = -viewSize * aspect
              camera.right = viewSize * aspect
              camera.top = viewSize
              camera.bottom = -viewSize
              camera.position.set(center.x, center.y, 10)
              camera.zoom = 1
              camera.updateProjectionMatrix()
              controls?.target.set(center.x, center.y, 0)
              controls?.update()
              onDocInfo(`DXF cargado. Tamaño: ${size.x.toFixed(2)} x ${size.y.toFixed(2)} unidades`)
            }
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
              scene.add(dxfObj)
              setEntityRoot(dxfObj)
              const box = new THREE.Box3().setFromObject(dxfObj)
              const center = box.getCenter(new THREE.Vector3())
              const size = box.getSize(new THREE.Vector3())
              const maxSize = Math.max(size.x, size.y)
              const viewSize = maxSize * 0.6
              const w = renderer.domElement.clientWidth
              const h = renderer.domElement.clientHeight
              const aspect = w / h
              camera.left = -viewSize * aspect
              camera.right = viewSize * aspect
              camera.top = viewSize
              camera.bottom = -viewSize
              camera.position.set(center.x, center.y, 10)
              camera.zoom = 1
              camera.updateProjectionMatrix()
              controls?.target.set(center.x, center.y, 0)
              controls?.update()
              setErrorMsg(null)
              onDocInfo(`DXF cargado (viewer). Tamaño: ${size.x.toFixed(2)} x ${size.y.toFixed(2)} unidades`)
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
            scene.add(dxfObj as any)
            setEntityRoot(dxfObj as any)
            const box = new THREE.Box3().setFromObject(dxfObj as any)
            const center = box.getCenter(new THREE.Vector3())
            const size = box.getSize(new THREE.Vector3())
            const maxSize = Math.max(size.x, size.y)
            const viewSize = maxSize * 0.6
            const w = renderer.domElement.clientWidth
            const h = renderer.domElement.clientHeight
            const aspect = w / h
            camera.left = -viewSize * aspect
            camera.right = viewSize * aspect
            camera.top = viewSize
            camera.bottom = -viewSize
            camera.position.set(center.x, center.y, 10)
            camera.zoom = 1
            camera.updateProjectionMatrix()
            controls?.target.set(center.x, center.y, 0)
            controls?.update()
            setErrorMsg(null)
            onDocInfo(`DXF cargado (viewer). Tamaño: ${size.x.toFixed(2)} x ${size.y.toFixed(2)} unidades`)
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
    
    // Move camera and controls to center of object
    camera.position.set(center.x, center.y, 100)
    camera.updateProjectionMatrix()
    
    controls.target.set(center.x, center.y, 0)
    controls.update()
  }

  return (
    <div
      ref={containerRef}
      className={`relative flex-1 overflow-hidden bg-slate-900 h-full ${tool === 'hand' ? 'cursor-grab' : 'cursor-crosshair'}`}
      onContextMenu={(e) => e.preventDefault()}
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
      onMouseMove={onMouseMove}
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

      {/* Debug Info Overlay */}
      <div className="absolute top-2 left-2 bg-black/70 text-white p-2 text-xs rounded pointer-events-none z-50">
        <div>Pos: {debugInfo.pos}</div>
        <div>Zoom: {debugInfo.zoom}</div>
        <div>Snaps: {debugInfo.candidates}</div>
        <div>Objects: {debugStats || 'None'}</div>
        <div>Tool: {tool}</div>
        <div>Status: {snap ? `SNAP: ${snap.type}` : 'No Snap'}</div>
      </div>

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

      <div className="absolute top-16 right-6 z-50 flex gap-2">
        <button
          onClick={() => setDimensions([])}
          className="text-[10px] px-2 py-1 rounded bg-slate-800 border border-slate-700 hover:bg-slate-700"
          title="Limpiar Cotas"
        >
          Limpiar Cotas
        </button>
        <button
          onClick={() => setAreas([])}
          className="text-[10px] px-2 py-1 rounded bg-slate-800 border border-slate-700 hover:bg-slate-700"
          title="Limpiar Áreas"
        >
          Limpiar Áreas
        </button>
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
