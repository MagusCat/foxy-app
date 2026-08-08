import { useCallback, useEffect, useMemo } from 'react';

import { usePersistentState } from '@/hooks/use-persistent-state';

const STORAGE_KEY = 'foxy:streak';

/** Días que se conservan en el historial (suficiente para un año de rachas). */
const MAX_HISTORY = 400;

/** Meta por defecto: 5 días activos por semana. */
export const WEEKLY_GOAL = 5;

/** Congelaciones acumulables y cada cuántos días seguidos se gana una. */
export const MAX_FREEZES = 2;
const FREEZE_EVERY = 7;

const MILESTONES = [3, 7, 14, 30, 60, 100, 180, 365];

const WEEK_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

type StoredStreak = {
  /** Días con actividad, en formato YYYY-MM-DD local y orden ascendente. */
  days: string[];
  /** Mejor racha alcanzada, para no perderla al romperse la actual. */
  best: number;
  /** Congelaciones disponibles. */
  freezes: number;
  /** Días que se salvaron gastando una congelación. */
  frozen: string[];
  /** Día en que se otorgó la última congelación, para no repetir el premio. */
  lastGrantDay?: string;
};

/** Formato viejo del hook: se migra al hidratar. */
type LegacyStreak = { lastDay?: string; count?: number };

export type StreakDay = {
  key: string;
  label: string;
  active: boolean;
  /** El día se salvó con una congelación, no con estudio real. */
  frozen: boolean;
  isToday: boolean;
  isFuture: boolean;
};

export type StreakInfo = {
  count: number;
  best: number;
  /** Total de días activos registrados, no necesariamente seguidos. */
  totalDays: number;
  /** Semana actual de lunes a domingo. */
  week: StreakDay[];
  weeklyActive: number;
  weeklyGoal: number;
  /** La racha sigue viva por ayer, pero hoy todavía no hay actividad. */
  atRisk: boolean;
  /** Congelaciones guardadas para cubrir un día perdido. */
  freezes: number;
  /** Siguiente meta de días seguidos, o `null` si ya pasó todas. */
  nextMilestone: number | null;
  daysToMilestone: number;
  hydrated: boolean;
};

/** Fecha local en YYYY-MM-DD (no usamos toISOString: eso convierte a UTC). */
function localDay(date: Date) {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function parseDay(day: string) {
  return new Date(`${day}T00:00:00`);
}

function shiftDays(date: Date, amount: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
}

/** Lunes de la semana a la que pertenece la fecha. */
function startOfWeek(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return shiftDays(copy, -((copy.getDay() + 6) % 7));
}

/** Acepta el formato actual y el viejo `{ lastDay, count }`. */
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

/** Días que cuentan para la racha: los estudiados más los congelados. */
function activeDays(stored: StoredStreak) {
  return new Set([...stored.days, ...stored.frozen]);
}

/** Añade un día al historial. Devuelve el mismo objeto si ya estaba. */
function withDay(stored: StoredStreak, day: string): StoredStreak {
  if (stored.days.includes(day)) return stored;
  const days = [...stored.days, day].sort().slice(-MAX_HISTORY);
  return { ...stored, days };
}

function streakEndingAt(daySet: Set<string>, today: string) {
  let cursor = parseDay(today);

  // Si hoy aún no hay actividad, la racha puede seguir viva por ayer.
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

/**
 * Registra el día de hoy aplicando las reglas de la racha.
 *
 * Antes de sumar el día se revisa si ayer quedó vacío: si la racha venía viva
 * y hay una congelación guardada, se gasta para tapar ese hueco. Después, cada
 * siete días seguidos se gana una congelación nueva (máximo dos).
 */
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

/**
 * Racha de días seguidos usando Foxy.
 *
 * Abrir la app cuenta el día; `markStudied` deja marcarlo también desde una
 * acción concreta (enviar una pregunta, generar un examen) y es idempotente.
 * Se guarda el historial completo, así que se pueden mostrar la semana, la
 * mejor racha y el progreso semanal, y un cambio de reloj hacia atrás ya no
 * borra el progreso.
 */
export function useDailyStreak() {
  const [raw, setRaw, hydrated] = usePersistentState<StoredStreak>(STORAGE_KEY, {
    days: [],
    best: 0,
    freezes: 1,
    frozen: [],
  });

  // Migra el formato viejo y registra el día de hoy, una vez ya hidratado. Si
  // nada cambia, `advance` devuelve el mismo contenido y no se reescribe.
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

  // La mejor racha se persiste aparte para que sobreviva a un corte de racha.
  useEffect(() => {
    if (!hydrated) return;
    setRaw((prev) => {
      const stored = normalize(prev);
      return stored.best >= info.best ? stored : { ...stored, best: info.best };
    });
  }, [hydrated, info.best, setRaw]);

  return [info.count, info, markStudied] as const;
}
