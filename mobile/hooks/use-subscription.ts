import { useCallback, useMemo } from 'react';

import { BASIC_DAILY_QUESTIONS, BASIC_SUBJECT_LIMIT, getPlan, type PlanId } from '@/constants/plans';
import { usePersistentState } from '@/hooks/use-persistent-state';
import { localDay } from '@/lib/time';

type DailyUsage = {
  day: string;
  questions: number;
};

export function useSubscription() {
  const [planId, setPlanId] = usePersistentState<PlanId>('foxy:plan', 'basico');
  const [usage, setUsage] = usePersistentState<DailyUsage>('foxy:usage', {
    day: localDay(new Date()),
    questions: 0,
  });

  const plan = useMemo(() => getPlan(planId), [planId]);
  const isBasic = planId === 'basico';

  const today = localDay(new Date());
  const questionsToday = usage.day === today ? usage.questions : 0;
  const limit = isBasic ? BASIC_DAILY_QUESTIONS : null;
  const remaining = limit === null ? null : Math.max(limit - questionsToday, 0);

  const registerQuestion = useCallback(() => {
    setUsage((prev) => {
      const day = localDay(new Date());
      return prev.day === day
        ? { day, questions: prev.questions + 1 }
        : { day, questions: 1 };
    });
  }, [setUsage]);

  return {
    plan,
    planId,
    setPlanId,
    isBasic,
    questionsToday,
    limit,
    remaining,
    reachedLimit: remaining !== null && remaining <= 0,
    registerQuestion,
    subjectLimit: isBasic ? BASIC_SUBJECT_LIMIT : null,
  };
}
