import { useEffect } from 'react';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';

import { useDailyStreak } from '@/hooks/use-daily-streak';
import { useFocusSession } from '@/hooks/use-focus-session';
import { usePersistentState } from '@/hooks/use-persistent-state';
import { useStudyActivity } from '@/hooks/use-study-activity';

/**
 * Apunta en la actividad las sesiones de enfoque que llegaron a cero.
 *
 * Vive en el layout raíz y solo aquí: el hook del temporizador se monta en
 * varias pantallas a la vez, así que si cada una registrara la sesión, los
 * minutos se contarían varias veces. El temporizador solo marca "terminada" y
 * este vigilante es el único que la consume.
 */
export function FocusCompletionWatcher() {
  const { session, hydrated, clearFinished } = useFocusSession();
  const { logSession } = useStudyActivity();
  const [, , markStudied] = useDailyStreak();
  const [selectedSubject] = usePersistentState('foxy:selected-subject', 'Matemáticas');

  const finished = session.finished;

  useEffect(() => {
    if (!hydrated || !finished) return;

    clearFinished();
    markStudied();
    logSession({
      kind: 'lesson',
      subject: selectedSubject,
      title: `Sesión de enfoque de ${finished} min`,
      minutes: finished,
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Alert.alert(
      '¡Sesión completada! 🎉',
      `${finished} minutos de ${selectedSubject} sumados a tu actividad de hoy.`,
    );
  }, [hydrated, finished, clearFinished, logSession, markStudied, selectedSubject]);

  return null;
}
