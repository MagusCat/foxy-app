import React from 'react';
import { Text, View } from 'react-native';

import { useTheme } from '@/contexts/theme-context';

type GoalBarProps = {
  ratio: number;
  target: number;
  color: string;
  withTargetLabel?: boolean;
  height?: number;
};

export function GoalBar({ ratio, target, color, withTargetLabel, height = 8 }: GoalBarProps) {
  const { colors } = useTheme();
  const clamped = Math.min(Math.max(ratio, 0), 1);
  const targetRatio = Math.min(Math.max(target / 100, 0), 1);

  return (
    <View>
      {withTargetLabel ? (
        <View className="mb-1 h-4 w-full">
          <Text
            className="absolute text-[10px] font-semibold italic"
            style={{
              color: '#F59E0B',
              left: `${targetRatio * 100}%`,
              transform: [{ translateX: -52 }],
              width: 104,
              textAlign: 'center',
            }}
            numberOfLines={1}
          >
            calificación objetivo
          </Text>
        </View>
      ) : null}

      <View
        className="w-full justify-center overflow-hidden rounded-full"
        style={{ height, backgroundColor: colors.surface }}
      >
        <View
          className="h-full rounded-full"
          style={{ width: `${clamped * 100}%`, backgroundColor: color }}
        />

        <View
          className="absolute rounded-full"
          style={{
            left: `${targetRatio * 100}%`,
            width: 3,
            height: height + 6,
            marginLeft: -1.5,
            backgroundColor: '#F59E0B',
          }}
        />
      </View>
    </View>
  );
}
