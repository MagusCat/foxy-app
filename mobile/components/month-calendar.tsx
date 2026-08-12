import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Palette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { buildMonthGrid, localDay, MONTH_NAMES, WEEKDAY_LABELS } from '@/hooks/use-agenda';

type MonthCalendarProps = {
  /** Día del examen: se marca con el birrete. */
  examDay?: string;
  /** Día elegido, cuando el calendario sirve para escoger fecha. */
  selectedDay?: string;
  onSelectDay?: (day: string) => void;
  /** Bloquea todo lo anterior a hoy (elegir la fecha del examen). */
  disablePast?: boolean;
  accent?: string;
};

export function MonthCalendar({
  examDay,
  selectedDay,
  onSelectDay,
  disablePast,
  accent = Palette.accentPurple,
}: MonthCalendarProps) {
  const { colors, isDark } = useTheme();
  const today = localDay(new Date());

  // El mes que se ve arranca en el del día elegido, no siempre en el actual.
  const anchor = new Date(`${selectedDay ?? examDay ?? today}T00:00:00`);
  const [cursor, setCursor] = useState({ year: anchor.getFullYear(), month: anchor.getMonth() });

  const cells = buildMonthGrid(cursor.year, cursor.month);

  const shiftMonth = (delta: number) => {
    setCursor((prev) => {
      const date = new Date(prev.year, prev.month + delta, 1);
      return { year: date.getFullYear(), month: date.getMonth() };
    });
  };

  return (
    <View>
      <View className="mb-3 flex-row items-center justify-between px-1">
        <TouchableOpacity
          className="h-8 w-8 items-center justify-center rounded-full"
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          accessibilityRole="button"
          accessibilityLabel="Mes anterior"
          onPress={() => shiftMonth(-1)}
        >
          <Ionicons name="chevron-back" size={17} color={colors.icon} />
        </TouchableOpacity>

        <Text className="text-[15px] font-bold text-text-primary-light dark:text-text-primary-dark">
          {MONTH_NAMES[cursor.month]} {cursor.year}
        </Text>

        <TouchableOpacity
          className="h-8 w-8 items-center justify-center rounded-full"
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          accessibilityRole="button"
          accessibilityLabel="Mes siguiente"
          onPress={() => shiftMonth(1)}
        >
          <Ionicons name="chevron-forward" size={17} color={colors.icon} />
        </TouchableOpacity>
      </View>

      <View className="flex-row">
        {WEEKDAY_LABELS.map((label, index) => (
          <View key={`${label}-${index}`} className="flex-1 items-center pb-1.5">
            <Text className="text-[11px] font-semibold text-text-secondary-light dark:text-text-secondary-dark">
              {label}
            </Text>
          </View>
        ))}
      </View>

      <View className="flex-row flex-wrap">
        {cells.map((cell) => {
          const isExam = cell.key === examDay;
          const isSelected = cell.key === selectedDay;
          const isPast = disablePast && cell.key < today;
          const disabled = !onSelectDay || isPast;

          return (
            <TouchableOpacity
              key={cell.key}
              className="h-11 items-center justify-center"
              style={{ width: `${100 / 7}%` }}
              activeOpacity={disabled ? 1 : 0.7}
              disabled={disabled}
              accessibilityRole={onSelectDay ? 'button' : 'text'}
              accessibilityLabel={`${cell.day} de ${MONTH_NAMES[cursor.month]}`}
              accessibilityState={{ selected: isSelected, disabled: Boolean(disabled) }}
              onPress={() => onSelectDay?.(cell.key)}
            >
              <View
                className="h-9 w-9 items-center justify-center rounded-full"
                style={{
                  backgroundColor: isExam
                    ? `${accent}${isDark ? '3A' : '26'}`
                    : isSelected
                      ? accent
                      : 'transparent',
                  borderWidth: cell.isToday && !isSelected ? 1.5 : 0,
                  borderColor: colors.text,
                }}
              >
                {isExam ? (
                  <Ionicons name="school" size={17} color={accent} />
                ) : (
                  <Text
                    className="text-[13px] font-medium"
                    style={{
                      color: isSelected
                        ? '#FFFFFF'
                        : cell.isOutside || isPast
                          ? colors.icon
                          : colors.text,
                      opacity: cell.isOutside || isPast ? 0.45 : 1,
                    }}
                  >
                    {cell.day}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
