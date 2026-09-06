import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Listener = (serialized: string | null, from: symbol) => void;

const listeners = new Map<string, Set<Listener>>();

function broadcast(key: string, serialized: string | null, from: symbol) {
  listeners.get(key)?.forEach((listener) => listener(serialized, from));
}

function safeParse<T>(raw: string): T | undefined {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

export function usePersistentState<T>(key: string, initialValue: T) {
  const [value, setStoredValue] = useState<T>(initialValue);
  const [hydrated, setHydrated] = useState(false);

  const instanceId = useRef<symbol>(Symbol(key));
  const lastSerialized = useRef<string | null>(null);
  const initialRef = useRef(initialValue);
  useEffect(() => {
    initialRef.current = initialValue;
  });

  const pending = useRef<((prev: T) => T)[]>([]);
  const hydratedRef = useRef(false);

  const setValue = useCallback((next: T | ((prev: T) => T)) => {
    const updater = typeof next === 'function' ? (next as (prev: T) => T) : () => next;
    if (!hydratedRef.current) pending.current.push(updater);
    setStoredValue(updater);
  }, []);

  useEffect(() => {
    let cancelled = false;

    AsyncStorage.getItem(key)
      .then((raw) => {
        if (cancelled) return;

        const stored = raw == null ? undefined : safeParse<T>(raw);
        const queued = pending.current;
        pending.current = [];

        if (stored !== undefined) lastSerialized.current = raw;

        if (queued.length > 0) {
          const base = stored !== undefined ? stored : initialRef.current;
          setStoredValue(queued.reduce((acc, updater) => updater(acc), base));
          return;
        }

        if (stored !== undefined) setStoredValue(stored);
      })
      .catch(() => {})
      .finally(() => {
        if (cancelled) return;
        hydratedRef.current = true;
        setHydrated(true);
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
        setStoredValue(initialRef.current);
        return;
      }

      if (lastSerialized.current === serialized) return;
      lastSerialized.current = serialized;

      const parsed = safeParse<T>(serialized);
      if (parsed !== undefined) setStoredValue(parsed);
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
  'foxy:profile-setup-done',
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
  'foxy:chat',
  'foxy:conversations',
  'foxy:pending-question',
  'foxy:answer-mode',
  'foxy:plan',
  'foxy:usage',
  'foxy:notifications',
  'foxy:learning',
  'foxy:focus-session',
];

export const SESSION_KEYS = [
  'foxy:profile-setup-done',
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
  'foxy:chat',
  'foxy:conversations',
  'foxy:usage',
  'foxy:focus-session',
];
