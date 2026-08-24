import { useCallback, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';

import { usePersistentState } from '@/hooks/use-persistent-state';
import { localDay } from '@/lib/time';

const STORAGE_KEY = 'foxy:activity-log';

const MAX_SESSIONS = 200;

export type StudyKind = 'chat' | 'scan' | 'exam' | 'lesson' | 'class' | 'focus';

export type StudySession = {
  id: string;
  kind: StudyKind;
  subject: string;
  title: string;
  minutes: number;
  at: string;
};

export const STUDY_KIND_META: Record<
  StudyKind,
  { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }
> = {
  chat: { label: 'Pregunta a Foxy', icon: 'chatbubble-ellipses-outline', color: '#3B82F6' },
  scan: { label: 'Problema escaneado', icon: 'scan-outline', color: '#14B8A6' },
  exam: { label: 'Examen de práctica', icon: 'document-text-outline', color: '#EF4444' },
  lesson: { label: 'Lección', icon: 'sparkles-outline', color: '#A855F7' },
  class: { label: 'Clase', icon: 'people-outline', color: '#F97316' },
  focus: { label: 'Sesión de enfoque', icon: 'timer-outline', color: '#F97316' },
};

const DAY_LABELS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

export type SubjectTotal = {
  subject: string;
  minutes: number;
  sessions: number;
  ratio: number;
};

export type DayTotal = {
  key: string;
  label: string;
  minutes: number;
  isToday: boolean;
};

export function useStudyActivity() {
  const [sessions, setSessions, hydrated] = usePersistentState<StudySession[]>(STORAGE_KEY, []);

  const logSession = useCallback(
    (session: Omit<StudySession, 'id' | 'at'> & { at?: string }) => {
      const entry: StudySession = {
        ...session,
        id: `ses-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        at: session.at ?? new Date().toISOString(),
      };
      setSessions((prev) => [entry, ...prev].slice(0, MAX_SESSIONS));
    },
    [setSessions],
  );

  const clearSessions = useCallback(() => setSessions([]), [setSessions]);

  const stats = useMemo(() => {
    const now = new Date();
    const today = localDay(now);

    const days: DayTotal[] = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(now);
      date.setDate(date.getDate() - (6 - index));
      const key = localDay(date);
      return { key, label: DAY_LABELS[date.getDay()], minutes: 0, isToday: key === today };
    });
    const dayIndex = new Map(days.map((day, index) => [day.key, index]));

    const subjectMinutes = new Map<string, { minutes: number; sessions: number }>();
    const minutesByDay = new Map<string, number>();
    const focusMinutesByDay = new Map<string, number>();
    let totalMinutes = 0;
    let todayMinutes = 0;
    let weekMinutes = 0;
    let examsCreated = 0;

    sessions.forEach((session) => {
      const key = localDay(new Date(session.at));
      totalMinutes += session.minutes;
      minutesByDay.set(key, (minutesByDay.get(key) ?? 0) + session.minutes);
      if (session.kind === 'exam') examsCreated += 1;
      if (key === today) todayMinutes += session.minutes;

      const index = dayIndex.get(key);
      if (index !== undefined) {
        days[index].minutes += session.minutes;
        weekMinutes += session.minutes;
      }

      const current = subjectMinutes.get(session.subject) ?? { minutes: 0, sessions: 0 };
      subjectMinutes.set(session.subject, {
        minutes: current.minutes + session.minutes,
        sessions: current.sessions + 1,
      });
    });

    sessions.forEach((session) => {
      if (session.kind !== 'focus') return;
      const key = localDay(new Date(session.at));
      focusMinutesByDay.set(key, (focusMinutesByDay.get(key) ?? 0) + session.minutes);
    });
    const todayFocusMinutes = focusMinutesByDay.get(today) ?? 0;

    const maxSubjectMinutes = Math.max(1, ...[...subjectMinutes.values()].map((item) => item.minutes));
    const bySubject: SubjectTotal[] = [...subjectMinutes.entries()]
      .map(([subject, item]) => ({
        subject,
        minutes: item.minutes,
        sessions: item.sessions,
        ratio: item.minutes / maxSubjectMinutes,
      }))
      .sort((a, b) => b.minutes - a.minutes);

    return {
      totalSessions: sessions.length,
      totalMinutes,
      todayMinutes,
      todayFocusMinutes,
      weekMinutes,
      examsCreated,
      minutesByDay,
      focusMinutesByDay,
      days,
      maxDayMinutes: Math.max(1, ...days.map((day) => day.minutes)),
      bySubject,
      topSubject: bySubject[0]?.subject ?? null,
    };
  }, [sessions]);

  return { sessions, logSession, clearSessions, stats, hydrated };
}

export function formatMinutes(minutes: number): string {
  if (minutes <= 0) return '0 min';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}
