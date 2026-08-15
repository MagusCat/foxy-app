
export const ALLOWED_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/rtf',
  'text/rtf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export const ALLOWED_DOCUMENT_EXTENSIONS = ['pdf', 'txt', 'md', 'markdown', 'csv', 'rtf', 'doc', 'docx'];

export const ALLOWED_DOCUMENTS_LABEL = 'PDF, TXT, MD, CSV, RTF, DOC y DOCX';

export const MAX_ATTACHMENTS = 10;

export const MAX_FILE_BYTES = 20 * 1024 * 1024;

export function getExtension(name: string): string {
  const clean = name.split('?')[0].split('#')[0];
  const lastDot = clean.lastIndexOf('.');
  if (lastDot <= 0 || lastDot === clean.length - 1) return '';
  return clean.slice(lastDot + 1).toLowerCase();
}

export function isAllowedDocument(name: string, mimeType?: string | null): boolean {
  const normalizedMime = mimeType?.split(';')[0].trim().toLowerCase();
  if (normalizedMime && ALLOWED_DOCUMENT_MIME_TYPES.includes(normalizedMime)) return true;
  return ALLOWED_DOCUMENT_EXTENSIONS.includes(getExtension(name));
}


export function isOpaqueFileName(name: string): boolean {
  const base = name.slice(0, name.length - (getExtension(name).length + 1)) || name;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(base)) return true;
  return base.length >= 12 && /^[0-9a-f]+$/i.test(base);
}

export function imageExtensionFromMime(mimeType?: string | null): string {
  const subtype = mimeType?.split('/')[1]?.split(';')[0]?.toLowerCase();
  if (!subtype) return 'jpg';
  if (subtype === 'jpeg') return 'jpg';
  return subtype;
}

export function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
