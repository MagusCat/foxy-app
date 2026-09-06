import { useCallback, useEffect, useMemo } from 'react';

import { usePersistentState } from '@/hooks/use-persistent-state';
import { localDay } from '@/lib/time';

const STORAGE_KEY = 'foxy:streak';

const MAX_HISTORY = 400;

export const WEEKLY_GOAL = 5;

export const MAX_FREEZES = 2;
const FREEZE_EVERY = 7;

const MILESTONES = [3, 7, 14, 30, 60, 100, 180, 365];

const WEEK_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

type StoredStreak = {
  days: string[];
  best: number;
  freezes: number;
  frozen: string[];
  lastGrantDay?: string;
};

type LegacyStreak = { lastDay?: string; count?: number };

export type StreakDay = {
  key: string;
  label: string;
  active: boolean;
  frozen: boolean;
  isToday: boolean;
  isFuture: boolean;
};

export type StreakInfo = {
  count: number;
  best: number;
  totalDays: number;
  week: StreakDay[];
  weeklyActive: number;
  weeklyGoal: number;
  atRisk: boolean;
  freezes: number;
  nextMilestone: number | null;
  daysToMilestone: number;
  hydrated: boolean;
};

function parseDay(day: string) {
  return new Date(`${day}T00:00:00`);
}

function shiftDays(date: Date, amount: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
}

function startOfWeek(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return shiftDays(copy, -((copy.getDay() + 6) % 7));
}

function normalize(value: StoredStreak | LegacyStreak | null | undefined): StoredStreak {
  const base = { freezes: 1, frozen: [] as string[] };

  if (value && Array.isArray((value as StoredStreak).days)) {
    const stored = value as StoredStreak;
    return {
      days: stored.days.filter((day) => typeof day === 'string'),
      best: typeof stored.best === 'number' ? stored.best : 0,
      freezes: typeof stored.freezes === 'number' ? stored.freezes : base.freezes,
      frozen: Array.isArray(stored.frozen) ? stored.frozen : base.frozen,
      lastGrantDay: stored.lastGrantDay,
    };
  }

  const legacy = value as LegacyStreak | null | undefined;
  if (legacy?.lastDay) {
    return { ...base, days: [legacy.lastDay], best: legacy.count ?? 1 };
  }

  return { ...base, days: [], best: 0 };
}

function activeDays(stored: StoredStreak) {
  return new Set([...stored.days, ...stored.frozen]);
}

function withDay(stored: StoredStreak, day: string): StoredStreak {
  if (stored.days.includes(day)) return stored;
  const days = [...stored.days, day].sort().slice(-MAX_HISTORY);
  return { ...stored, days };
}

function streakEndingAt(daySet: Set<string>, today: string) {
  let cursor = parseDay(today);

  if (!daySet.has(today)) {
    cursor = shiftDays(cursor, -1);
    if (!daySet.has(localDay(cursor))) return 0;
  }

  let count = 0;
  while (daySet.has(localDay(cursor))) {
    count += 1;
    cursor = shiftDays(cursor, -1);
  }
  return count;
}

function advance(stored: StoredStreak, today: string): StoredStreak {
  let next = stored;
  const active = activeDays(stored);

  if (!active.has(today)) {
    const yesterday = localDay(shiftDays(parseDay(today), -1));
    const dayBefore = localDay(shiftDays(parseDay(today), -2));

    if (!active.has(yesterday) && active.has(dayBefore) && next.freezes > 0) {
      next = { ...next, frozen: [...next.frozen, yesterday], freezes: next.freezes - 1 };
    }
  }

  next = withDay(next, today);

  const count = streakEndingAt(activeDays(next), today);
  const earnedFreeze =
    count > 0 && count % FREEZE_EVERY === 0 && next.freezes < MAX_FREEZES && next.lastGrantDay !== today;

  if (earnedFreeze) {
    next = { ...next, freezes: next.freezes + 1, lastGrantDay: today };
  }

  return next;
}

export function useDailyStreak() {
  const [raw, setRaw, hydrated] = usePersistentState<StoredStreak>(STORAGE_KEY, {
    days: [],
    best: 0,
    freezes: 1,
    frozen: [],
  });

  useEffect(() => {
    if (!hydrated) return;
    setRaw((prev) => advance(normalize(prev), localDay(new Date())));
  }, [hydrated, setRaw]);

  const markStudied = useCallback(
    () => setRaw((prev) => advance(normalize(prev), localDay(new Date()))),
    [setRaw],
  );

  const info = useMemo<StreakInfo>(() => {
    const stored = normalize(raw);
    const studied = new Set(stored.days);
    const frozen = new Set(stored.frozen);
    const daySet = activeDays(stored);
    const now = new Date();
    const today = localDay(now);

    const count = streakEndingAt(daySet, today);
    const best = Math.max(stored.best, count);

    const monday = startOfWeek(now);
    const week: StreakDay[] = WEEK_LABELS.map((label, index) => {
      const date = shiftDays(monday, index);
      const key = localDay(date);
      return {
        key,
        label,
        active: daySet.has(key),
        frozen: frozen.has(key) && !studied.has(key),
        isToday: key === today,
        isFuture: date > now && key !== today,
      };
    });

    const nextMilestone = MILESTONES.find((milestone) => milestone > count) ?? null;

    return {
      count,
      best,
      totalDays: stored.days.length,
      week,
      weeklyActive: week.filter((day) => day.active).length,
      weeklyGoal: WEEKLY_GOAL,
      atRisk: count > 0 && !daySet.has(today),
      freezes: stored.freezes,
      nextMilestone,
      daysToMilestone: nextMilestone ? nextMilestone - count : 0,
      hydrated,
    };
  }, [raw, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    setRaw((prev) => {
      const stored = normalize(prev);
      return stored.best >= info.best ? stored : { ...stored, best: info.best };
    });
  }, [hydrated, info.best, setRaw]);

  return [info.count, info, markStudied] as const;
}
