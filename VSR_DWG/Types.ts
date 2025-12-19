
export interface CADPoint {
  x: number;
  y: number;
}

export interface CADEntity {
  id: string;
  type: 'line' | 'circle' | 'rect' | 'text' | 'arc' | 'polyline';
  x1: number;
  y1: number;
  x2?: number;
  y2?: number;
  radius?: number;
  points?: CADPoint[]; // Para LWPOLYLINE
  content?: string;
  layer: string;
  color: string;
  strokeWidth: number;
  isSelected?: boolean;
}

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  color: string;
}

export interface DrawingState {
  fileName: string;
  entities: CADEntity[];
  layers: Layer[];
  zoom: number;
  panX: number;
  panY: number;
}

export interface AIAnalysisResult {
  summary: string;
  recommendations: string[];
  specs: {
    area?: string;
    elements?: string;
    standards?: string;
  };
}
