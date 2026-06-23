export interface SummaryTypeInfo {
  key: string;
  label: string;
  generated: boolean;
  updated_at: string | null;
}

export interface SummaryResponse {
  summary_type: string;
  label: string;
  content: string;
  updated_at: string;
}
