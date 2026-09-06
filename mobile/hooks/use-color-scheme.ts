import { useTheme } from '@/contexts/theme-context';

export function useColorScheme() {
  return useTheme().colorScheme;
}
