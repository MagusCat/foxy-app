import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useKeyboardHeight } from '@/hooks/use-keyboard-height';

/**
 * Padding inferior para los modales tipo hoja (anclados abajo).
 *
 * Con el teclado abierto hay que levantar la hoja o tapa el input y los
 * botones. En Android además hay que descontar la barra de navegación: los
 * modales usan `navigationBarTranslucent`, así que la ventana se dibuja por
 * detrás de ella y la altura del teclado por sí sola deja los botones
 * justo debajo del teclado (invisibles).
 *
 * Con el teclado cerrado basta con respetar el inset inferior del sistema.
 */
export function useSheetPaddingBottom() {
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();

  if (keyboardHeight > 0) {
    return keyboardHeight + (Platform.OS === 'android' ? insets.bottom : 0) + 16;
  }

  return insets.bottom + (Platform.OS === 'ios' ? 36 : 24);
}
