import { useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { BackHandler, Dimensions, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

let nodes = new Map<string, ReactNode>();
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return nodes;
}

function setPortalNode(id: string, node: ReactNode) {
  if (node === null) {
    if (!nodes.has(id)) return;
    const next = new Map(nodes);
    next.delete(id);
    nodes = next;
  } else {
    const next = new Map(nodes);
    next.set(id, node);
    nodes = next;
  }
  notify();
}

export function PortalHost() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  if (snapshot.size === 0) return null;

  return (
    <>
      {[...snapshot.entries()].map(([id, node]) => (
        <Animated.View
          key={id}
          entering={FadeIn.duration(180)}
          style={[StyleSheet.absoluteFill, { zIndex: 900, elevation: 900 }]}
        >
          {node}
        </Animated.View>
      ))}
    </>
  );
}

let portalIdCounter = 0;

const SHEET_SLIDE_DISTANCE = Math.round(Dimensions.get('window').height * 0.6);

export function SheetSlide({ children }: { children: ReactNode }) {
  const translateY = useSharedValue(SHEET_SLIDE_DISTANCE);

  useEffect(() => {
    translateY.value = withTiming(0, { duration: 320, easing: Easing.out(Easing.cubic) });
  }, [translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
}

type AppModalProps = {
  visible: boolean;
  onRequestClose: () => void;
  children: ReactNode;
};

export function AppModal({ visible, onRequestClose, children }: AppModalProps) {
  const idRef = useRef<string>(undefined);
  if (!idRef.current) idRef.current = `modal-${++portalIdCounter}`;

  useEffect(() => {
    setPortalNode(idRef.current!, visible ? children : null);
  });

  useEffect(() => () => setPortalNode(idRef.current!, null), []);

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onRequestClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, onRequestClose]);

  return null;
}
