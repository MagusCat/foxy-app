import React from 'react';
import { Text, View } from 'react-native';

import { Palette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';

type BrandLogoProps = {
  size?: number;
  withWordmark?: boolean;
  background?: string;
  wordmarkColor?: string;
};

export function BrandLogo({
  size = 56,
  withWordmark = false,
  background = Palette.primary,
  wordmarkColor,
}: BrandLogoProps) {
  const { colors } = useTheme();

  return (
    <View className="flex-row items-center" accessibilityRole="image" accessibilityLabel="Fox">
      <View
        className="items-center justify-center"
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.28,
          backgroundColor: background,
        }}
      >
        <Text style={{ fontSize: size * 0.5 }}>🦊</Text>
      </View>

      {withWordmark ? (
        <Text className="ml-3 font-bold" style={{ fontSize: size * 0.55, color: wordmarkColor ?? colors.text }}>
          Fox
        </Text>
      ) : null}
    </View>
  );
}
