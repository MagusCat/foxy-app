import React from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

type ProgressRingProps = {
  /** Lado del círculo en px. */
  size?: number;
  stroke?: number;
  /** 0 a 1. */
  ratio: number;
  color: string;
  trackColor: string;
  /** Lo que va dentro del anillo (normalmente el porcentaje). */
  children?: React.ReactNode;
};

/**
 * Anillo de progreso. Se dibuja con un trazo discontinuo cuyo primer tramo
 * mide lo avanzado: es un único `Circle`, así que no hay costuras entre
 * mitades como en el truco de dos semicírculos.
 */
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
            // Sin girar, el trazo arranca a las 3 en punto.
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : null}
      </Svg>

      {children}
    </View>
  );
}
