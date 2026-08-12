import React from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

type ProgressRingProps = {
  size?: number;
  stroke?: number;
  ratio: number;
  color: string;
  trackColor: string;
  children?: React.ReactNode;
};

export function ProgressRing({
  size = 64,
  stroke = 6,
  ratio,
  color,
  trackColor,
  children,
}: ProgressRingProps) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(Math.max(ratio, 0), 1);

  return (
    <View style={{ width: size, height: size }} className="items-center justify-center">
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={stroke}
          fill="none"
        />
        {clamped > 0 ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${circumference * clamped} ${circumference}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : null}
      </Svg>

      {children}
    </View>
  );
}
