import React from 'react';
import { Text, View } from 'react-native';

import { useTheme } from '@/contexts/theme-context';

type GoalBarProps = {
  /** Dominio actual, 0 a 1. */
  ratio: number;
  /** Calificación objetivo en porcentaje: se dibuja como marca en la barra. */
  target: number;
  color: string;
  /** Muestra la etiqueta "calificación objetivo" sobre la marca. */
  withTargetLabel?: boolean;
  height?: number;
};

/**
 * Barra de dominio con la marca de la calificación objetivo. La meta se ve
 * siempre, aunque el avance sea 0: es la referencia de a dónde hay que llegar.
 */
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
              // La etiqueta se centra sobre la marca sin salirse por los lados.
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
