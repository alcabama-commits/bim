
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface PdfMetadata {
  name: string;
  size: number;
  totalPages: number;
  text: string;
}

export enum ViewMode {
  SinglePage = 'single',
  Continuous = 'continuous'
}
