import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { usePersistentState } from '@/hooks/use-persistent-state';

export type FocusSession = {
  minutes: number;
  endsAt: number | null;
  remaining: number;
  finished?: number | null;
};

export const FOCUS_SESSION_KEY = 'foxy:focus-session';

const DEFAULT_MINUTES = 25;

const DEFAULT_SESSION: FocusSession = {
  minutes: DEFAULT_MINUTES,
  endsAt: null,
  remaining: DEFAULT_MINUTES * 60,
  finished: null,
};

function normalize(session: FocusSession | null | undefined): FocusSession {
  const minutes =
    typeof session?.minutes === 'number' && session.minutes > 0
      ? Math.round(session.minutes)
      : DEFAULT_MINUTES;

  const endsAt =
    typeof session?.endsAt === 'number' && Number.isFinite(session.endsAt) ? session.endsAt : null;

  const remaining =
    typeof session?.remaining === 'number' && Number.isFinite(session.remaining)
      ? Math.min(Math.max(Math.round(session.remaining), 0), minutes * 60)
      : minutes * 60;

  const finished =
    typeof session?.finished === 'number' && session.finished > 0 ? Math.round(session.finished) : null;

  return { minutes, endsAt, remaining, finished };
}

function secondsLeftOf(session: FocusSession) {
  const safe = normalize(session);
  if (safe.endsAt === null) return safe.remaining;
  return Math.max(Math.round((safe.endsAt - Date.now()) / 1000), 0);
}

export function formatClock(seconds: number) {
  const safe = Number.isFinite(seconds) ? Math.max(seconds, 0) : 0;
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${minutes}:${`${rest}`.padStart(2, '0')}`;
}

export function useFocusSession() {
  const [raw, setRaw, hydrated] = usePersistentState<FocusSession>(FOCUS_SESSION_KEY, DEFAULT_SESSION);

  const session = normalize(raw);
  const isRunning = session.endsAt !== null;

  const [secondsLeft, setSecondsLeft] = useState(() => secondsLeftOf(raw));

  const setSession = useCallback(
    (update: (prev: FocusSession) => FocusSession) => setRaw((prev) => update(normalize(prev))),
    [setRaw],
  );

  useEffect(() => {
    const tick = () => setSecondsLeft(secondsLeftOf(raw));

    tick();
    if (normalize(raw).endsAt === null) return;

    const timer = setInterval(tick, 1000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') tick();
    });

    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [raw]);

  useEffect(() => {
    if (!hydrated || !isRunning || secondsLeft > 0) return;

    setSession((prev) =>
      prev.endsAt === null
        ? prev
        : { ...prev, endsAt: null, remaining: prev.minutes * 60, finished: prev.minutes },
    );
  }, [hydrated, isRunning, secondsLeft, setSession]);

  const start = useCallback(
    () =>
      setSession((prev) => {
        if (prev.endsAt !== null) return prev;
        const left = prev.remaining > 0 ? prev.remaining : prev.minutes * 60;
        return { ...prev, endsAt: Date.now() + left * 1000, remaining: left, finished: null };
      }),
    [setSession],
  );

  const pause = useCallback(
    () => setSession((prev) => ({ ...prev, endsAt: null, remaining: secondsLeftOf(prev) })),
    [setSession],
  );

  const reset = useCallback(
    () => setSession((prev) => ({ ...prev, endsAt: null, remaining: prev.minutes * 60, finished: null })),
    [setSession],
  );

  const setMinutes = useCallback(
    (minutes: number) => setSession(() => ({ minutes, endsAt: null, remaining: minutes * 60, finished: null })),
    [setSession],
  );

  const clearFinished = useCallback(
    () => setSession((prev) => (prev.finished == null ? prev : { ...prev, finished: null })),
    [setSession],
  );

  return {
    session,
    secondsLeft,
    isRunning,
    hydrated,
    start,
    pause,
    reset,
    setMinutes,
    clearFinished,
  };
}
