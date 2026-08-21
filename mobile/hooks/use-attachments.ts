import { useCallback, useRef, useState } from 'react';
import { Linking } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

import {
  ALLOWED_DOCUMENTS_LABEL,
  ALLOWED_DOCUMENT_MIME_TYPES,
  MAX_ATTACHMENTS,
  MAX_FILE_BYTES,
  formatBytes,
  getExtension,
  imageExtensionFromMime,
  isAllowedDocument,
  isOpaqueFileName,
} from '@/constants/attachments';
import { appAlert } from '@/features/shared/components/overlay';

export type Attachment = {
  id: string;
  kind: 'image' | 'file';
  name: string;
  uri: string;
  mimeType?: string;
  size?: number;
};

/**
 * La cámara es el único permiso que se pide: lanzar la galería no necesita
 * permiso en Android (doc SDK 54). Nunca devuelve `false` en silencio: si no
 * se puede continuar, el usuario siempre ve por qué, con "Abrir ajustes".
 */
async function ensureCameraPermission(): Promise<boolean> {
  const current = await ImagePicker.getCameraPermissionsAsync();
  if (current.granted) return true;

  if (current.canAskAgain) {
    const requested = await ImagePicker.requestCameraPermissionsAsync();
    if (requested.granted) return true;
  }

  appAlert(
    'Cámara bloqueada',
    'Foxy necesita la cámara para escanear tus apuntes. Actívala en los ajustes del sistema para continuar.',
    [
      { text: 'Ahora no', style: 'cancel' },
      { text: 'Abrir ajustes', onPress: () => Linking.openSettings() },
    ],
  );
  return false;
}

export function useAttachments() {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const sequence = useRef(0);
  const current = useRef<Attachment[]>([]);

  const nextId = () => {
    sequence.current += 1;
    return `att-${Date.now()}-${sequence.current}`;
  };

  const addAttachments = useCallback((incoming: Omit<Attachment, 'id'>[]) => {
    if (incoming.length === 0) return 0;

    const known = new Set(current.current.map((item) => item.uri));
    const room = MAX_ATTACHMENTS - current.current.length;
    const fresh = incoming
      .filter((item) => !known.has(item.uri))
      .slice(0, Math.max(room, 0))
      .map((item) => ({ ...item, id: nextId() }));

    if (fresh.length === 0) return 0;

    current.current = [...current.current, ...fresh];
    setAttachments(current.current);
    return fresh.length;
  }, []);

  const warnIfTrimmed = (requested: number, accepted: number) => {
    if (accepted >= requested) return;
    appAlert(
      'Adjuntos al límite',
      `Foxy admite ${MAX_ATTACHMENTS} adjuntos por mensaje. Se agregaron ${accepted} de ${requested}.`,
    );
  };

  const removeAttachment = useCallback((id: string) => {
    current.current = current.current.filter((item) => item.id !== id);
    setAttachments(current.current);
  }, []);

  const clearAttachments = useCallback(() => {
    current.current = [];
    setAttachments(current.current);
  }, []);

  const addFromCamera = useCallback(async () => {
    if (!(await ensureCameraPermission())) return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.7,
        exif: false,
        cameraType: ImagePicker.CameraType.back,
      });

      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset?.uri) {
        appAlert('No se guardó la foto', 'La cámara no devolvió ninguna imagen. Inténtalo de nuevo.');
        return;
      }

      const stamp = new Date();
      const name =
        asset.fileName ||
        `Foto ${stamp.getHours()}.${`${stamp.getMinutes()}`.padStart(2, '0')}.${imageExtensionFromMime(
          asset.mimeType,
        )}`;

      const accepted = addAttachments([
        { kind: 'image', uri: asset.uri, name, mimeType: asset.mimeType, size: asset.fileSize },
      ]);
      warnIfTrimmed(1, accepted);
    } catch (error) {
      console.log('Error abriendo la cámara:', error);
      appAlert('No se pudo abrir la cámara', 'Cierra otras apps que la estén usando e inténtalo de nuevo.');
    }
  }, [addAttachments]);

  const addFromLibrary = useCallback(async () => {
    // La galería no pide permiso: pedirlo y bloquear si se deniega deja el
    // botón muerto (advertencia 0.4 del doc). Solo la cámara lo necesita.
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: MAX_ATTACHMENTS,
        quality: 0.7,
        exif: false,
      });

      if (result.canceled) return;

      const assets = (result.assets ?? []).filter((asset) => Boolean(asset.uri));
      if (assets.length === 0) {
        appAlert('Sin imágenes', 'No se pudo leer la selección. Inténtalo de nuevo.');
        return;
      }

      const accepted = addAttachments(
        assets.map((asset, index) => {
          const extension = imageExtensionFromMime(asset.mimeType);
          const fallback = `Imagen ${index + 1}.${extension}`;

          return {
            kind: 'image' as const,
            uri: asset.uri,
            name: asset.fileName && !isOpaqueFileName(asset.fileName) ? asset.fileName : fallback,
            mimeType: asset.mimeType,
            size: asset.fileSize,
          };
        }),
      );
      warnIfTrimmed(assets.length, accepted);
    } catch (error) {
      console.log('Error abriendo la galería:', error);
      appAlert('No se pudieron abrir tus fotos', 'Inténtalo de nuevo.');
    }
  }, [addAttachments]);

  const addFromFiles = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ALLOWED_DOCUMENT_MIME_TYPES,
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const assets = result.assets ?? [];
      const valid: Omit<Attachment, 'id'>[] = [];
      const rejectedType: string[] = [];
      const rejectedSize: string[] = [];

      assets.forEach((asset, index) => {
        const name = asset.name || `Documento ${index + 1}`;
        if (!isAllowedDocument(name, asset.mimeType)) {
          rejectedType.push(name);
          return;
        }
        if (asset.size && asset.size > MAX_FILE_BYTES) {
          rejectedSize.push(`${name} (${formatBytes(asset.size)})`);
          return;
        }
        valid.push({
          kind: 'file',
          uri: asset.uri,
          name,
          mimeType: asset.mimeType,
          size: asset.size,
        });
      });

      const accepted = addAttachments(valid);

      if (rejectedType.length > 0) {
        appAlert(
          'Formato no soportado todavía',
          `Por ahora Foxy solo lee ${ALLOWED_DOCUMENTS_LABEL}.\n\nSe omitió: ${rejectedType.join(', ')}`,
        );
      } else if (rejectedSize.length > 0) {
        appAlert(
          'Archivo demasiado grande',
          `El límite es ${formatBytes(MAX_FILE_BYTES)} por archivo.\n\nSe omitió: ${rejectedSize.join(', ')}`,
        );
      } else {
        warnIfTrimmed(valid.length, accepted);
      }
    } catch (error) {
      console.log('Error abriendo el selector de archivos:', error);
      appAlert('No se pudo abrir el archivo', 'Inténtalo de nuevo.');
    }
  }, [addAttachments]);

  return {
    attachments,
    addFromCamera,
    addFromLibrary,
    addFromFiles,
    removeAttachment,
    clearAttachments,
  };
}

export async function pickSingleImage(source: 'camera' | 'library'): Promise<string | null> {
  if (source === 'camera' && !(await ensureCameraPermission())) return null;

  try {
    // Sin `allowsEditing` ni `shape`: el recortador del fabricante rompe en
    // algunos dispositivos (advertencia 0.3). La confirmación con la foto en
    // círculo la hace la propia app, dentro de avatar-editor.
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.6, exif: false })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.6,
            exif: false,
          });

    if (result.canceled) return null;
    return result.assets?.[0]?.uri ?? null;
  } catch (error) {
    console.log('Error eligiendo la foto de perfil:', error);
    appAlert('No se pudo cambiar tu foto', 'Inténtalo de nuevo.');
    return null;
  }
}

export function describeAttachment(attachment: Attachment): string {
  const extension = getExtension(attachment.name).toUpperCase();
  const size = formatBytes(attachment.size);
  return [extension || (attachment.kind === 'image' ? 'IMG' : 'DOC'), size].filter(Boolean).join(' · ');
}
