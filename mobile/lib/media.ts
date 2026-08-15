import { Directory, File, Paths } from 'expo-file-system';

const MEDIA_FOLDER = 'foxy-media';

function extensionOf(uri: string) {
  const clean = uri.split('?')[0].split('#')[0];
  const dot = clean.lastIndexOf('.');
  if (dot <= 0 || dot === clean.length - 1) return 'jpg';
  const extension = clean.slice(dot + 1).toLowerCase();
  return extension.length <= 5 ? extension : 'jpg';
}

export function persistMedia(uri: string, prefix = 'img'): string {
  if (!uri || !uri.startsWith('file://')) return uri;

  try {
    const folder = new Directory(Paths.document, MEDIA_FOLDER);
    if (!folder.exists) folder.create({ intermediates: true });

    const name = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${extensionOf(uri)}`;
    const destination = new File(folder, name);

    new File(uri).copy(destination);
    return destination.uri;
  } catch {
    return uri;
  }
}

export function deleteMedia(uri?: string) {
  if (!uri || !uri.includes(MEDIA_FOLDER)) return;

  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    return;
  }
}
