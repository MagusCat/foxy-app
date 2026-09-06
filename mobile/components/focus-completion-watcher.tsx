import { useEffect } from 'react';
import * as Haptics from 'expo-haptics';

import { appAlert } from '@/features/shared/components/overlay';
import { useDailyStreak } from '@/hooks/use-daily-streak';
import { useFocusSession } from '@/hooks/use-focus-session';
import { usePersistentState } from '@/hooks/use-persistent-state';
import { useStudyActivity } from '@/hooks/use-study-activity';

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
      kind: 'focus',
      subject: selectedSubject,
      title: `Sesión de enfoque de ${finished} min`,
      minutes: finished,
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    appAlert(
      '¡Sesión completada! 🎉',
      `${finished} minutos de ${selectedSubject} sumados a tu actividad de hoy.`,
    );
  }, [hydrated, finished, clearFinished, logSession, markStudied, selectedSubject]);

  return null;
}
