import React, { useEffect } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';

import { BrandLogo } from '@/components/brand-logo';
import { Palette } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';

/** Cuánto se queda la marca en pantalla antes de continuar. */
const SPLASH_MS = 1400;

/**
 * Pantalla de marca a pantalla completa. El splash nativo se oculta en cuanto
 * la navegación llega aquí, así que esta es la primera imagen de la app: sirve
 * de puente mientras se decide entre la introducción y el inicio de sesión.
 */
export default function SplashScreen() {
  const router = useRouter();
  const { hasSeenOnboarding } = useAuth();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace(hasSeenOnboarding ? '/login' : '/onboarding');
    }, SPLASH_MS);

    return () => clearTimeout(timer);
  }, [router, hasSeenOnboarding]);

  return (
    <View className="flex-1 items-center justify-center" style={{ backgroundColor: Palette.primary }}>
      {/* El fondo es siempre rojo, así que la barra de estado va en claro. */}
      <StatusBar style="light" />
      <BrandLogo size={72} withWordmark background="#FFFFFF" wordmarkColor="#FFFFFF" />
    </View>
  );
}
