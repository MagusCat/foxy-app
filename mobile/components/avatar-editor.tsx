import React, { useState } from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';

import { Palette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { pickSingleImage } from '@/hooks/use-attachments';
import { usePersistentState } from '@/hooks/use-persistent-state';
import { useSheetPaddingBottom } from '@/hooks/use-sheet-padding';

type AvatarEditorProps = {
  name: string;
  size?: number;
  editable?: boolean;
};

export function AvatarEditor({ name, size = 64, editable = true }: AvatarEditorProps) {
  const { isDark, colors } = useTheme();
  const sheetPaddingBottom = useSheetPaddingBottom();

  const [avatarUri, setAvatarUri] = usePersistentState('foxy:avatar', '');
  const [isSheetVisible, setSheetVisible] = useState(false);

  const accent = isDark ? Palette.primaryGlow : Palette.primary;
  const initial = name.trim().charAt(0).toUpperCase() || 'F';

  const choose = async (source: 'camera' | 'library') => {
    setSheetVisible(false);
    setTimeout(async () => {
      const uri = await pickSingleImage(source);
      if (uri) setAvatarUri(uri);
    }, 260);
  };

  const options: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    danger?: boolean;
    onPress: () => void;
  }[] = [
    { icon: 'camera-outline', label: 'Tomar una foto', onPress: () => choose('camera') },
    { icon: 'images-outline', label: 'Elegir de la galería', onPress: () => choose('library') },
    ...(avatarUri
      ? [
          {
            icon: 'trash-outline' as const,
            label: 'Quitar foto',
            danger: true,
            onPress: () => {
              setAvatarUri('');
              setSheetVisible(false);
            },
          },
        ]
      : []),
  ];

  return (
    <>
      <TouchableOpacity
        activeOpacity={editable ? 0.8 : 1}
        disabled={!editable}
        accessibilityRole={editable ? 'button' : 'image'}
        accessibilityLabel={editable ? 'Cambiar mi foto de perfil' : `Foto de ${name}`}
        onPress={() => setSheetVisible(true)}
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

      <Modal
        visible={isSheetVisible}
        transparent
        statusBarTranslucent
        navigationBarTranslucent
        animationType="slide"
        onRequestClose={() => setSheetVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/45 dark:bg-black/75">
          <TouchableOpacity className="flex-1" activeOpacity={1} onPress={() => setSheetVisible(false)} />

          <View
            className="rounded-t-[26px] bg-white px-[18px] pt-[18px] dark:bg-[#16141D]"
            style={{ paddingBottom: sheetPaddingBottom }}
          >
            <View className="mb-3.5 flex-row items-center justify-between">
              <Text className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark">
                Foto de perfil
              </Text>
              <TouchableOpacity
                className="h-[30px] w-[30px] items-center justify-center rounded-full bg-[#F3F4F6] dark:bg-[#2A2533]"
                accessibilityRole="button"
                accessibilityLabel="Cerrar"
                onPress={() => setSheetVisible(false)}
              >
                <Ionicons name="close" size={18} color={colors.text} />
              </TouchableOpacity>
            </View>

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
          </View>
        </View>
      </Modal>
    </>
  );
}
