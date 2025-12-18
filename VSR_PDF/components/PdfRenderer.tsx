
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Calibration, Tool } from '../types';

declare const window: any;

interface PdfRendererProps {
  file: File | null;
  currentPage: number;
  scale: number;
  rotation: number;
  tool: Tool;
  showGrid: boolean;
  isBlueprint: boolean;
  calibration: Calibration | null;
  onCalibrationComplete: (c: Calibration) => void;
  onDocumentLoad: (totalPages: number, fullText: string) => void;
  onFileSelect: (file: File) => void;
  // Added onToolChange to the props interface to fix the error where setActiveTool was not found
  onToolChange?: (tool: Tool) => void;
}

const PdfRenderer: React.FC<PdfRendererProps> = ({ 
  file, 
  currentPage, 
  scale, 
  rotation,
  tool,
  showGrid,
  isBlueprint,
  calibration,
  onCalibrationComplete,
  onDocumentLoad,
  onFileSelect,
  // Destructure onToolChange from props
  onToolChange
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);

  const [points, setPoints] = useState<{x: number, y: number}[]>([]);

  useEffect(() => {
    const lib = window.pdfjsLib;
    if (lib) {
      lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
  }, []);

  useEffect(() => {
    if (!file) {
      setPdfDoc(null);
      return;
    }
    const loadPdf = async () => {
      const lib = window.pdfjsLib;
      if (!lib) return;

      setLoading(true);
      try {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const typedarray = new Uint8Array(e.target?.result as ArrayBuffer);
          const pdf = await lib.getDocument(typedarray).promise;
          setPdfDoc(pdf);
          let fullText = "";
          for (let i = 1; i <= Math.min(pdf.numPages, 3); i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            fullText += content.items.map((item: any) => item.str).join(" ") + " ";
          }
          onDocumentLoad(pdf.numPages, fullText);
        };
        reader.readAsArrayBuffer(file);
      } catch (error) {
        console.error("Error loading PDF:", error);
      } finally {
        setLoading(false);
      }
    };
    loadPdf();
  }, [file, onDocumentLoad]);

  const renderPage = useCallback(async (pageNum: number) => {
    if (!pdfDoc || !canvasRef.current) return;
    try {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale, rotation });
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (context) {
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await page.render({ canvasContext: context, viewport: viewport }).promise;
      }
    } catch (error) {
      console.error("Error rendering page:", error);
    }
  }, [pdfDoc, scale, rotation]);

  useEffect(() => {
    if (pdfDoc) renderPage(currentPage);
    setPoints([]);
  }, [pdfDoc, currentPage, scale, rotation, renderPage]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!file) return;
    if (tool === 'hand') {
      setIsDragging(true);
      setStartX(e.pageX - (containerRef.current?.offsetLeft || 0));
      setStartY(e.pageY - (containerRef.current?.offsetTop || 0));
      setScrollLeft(containerRef.current?.scrollLeft || 0);
      setScrollTop(containerRef.current?.scrollTop || 0);
    } else if ((tool === 'measure' || tool === 'calibrate') && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      if (points.length >= 2) {
        setPoints([{x, y}]);
      } else {
        const newPoints = [...points, {x, y}];
        setPoints(newPoints);
        
        if (newPoints.length === 2 && tool === 'calibrate') {
          const dx = newPoints[1].x - newPoints[0].x;
          const dy = newPoints[1].y - newPoints[0].y;
          const pixelDist = Math.sqrt(dx * dx + dy * dy);
          const val = prompt("Establecer escala: ¿Cuántos metros mide esta línea en la realidad?", "1.0");
          if (val) {
            onCalibrationComplete({
              pixels: pixelDist,
              realValue: parseFloat(val),
              unit: 'm'
            });
            // Fixed: use the onToolChange prop instead of the undefined setActiveTool
            onToolChange?.('measure');
          }
        }
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || tool !== 'hand' || !containerRef.current) return;
    const x = e.pageX - containerRef.current.offsetLeft;
    const y = e.pageY - containerRef.current.offsetTop;
    containerRef.current.scrollLeft = scrollLeft - (x - startX) * 1.5;
    containerRef.current.scrollTop = scrollTop - (y - startY) * 1.5;
  };

  if (!file) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-900 border-2 border-dashed border-slate-800 m-8 rounded-3xl">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-20 h-20 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-yellow-500/20">
            <i className="fa-solid fa-cloud-arrow-up text-3xl text-yellow-500 animate-pulse"></i>
          </div>
          <h3 className="text-xl font-bold text-white">Visor BIM Preparado</h3>
          <p className="text-slate-400 text-sm">Carga un plano PDF para comenzar el análisis técnico y mediciones de obra.</p>
          <label className="inline-block cursor-pointer bg-yellow-500 hover:bg-yellow-400 text-slate-950 px-8 py-3 rounded-xl font-bold transition-all transform hover:scale-105 active:scale-95">
            Seleccionar Archivo
            <input 
              type="file" 
              className="hidden" 
              accept=".pdf" 
              onChange={(e) => e.target.files?.[0] && onFileSelect(e.target.files[0])} 
            />
          </label>
        </div>
      </div>
    );
  }

  const calculateFormattedDistance = () => {
    if (points.length !== 2) return null;
    const dx = points[1].x - points[0].x;
    const dy = points[1].y - points[0].y;
    const pixels = Math.sqrt(dx * dx + dy * dy);
    
    if (calibration) {
      const realDist = (pixels / calibration.pixels) * calibration.realValue;
      return `${realDist.toFixed(3)} ${calibration.unit}`;
    }
    return `${(pixels / scale).toFixed(1)} px`;
  };

  const displayDist = calculateFormattedDistance();

  return (
    <div 
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={() => setIsDragging(false)}
      onMouseLeave={() => setIsDragging(false)}
      className={`relative flex-1 overflow-auto bg-slate-900 h-full no-scrollbar ${tool === 'hand' ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-crosshair'}`}
    >
      <div className="relative inline-block m-auto min-w-full min-h-full flex items-center justify-center p-20">
        <div className={`relative transition-all duration-300 ${isBlueprint ? 'invert hue-rotate-180 brightness-110 contrast-125' : ''}`}>
          <canvas ref={canvasRef} className="bg-white shadow-[0_0_60px_rgba(0,0,0,0.6)] border border-slate-700" />
          
          {showGrid && (
            <div className="absolute inset-0 pointer-events-none opacity-20" 
                 style={{ backgroundImage: 'linear-gradient(#444 1px, transparent 1px), linear-gradient(90deg, #444 1px, transparent 1px)', backgroundSize: `${50 * scale}px ${50 * scale}px` }}>
            </div>
          )}

          <svg className="absolute inset-0 pointer-events-none w-full h-full">
            {points.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r="6" fill="#facc15" stroke="#000" strokeWidth="2" />
            ))}
            {points.length === 2 && (
              <>
                <line x1={points[0].x} y1={points[0].y} x2={points[1].x} y2={points[1].y} stroke="#facc15" strokeWidth="3" strokeDasharray="6,4" />
                <g transform={`translate(${(points[0].x + points[1].x) / 2}, ${(points[0].y + points[1].y) / 2 - 20})`}>
                  <rect x="-50" y="-12" width="100" height="24" rx="12" fill="#000" stroke="#facc15" strokeWidth="2" />
                  <text fontSize="12" fontWeight="900" textAnchor="middle" fill="#facc15" dy="5" className="font-mono">
                    {displayDist}
                  </text>
                </g>
              </>
            )}
          </svg>
        </div>
      </div>

      {loading && (
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50">
          <div className="flex flex-col items-center gap-6">
            <div className="w-16 h-16 border-4 border-yellow-500/20 border-t-yellow-500 animate-spin rounded-full"></div>
            <div className="text-center">
              <span className="block text-yellow-500 font-mono text-xs tracking-widest uppercase mb-1">Cargando Render BIM</span>
              <span className="text-slate-500 text-[10px] uppercase font-bold">Por favor espere...</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PdfRenderer;