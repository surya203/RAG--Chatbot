export type DocumentStatus = "pending" | "processing" | "ready" | "failed";

export interface Document {
  id: string;
  original_name: string;
  subject: string;
  content_type: string;
  size_bytes: number;
  status: DocumentStatus;
  chunk_count: number;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface UploadResponse {
  uploaded: Document[];
  errors: string[];
}

export interface DocumentUpdate {
  original_name?: string;
  subject?: string;
}
