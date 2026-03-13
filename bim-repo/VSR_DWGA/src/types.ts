export type Tool = 'hand' | 'measure' | 'calibrate' | 'dimension' | 'area';

export interface Calibration {
  world: number;
  realValue: number;
  unit: 'm' | 'cm' | 'mm';
}

export interface DimensionItem {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  text: string;
}

export interface AreaItem {
  pts: Array<{ x: number; y: number }>;
  text: string;
}

export interface SnapSettings {
  enableEndpoint: boolean;
  enableMidpoint: boolean;
  thresholdPx: number;
}
