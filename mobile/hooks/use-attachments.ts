import { useCallback, useRef, useState } from 'react';
import { Alert, Linking, Platform } from 'react-native';
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
} from '@/constants/attachments';

export type Attachment = {
  id: string;
  kind: 'image' | 'file';
  name: string;
  uri: string;
  mimeType?: string;
  size?: number;
};

type PermissionKind = 'camera' | 'library';

const PERMISSION_COPY: Record<PermissionKind, { title: string; message: string }> = {
  camera: {
    title: 'Cámara bloqueada',
    message:
      'Foxy necesita la cámara para escanear tus apuntes. Actívala en los ajustes del sistema para continuar.',
  },
  library: {
    title: 'Fotos bloqueadas',
    message:
      'Foxy necesita acceso a tus fotos para adjuntarlas. Actívalo en los ajustes del sistema para continuar.',
  },
};

/**
 * Pide un permiso una sola vez y, si el sistema ya no deja volver a
 * preguntar (Android recuerda el "no volver a preguntar"), ofrece abrir los
 * ajustes en lugar de fallar en silencio.
 */
async function ensurePermission(kind: PermissionKind): Promise<boolean> {
  const current =
    kind === 'camera'
      ? await ImagePicker.getCameraPermissionsAsync()
      : await ImagePicker.getMediaLibraryPermissionsAsync();

  if (current.granted) return true;

  if (current.canAskAgain) {
    const requested =
      kind === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (requested.granted) return true;
    // El usuario dijo que no ahora mismo: no lo mandamos a ajustes por eso.
    if (requested.canAskAgain) return false;
  }

  const copy = PERMISSION_COPY[kind];
  Alert.alert(copy.title, copy.message, [
    { text: 'Ahora no', style: 'cancel' },
    { text: 'Abrir ajustes', onPress: () => Linking.openSettings() },
  ]);
  return false;
}

/**
 * Adjuntos del chat: cámara, galería y documentos.
 *
 * Todo el saneado vive aquí para que las pantallas solo pinten. Se validan
 * cuatro cosas que en Android fallan seguido: nombre de archivo ausente,
 * duplicados por doble toque, límite de cantidad y tipos no soportados.
 */
export function useAttachments() {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  // Contador propio: `Date.now()` repite valor cuando se agregan varios en el
  // mismo tick y React se queja por keys duplicadas.
  const sequence = useRef(0);
  /**
   * Espejo de la lista. React no garantiza ejecutar el updater de `setState`
   * en el mismo tick, así que leer el resultado desde dentro del updater
   * devolvía cero y el aviso de "se agregaron N de M" salía mal.
   */
  const current = useRef<Attachment[]>([]);

  const nextId = () => {
    sequence.current += 1;
    return `att-${Date.now()}-${sequence.current}`;
  };

  /**
   * Inserta respetando el cupo y descartando lo que ya está adjunto. Devuelve
   * cuántos entraron para poder avisar si se recortó la selección.
   */
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
    Alert.alert(
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

  /**
   * Cámara. En Android no usamos `allowsEditing`: el recorte lo resuelve cada
   * fabricante con su propia actividad y en varios equipos vuelve sin imagen.
   * Para escanear un problema conviene la foto completa, además.
   */
  const addFromCamera = useCallback(async () => {
    if (!(await ensurePermission('camera'))) return;

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
      // La cámara de Android casi nunca informa `fileName`; sin este respaldo
      // todas las fotos entraban al chat con el mismo nombre.
      if (!asset?.uri) {
        Alert.alert('No se guardó la foto', 'La cámara no devolvió ninguna imagen. Inténtalo de nuevo.');
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
      Alert.alert('No se pudo abrir la cámara', 'Cierra otras apps que la estén usando e inténtalo de nuevo.');
    }
  }, [addAttachments]);

  /** Galería. Selección múltiple, limitada al cupo que aún queda libre. */
  const addFromLibrary = useCallback(async () => {
    if (!(await ensurePermission('library'))) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        // `allowsEditing` es incompatible con la selección múltiple.
        allowsMultipleSelection: true,
        selectionLimit: MAX_ATTACHMENTS,
        quality: 0.7,
        exif: false,
      });

      if (result.canceled) return;

      const assets = (result.assets ?? []).filter((asset) => Boolean(asset.uri));
      if (assets.length === 0) {
        Alert.alert('Sin imágenes', 'No se pudo leer la selección. Inténtalo de nuevo.');
        return;
      }

      const accepted = addAttachments(
        assets.map((asset, index) => ({
          kind: 'image' as const,
          uri: asset.uri,
          name: asset.fileName || `Imagen ${index + 1}.${imageExtensionFromMime(asset.mimeType)}`,
          mimeType: asset.mimeType,
          size: asset.fileSize,
        })),
      );
      warnIfTrimmed(assets.length, accepted);
    } catch (error) {
      console.log('Error abriendo la galería:', error);
      Alert.alert('No se pudieron abrir tus fotos', 'Inténtalo de nuevo.');
    }
  }, [addAttachments]);

  /**
   * Documentos. Solo PDF y documentos de texto mientras la IA no soporte más
   * formatos: se filtra el selector y se revisa lo que devuelve, porque en
   * Android el filtro de MIME es una sugerencia, no una garantía.
   */
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
        Alert.alert(
          'Formato no soportado todavía',
          `Por ahora Foxy solo lee ${ALLOWED_DOCUMENTS_LABEL}.\n\nSe omitió: ${rejectedType.join(', ')}`,
        );
      } else if (rejectedSize.length > 0) {
        Alert.alert(
          'Archivo demasiado grande',
          `El límite es ${formatBytes(MAX_FILE_BYTES)} por archivo.\n\nSe omitió: ${rejectedSize.join(', ')}`,
        );
      } else {
        warnIfTrimmed(valid.length, accepted);
      }
    } catch (error) {
      console.log('Error abriendo el selector de archivos:', error);
      Alert.alert('No se pudo abrir el archivo', 'Inténtalo de nuevo.');
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

/**
 * Selector de una sola imagen con recorte cuadrado, para la foto de perfil.
 * Vive aquí porque comparte el manejo de permisos con los adjuntos del chat.
 */
export async function pickSingleImage(source: 'camera' | 'library'): Promise<string | null> {
  if (!(await ensurePermission(source === 'camera' ? 'camera' : 'library'))) return null;

  try {
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
      exif: false,
      // El recorte circular solo existe en Android; en iOS ya es cuadrado.
      ...(Platform.OS === 'android' ? { shape: 'oval' as const } : {}),
    };

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);

    if (result.canceled) return null;
    return result.assets?.[0]?.uri ?? null;
  } catch (error) {
    console.log('Error eligiendo la foto de perfil:', error);
    Alert.alert('No se pudo cambiar tu foto', 'Inténtalo de nuevo.');
    return null;
  }
}

/** Etiqueta corta bajo el nombre del adjunto: "PDF · 1.2 MB". */
export function describeAttachment(attachment: Attachment): string {
  const extension = getExtension(attachment.name).toUpperCase();
  const size = formatBytes(attachment.size);
  return [extension || (attachment.kind === 'image' ? 'IMG' : 'DOC'), size].filter(Boolean).join(' · ');
}
