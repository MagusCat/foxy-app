import React, { createContext, useCallback, useContext, useMemo } from 'react';

import { clearPersistedState, SESSION_KEYS, usePersistentState } from '@/hooks/use-persistent-state';

/** Por dónde entró el usuario. Se guarda para mostrarlo luego en Mi cuenta. */
export type AuthProvider = 'google' | 'apple' | 'email';

type Session = {
  provider: AuthProvider;
  /** ISO. Sirve para saber desde cuándo está la sesión en este equipo. */
  startedAt: string;
};

type AuthContextValue = {
  /** `false` mientras se lee el almacenamiento: aún no se sabe a dónde ir. */
  isReady: boolean;
  isSignedIn: boolean;
  session: Session | null;
  hasSeenOnboarding: boolean;
  markOnboardingSeen: () => void;
  signIn: (provider: AuthProvider) => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProviderContext({ children }: { children: React.ReactNode }) {
  /**
   * Todavía no hay cuentas en línea. La sesión es local: guardamos por dónde
   * entró el usuario para que la app arranque en las pestañas la próxima vez.
   *
   * TODO(auth): cuando exista el backend, aquí van el token y su refresco;
   * `signIn` pasará a ser asíncrono y devolverá el error del proveedor.
   */
  const [session, setSession, sessionHydrated] = usePersistentState<Session | null>(
    'foxy:session',
    null,
  );
  const [hasSeenOnboarding, setHasSeenOnboarding, onboardingHydrated] = usePersistentState(
    'foxy:onboarding-seen',
    false,
  );

  const markOnboardingSeen = useCallback(() => {
    setHasSeenOnboarding(true);
  }, [setHasSeenOnboarding]);

  const signIn = useCallback(
    (provider: AuthProvider) => {
      setSession({ provider, startedAt: new Date().toISOString() });
      // Quien inicia sesión ya vio la introducción: no se la repetimos.
      setHasSeenOnboarding(true);
    },
    [setSession, setHasSeenOnboarding],
  );

  const signOut = useCallback(async () => {
    // Sin cuentas en línea, el perfil vive en el dispositivo: al cerrar sesión
    // se borra, igual que hacía Perfil antes de que existiera esta pantalla.
    await clearPersistedState(SESSION_KEYS);
    setSession(null);
  }, [setSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      isReady: sessionHydrated && onboardingHydrated,
      isSignedIn: session !== null,
      session,
      hasSeenOnboarding,
      markOnboardingSeen,
      signIn,
      signOut,
    }),
    [
      sessionHydrated,
      onboardingHydrated,
      session,
      hasSeenOnboarding,
      markOnboardingSeen,
      signIn,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProviderContext');
  }
  return context;
}
