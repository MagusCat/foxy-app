import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';

import { Palette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { useOverlay } from '@/features/shared/components/overlay';
import { pickSingleImage } from '@/hooks/use-attachments';
import { usePersistentState } from '@/hooks/use-persistent-state';
import { deleteMedia, persistMedia } from '@/lib/media';

type AvatarEditorProps = {
  name: string;
  size?: number;
  editable?: boolean;
};

type AvatarOption = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  danger?: boolean;
  onPress: () => void;
};

/** Diámetro del círculo de la confirmación (doc Parte 9). */
const CONFIRM_PHOTO_SIZE = 190;

function ConfirmPhotoContent({
  uri,
  onUse,
  onAgain,
  onCancel,
}: {
  uri: string;
  onUse: () => void;
  onAgain: () => void;
  onCancel: () => void;
}) {
  const { colors, isDark } = useTheme();
  const accent = isDark ? Palette.primaryGlow : Palette.primary;

  return (
    <View className="items-center">
      <View
        className="mb-5 items-center justify-center overflow-hidden rounded-full border-[3px]"
        style={{ height: CONFIRM_PHOTO_SIZE, width: CONFIRM_PHOTO_SIZE, borderColor: accent }}
      >
        <Image source={{ uri }} style={{ height: '100%', width: '100%' }} contentFit="cover" transition={150} />
      </View>

      <TouchableOpacity
        className="mb-2.5 w-full items-center rounded-2xl py-3.5"
        style={{ backgroundColor: Palette.primary }}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Usar esta foto"
        onPress={onUse}
      >
        <Text className="text-[15px] font-bold text-white">Usar esta foto</Text>
      </TouchableOpacity>

      <TouchableOpacity
        className="mb-2.5 w-full items-center rounded-2xl border py-3.5"
        style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Elegir otra"
        onPress={onAgain}
      >
        <Text className="text-[14px] font-semibold text-text-primary-light dark:text-text-primary-dark">
          Elegir otra
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        className="w-full items-center rounded-2xl py-3.5"
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Cancelar"
        onPress={onCancel}
      >
        <Text className="text-[14px] font-semibold text-text-secondary-light dark:text-text-secondary-dark">
          Cancelar
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export function AvatarEditor({ name, size = 64, editable = true }: AvatarEditorProps) {
  const { isDark, colors } = useTheme();
  const { showSheet } = useOverlay();

  const [avatarUri, setAvatarUri] = usePersistentState('foxy:avatar', '');

  const accent = isDark ? Palette.primaryGlow : Palette.primary;
  const initial = name.trim().charAt(0).toUpperCase() || 'F';

  const openOptions = () => {
    showSheet({
      title: 'Foto de perfil',
      render: (close) => {
        const choose = (source: 'camera' | 'library') => {
          // La hoja se cierra antes de abrir el selector. Sin el `Modal` de
          // antes no hace falta esperar, y sin banderas tipo `isPicking`: si
          // el selector nunca resuelve, el botón del avatar sigue vivo.
          close();
          pickSingleImage(source).then((uri) => {
            if (!uri) return;

            // Se enseña la foto primero con la ruta del selector; solo se
            // copia a almacenamiento permanente al confirmar. Si la copia
            // falla, el usuario ya ve su foto en vez de quedarse sin señales.
            showSheet({
              render: (closeConfirm) => (
                <ConfirmPhotoContent
                  uri={uri}
                  onUse={() => {
                    const stored = persistMedia(uri, 'avatar');
                    setAvatarUri((previous) => {
                      if (previous && previous !== stored) deleteMedia(previous);
                      return stored;
                    });
                    closeConfirm();
                  }}
                  onAgain={() => {
                    closeConfirm();
                    openOptions();
                  }}
                  onCancel={closeConfirm}
                />
              ),
            });
          });
        };

        const options: AvatarOption[] = [
          { icon: 'camera-outline', label: 'Tomar una foto', onPress: () => choose('camera') },
          { icon: 'images-outline', label: 'Elegir de la galería', onPress: () => choose('library') },
          ...(avatarUri
            ? [
                {
                  icon: 'trash-outline' as const,
                  label: 'Quitar foto',
                  danger: true,
                  onPress: () => {
                    deleteMedia(avatarUri);
                    setAvatarUri('');
                    close();
                  },
                },
              ]
            : []),
        ];

        return (
          <>
            <View className="gap-2">
              {options.map((option) => (
                <TouchableOpacity
                  key={option.label}
                  className="flex-row items-center rounded-[16px] border px-3.5 py-3"
                  style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={option.label}
                  onPress={option.onPress}
                >
                  <Ionicons
                    name={option.icon}
                    size={19}
                    color={option.danger ? '#EF4444' : colors.text}
                    style={{ marginRight: 12 }}
                  />
                  <Text
                    className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark"
                    style={option.danger ? { color: '#EF4444' } : undefined}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text className="mt-3 px-1 text-[11px] leading-[16px] text-text-secondary-light dark:text-text-secondary-dark">
              Tu foto se queda en este dispositivo. Nadie más la ve mientras no exista la cuenta en
              línea.
            </Text>
          </>
        );
      },
    });
  };

  return (
    <TouchableOpacity
      activeOpacity={editable ? 0.8 : 1}
      disabled={!editable}
      accessibilityRole={editable ? 'button' : 'image'}
      accessibilityLabel={editable ? 'Cambiar mi foto de perfil' : `Foto de ${name}`}
      onPress={openOptions}
    >
      <View
        className="items-center justify-center overflow-hidden rounded-full"
        style={{
          height: size,
          width: size,
          backgroundColor: isDark ? '#2D1B22' : '#FEE2E2',
        }}
      >
        {avatarUri ? (
          <Image
            source={{ uri: avatarUri }}
            style={{ height: '100%', width: '100%' }}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <Text style={{ color: accent, fontSize: size * 0.38, fontWeight: '700' }}>{initial}</Text>
        )}
      </View>

      {editable ? (
        <View
          className="absolute bottom-0 right-0 items-center justify-center rounded-full border-2"
          style={{
            height: size * 0.34,
            width: size * 0.34,
            backgroundColor: accent,
            borderColor: colors.card,
          }}
        >
          <Ionicons name="camera" size={size * 0.17} color="#FFFFFF" />
        </View>
      ) : null}
    </TouchableOpacity>
  );
}