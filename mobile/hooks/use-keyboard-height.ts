import { useSyncExternalStore } from 'react';
import { Dimensions, Keyboard, type KeyboardEvent } from 'react-native';

let height = 0;
let isVisible = false;
const listeners = new Set<() => void>();
let subscriptions: { remove: () => void }[] | null = null;

function emit() {
  listeners.forEach((listener) => listener());
}

function setHeight(next: number) {
  if (height === next) return;
  height = next;
  emit();
}

function handleShow(event: KeyboardEvent) {
  const { height: reported, screenY } = event.endCoordinates;
  const computed = Math.max(0, Dimensions.get('screen').height - screenY);
  const next = Math.max(reported > 0 ? reported : 0, computed);
  if (!isVisible && next <= 0) return;
  isVisible = true;
  setHeight(next);
}

function handleHide() {
  if (!isVisible) return;
  isVisible = false;
  setHeight(0);
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  if (!subscriptions) {
    subscriptions = [
      Keyboard.addListener('keyboardWillShow', handleShow),
      Keyboard.addListener('keyboardDidShow', handleShow),
      Keyboard.addListener('keyboardWillHide', handleHide),
      Keyboard.addListener('keyboardDidHide', handleHide),
    ];
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && subscriptions) {
      subscriptions.forEach((subscription) => subscription.remove());
      subscriptions = null;
      height = 0;
      isVisible = false;
    }
  };
}

function getSnapshot() {
  return height;
}

export function useKeyboardHeight() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
