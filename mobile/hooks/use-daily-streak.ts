import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'foxy:streak';

type StoredStreak = {
  /** Último día en que se abrió la app, en formato YYYY-MM-DD local. */
  lastDay: string;
  count: number;
};

/** Fecha local en YYYY-MM-DD (no usamos toISOString: eso convierte a UTC). */
function localDay(date: Date) {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function daysBetween(fromDay: string, toDay: string) {
  const from = new Date(`${fromDay}T00:00:00`);
  const to = new Date(`${toDay}T00:00:00`);
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

/**
 * Racha de días seguidos usando la app.
 *
 * Mismo día -> se mantiene. Día siguiente -> +1. Hueco de 2+ días -> vuelve a 1.
 */
export function useDailyStreak() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (cancelled) return;

        const today = localDay(new Date());
        let next: StoredStreak = { lastDay: today, count: 1 };

        if (raw) {
          try {
            const stored = JSON.parse(raw) as StoredStreak;
            const gap = daysBetween(stored.lastDay, today);
            if (gap === 0) {
              next = stored;
            } else if (gap === 1) {
              next = { lastDay: today, count: stored.count + 1 };
            }
            // gap >= 2 (o negativo por cambio de reloj) -> reinicia a 1
          } catch {
            // Dato corrupto: empezamos de cero.
          }
        }

        setCount(next.count);
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  return [count] as const;
}
