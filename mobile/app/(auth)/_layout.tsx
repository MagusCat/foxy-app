import React from 'react';
import { Stack } from 'expo-router';

import { useTheme } from '@/contexts/theme-context';

export default function AuthLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // No hay a dónde volver desde aquí: el gesto de retroceso sacaría al
        // usuario del flujo de entrada hacia una app sin sesión.
        gestureEnabled: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="splash" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="login" />
    </Stack>
  );
}
