import React, { useCallback, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { Card, ChipGroup, Note, ScreenShell, SectionTitle, softTint } from '@/components/settings-ui';
import { WheelHighlight, WheelPicker } from '@/components/wheel-picker';
import { getSubjectAccent } from '@/constants/subject-colors';
import { Palette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { appAlert } from '@/features/shared/components/overlay';
import { AppModal, SheetSlide } from '@/features/shared/components/portal';
import { useDailyStreak } from '@/hooks/use-daily-streak';
import { formatClock, useFocusSession } from '@/hooks/use-focus-session';
import { useDailyGoal } from '@/hooks/use-learning-prefs';
import { usePersistentState } from '@/hooks/use-persistent-state';
import { useSheetPaddingBottom } from '@/hooks/use-sheet-padding';
import { formatMinutes, useStudyActivity } from '@/hooks/use-study-activity';

const PRESETS = [15, 25, 45, 60];

const CUSTOM_MINUTES = Array.from({ length: 24 }, (_, index) => `${(index + 1) * 5}`);

export default function FocusScreen() {
  const { isDark, colors } = useTheme();
  const { logSession, stats } = useStudyActivity();
  const [, , markStudied] = useDailyStreak();
  const goal = useDailyGoal();
  const sheetPaddingBottom = useSheetPaddingBottom();

  const [subjects] = usePersistentState<string[]>('foxy:subjects', ['Matemáticas']);
  const [selectedSubject, setSelectedSubject] = usePersistentState('foxy:selected-subject', 'Matemáticas');

  const { session, secondsLeft, isRunning, start, pause, reset, setMinutes } = useFocusSession();
  const minutes = session.minutes;
  const remaining = secondsLeft;

  const [isCustomVisible, setCustomVisible] = useState(false);
  const [customDraft, setCustomDraft] = useState(`${minutes}`);

  const accent = getSubjectAccent(selectedSubject, isDark);
  const isPreset = PRESETS.includes(minutes);

  const finishEarly = useCallback(
    (completedMinutes: number) => {
      reset();

      if (completedMinutes < 1) return;

      markStudied();
      logSession({
        kind: 'focus',
        subject: selectedSubject,
        title: `Sesión de enfoque de ${completedMinutes} min`,
        minutes: completedMinutes,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    },
    [logSession, markStudied, reset, selectedSubject],
  );

  const handleStart = () => {
    start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const stopEarly = () => {
    const done = Math.floor((minutes * 60 - remaining) / 60);
    if (done < 1) {
      reset();
      return;
    }

    appAlert(
      'Terminar antes',
      `Llevas ${done} ${done === 1 ? 'minuto' : 'minutos'}. ¿Los guardamos en tu actividad?`,
      [
        { text: 'Seguir estudiando', style: 'cancel' },
        { text: 'Descartar', style: 'destructive', onPress: reset },
        { text: 'Guardar', onPress: () => finishEarly(done) },
      ],
    );
  };

  const openCustom = () => {
    setCustomDraft(`${minutes}`);
    setCustomVisible(true);
  };

  const elapsedRatio = minutes > 0 ? Math.min(Math.max(1 - remaining / (minutes * 60), 0), 1) : 0;

  return (
    <ScreenShell title="Modo enfoque" subtitle="Estudia sin distracciones y suma minutos reales">
      <View
        className="mt-2 items-center rounded-[24px] border p-6"
        style={{ backgroundColor: softTint(accent.color, isDark), borderColor: accent.color }}
      >
        <Text className="text-[11px] font-bold uppercase tracking-wider" style={{ color: accent.color }}>
          {isRunning ? 'Concentrado en' : 'Listo para'}
        </Text>
        <Text className="mt-1 text-[15px] font-semibold text-text-primary-light dark:text-text-primary-dark">
          {selectedSubject}
        </Text>

        <Text
          className="my-4 font-bold text-text-primary-light dark:text-text-primary-dark"
          style={{ fontSize: 64, fontVariant: ['tabular-nums'] }}
        >
          {formatClock(remaining)}
        </Text>

        <View className="h-2 w-full overflow-hidden rounded-full" style={{ backgroundColor: colors.card }}>
          <View
            className="h-full rounded-full"
            style={{ width: `${Math.round(elapsedRatio * 100)}%`, backgroundColor: accent.color }}
          />
        </View>

        <View className="mt-5 w-full flex-row gap-2.5">
          <TouchableOpacity
            className="flex-1 flex-row items-center justify-center rounded-[16px] py-3.5"
            style={{ backgroundColor: accent.color }}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={isRunning ? 'Pausar' : 'Empezar'}
            onPress={isRunning ? pause : handleStart}
          >
            <Ionicons
              name={isRunning ? 'pause' : 'play'}
              size={17}
              color="#FFFFFF"
              style={{ marginRight: 6 }}
            />
            <Text className="text-sm font-bold text-white">{isRunning ? 'Pausar' : 'Empezar'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="h-[46px] w-[46px] items-center justify-center rounded-[16px] border"
            style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Terminar sesión"
            onPress={stopEarly}
          >
            <Ionicons name="stop" size={17} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <SectionTitle>Duración</SectionTitle>
      <Card>
        <View className="p-3.5">
          <View className="flex-row flex-wrap gap-2">
            {PRESETS.map((preset) => {
              const isSelected = minutes === preset;
              return (
                <TouchableOpacity
                  key={preset}
                  className="rounded-2xl border-[1.5px] px-3.5 py-2"
                  style={{
                    borderColor: isSelected ? accent.color : colors.cardBorder,
                    backgroundColor: isSelected ? softTint(accent.color, isDark) : colors.card,
                  }}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => setMinutes(preset)}
                >
                  <Text
                    className="text-[13px] font-semibold text-text-secondary-light dark:text-text-secondary-dark"
                    style={isSelected ? { color: accent.color, fontWeight: '700' } : undefined}
                  >
                    {preset} min
                  </Text>
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              className="flex-row items-center rounded-2xl border-[1.5px] px-3.5 py-2"
              style={{
                borderColor: isPreset ? colors.cardBorder : accent.color,
                backgroundColor: isPreset ? colors.card : softTint(accent.color, isDark),
              }}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityState={{ selected: !isPreset }}
              accessibilityLabel="Elegir una duración personalizada"
              onPress={openCustom}
            >
              <Ionicons
                name="options-outline"
                size={14}
                color={isPreset ? colors.icon : accent.color}
                style={{ marginRight: 5 }}
              />
              <Text
                className="text-[13px] font-semibold text-text-secondary-light dark:text-text-secondary-dark"
                style={isPreset ? undefined : { color: accent.color, fontWeight: '700' }}
              >
                {isPreset ? 'Personalizado' : `${minutes} min`}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Card>

      <SectionTitle>Materia</SectionTitle>
      <Card>
        <View className="p-3.5">
          {subjects.length === 0 ? (
            <Text className="text-[13px] text-text-secondary-light dark:text-text-secondary-dark">
              Todavía no tienes materias. Márcalas en Mi cuenta.
            </Text>
          ) : (
            <ChipGroup
              options={subjects.map((subject) => ({ value: subject, label: subject }))}
              selected={selectedSubject}
              onSelect={setSelectedSubject}
              accent={accent.color}
            />
          )}
        </View>
      </Card>

      <SectionTitle>Tu meta de hoy</SectionTitle>
      <Card>
        <View className="p-4">
          <View className="mb-2 flex-row items-center justify-between">
            <Text className="text-[13px] font-semibold text-text-primary-light dark:text-text-primary-dark">
              {goal.met ? '¡Meta cumplida! 🎉' : `Te faltan ${formatMinutes(goal.remaining)}`}
            </Text>
            <Text className="text-[13px] font-bold" style={{ color: Palette.flameOrange }}>
              {goal.done} / {goal.goal} min
            </Text>
          </View>
          <View className="h-2 overflow-hidden rounded-full" style={{ backgroundColor: colors.surface }}>
            <View
              className="h-full rounded-full"
              style={{
                width: `${Math.round(goal.ratio * 100)}%`,
                backgroundColor: goal.met ? '#10B981' : Palette.flameOrange,
              }}
            />
          </View>
          <Text className="mt-2 text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
            Llevas {formatMinutes(stats.weekMinutes)} esta semana. La meta se cambia en Preferencias de
            aprendizaje.
          </Text>
        </View>
      </Card>

      <Note icon="phone-portrait-outline">
        Deja el teléfono a un lado: el temporizador sigue contando aunque vuelvas a Inicio o cierres
        la app, y al terminar suma los minutos a tu actividad y a tu racha.
      </Note>

      <AppModal visible={isCustomVisible} onRequestClose={() => setCustomVisible(false)}>
        <View className="flex-1 justify-end bg-black/45 dark:bg-black/75">
          <TouchableOpacity
            className="flex-1"
            activeOpacity={1}
            onPress={() => setCustomVisible(false)}
          />

          <SheetSlide>
            <View
              className="rounded-t-[26px] px-[18px] pt-[18px]"
              style={{ backgroundColor: colors.card, paddingBottom: sheetPaddingBottom }}
            >
            <View className="mb-1 flex-row items-center">
              <View className="h-[34px] w-[34px]" />
              <Text className="flex-1 text-center text-[17px] font-bold text-text-primary-light dark:text-text-primary-dark">
                Duración personalizada
              </Text>
              <TouchableOpacity
                className="h-[34px] w-[34px] items-center justify-center rounded-full"
                style={{ backgroundColor: colors.surface }}
                accessibilityRole="button"
                accessibilityLabel="Cerrar"
                onPress={() => setCustomVisible(false)}
              >
                <Ionicons name="close" size={18} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View className="my-2 items-center">
              <View className="relative flex-row items-center justify-center">
                <WheelHighlight />
                <WheelPicker
                  options={CUSTOM_MINUTES}
                  value={customDraft}
                  onChange={setCustomDraft}
                  width={92}
                  accessibilityLabel="Minutos de la sesión"
                />
                <Text className="ml-2 text-[17px] font-semibold text-text-secondary-light dark:text-text-secondary-dark">
                  minutos
                </Text>
              </View>
            </View>

            <TouchableOpacity
              className="mt-2 items-center rounded-[18px] py-4"
              style={{ backgroundColor: accent.color }}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Usar esta duración"
              onPress={() => {
                setMinutes(Number(customDraft));
                setCustomVisible(false);
              }}
            >
              <Text className="text-[15px] font-bold text-white">Usar {customDraft} minutos</Text>
            </TouchableOpacity>
            </View>
          </SheetSlide>
        </View>
      </AppModal>
    </ScreenShell>
  );
}
