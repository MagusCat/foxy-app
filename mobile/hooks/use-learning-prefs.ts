import { usePersistentState } from '@/hooks/use-persistent-state';
import { useStudyActivity } from '@/hooks/use-study-activity';

export type GoalPlacement = 'lista' | 'arriba' | 'oculta' | 'apagada';

export type LearningPrefs = {
  style: 'pasos' | 'directo' | 'ejemplos';
  level: 'basico' | 'intermedio' | 'avanzado';
  tone: 'amigable' | 'neutral' | 'motivador';
  language: 'es' | 'en';
  dailyGoal: number;
  goalPlacement: GoalPlacement;
  showFullSolution: boolean;
  extraPractice: boolean;
  focusMode: boolean;
};

export const DEFAULT_LEARNING_PREFS: LearningPrefs = {
  style: 'pasos',
  level: 'intermedio',
  tone: 'amigable',
  language: 'es',
  dailyGoal: 20,
  goalPlacement: 'lista',
  showFullSolution: true,
  extraPractice: true,
  focusMode: false,
};

export function useLearningPrefs() {
  return usePersistentState<LearningPrefs>('foxy:learning', DEFAULT_LEARNING_PREFS);
}

export function useDailyGoal() {
  const [prefs] = useLearningPrefs();
  const { stats } = useStudyActivity();

  const goal = Math.max(prefs.dailyGoal, 1);
  // Solo el modo enfoque suma minutos a la meta diaria (doc Parte 6.2).
  // Lecciones, exámenes y preguntas quedan en el historial de actividad sin
  // mover la meta. No reintroducir stats.todayMinutes aquí.
  const done = stats.todayFocusMinutes;
  const met = done >= goal;
  const placement = prefs.goalPlacement;

  return {
    goal,
    done,
    remaining: Math.max(goal - done, 0),
    ratio: Math.min(done / goal, 1),
    met,
    placement,
    // "apagada" apaga la meta en todos lados; el resto sigue contando aunque
    // no se muestre (p. ej. "oculta").
    enabled: placement !== 'apagada',
    // "lista": tarjeta en la portada mientras falte, luego pasa al encabezado.
    showInList: placement === 'lista' && !met,
    showInHeader: placement === 'arriba' || (placement === 'lista' && met),
  };
}
