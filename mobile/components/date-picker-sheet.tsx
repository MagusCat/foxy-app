import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { MonthCalendar } from '@/components/month-calendar';
import { Palette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { AppModal, SheetSlide } from '@/features/shared/components/portal';
import { useSheetPaddingBottom } from '@/hooks/use-sheet-padding';

type DatePickerSheetProps = {
  visible: boolean;
  title: string;
  description?: string;
  value: string;
  onCancel: () => void;
  onSelect: (day: string) => void;
};

export function DatePickerSheet({
  visible,
  title,
  description,
  value,
  onCancel,
  onSelect,
}: DatePickerSheetProps) {
  const { colors } = useTheme();
  const sheetPaddingBottom = useSheetPaddingBottom();

  return (
    <AppModal visible={visible} onRequestClose={onCancel}>
      <View className="flex-1 justify-end bg-black/45 dark:bg-black/75">
        <TouchableOpacity className="flex-1" activeOpacity={1} onPress={onCancel} />

        <SheetSlide>
          <View
            className="rounded-t-[26px] px-[18px] pt-[18px]"
            style={{ backgroundColor: colors.card, paddingBottom: sheetPaddingBottom }}
          >
          <View className="mb-1 flex-row items-center">
            <View className="h-[34px] w-[34px]" />
            <Text className="flex-1 text-center text-[17px] font-bold text-text-primary-light dark:text-text-primary-dark">
              {title}
            </Text>
            <TouchableOpacity
              className="h-[34px] w-[34px] items-center justify-center rounded-full"
              style={{ backgroundColor: colors.surface }}
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
              onPress={onCancel}
            >
              <Ionicons name="close" size={18} color={colors.text} />
            </TouchableOpacity>
          </View>

          {description ? (
            <Text className="mb-2 text-center text-[12px] text-text-secondary-light dark:text-text-secondary-dark">
              {description}
            </Text>
          ) : null}

          {/* Solo fechas de hoy en adelante: disablePast bloquea los días previos. */}
          <MonthCalendar selectedDay={value} onSelectDay={(day) => onSelect(day)} disablePast />

          <TouchableOpacity
            className="mt-2 items-center rounded-[18px] py-4"
            style={{ backgroundColor: Palette.primary }}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Confirmar la fecha"
            onPress={onCancel}
          >
            <Text className="text-[15px] font-bold text-white">Listo</Text>
          </TouchableOpacity>
          </View>
        </SheetSlide>
      </View>
    </AppModal>
  );
}
