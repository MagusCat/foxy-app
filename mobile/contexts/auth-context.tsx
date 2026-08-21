import React, { createContext, useCallback, useContext, useMemo } from 'react';

import { clearPersistedState, SESSION_KEYS, usePersistentState } from '@/hooks/use-persistent-state';

export type AuthProvider = 'google' | 'apple' | 'email';

type Session = {
  provider: AuthProvider;
  startedAt: string;
};

type AuthContextValue = {
  isReady: boolean;
  isSignedIn: boolean;
  session: Session | null;
  hasSeenOnboarding: boolean;
  markOnboardingSeen: () => void;
  hasCompletedSetup: boolean;
  completeSetup: () => void;
  signIn: (provider: AuthProvider) => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProviderContext({ children }: { children: React.ReactNode }) {
  const [session, setSession, sessionHydrated] = usePersistentState<Session | null>(
    'foxy:session',
    null,
  );
  const [hasSeenOnboarding, setHasSeenOnboarding, onboardingHydrated] = usePersistentState(
    'foxy:onboarding-seen',
    false,
  );
  const [hasCompletedSetup, setHasCompletedSetup, setupHydrated] = usePersistentState(
    'foxy:profile-setup-done',
    false,
  );

  const markOnboardingSeen = useCallback(() => {
    setHasSeenOnboarding(true);
  }, [setHasSeenOnboarding]);

  const completeSetup = useCallback(() => {
    setHasCompletedSetup(true);
  }, [setHasCompletedSetup]);

  const signIn = useCallback(
    (provider: AuthProvider) => {
      setSession({ provider, startedAt: new Date().toISOString() });
      // Quien inicia sesión ya vio la introducción: no se la repetimos.
      setHasSeenOnboarding(true);
    },
    [setSession, setHasSeenOnboarding],
  );

  const signOut = useCallback(async () => {
    await clearPersistedState(SESSION_KEYS);
    setSession(null);
  }, [setSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      isReady: sessionHydrated && onboardingHydrated && setupHydrated,
      isSignedIn: session !== null,
      session,
      hasSeenOnboarding,
      markOnboardingSeen,
      hasCompletedSetup,
      completeSetup,
      signIn,
      signOut,
    }),
    [
      sessionHydrated,
      onboardingHydrated,
      setupHydrated,
      session,
      hasSeenOnboarding,
      markOnboardingSeen,
      hasCompletedSetup,
      completeSetup,
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
