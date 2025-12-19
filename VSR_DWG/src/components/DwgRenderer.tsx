import React, { useEffect, useRef, useState } from 'react'
import type { Calibration, Tool } from '../types'
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
}

const DwgRenderer: React.FC<Props> = ({
  file, tool, showGrid, isBlueprint, calibration, onCalibrationComplete, onDocInfo
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [renderer, setRenderer] = useState<THREE.WebGLRenderer | null>(null)
  const [scene] = useState(() => new THREE.Scene())
  const [camera] = useState(() => new THREE.OrthographicCamera(-10, 10, 10, -10, -1000, 1000))
  const [controls, setControls] = useState<OrbitControls | null>(null)
  const [gridHelper, setGridHelper] = useState<THREE.GridHelper | null>(null)
  const [entityRoot, setEntityRoot] = useState<THREE.Object3D | null>(null)
  const [points, setPoints] = useState<THREE.Vector3[]>([])
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [loadingText, setLoadingText] = useState<string>('')
  const loadTimeoutRef = useRef<number | null>(null)

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

    const ctrls = new OrbitControls(camera, r.domElement)
    ctrls.enableRotate = false
    ctrls.zoomSpeed = 1.0
    ctrls.panSpeed = 0.9
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
      const aspect = w / h
      const viewSize = 50
      camera.left = -viewSize * aspect
      camera.right = viewSize * aspect
      camera.top = viewSize
      camera.bottom = -viewSize
      camera.updateProjectionMatrix()
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [renderer, scene, camera])

  useEffect(() => {
    if (!renderer) return
    if (isBlueprint) {
      renderer.domElement.style.filter = 'invert(1) hue-rotate(180deg) brightness(1.1) contrast(1.25)'
    } else {
      renderer.domElement.style.filter = ''
    }
  }, [isBlueprint, renderer])

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
              const root = new THREE.Group()
              const material = new THREE.LineBasicMaterial({ color: 0xffffff })
              ;((db?.lines || []) as any[]).forEach((ln: any) => {
                const geo = new THREE.BufferGeometry().setFromPoints([
                  new THREE.Vector3(ln.start.x, ln.start.y, 0),
                  new THREE.Vector3(ln.end.x, ln.end.y, 0),
                ])
                root.add(new THREE.Line(geo, material))
              })
              ;((db?.arcs || []) as any[]).forEach((arc: any) => {
                const segs = 64
                const curve = new THREE.EllipseCurve(
                  arc.center.x, arc.center.y,
                  arc.radius, arc.radius,
                  arc.startAngle, arc.endAngle, false, 0
                )
                const pts = curve.getPoints(segs).map(p => new THREE.Vector3(p.x, p.y, 0))
                const geo = new THREE.BufferGeometry().setFromPoints(pts)
                root.add(new THREE.Line(geo, material))
              })
              ;((db?.circles || []) as any[]).forEach((c: any) => {
                const segs = 64
                const curve = new THREE.EllipseCurve(
                  c.center.x, c.center.y,
                  c.radius, c.radius, 0, Math.PI * 2, false, 0
                )
                const pts = curve.getPoints(segs).map(p => new THREE.Vector3(p.x, p.y, 0))
                const geo = new THREE.BufferGeometry().setFromPoints(pts)
                root.add(new THREE.Line(geo, material))
              })
              scene.add(root)
              setEntityRoot(root)
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
    const fontLoader = new FontLoader()
    fontLoader.load('https://threejs.org/examples/fonts/helvetiker_regular.typeface.json', (font) => {
      const loader = new DXFLoader()
      loader.setFont(font)
      loader.setEnableLayer(true)
      loader.setConsumeUnits(true)
      loader.setDefaultColor(0x000000)
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current)
      }
      loadTimeoutRef.current = window.setTimeout(() => {
        setLoading(false)
        setErrorMsg('Tiempo de carga excedido. Verifica que el DXF sea válido.')
        URL.revokeObjectURL(url)
      }, 15000)
      loader.load(url, (data: any) => {
        const root = data?.entity
        if (root) {
          root.traverse((obj: any) => {
            if ((obj as any).isLine) {
              (obj as THREE.Line).material = new THREE.LineBasicMaterial({ color: 0xffffff })
            }
          })
          scene.add(root)
          setEntityRoot(root)
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
        setLoading(false)
        if (loadTimeoutRef.current) {
          clearTimeout(loadTimeoutRef.current)
          loadTimeoutRef.current = null
        }
        URL.revokeObjectURL(url)
      }, undefined, async () => {
        setLoading(false)
        setErrorMsg('No se pudo procesar el DXF con el cargador principal.')
        try {
          const mod = await import('three-dxf-viewer')
          const viewer = new (mod as any).DXFViewer()
          const dxfObj = await viewer.getFromFile(file, 'https://threejs.org/examples/fonts/helvetiker_regular.typeface.json')
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
            onDocInfo(`DXF cargado (fallback). Tamaño: ${size.x.toFixed(2)} x ${size.y.toFixed(2)} unidades`)
          }
        } catch (e) {
          setErrorMsg('Error al procesar DXF. Prueba con otro archivo o convertir desde CAD.')
        } finally {
          URL.revokeObjectURL(url)
        }
      })
    }, undefined, () => {
      setLoading(false)
      setErrorMsg('Error cargando fuente de texto.')
      URL.revokeObjectURL(url)
    })
    }
    run()
  }, [file, renderer, scene, camera, controls, entityRoot, onDocInfo])

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

  const onMouseDown = (e: React.MouseEvent) => {
    if (!renderer) return
    if (tool === 'measure' || tool === 'calibrate') {
      const p = ndcToWorldOnPlaneZ0(e)
      if (!p) return
      if (points.length >= 2) {
        setPoints([p])
      } else {
        const next = [...points, p]
        setPoints(next)
        if (next.length === 2 && tool === 'calibrate') {
          const worldDist = next[0].distanceTo(next[1])
          const val = prompt('Establecer escala: ¿Cuántos metros mide esta línea en la realidad?', '1.0')
          if (val) {
            onCalibrationComplete({ world: worldDist, realValue: parseFloat(val), unit: 'm' })
          }
        }
      }
    }
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

  return (
    <div
      ref={containerRef}
      className={`relative flex-1 overflow-hidden bg-slate-900 h-full ${tool === 'hand' ? 'cursor-grab' : 'cursor-crosshair'}`}
      onMouseDown={onMouseDown}
    >
      <canvas ref={canvasRef} className="w-full h-full block" />

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

      {loading && (
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50">
          <div className="flex flex-col items-center gap-6">
            <div className="w-16 h-16 border-4 border-yellow-500/20 border-t-yellow-500 animate-spin rounded-full"></div>
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
