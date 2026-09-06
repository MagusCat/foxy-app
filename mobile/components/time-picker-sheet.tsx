import React, { useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { WheelHighlight, WheelPicker } from '@/components/wheel-picker';
import { Palette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { AppModal, SheetSlide } from '@/features/shared/components/portal';
import { useSheetPaddingBottom } from '@/hooks/use-sheet-padding';
import {
  HOUR_OPTIONS,
  MERIDIEM_OPTIONS,
  MINUTE_OPTIONS,
  parseTime,
  toTimeString,
  type Meridiem,
} from '@/lib/time';

type TimePickerSheetProps = {
  visible: boolean;
  title: string;
  description?: string;
  value: string;
  onCancel: () => void;
  onSave: (value: string) => void;
};

export function TimePickerSheet({
  visible,
  title,
  description,
  value,
  onCancel,
  onSave,
}: TimePickerSheetProps) {
  const { colors } = useTheme();
  const sheetPaddingBottom = useSheetPaddingBottom();

  const [hour, setHour] = useState('6');
  const [minute, setMinute] = useState('00');
  const [meridiem, setMeridiem] = useState<Meridiem>('p. m.');

  useEffect(() => {
    if (!visible) return;
    const parsed = parseTime(value);
    setHour(parsed.hour);
    setMinute(parsed.minute);
    setMeridiem(parsed.meridiem);
  }, [visible, value]);

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

          <View className="my-2 items-center">
            <View className="relative flex-row items-center justify-center">
              <WheelHighlight />

              <WheelPicker
                options={HOUR_OPTIONS}
                value={hour}
                onChange={setHour}
                accessibilityLabel="Hora"
              />
              <Text className="px-1 text-[24px] font-bold text-text-primary-light dark:text-text-primary-dark">
                :
              </Text>
              <WheelPicker
                options={MINUTE_OPTIONS}
                value={minute}
                onChange={setMinute}
                accessibilityLabel="Minutos"
              />
              <WheelPicker
                options={MERIDIEM_OPTIONS}
                value={meridiem}
                onChange={(next) => setMeridiem(next as Meridiem)}
                width={96}
                accessibilityLabel="Antes o después del mediodía"
              />
            </View>
          </View>

          <TouchableOpacity
            className="mt-2 items-center rounded-[18px] py-4"
            style={{ backgroundColor: Palette.primary }}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Guardar la hora"
            onPress={() => onSave(toTimeString(hour, minute, meridiem))}
          >
            <Text className="text-[15px] font-bold text-white">Guardar</Text>
          </TouchableOpacity>
          </View>
        </SheetSlide>
      </View>
    </AppModal>
  );
}
