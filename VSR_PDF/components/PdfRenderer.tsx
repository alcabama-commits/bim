
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';

declare const pdfjsLib: any;

interface PdfRendererProps {
  file: File | null;
  currentPage: number;
  scale: number;
  rotation: number;
  tool: 'select' | 'hand' | 'measure';
  showGrid: boolean;
  isBlueprint: boolean;
  onDocumentLoad: (totalPages: number, fullText: string) => void;
  onPageChange: (page: number) => void;
}

const PdfRenderer: React.FC<PdfRendererProps> = ({ 
  file, 
  currentPage, 
  scale, 
  rotation,
  tool,
  showGrid,
  isBlueprint,
  onDocumentLoad 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<SVGSVGElement>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  // State for Panning
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);

  // State for Measurement
  const [measurePoints, setMeasurePoints] = useState<{x: number, y: number}[]>([]);

  useEffect(() => {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }, []);

  useEffect(() => {
    if (!file) return;
    const loadPdf = async () => {
      setLoading(true);
      try {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const typedarray = new Uint8Array(e.target?.result as ArrayBuffer);
          const pdf = await pdfjsLib.getDocument(typedarray).promise;
          setPdfDoc(pdf);
          let fullText = "";
          for (let i = 1; i <= Math.min(pdf.numPages, 5); i++) {
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
  }, [file]);

  const renderPage = useCallback(async (pageNum: number) => {
    if (!pdfDoc || !canvasRef.current) return;
    try {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale, rotation });
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      const renderContext = { canvasContext: context, viewport: viewport };
      await page.render(renderContext).promise;
    } catch (error) {
      console.error("Error rendering page:", error);
    }
  }, [pdfDoc, scale, rotation]);

  useEffect(() => {
    if (pdfDoc) renderPage(currentPage);
    setMeasurePoints([]); // Reset measurements on page/scale change
  }, [pdfDoc, currentPage, scale, rotation, renderPage]);

  // Hand Tool Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (tool === 'hand') {
      setIsDragging(true);
      setStartX(e.pageX - (containerRef.current?.offsetLeft || 0));
      setStartY(e.pageY - (containerRef.current?.offsetTop || 0));
      setScrollLeft(containerRef.current?.scrollLeft || 0);
      setScrollTop(containerRef.current?.scrollTop || 0);
    } else if (tool === 'measure' && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (measurePoints.length >= 2) setMeasurePoints([{x, y}]);
      else setMeasurePoints([...measurePoints, {x, y}]);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || tool !== 'hand' || !containerRef.current) return;
    e.preventDefault();
    const x = e.pageX - containerRef.current.offsetLeft;
    const y = e.pageY - containerRef.current.offsetTop;
    const walkX = (x - startX) * 1.5;
    const walkY = (y - startY) * 1.5;
    containerRef.current.scrollLeft = scrollLeft - walkX;
    containerRef.current.scrollTop = scrollTop - walkY;
  };

  const handleMouseUp = () => setIsDragging(false);

  const calculateDistance = () => {
    if (measurePoints.length !== 2) return null;
    const dx = measurePoints[1].x - measurePoints[0].x;
    const dy = measurePoints[1].y - measurePoints[0].y;
    const pixels = Math.sqrt(dx * dx + dy * dy);
    // Rough estimate: Assuming 72 DPI and 1:100 scale if we wanted real meters, 
    // but for now we show relative units or pixels
    return (pixels / scale).toFixed(2);
  };

  const distance = calculateDistance();

  return (
    <div 
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      className={`relative flex-1 overflow-auto bg-slate-800 h-full no-scrollbar ${tool === 'hand' ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-crosshair'}`}
    >
      <div className="relative inline-block m-auto min-w-full min-h-full flex items-center justify-center p-12">
        <div className={`relative pdf-canvas-container transition-all duration-300 ${isBlueprint ? 'invert hue-rotate-180 brightness-110' : ''}`}>
          <canvas ref={canvasRef} className="bg-white shadow-2xl border border-slate-700" />
          
          {/* Grid Overlay */}
          {showGrid && (
            <div className="absolute inset-0 pointer-events-none opacity-20" 
                 style={{ backgroundImage: 'linear-gradient(#444 1px, transparent 1px), linear-gradient(90deg, #444 1px, transparent 1px)', backgroundSize: `${20 * scale}px ${20 * scale}px` }}>
            </div>
          )}

          {/* Measurement SVG Layer */}
          <svg className="absolute inset-0 pointer-events-none w-full h-full">
            {measurePoints.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r="4" fill="#6366f1" stroke="white" strokeWidth="2" />
            ))}
            {measurePoints.length === 2 && (
              <>
                <line x1={measurePoints[0].x} y1={measurePoints[0].y} x2={measurePoints[1].x} y2={measurePoints[1].y} stroke="#6366f1" strokeWidth="2" strokeDasharray="4" />
                <rect 
                  x={(measurePoints[0].x + measurePoints[1].x) / 2 - 40} 
                  y={(measurePoints[0].y + measurePoints[1].y) / 2 - 25} 
                  width="80" height="20" rx="4" fill="white" stroke="#6366f1" 
                />
                <text 
                  x={(measurePoints[0].x + measurePoints[1].x) / 2} 
                  y={(measurePoints[0].y + measurePoints[1].y) / 2 - 11} 
                  fontSize="12" fontWeight="bold" textAnchor="middle" fill="#6366f1"
                >
                  {distance} px
                </text>
              </>
            )}
          </svg>
        </div>
      </div>

      {loading && (
        <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-400"></div>
            <span className="text-white text-sm font-medium">Cargando Planimetría...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default PdfRenderer;