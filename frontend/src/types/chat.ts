export interface SourceChunk {
  document_id: string;
  document_name: string;
  subject: string;
  chunk_index: number;
  score: number;
  preview: string;
}

export interface ChatQueryRequest {
  question: string;
  conversation_id?: string;
  document_ids?: string[] | null;
}
