import { api } from "@/lib/api";
import type { Document, DocumentUpdate, UploadResponse } from "@/types/document";

export async function listDocuments(): Promise<Document[]> {
  const { data } = await api.get<Document[]>("/api/v1/documents");
  return data;
}

export async function uploadDocuments(
  files: File[],
  subject: string,
  onProgress?: (percent: number) => void
): Promise<UploadResponse> {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  formData.append("subject", subject);

  const { data } = await api.post<UploadResponse>(
    "/api/v1/documents/upload",
    formData,
    {
      // Drop instance JSON Content-Type so the browser adds the multipart boundary.
      headers: { "Content-Type": false as unknown as string },
      onUploadProgress: (event) => {
        if (onProgress && event.total) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      },
    }
  );
  return data;
}

export async function updateDocument(
  id: string,
  update: DocumentUpdate
): Promise<Document> {
  const { data } = await api.patch<Document>(`/api/v1/documents/${id}`, update);
  return data;
}

export async function deleteDocument(id: string): Promise<void> {
  await api.delete(`/api/v1/documents/${id}`);
}

export async function reprocessDocument(id: string): Promise<Document> {
  const { data } = await api.post<Document>(`/api/v1/documents/${id}/reprocess`);
  return data;
}

/**
 * Fetch a document's PDF as an authenticated blob URL. An <iframe>/<embed>
 * can't send the auth header itself, so we fetch the bytes via axios (which
 * attaches the token) and hand back an object URL the caller must revoke.
 */
export async function fetchDocumentBlobUrl(id: string): Promise<string> {
  const { data } = await api.get<Blob>(`/api/v1/documents/${id}/file`, {
    responseType: "blob",
  });
  return URL.createObjectURL(data);
}
