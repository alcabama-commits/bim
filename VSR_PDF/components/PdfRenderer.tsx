
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { pdfjs, Document, Page } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import { useGesture } from '@use-gesture/react';

// --- CAMBIO IMPORTANTE AQUÍ ---
// Configura el worker de PDF.js usando un CDN para máxima compatibilidad.
// Reemplaza la configuración anterior que usaba `import.meta.url`.
const workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;
pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

interface PdfRendererProps {
  file: File | null;
  currentPage: number;
  scale: number;
  rotation: number;
  tool: 'select' | 'hand' | 'measure';
  showGrid: boolean;
  isBlueprint: boolean;
  onDocumentLoad: (pages: number, text: string) => void;
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
  onDocumentLoad,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  // Reset position on file change
  useEffect(() => {
    setPosition({ x: 0, y: 0 });
  }, [file]);

  useGesture(
    {
      onDrag: ({ offset: [dx, dy], event }) => {
        if (tool === 'hand') {
          event.preventDefault();
          setPosition({ x: dx, y: dy });
        }
      },
    },
    {
      target: containerRef,
      eventOptions: { passive: false },
      drag: {
        from: () => [position.x, position.y],
        filterTaps: true,
        pointer: { touch: true },
      },
    }
  );

  const handleDocumentLoadSuccess = useCallback(async (pdf: any) => {
    const numPages = pdf.numPages;
    let fullText = "";
    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += pageText + '\n\n';
    }
    onDocumentLoad(numPages, fullText);
  }, [onDocumentLoad]);

  if (!file) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 p-8 text-center">
        <i className="fa-solid fa-file-arrow-up text-6xl mb-6"></i>
        <h2 className="text-2xl font-bold text-slate-300 mb-2">Carga un plano para comenzar</h2>
        <p className="max-w-md">
          Selecciona un archivo PDF desde tu dispositivo para visualizarlo y analizarlo con la ayuda de nuestra IA.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`w-full h-full overflow-hidden flex items-center justify-center relative ${tool === 'hand' ? 'cursor-grab' : 'cursor-crosshair'}`}
      style={{ touchAction: 'none' }}
    >
      {showGrid && (
        <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:2rem_2rem] z-0"></div>
      )}
      <div
        className="relative transition-transform duration-200 ease-out"
        style={{
          transform: `translate(${position.x}px, ${position.y}px)`,
        }}
      >
        <Document
          file={file}
          onLoadSuccess={handleDocumentLoadSuccess}
          onLoadError={console.error}
          className={isBlueprint ? 'blueprint-filter' : ''}
        >
          <Page
            pageNumber={currentPage}
            scale={scale}
            rotation={rotation}
            renderTextLayer={false}
            renderAnnotationLayer={false}
          />
        </Document>
      </div>
    </div>
  );
};

export default PdfRenderer;
