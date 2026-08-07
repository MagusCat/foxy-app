import { DarkTheme, DefaultTheme, type Theme } from '@react-navigation/native';
import { Platform } from 'react-native';

/**
 * Palette - Variables globales de color del proyecto Foxy
 * Paleta de tonos Rojos, Azules y tonalidades derivadas.
 */
export const Palette = {
  // Tonos Rojos Principales
  primary: '#EF4444',         // Rojo carmesí vibrante
  primaryDark: '#DC2626',     // Rojo oscuro
  primaryGlow: '#F87171',     // Resplandor rojo claro

  // Tonos Azules Principales
  accentBlue: '#3B82F6',      // Azul real / eléctrico
  accentBlueDark: '#1D4ED8',  // Azul profundo
  accentBlueGlow: '#60A5FA',  // Resplandor azul

  // Tonos Complementarios
  accentPurple: '#A855F7',    // Violeta acento
  flameOrange: '#F97316',     // Naranja racha

  // Modo Oscuro (Fondos y Superficies)
  bgDark: '#0C0B0E',          // Fondo principal ultra oscuro
  cardDark: '#16151B',        // Tarjetas y paneles de entrada
  cardDarkBorder: '#2D2533',  // Bordes de tarjetas con ligero matiz
  surfaceDark: '#211F2B',     // Superficie de botones redondos y cápsulas
  surfaceDarkBorder: '#383144',// Bordes de superficies

  // Modo Claro
  bgLight: '#F9FAFB',
  cardLight: '#FFFFFF',
  cardLightBorder: '#E5E7EB',
  surfaceLight: '#F3F4F6',

  // Colores de Texto
  textPrimaryDark: '#FFFFFF',
  textSecondaryDark: '#9CA3AF',
  textMutedDark: '#6B7280',

  textPrimaryLight: '#111827',
  textSecondaryLight: '#4B5563',
  textMutedLight: '#9CA3AF',
};

export const Colors = {
  light: {
    text: Palette.textPrimaryLight,
    textSecondary: Palette.textSecondaryLight,
    background: Palette.bgLight,
    card: Palette.cardLight,
    cardBorder: Palette.cardLightBorder,
    surface: Palette.surfaceLight,
    tint: Palette.primary,
    icon: '#6B7280',
    tabIconDefault: '#6B7280',
    tabIconSelected: Palette.primary,
  },
  dark: {
    text: Palette.textPrimaryDark,
    textSecondary: Palette.textSecondaryDark,
    background: Palette.bgDark,
    card: Palette.cardDark,
    cardBorder: Palette.cardDarkBorder,
    surface: Palette.surfaceDark,
    tint: Palette.primaryGlow,
    icon: '#9CA3AF',
    tabIconDefault: '#9CA3AF',
    tabIconSelected: Palette.primaryGlow,
  },
};

export const NavigationThemes: Record<'light' | 'dark', Theme> = {
  light: {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      primary: Palette.primary,
      background: Palette.bgLight,
      card: Palette.cardLight,
      text: Palette.textPrimaryLight,
      border: Palette.cardLightBorder,
      notification: Palette.primary,
    },
  },
  dark: {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      primary: Palette.primaryGlow,
      background: Palette.bgDark,
      card: Palette.cardDark,
      text: Palette.textPrimaryDark,
      border: Palette.cardDarkBorder,
      notification: Palette.primaryGlow,
    },
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
