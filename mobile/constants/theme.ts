import { DarkTheme, DefaultTheme, type Theme } from '@react-navigation/native';
import { Platform } from 'react-native';

export const Palette = {
  primary: '#EF4444',
  primaryDark: '#DC2626',
  primaryGlow: '#F87171',

  accentBlue: '#3B82F6',
  accentBlueDark: '#1D4ED8',
  accentBlueGlow: '#60A5FA',

  accentPurple: '#A855F7',
  flameOrange: '#F97316',

  bgDark: '#0C0B0E',
  cardDark: '#16151B',
  cardDarkBorder: '#2D2533',
  surfaceDark: '#211F2B',
  surfaceDarkBorder: '#383144',

  bgLight: '#F9FAFB',
  cardLight: '#FFFFFF',
  cardLightBorder: '#E5E7EB',
  surfaceLight: '#F3F4F6',

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
