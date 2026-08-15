import React, { useEffect, useRef } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';

import { useTheme } from '@/contexts/theme-context';

export const WHEEL_ITEM_HEIGHT = 46;
const VISIBLE_ITEMS = 5;
const WHEEL_HEIGHT = WHEEL_ITEM_HEIGHT * VISIBLE_ITEMS;

type WheelPickerProps = {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  width?: number;
  accessibilityLabel: string;
};

export function WheelPicker({
  options,
  value,
  onChange,
  width = 78,
  accessibilityLabel,
}: WheelPickerProps) {
  const { colors } = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const index = Math.max(options.indexOf(value), 0);
  const settled = useRef(index);

  useEffect(() => {
    settled.current = index;
    const timer = setTimeout(
      () => scrollRef.current?.scrollTo({ y: index * WHEEL_ITEM_HEIGHT, animated: false }),
      0,
    );
    return () => clearTimeout(timer);
  }, [index]);

  const commit = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.y / WHEEL_ITEM_HEIGHT);
    const clamped = Math.min(Math.max(next, 0), options.length - 1);
    if (clamped === settled.current) return;

    settled.current = clamped;
    Haptics.selectionAsync().catch(() => {});
    onChange(options[clamped]);
  };

  return (
    <View style={{ width, height: WHEEL_HEIGHT }}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={WHEEL_ITEM_HEIGHT}
        decelerationRate="fast"
        onMomentumScrollEnd={commit}
        onScrollEndDrag={commit}
        accessibilityLabel={accessibilityLabel}
        contentContainerStyle={{
          paddingVertical: WHEEL_ITEM_HEIGHT * ((VISIBLE_ITEMS - 1) / 2),
        }}
      >
        {options.map((option) => {
          const isSelected = option === value;
          return (
            <View
              key={option}
              style={{ height: WHEEL_ITEM_HEIGHT }}
              className="items-center justify-center"
            >
              <Text
                style={{
                  fontSize: isSelected ? 26 : 20,
                  fontWeight: isSelected ? '700' : '500',
                  color: isSelected ? colors.text : colors.icon,
                  opacity: isSelected ? 1 : 0.55,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {option}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function WheelHighlight() {
  const { colors } = useTheme();
  return (
    <View
      pointerEvents="none"
      className="absolute left-0 right-0 rounded-2xl border"
      style={{
        top: WHEEL_ITEM_HEIGHT * 2,
        height: WHEEL_ITEM_HEIGHT,
        backgroundColor: colors.surface,
        borderColor: colors.cardBorder,
      }}
    />
  );
}
