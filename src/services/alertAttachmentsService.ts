import apiClient from '../utils/apiClient';

/**
 * Alert attachment service. All traffic goes through the shared apiClient
 * (bearer token, machine-info header, 401 refresh). The API service stores
 * the physical file and keeps only the reference in the database; nothing in
 * this app touches Supabase or any database directly.
 */

export interface AlertAttachment {
  attachment_id: string;
  alert_id: string;
  file_name: string;
  file_size: number;
  content_type?: string;
  description?: string;
  uploaded_by: string;
  uploaded_at: string;
}

// Attachment rules (mirror these on the server - never trust the client alone)
export const MAX_FILE_MB = 10;
export const MAX_STAGED_FILES = 10;
export const ALLOWED_EXT = [
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'csv',
  'txt',
  'png',
  'jpg',
  'jpeg',
  'msg',
  'eml',
  'zip',
];

export const extOf = (name: string) =>
  name.split('.').pop()?.toLowerCase() || '';

export const fmtSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

/** Returns a human-readable rejection reason, or null when the file is OK. */
export function validateFile(file: File): string | null {
  if (file.size === 0) return 'empty file';
  if (file.size > MAX_FILE_MB * 1024 * 1024) return `over ${MAX_FILE_MB} MB`;
  if (!ALLOWED_EXT.includes(extOf(file.name))) return 'type not allowed';
  return null;
}

type ListEnvelope = AlertAttachment[] | { attachments?: AlertAttachment[] };

function extractList(data: unknown): AlertAttachment[] {
  if (Array.isArray(data)) return data as AlertAttachment[];
  const envelope = data as ListEnvelope | undefined;
  if (Array.isArray(envelope?.attachments)) return envelope.attachments;
  if (Array.isArray((envelope as any)?.data)) return (envelope as any).data;
  return [];
}

async function listAttachments(alertId: string): Promise<AlertAttachment[]> {
  const res = await apiClient.post<ListEnvelope>('alert-attachments/list', {
    alert_id: alertId,
  });
  if (!res.success) throw new Error(res.error || 'Failed to load attachments');
  return extractList(res.data);
}

async function uploadAttachment(
  alertId: string,
  uploadedBy: string,
  description: string,
  file: File
): Promise<AlertAttachment> {
  const fd = new FormData();
  fd.append('alert_id', alertId);
  fd.append('uploaded_by', uploadedBy);
  fd.append('description', description.trim());
  fd.append('file', file, file.name); // browser sets the multipart boundary
  const res = await apiClient.postForm<AlertAttachment>(
    'alert-attachments/upload',
    fd
  );
  if (!res.success) throw new Error(res.error || 'Upload failed');
  return (res.data ?? {}) as AlertAttachment;
}

async function downloadAttachment(
  file: Pick<AlertAttachment, 'attachment_id' | 'file_name'>
): Promise<void> {
  const res = await apiClient.downloadBlob(
    `alert-attachments/download/${encodeURIComponent(file.attachment_id)}`
  );
  if (!res.success || !res.blob)
    throw new Error(res.error || 'Download failed');
  const url = URL.createObjectURL(res.blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.file_name || `attachment-${file.attachment_id}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function deleteAttachment(
  attachmentId: string,
  alertId: string,
  username: string
): Promise<void> {
  const res = await apiClient.post('alert-attachments/delete', {
    attachment_id: attachmentId,
    alert_id: alertId,
    username,
  });
  if (!res.success) throw new Error(res.error || 'Delete failed');
}

export const alertAttachmentsService = {
  list: listAttachments,
  upload: uploadAttachment,
  download: downloadAttachment,
  delete: deleteAttachment,
};
