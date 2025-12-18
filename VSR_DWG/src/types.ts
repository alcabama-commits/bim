export type Tool = 'hand' | 'measure' | 'calibrate';

export interface Calibration {
  world: number;
  realValue: number;
  unit: 'm' | 'cm' | 'mm';
}
