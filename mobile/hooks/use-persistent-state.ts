import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Listener = (serialized: string | null, from: symbol) => void;

const listeners = new Map<string, Set<Listener>>();

function broadcast(key: string, serialized: string | null, from: symbol) {
  listeners.get(key)?.forEach((listener) => listener(serialized, from));
}

export function usePersistentState<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(initialValue);
  const [hydrated, setHydrated] = useState(false);

  const instanceId = useRef<symbol>(Symbol(key));
  const lastSerialized = useRef<string | null>(null);
  const initialRef = useRef(initialValue);
  useEffect(() => {
    initialRef.current = initialValue;
  });

  useEffect(() => {
    let cancelled = false;

    AsyncStorage.getItem(key)
      .then((raw) => {
        if (cancelled || raw == null) return;
        try {
          setValue(JSON.parse(raw) as T);
          lastSerialized.current = raw;
        } catch {}
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setHydrated(true);
      });

    return () => {
      cancelled = true;
    };
  }, [key]);

  useEffect(() => {
    const self = instanceId.current;
    const listener: Listener = (serialized, from) => {
      if (from === self) return;

      if (serialized === null) {
        lastSerialized.current = null;
        setValue(initialRef.current);
        return;
      }

      if (lastSerialized.current === serialized) return;
      lastSerialized.current = serialized;
      try {
        setValue(JSON.parse(serialized) as T);
      } catch {}
    };

    const set = listeners.get(key) ?? new Set<Listener>();
    set.add(listener);
    listeners.set(key, set);

    return () => {
      set.delete(listener);
      if (set.size === 0) listeners.delete(key);
    };
  }, [key]);

  useEffect(() => {
    if (!hydrated) return;

    const serialized = JSON.stringify(value);
    if (lastSerialized.current === serialized) return;
    lastSerialized.current = serialized;

    AsyncStorage.setItem(key, serialized).catch(() => {});
    broadcast(key, serialized, instanceId.current);
  }, [key, value, hydrated]);

  return [value, setValue, hydrated] as const;
}

export async function clearPersistedState(keys: string[]) {
  await AsyncStorage.multiRemove(keys);

  const source = Symbol('reset');
  keys.forEach((key) => broadcast(key, null, source));
}

export const STORAGE_KEYS = [
  'foxy:theme-preference',
  'foxy:session',
  'foxy:onboarding-seen',
  'foxy:user-name',
  'foxy:avatar',
  'foxy:account',
  'foxy:subjects',
  'foxy:selected-subject',
  'foxy:school',
  'foxy:grade',
  'foxy:recent-exams',
  'foxy:study-plans',
  'foxy:classrooms',
  'foxy:streak',
  'foxy:activity-log',
  'foxy:events',
  'foxy:questions',
  'foxy:pending-question',
  'foxy:answer-mode',
  'foxy:plan',
  'foxy:usage',
  'foxy:notifications',
  'foxy:learning',
  'foxy:focus-session',
];

export const SESSION_KEYS = [
  'foxy:user-name',
  'foxy:avatar',
  'foxy:account',
  'foxy:school',
  'foxy:grade',
  'foxy:recent-exams',
  'foxy:study-plans',
  'foxy:classrooms',
  'foxy:activity-log',
  'foxy:events',
  'foxy:questions',
  'foxy:usage',
  'foxy:focus-session',
];
