import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { usePersistentState } from '@/hooks/use-persistent-state';

export type FocusSession = {
  minutes: number;
  endsAt: number | null;
  remaining: number;
};

export const FOCUS_SESSION_KEY = 'foxy:focus-session';

const DEFAULT_MINUTES = 25;

const DEFAULT_SESSION: FocusSession = {
  minutes: DEFAULT_MINUTES,
  endsAt: null,
  remaining: DEFAULT_MINUTES * 60,
};

function secondsLeftOf(session: FocusSession) {
  if (session.endsAt === null) return Math.max(session.remaining, 0);
  return Math.max(Math.round((session.endsAt - Date.now()) / 1000), 0);
}

export function formatClock(seconds: number) {
  const safe = Math.max(seconds, 0);
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${minutes}:${`${rest}`.padStart(2, '0')}`;
}

export function useFocusSession() {
  const [session, setSession, hydrated] = usePersistentState<FocusSession>(
    FOCUS_SESSION_KEY,
    DEFAULT_SESSION,
  );

  const isRunning = session.endsAt !== null;
  const [secondsLeft, setSecondsLeft] = useState(() => secondsLeftOf(session));

  useEffect(() => {
    const tick = () => setSecondsLeft(secondsLeftOf(session));

    tick();
    if (session.endsAt === null) return;

    const timer = setInterval(tick, 1000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') tick();
    });

    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [session]);

  const start = useCallback(
    () =>
      setSession((prev) => {
        const left = secondsLeftOf(prev) || prev.minutes * 60;
        return { ...prev, endsAt: Date.now() + left * 1000, remaining: left };
      }),
    [setSession],
  );

  const pause = useCallback(
    () => setSession((prev) => ({ ...prev, endsAt: null, remaining: secondsLeftOf(prev) })),
    [setSession],
  );

  const reset = useCallback(
    () => setSession((prev) => ({ ...prev, endsAt: null, remaining: prev.minutes * 60 })),
    [setSession],
  );

  const setMinutes = useCallback(
    (minutes: number) => setSession({ minutes, endsAt: null, remaining: minutes * 60 }),
    [setSession],
  );

  return { session, secondsLeft, isRunning, hydrated, start, pause, reset, setMinutes };
}
