import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useKeyboardHeight } from '@/hooks/use-keyboard-height';

export function useSheetPaddingBottom() {
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();

  if (keyboardHeight > 0) {
    return keyboardHeight + 12;
  }

  return insets.bottom + (Platform.OS === 'ios' ? 36 : 24);
}
