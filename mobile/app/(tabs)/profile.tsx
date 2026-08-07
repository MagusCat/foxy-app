import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Palette } from '@/constants/theme';
import { ThemePreference, useTheme } from '@/contexts/theme-context';
import { useKeyboardHeight } from '@/hooks/use-keyboard-height';
import { usePersistentState, clearPersistedState, STORAGE_KEYS } from '@/hooks/use-persistent-state';
import { useDailyStreak } from '@/hooks/use-daily-streak';

const THEME_OPTIONS: {
  value: ThemePreference;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { value: 'system', label: 'Sistema', icon: 'phone-portrait-outline' },
  { value: 'light', label: 'Claro', icon: 'sunny-outline' },
  { value: 'dark', label: 'Oscuro', icon: 'moon-outline' },
];

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const { preference, setPreference, isDark, colors } = useTheme();
  const accent = isDark ? Palette.primaryGlow : Palette.primary;

  const [userName, setUserName] = usePersistentState('foxy:user-name', 'Usuario');
  const [school] = usePersistentState('foxy:school', '');
  const [subjects] = usePersistentState<string[]>('foxy:subjects', []);
  const [streakCount] = useDailyStreak();

  const [isNameModalVisible, setNameModalVisible] = useState(false);
  const [nameInput, setNameInput] = useState('');

  const openNameModal = () => {
    setNameInput(userName);
    setNameModalVisible(true);
  };

  const handleSaveName = () => {
    const trimmed = nameInput.trim();
    if (!trimmed) {
      Alert.alert('Campo vacío', 'Escribe cómo quieres que Foxy te llame.');
      return;
    }
    setUserName(trimmed);
    setNameModalVisible(false);
  };

  const handleResetData = () => {
    Alert.alert(
      'Borrar mis datos',
      'Se eliminarán tus materias, salones, exámenes, escuela y preferencias guardadas en este dispositivo. No se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar todo',
          style: 'destructive',
          onPress: async () => {
            await clearPersistedState(STORAGE_KEYS);
            Alert.alert(
              'Datos borrados',
              'Cierra y vuelve a abrir la app para empezar desde cero.',
            );
          },
        },
      ],
    );
  };

  return (
    <View className="flex-1 bg-bg-light dark:bg-bg-dark">
      <ScrollView
        className="px-6"
        contentContainerStyle={{
          paddingTop: Math.max(insets.top, 16),
          paddingBottom: insets.bottom + 100,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-[26px] font-bold text-text-primary-light dark:text-text-primary-dark">
          Mi Perfil
        </Text>

        {/* TARJETA DE USUARIO */}
        <View
          className="mt-5 flex-row items-center rounded-2xl border p-4"
          style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}
        >
          <View
            className="h-14 w-14 items-center justify-center rounded-full"
            style={{ backgroundColor: isDark ? '#2D1B22' : '#FEE2E2' }}
          >
            <Text className="text-xl font-bold" style={{ color: accent }}>
              {userName.charAt(0).toUpperCase()}
            </Text>
          </View>

          <View className="ml-3 flex-1">
            <Text
              className="text-base font-bold text-text-primary-light dark:text-text-primary-dark"
              numberOfLines={1}
            >
              {userName}
            </Text>
            <Text
              className="mt-0.5 text-xs text-text-secondary-light dark:text-text-secondary-dark"
              numberOfLines={1}
            >
              {school || 'Sin escuela asignada'}
            </Text>
          </View>

          <TouchableOpacity
            className="h-9 w-9 items-center justify-center rounded-full"
            style={{ backgroundColor: colors.surface }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Editar mi nombre"
            onPress={openNameModal}
          >
            <Ionicons name="pencil-outline" size={16} color={colors.icon} />
          </TouchableOpacity>
        </View>

        {/* RESUMEN */}
        <View className="mt-3 flex-row gap-3">
          {[
            { icon: 'flame' as const, value: streakCount, label: 'días seguidos', color: Palette.flameOrange },
            { icon: 'book-outline' as const, value: subjects.length, label: 'materias', color: Palette.accentBlue },
          ].map((stat) => (
            <View
              key={stat.label}
              className="flex-1 items-center rounded-2xl border py-3"
              style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}
            >
              <Ionicons name={stat.icon} size={18} color={stat.color} />
              <Text className="mt-1 text-lg font-bold text-text-primary-light dark:text-text-primary-dark">
                {stat.value}
              </Text>
              <Text className="text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
                {stat.label}
              </Text>
            </View>
          ))}
        </View>

        {/* APARIENCIA */}
        <View
          className="mt-3 flex-row items-center justify-between rounded-2xl border p-3"
          style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}
        >
          <Text className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
            Apariencia
          </Text>

          <View
            className="flex-row items-center gap-1 rounded-full p-1"
            style={{ backgroundColor: colors.surface }}
          >
            {THEME_OPTIONS.map((option) => {
              const isSelected = preference === option.value;

              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="button"
                  accessibilityLabel={`Tema ${option.label}`}
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => setPreference(option.value)}
                  className="h-8 w-8 items-center justify-center rounded-full"
                  style={{ backgroundColor: isSelected ? accent : 'transparent' }}
                >
                  <Ionicons
                    name={option.icon}
                    size={16}
                    color={isSelected ? '#FFFFFF' : colors.icon}
                  />
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ZONA PELIGROSA */}
        <TouchableOpacity
          className="mt-3 flex-row items-center rounded-2xl border p-4"
          style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Borrar mis datos"
          onPress={handleResetData}
        >
          <Ionicons name="trash-outline" size={18} color="#EF4444" />
          <View className="ml-3 flex-1">
            <Text className="text-sm font-semibold" style={{ color: '#EF4444' }}>
              Borrar mis datos
            </Text>
            <Text className="mt-0.5 text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
              Elimina todo lo guardado en este dispositivo
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#6B7280" />
        </TouchableOpacity>
      </ScrollView>

      {/* MODAL: EDITAR NOMBRE */}
      <Modal
        visible={isNameModalVisible}
        transparent
        statusBarTranslucent
        navigationBarTranslucent
        animationType="fade"
        onRequestClose={() => setNameModalVisible(false)}
      >
        <View
          className="flex-1 items-center justify-center bg-black/55 px-6 dark:bg-black/80"
          style={{ paddingBottom: keyboardHeight }}
        >
          <View
            className="w-full rounded-[22px] border border-[#E5E7EB] bg-white p-5 dark:border-[#342F42] dark:bg-[#1C1924]"
            style={{ elevation: 10 }}
          >
            <Text className="mb-1 text-lg font-bold text-text-primary-light dark:text-text-primary-dark">
              ¿Cómo te llamas?
            </Text>
            <Text className="mb-3.5 text-xs text-text-secondary-light dark:text-text-secondary-dark">
              Así te saludará Foxy.
            </Text>
            <TextInput
              className="mb-[18px] rounded-[14px] border border-[#E5E7EB] bg-[#F9FAFB] px-3.5 py-2.5 text-sm text-text-primary-light dark:border-[#2D2838] dark:bg-[#14121A] dark:text-text-primary-dark"
              placeholder="Tu nombre"
              placeholderTextColor="#6B7280"
              value={nameInput}
              onChangeText={setNameInput}
              autoFocus
              maxLength={24}
              returnKeyType="done"
              onSubmitEditing={handleSaveName}
            />
            <View className="flex-row justify-end gap-2.5">
              <TouchableOpacity
                className="rounded-2xl px-4 py-2"
                onPress={() => setNameModalVisible(false)}
              >
                <Text className="text-sm font-semibold text-text-secondary-light dark:text-text-secondary-dark">
                  Cancelar
                </Text>
              </TouchableOpacity>
              <TouchableOpacity className="rounded-2xl bg-primary px-5 py-2" onPress={handleSaveName}>
                <Text className="text-sm font-semibold text-white">Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
