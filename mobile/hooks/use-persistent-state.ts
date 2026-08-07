import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Listener = (serialized: string, from: symbol) => void;

/**
 * Las pestañas siguen montadas al cambiar de tab, así que dos pantallas que
 * usan la misma clave necesitan enterarse de los cambios de la otra. Sin esto,
 * cambiar el nombre en Perfil no se vería en Preguntar hasta reiniciar la app.
 */
const listeners = new Map<string, Set<Listener>>();

function broadcast(key: string, serialized: string, from: symbol) {
  listeners.get(key)?.forEach((listener) => listener(serialized, from));
}

export function usePersistentState<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(initialValue);
  const [hydrated, setHydrated] = useState(false);

  // Identifica a esta instancia para ignorar sus propios avisos.
  const instanceId = useRef<symbol>(Symbol(key));
  // Último valor ya escrito/recibido: corta los bucles de eco entre instancias.
  const lastSerialized = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    AsyncStorage.getItem(key)
      .then((raw) => {
        if (cancelled || raw == null) return;
        try {
          setValue(JSON.parse(raw) as T);
          lastSerialized.current = raw;
        } catch {
          // Valor corrupto: nos quedamos con el inicial y lo sobrescribimos.
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setHydrated(true);
      });

    return () => {
      cancelled = true;
    };
  }, [key]);

  // Escucha cambios hechos por otras pantallas sobre la misma clave.
  useEffect(() => {
    const self = instanceId.current;
    const listener: Listener = (serialized, from) => {
      if (from === self || lastSerialized.current === serialized) return;
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

  // Persiste y avisa al resto. Hasta hidratar no escribimos, o el valor
  // inicial pisaría lo que el usuario había guardado antes.
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

/** Borra todo lo que guarda la app. Usado por "Borrar mis datos" en Perfil. */
export async function clearPersistedState(keys: string[]) {
  await AsyncStorage.multiRemove(keys);
}

export const STORAGE_KEYS = [
  'foxy:theme-preference',
  'foxy:user-name',
  'foxy:subjects',
  'foxy:selected-subject',
  'foxy:mood',
  'foxy:school',
  'foxy:recent-exams',
  'foxy:classrooms',
  'foxy:streak',
];
