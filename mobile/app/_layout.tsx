import '@/global.css';
import { ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { FocusCompletionWatcher } from '@/components/focus-completion-watcher';
import { NavigationThemes } from '@/constants/theme';
import { AuthProviderContext, useAuth } from '@/contexts/auth-context';
import { ThemeProvider, useTheme } from '@/contexts/theme-context';

export const unstable_settings = {
  anchor: '(tabs)',
};

// El splash nativo tapa el arranque hasta saber si hay sesión. Sin esto se
// vería un parpadeo de las pestañas antes de saltar al inicio de sesión.
ExpoSplashScreen.preventAutoHideAsync().catch(() => {});

/**
 * Manda al flujo de entrada o a la app según haya sesión. Vive dentro del
 * Stack para poder navegar, y no pinta nada por su cuenta.
 */
function AuthGate() {
  const { isReady, isSignedIn } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!isReady) return;

    const inAuthFlow = segments[0] === '(auth)';

    if (!isSignedIn && !inAuthFlow) {
      router.replace('/splash');
      return;
    }

    if (isSignedIn && inAuthFlow) {
      router.replace('/(tabs)');
      return;
    }

    // Ya estamos donde toca: recién ahora se puede destapar la pantalla.
    ExpoSplashScreen.hideAsync().catch(() => {});
  }, [isReady, isSignedIn, segments, router]);

  return null;
}

function RootLayoutContent() {
  const { colorScheme, colors } = useTheme();

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.background);
  }, [colors.background]);

  return (
    <NavigationThemeProvider value={NavigationThemes[colorScheme]}>
      <AuthGate />
      <FocusCompletionWatcher />

      {/* Las pantallas apiladas traen su propio encabezado (ScreenShell), así
          que el del navegador se oculta en todas. */}
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal', headerShown: true }} />
        <Stack.Screen name="activity" />
        <Stack.Screen name="calendar" />
        <Stack.Screen name="achievements" />
        <Stack.Screen name="focus" />
        <Stack.Screen name="history" />
        <Stack.Screen name="exam/new" />
        <Stack.Screen name="exam/[id]" />
        <Stack.Screen name="exam/topic" />
        <Stack.Screen name="subscription" />
        <Stack.Screen name="settings/account" />
        <Stack.Screen name="settings/school" />
        <Stack.Screen name="settings/learning" />
        <Stack.Screen name="settings/notifications" />
        <Stack.Screen name="settings/privacy" />
        <Stack.Screen name="settings/help" />
        <Stack.Screen name="settings/about-fox" />
      </Stack>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProviderContext>
        <RootLayoutContent />
      </AuthProviderContext>
    </ThemeProvider>
  );
}
