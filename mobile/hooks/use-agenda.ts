import { useCallback, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';

import { usePersistentState } from '@/hooks/use-persistent-state';

const STORAGE_KEY = 'foxy:events';

export type EventKind = 'examen' | 'tarea' | 'clase' | 'repaso';

export type AgendaEvent = {
  id: string;
  title: string;
  subject: string;
  /** YYYY-MM-DD local. */
  date: string;
  /** HH:MM opcional. */
  time?: string;
  kind: EventKind;
};

export const EVENT_KIND_META: Record<
  EventKind,
  { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }
> = {
  examen: { label: 'Examen', icon: 'document-text-outline', color: '#EF4444' },
  tarea: { label: 'Tarea', icon: 'create-outline', color: '#3B82F6' },
  clase: { label: 'Clase', icon: 'people-outline', color: '#A855F7' },
  repaso: { label: 'Repaso', icon: 'sparkles-outline', color: '#10B981' },
};

export const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export const WEEKDAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export function localDay(date: Date) {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Días entre dos fechas YYYY-MM-DD, ignorando la hora. */
export function daysUntil(day: string, from = new Date()) {
  const target = new Date(`${day}T00:00:00`).getTime();
  const base = new Date(`${localDay(from)}T00:00:00`).getTime();
  return Math.round((target - base) / 86_400_000);
}

/** "Hoy", "Mañana", "En 3 días" o la fecha larga si está lejos. */
export function describeEventDate(day: string) {
  const diff = daysUntil(day);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Mañana';
  if (diff > 1 && diff <= 7) return `En ${diff} días`;
  if (diff === -1) return 'Ayer';
  if (diff < -1) return `Hace ${Math.abs(diff)} días`;

  const date = new Date(`${day}T00:00:00`);
  return `${date.getDate()} de ${MONTH_NAMES[date.getMonth()].toLowerCase()}`;
}

export type CalendarCell = {
  key: string;
  day: number;
  /** Celda de relleno del mes anterior o siguiente. */
  isOutside: boolean;
  isToday: boolean;
};

/**
 * Rejilla de 6 semanas empezando en lunes. Siempre 42 celdas para que el
 * calendario no cambie de alto al pasar de mes.
 */
export function buildMonthGrid(year: number, month: number): CalendarCell[] {
  const first = new Date(year, month, 1);
  // getDay(): 0 = domingo. Queremos 0 = lunes.
  const leading = (first.getDay() + 6) % 7;
  const today = localDay(new Date());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(year, month, index - leading + 1);
    const key = localDay(date);
    return {
      key,
      day: date.getDate(),
      isOutside: date.getMonth() !== month,
      isToday: key === today,
    };
  });
}

/**
 * Agenda de próximos eventos: exámenes, tareas, clases y repasos.
 *
 * Todo se guarda en el dispositivo; cuando exista el backend esto se
 * sincroniza con el calendario de la escuela.
 */
export function useAgenda() {
  const [events, setEvents, hydrated] = usePersistentState<AgendaEvent[]>(STORAGE_KEY, []);

  const addEvent = useCallback(
    (event: Omit<AgendaEvent, 'id'>) => {
      const entry: AgendaEvent = { ...event, id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` };
      setEvents((prev) => [...prev, entry]);
      return entry;
    },
    [setEvents],
  );

  const removeEvent = useCallback(
    (id: string) => setEvents((prev) => prev.filter((event) => event.id !== id)),
    [setEvents],
  );

  const sorted = useMemo(
    () => [...events].sort((a, b) => `${a.date}${a.time ?? ''}`.localeCompare(`${b.date}${b.time ?? ''}`)),
    [events],
  );

  const today = localDay(new Date());
  const upcoming = useMemo(() => sorted.filter((event) => event.date >= today), [sorted, today]);

  /** Días con al menos un evento, para pintar el punto en el calendario. */
  const markedDays = useMemo(() => {
    const map = new Map<string, AgendaEvent[]>();
    sorted.forEach((event) => {
      const list = map.get(event.date) ?? [];
      list.push(event);
      map.set(event.date, list);
    });
    return map;
  }, [sorted]);

  return { events: sorted, upcoming, markedDays, addEvent, removeEvent, hydrated };
}
