import { useCallback, useRef } from 'react';
import { useRouter } from 'expo-router';

const COOLDOWN_MS = 700;

/**
 * Misma forma de uso que `useRouter`, pero `push`/`replace`/`back`
 * comparten una ventana de 700 ms: dos toques seguidos, aunque sean en
 * botones distintos, no deben encadenar dos navegaciones.
 *
 * No usar en app/_layout.tsx (AuthGate) ni en (auth)/splash.tsx: ahí la
 * app navega por su cuenta y dos redirecciones seguidas son legítimas —
 * con el guard, una se pierde y el arranque se atasca.
 */
export function useGuardedRouter() {
  const router = useRouter();
  const lastNavAt = useRef(0);

  const withinCooldown = useCallback(() => {
    const now = Date.now();
    if (now - lastNavAt.current < COOLDOWN_MS) return true;
    lastNavAt.current = now;
    return false;
  }, []);

  const push = useCallback<typeof router.push>(
    (...args) => {
      if (withinCooldown()) return;
      router.push(...args);
    },
    [withinCooldown, router],
  );

  const replace = useCallback<typeof router.replace>(
    (...args) => {
      if (withinCooldown()) return;
      router.replace(...args);
    },
    [withinCooldown, router],
  );

  const back = useCallback(() => {
    if (withinCooldown()) return;
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  }, [withinCooldown, router]);

  return { ...router, push, replace, back };
}
