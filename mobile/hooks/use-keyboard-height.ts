import { useEffect, useState } from 'react';
import { Dimensions, Keyboard, KeyboardEvent } from 'react-native';

export function useKeyboardHeight() {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    let isVisible = false;

    const show = (event: KeyboardEvent) => {
      const { height: reported, screenY } = event.endCoordinates;
      // En Android edge-to-edge el alto reportado puede quedarse corto (no
      // incluye la franja del nav bar/gestos) y el contenido queda medio
      // tapado. Manda el mayor entre lo reportado y lo que el teclado
      // ocupa de verdad según su posición en pantalla.
      const computed = Math.max(0, Dimensions.get('window').height - screenY);
      const next = Math.max(reported > 0 ? reported : 0, computed);
      if (!isVisible && next <= 0) return;
      isVisible = true;
      setHeight((prev) => (prev === next ? prev : next));
    };

    const hide = () => {
      if (!isVisible) return;
      isVisible = false;
      setHeight(0);
    };

    const subscriptions = [
      Keyboard.addListener('keyboardWillShow', show),
      Keyboard.addListener('keyboardDidShow', show),
      Keyboard.addListener('keyboardWillHide', hide),
      Keyboard.addListener('keyboardDidHide', hide),
    ];

    return () => {
      subscriptions.forEach((subscription) => subscription.remove());
    };
  }, []);

  return height;
}
