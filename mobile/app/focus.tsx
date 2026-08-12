import React, { useCallback } from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { Card, ChipGroup, Note, ScreenShell, SectionTitle, softTint } from '@/components/settings-ui';
import { getSubjectAccent } from '@/constants/subject-colors';
import { Palette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { useDailyStreak } from '@/hooks/use-daily-streak';
import { formatClock, useFocusSession } from '@/hooks/use-focus-session';
import { useDailyGoal } from '@/hooks/use-learning-prefs';
import { usePersistentState } from '@/hooks/use-persistent-state';
import { formatMinutes, useStudyActivity } from '@/hooks/use-study-activity';

const DURATIONS = [
  { value: '15', label: '15 min' },
  { value: '25', label: '25 min' },
  { value: '45', label: '45 min' },
  { value: '60', label: '60 min' },
];

export default function FocusScreen() {
  const { isDark, colors } = useTheme();
  const { logSession, stats } = useStudyActivity();
  const [, , markStudied] = useDailyStreak();
  const goal = useDailyGoal();

  const [subjects] = usePersistentState<string[]>('foxy:subjects', ['Matemáticas']);
  const [selectedSubject, setSelectedSubject] = usePersistentState('foxy:selected-subject', 'Matemáticas');

  const { session, secondsLeft, isRunning, start, pause, reset, setMinutes } = useFocusSession();
  const minutes = session.minutes;
  const remaining = secondsLeft;

  const accent = getSubjectAccent(selectedSubject, isDark);

  /**
   * Guardar a mano lo que llevas al terminar antes de tiempo. Llegar a cero
   * no pasa por aquí: de eso se encarga `FocusCompletionWatcher` en la raíz,
   * para que la sesión se cierre igual aunque estés en otra pantalla.
   */
  const finishEarly = useCallback(
    (completedMinutes: number) => {
      reset();

      if (completedMinutes < 1) return;

      markStudied();
      logSession({
        kind: 'lesson',
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

    Alert.alert(
      'Terminar antes',
      `Llevas ${done} ${done === 1 ? 'minuto' : 'minutos'}. ¿Los guardamos en tu actividad?`,
      [
        { text: 'Seguir estudiando', style: 'cancel' },
        { text: 'Descartar', style: 'destructive', onPress: reset },
        { text: 'Guardar', onPress: () => finishEarly(done) },
      ],
    );
  };

  const changeDuration = (value: string) => setMinutes(Number(value));

  // Se acota: un total de 0 daría Infinity y un ancho negativo rompe la barra.
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
          <ChipGroup
            options={DURATIONS}
            selected={`${minutes}`}
            onSelect={changeDuration}
            accent={accent.color}
          />
        </View>
      </Card>

      <SectionTitle>Materia</SectionTitle>
      <Card>
        <View className="p-3.5">
          <ChipGroup
            options={subjects.slice(0, 8).map((subject) => ({ value: subject, label: subject }))}
            selected={selectedSubject}
            onSelect={setSelectedSubject}
            accent={accent.color}
          />
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
    </ScreenShell>
  );
}
