import { useEffect, useState } from 'react';
import {
  Keyboard,
  KeyboardEvent,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const SHOW_EVENT = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
const HIDE_EVENT = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

export function useKeyboardHeight() {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const animate = () => {
      if (Platform.OS !== 'web') {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      }
    };

    const showSub = Keyboard.addListener(SHOW_EVENT, (event: KeyboardEvent) => {
      animate();
      setHeight(event.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(HIDE_EVENT, () => {
      animate();
      setHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return height;
}
