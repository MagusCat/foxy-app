import { useCallback, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';

import { usePersistentState } from '@/hooks/use-persistent-state';

const STORAGE_KEY = 'foxy:activity-log';

/** Sesiones que se conservan en el dispositivo. */
const MAX_SESSIONS = 200;

export type StudyKind = 'chat' | 'scan' | 'exam' | 'lesson' | 'class';

export type StudySession = {
  id: string;
  kind: StudyKind;
  subject: string;
  title: string;
  /** Duración estimada en minutos: frontend hasta que exista el backend. */
  minutes: number;
  /** ISO: en disco se guarda como JSON, donde `Date` no sobrevive. */
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
};

const DAY_LABELS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

function localDay(date: Date) {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export type SubjectTotal = {
  subject: string;
  minutes: number;
  sessions: number;
  /** Proporción respecto a la materia más estudiada, para las barras. */
  ratio: number;
};

export type DayTotal = {
  key: string;
  label: string;
  minutes: number;
  isToday: boolean;
};

/**
 * Registro de estudio del usuario.
 *
 * Alimenta la pantalla de Actividad. Cada acción real de la app (enviar una
 * pregunta, generar un examen) llama a `logSession`, así que los totales
 * salen de lo que la persona hizo y no de datos inventados.
 */
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

    // Últimos 7 días, del más antiguo al de hoy.
    const days: DayTotal[] = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(now);
      date.setDate(date.getDate() - (6 - index));
      const key = localDay(date);
      return { key, label: DAY_LABELS[date.getDay()], minutes: 0, isToday: key === today };
    });
    const dayIndex = new Map(days.map((day, index) => [day.key, index]));

    const subjectMinutes = new Map<string, { minutes: number; sessions: number }>();
    /** Minutos por día de todo el historial: lo usan las metas y los logros. */
    const minutesByDay = new Map<string, number>();
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
      weekMinutes,
      examsCreated,
      minutesByDay,
      days,
      maxDayMinutes: Math.max(1, ...days.map((day) => day.minutes)),
      bySubject,
      topSubject: bySubject[0]?.subject ?? null,
    };
  }, [sessions]);

  return { sessions, logSession, clearSessions, stats, hydrated };
}

/** "45 min" / "2 h 15 min" */
export function formatMinutes(minutes: number): string {
  if (minutes <= 0) return '0 min';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}
