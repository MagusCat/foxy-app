import { Palette } from '@/constants/theme';

type AccentPair = {
  light: string;
  dark: string;
  softLight: string;
  softDark: string;
};

const ACCENT_POOL: AccentPair[] = [
  { light: Palette.primary, dark: Palette.primaryGlow, softLight: '#FEE2E2', softDark: '#2D1B22' },
  { light: Palette.accentBlue, dark: Palette.accentBlueGlow, softLight: '#DBEAFE', softDark: '#152238' },
  { light: Palette.accentPurple, dark: '#C084FC', softLight: '#F3E8FF', softDark: '#241A33' },
  { light: Palette.flameOrange, dark: '#FB923C', softLight: '#FFEDD5', softDark: '#331F14' },
  { light: '#10B981', dark: '#34D399', softLight: '#D1FAE5', softDark: '#122A22' },
  { light: '#14B8A6', dark: '#2DD4BF', softLight: '#CCFBF1', softDark: '#0F2B29' },
  { light: '#EC4899', dark: '#F472B6', softLight: '#FCE7F3', softDark: '#331222' },
  { light: '#F59E0B', dark: '#FBBF24', softLight: '#FEF3C7', softDark: '#332708' },
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getSubjectAccent(subject: string, isDark: boolean): { color: string; soft: string } {
  const entry = ACCENT_POOL[hashString(subject) % ACCENT_POOL.length];
  return {
    color: isDark ? entry.dark : entry.light,
    soft: isDark ? entry.softDark : entry.softLight,
  };
}
