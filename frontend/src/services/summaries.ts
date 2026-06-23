import { api } from "@/lib/api";
import type { SummaryResponse, SummaryTypeInfo } from "@/types/summary";

export async function listSummaryTypes(
  documentId: string
): Promise<SummaryTypeInfo[]> {
  const { data } = await api.get<SummaryTypeInfo[]>(
    `/api/v1/documents/${documentId}/summaries`
  );
  return data;
}

export async function getSummary(
  documentId: string,
  type: string
): Promise<SummaryResponse> {
  const { data } = await api.get<SummaryResponse>(
    `/api/v1/documents/${documentId}/summaries/${type}`
  );
  return data;
}

export async function generateSummary(
  documentId: string,
  type: string
): Promise<SummaryResponse> {
  const { data } = await api.post<SummaryResponse>(
    `/api/v1/documents/${documentId}/summaries/${type}`
  );
  return data;
}
