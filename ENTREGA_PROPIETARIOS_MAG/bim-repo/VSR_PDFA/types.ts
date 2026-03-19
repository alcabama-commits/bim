
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface Calibration {
  pixels: number;
  realValue: number;
  unit: string;
}

export type Tool = 'select' | 'hand' | 'measure' | 'calibrate';
