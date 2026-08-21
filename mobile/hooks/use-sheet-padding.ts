import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useKeyboardHeight } from '@/hooks/use-keyboard-height';

export function useSheetPaddingBottom() {
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();

  if (keyboardHeight > 0) {
    // La ventana NO se redimensiona con el teclado (modo overlay confirmado
    // en Expo Go SDK 54 edge-to-edge): hay que levantar el contenido por
    // encima del teclado en ambas plataformas. El inset inferior queda
    // tapado por el teclado, así que no se suma aquí.
    return keyboardHeight + 16;
  }

  return insets.bottom + (Platform.OS === 'ios' ? 36 : 24);
}
