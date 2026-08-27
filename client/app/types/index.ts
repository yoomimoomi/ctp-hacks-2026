export interface VisionAPIResponse {
  item_name: string;
  material_type: string;
  nyc_stream_category: string;
  bin_color: string;
  is_recyclable: boolean;
  preparation_instructions: string[];
  nyc_rule_notes: string;
  estimated_weight_grams: number;
  estimated_co2_grams: number;
  captured_at: string;
}

export interface ExtendedScanResult extends VisionAPIResponse {
  uiCategory: string;
  co2Saved: number;
}

export interface HistoryLog {
  id: number;
  item: string;
  category: string;
  co2: string;
  time: string;
}

export interface DashboardStats {
  totalScans: number;
  co2Diverted: number;
  recycledItems: number;
}