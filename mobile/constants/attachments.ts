/**
 * Reglas de los adjuntos que Foxy puede leer.
 *
 * Por ahora la IA solo procesa PDF y documentos de texto, así que el selector
 * se filtra por esos tipos Y además se valida lo que devuelve: en Android los
 * proveedores de archivos (Drive, WhatsApp, gestores de terceros) ignoran el
 * filtro de MIME con frecuencia y devuelven cualquier cosa.
 */

/** MIME types que se le piden al selector del sistema. */
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

/**
 * Respaldo por extensión. Android suele reportar `application/octet-stream`
 * para archivos que sí son válidos, y ahí el MIME no sirve para decidir.
 */
export const ALLOWED_DOCUMENT_EXTENSIONS = ['pdf', 'txt', 'md', 'markdown', 'csv', 'rtf', 'doc', 'docx'];

/** Texto corto para mostrarle al usuario qué aceptamos hoy. */
export const ALLOWED_DOCUMENTS_LABEL = 'PDF, TXT, MD, CSV, RTF, DOC y DOCX';

export const MAX_ATTACHMENTS = 10;

/** 20 MB: por encima de eso el envío al backend sería inviable en datos móviles. */
export const MAX_FILE_BYTES = 20 * 1024 * 1024;

/** Extensión en minúsculas, sin punto. Cadena vacía si el nombre no tiene. */
export function getExtension(name: string): string {
  const clean = name.split('?')[0].split('#')[0];
  const lastDot = clean.lastIndexOf('.');
  if (lastDot <= 0 || lastDot === clean.length - 1) return '';
  return clean.slice(lastDot + 1).toLowerCase();
}

/** Un documento vale si el MIME está permitido o si la extensión lo está. */
export function isAllowedDocument(name: string, mimeType?: string | null): boolean {
  const normalizedMime = mimeType?.split(';')[0].trim().toLowerCase();
  if (normalizedMime && ALLOWED_DOCUMENT_MIME_TYPES.includes(normalizedMime)) return true;
  return ALLOWED_DOCUMENT_EXTENSIONS.includes(getExtension(name));
}

/** Extensión de imagen a partir del MIME, con `jpg` como respaldo razonable. */
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
