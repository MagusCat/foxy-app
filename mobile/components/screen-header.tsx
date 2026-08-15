import React from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function useScreenPadding() {
  const insets = useSafeAreaInsets();

  return {
    top: Math.max(insets.top, 12) + 8,
    tabBottom: insets.bottom + 100,
    stackBottom: insets.bottom + 32,
  };
}

type TabHeaderProps = {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
};

export function TabHeader({ title, subtitle, right }: TabHeaderProps) {
  return (
    <View className="mb-5 flex-row items-center justify-between">
      <View className="flex-1 pr-3">
        <Text className="text-[26px] font-bold text-text-primary-light dark:text-text-primary-dark">
          {title}
        </Text>
        {subtitle ? (
          <Text className="mt-1 text-[13px] text-text-secondary-light dark:text-text-secondary-dark">
            {subtitle}
          </Text>
        ) : null}
      </View>

      {right}
    </View>
  );
}
