import { usePersistentState } from '@/hooks/use-persistent-state';
import { useStudyActivity } from '@/hooks/use-study-activity';

export type LearningPrefs = {
  style: 'pasos' | 'directo' | 'ejemplos';
  level: 'basico' | 'intermedio' | 'avanzado';
  tone: 'amigable' | 'neutral' | 'motivador';
  language: 'es' | 'en';
  dailyGoal: number;
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
  const done = stats.todayMinutes;

  return {
    goal,
    done,
    remaining: Math.max(goal - done, 0),
    ratio: Math.min(done / goal, 1),
    met: done >= goal,
  };
}
