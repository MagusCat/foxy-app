import { useEffect, useState } from 'react';
import { Dimensions, Keyboard, KeyboardEvent } from 'react-native';

export function useKeyboardHeight() {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    let isVisible = false;

    const show = (event: KeyboardEvent) => {
      const { height: reported, screenY } = event.endCoordinates;
      const computed = Math.max(0, Dimensions.get('screen').height - screenY);
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
