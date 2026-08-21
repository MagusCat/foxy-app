import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Palette } from '@/constants/theme';
import { useGuardedRouter } from '@/features/shared/hooks/use-guarded-router';
import { useDailyGoal } from '@/hooks/use-learning-prefs';
import { formatClock, useFocusSession } from '@/hooks/use-focus-session';
import { useDailyStreak } from '@/hooks/use-daily-streak';
import { useSubscription } from '@/hooks/use-subscription';

export function useScreenPadding() {
  const insets = useSafeAreaInsets();

  return {
    top: Math.max(insets.top, 12) + 8,
    tabBottom: insets.bottom + 100,
    stackBottom: insets.bottom + 32,
  };
}

type TabHeaderProps = {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
};

const PILL = 'h-9 flex-row items-center rounded-full border border-card-light-border bg-surface-light px-3 dark:border-surface-dark-border dark:bg-surface-dark';

export function AppHeader() {
  const padding = useScreenPadding();
  const router = useGuardedRouter();
  const [streakCount] = useDailyStreak();
  const { plan } = useSubscription();
  const focus = useFocusSession();
  const goal = useDailyGoal();

  return (
    <View className="flex-row items-center px-5" style={{ paddingTop: padding.top, paddingBottom: 16 }}>
      <View className="flex-1 items-start">
        <TouchableOpacity
          className={PILL}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`Racha de ${streakCount} ${streakCount === 1 ? 'día' : 'días'}. Ver mi actividad`}
          onPress={() => router.push('/activity')}
        >
          <Ionicons name="flame" size={17} color={Palette.flameOrange} />
          <Text className="ml-1 text-[14px] font-bold text-text-primary-light dark:text-text-primary-dark">
            {streakCount}
          </Text>
        </TouchableOpacity>
      </View>

      <View className="flex-1 items-center">
        {focus.isRunning ? (
          <TouchableOpacity
            className={PILL}
            style={{ borderColor: Palette.flameOrange }}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Modo enfoque en curso, quedan ${formatClock(focus.secondsLeft)}. Volver al temporizador`}
            onPress={() => router.push('/focus')}
          >
            <Ionicons name="timer-outline" size={14} color={Palette.flameOrange} />
            <Text
              className="ml-1.5 text-[13px] font-bold"
              style={{ color: Palette.flameOrange, fontVariant: ['tabular-nums'] }}
            >
              {formatClock(focus.secondsLeft)}
            </Text>
          </TouchableOpacity>
        ) : goal.showInHeader ? (
          goal.met ? (
            <TouchableOpacity
              className={PILL}
              style={{ paddingHorizontal: 10 }}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="¡Meta de hoy cumplida! Ver modo enfoque"
              onPress={() => router.push('/focus')}
            >
              <Ionicons name="checkmark-circle" size={17} color="#10B981" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              className={PILL}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`Meta de hoy: ${goal.done} de ${goal.goal} minutos. Abrir modo enfoque`}
              onPress={() => router.push('/focus')}
            >
              <Ionicons name="timer-outline" size={14} color={Palette.flameOrange} />
              <Text className="ml-1.5 text-[13px] font-bold" style={{ color: Palette.flameOrange }}>
                {goal.done}/{goal.goal}
              </Text>
            </TouchableOpacity>
          )
        ) : null}
      </View>

      <View className="flex-1 items-end">
        <TouchableOpacity
          className={`${PILL} shrink`}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`${plan.name}. Ver planes`}
          onPress={() => router.push('/subscription')}
        >
          <Ionicons name={plan.icon} size={14} color={plan.color} />
          <Text
            className="ml-1.5 shrink text-[13px] font-semibold text-text-primary-light dark:text-text-primary-dark"
            numberOfLines={1}
          >
            {plan.shortName}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function TabHeader({ title, subtitle, right }: TabHeaderProps) {
  return (
    <View className="mb-5 flex-row items-center justify-between">
      <View className="flex-1 pr-3">
        <Text className="text-[26px] font-bold text-text-primary-light dark:text-text-primary-dark">
          {title}
        </Text>
        {subtitle ? (
          <Text className="mt-1 text-[13px] text-text-secondary-light dark:text-text-secondary-dark">
            {subtitle}
          </Text>
        ) : null}
      </View>

      {right}
    </View>
  );
}
