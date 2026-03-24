export interface BIMElement {
  id: string;
  globalId?: string;
  name: string;
  category: string;
  volume: number;
  unit: string;
  properties?: Record<string, any>;
  modelId?: string;
  localId?: number;
}

export interface CategorySummary {
  category: string;
  totalVolume: number;
  count: number;
}
