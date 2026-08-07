import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme as useNativeWindColorScheme } from 'nativewind';

import { Colors } from '@/constants/theme';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ColorScheme = 'light' | 'dark';

const STORAGE_KEY = 'foxy:theme-preference';

type ThemeContextValue = {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  colorScheme: ColorScheme;
  isDark: boolean;
  colors: (typeof Colors)['light'];
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  /**
   * NativeWind es la ÚNICA fuente de verdad del tema.
   *
   * Su `setColorScheme` llama por dentro a `Appearance.setColorScheme(...)`.
   * Antes le pasábamos el esquema ya resuelto ('light' | 'dark'), lo que
   * forzaba el Appearance de todo el sistema: `useColorScheme()` quedaba
   * clavado en ese valor y la opción "Sistema" dejaba de seguir al SO.
   *
   * Ahora le pasamos la PREFERENCIA. Con 'system' NativeWind hace
   * `Appearance.setColorScheme(null)` y vuelve a seguir al sistema operativo.
   */
  const { colorScheme: activeScheme, setColorScheme } = useNativeWindColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  // Rehidrata la preferencia guardada en el dispositivo.
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (!cancelled && isThemePreference(stored)) {
          setPreferenceState(stored);
        }
      })
      .catch(() => {
        // Sin preferencia guardada seguimos con 'system'.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setColorScheme(preference);
  }, [preference, setColorScheme]);

  const setPreference = useCallback((nextPreference: ThemePreference) => {
    setPreferenceState(nextPreference);
    AsyncStorage.setItem(STORAGE_KEY, nextPreference).catch(() => {});
  }, []);

  const colorScheme: ColorScheme = activeScheme === 'dark' ? 'dark' : 'light';
  const isDark = colorScheme === 'dark';

  const value = useMemo<ThemeContextValue>(
    () => ({
      preference,
      setPreference,
      colorScheme,
      isDark,
      colors: Colors[colorScheme],
    }),
    [preference, setPreference, colorScheme, isDark],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme debe usarse dentro de ThemeProvider');
  }
  return context;
}
