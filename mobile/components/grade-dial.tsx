import React, { useMemo, useRef } from 'react';
import { PanResponder, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Svg, { Circle, Path } from 'react-native-svg';

import { Palette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';

export const MIN_GRADE = 50;
export const MAX_GRADE = 100;

/** El arco no cierra el círculo: el hueco de abajo marca dónde empieza. */
const START_ANGLE = 135;
const SWEEP = 270;

function polar(cx: number, cy: number, radius: number, degrees: number) {
  const radians = (degrees * Math.PI) / 180;
  return { x: cx + radius * Math.cos(radians), y: cy + radius * Math.sin(radians) };
}

function arcPath(cx: number, cy: number, radius: number, from: number, to: number) {
  const start = polar(cx, cy, radius, from);
  const end = polar(cx, cy, radius, to);
  const largeArc = to - from > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

function gradeToAngle(grade: number) {
  const ratio = (grade - MIN_GRADE) / (MAX_GRADE - MIN_GRADE);
  return START_ANGLE + ratio * SWEEP;
}

/**
 * Traduce el punto que toca el dedo a una nota. Fuera del arco (el hueco de
 * abajo) no se ignora el gesto: se pega al extremo más cercano, que es lo que
 * espera quien arrastra rápido y se pasa de largo.
 */
function pointToGrade(x: number, y: number, center: number) {
  const degrees = (Math.atan2(y - center, x - center) * 180) / Math.PI;
  let offset = degrees - START_ANGLE;
  while (offset < 0) offset += 360;

  if (offset > SWEEP) {
    offset = offset - SWEEP < 360 - offset ? SWEEP : 0;
  }

  return Math.round(MIN_GRADE + (offset / SWEEP) * (MAX_GRADE - MIN_GRADE));
}

type GradeDialProps = {
  value: number;
  onChange: (value: number) => void;
  size?: number;
  color: string;
};

/**
 * Selector circular de calificación objetivo (50 % a 100 %). Se puede
 * arrastrar sobre el aro o ajustar de uno en uno con los botones, que además
 * es la única forma accesible con lector de pantalla.
 */
export function GradeDial({ value, onChange, size = 232, color }: GradeDialProps) {
  const { colors, isDark } = useTheme();

  const stroke = 18;
  const center = size / 2;
  const radius = (size - stroke) / 2;

  const clamped = Math.min(Math.max(value, MIN_GRADE), MAX_GRADE);
  const angle = gradeToAngle(clamped);
  const knob = polar(center, center, radius, angle);

  // El valor vive fuera del responder: el gesto lee siempre el último
  // publicado y así no se dispara un cambio por cada píxel repetido.
  const latest = useRef(clamped);
  latest.current = clamped;

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          const { locationX, locationY } = event.nativeEvent;
          const next = pointToGrade(locationX, locationY, center);
          if (next !== latest.current) {
            latest.current = next;
            onChange(next);
          }
        },
        onPanResponderMove: (event) => {
          const { locationX, locationY } = event.nativeEvent;
          const next = pointToGrade(locationX, locationY, center);
          if (next === latest.current) return;

          latest.current = next;
          onChange(next);
          // Un toque seco cada 5 puntos: marcar cada grado vibra sin parar.
          if (next % 5 === 0) Haptics.selectionAsync().catch(() => {});
        },
      }),
    [center, onChange],
  );

  const step = (delta: number) => {
    const next = Math.min(Math.max(clamped + delta, MIN_GRADE), MAX_GRADE);
    if (next === clamped) return;
    onChange(next);
    Haptics.selectionAsync().catch(() => {});
  };

  return (
    <View className="items-center">
      <View
        style={{ width: size, height: size }}
        {...responder.panHandlers}
        accessibilityRole="adjustable"
        accessibilityLabel="Calificación objetivo"
        accessibilityValue={{ min: MIN_GRADE, max: MAX_GRADE, now: clamped }}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'increment') step(1);
          if (event.nativeEvent.actionName === 'decrement') step(1 * -1);
        }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      >
        {/* El SVG no intercepta el toque: el gesto lo maneja el contenedor,
            que es el único que da coordenadas locales fiables. */}
        <Svg width={size} height={size} pointerEvents="none">
          <Path
            d={arcPath(center, center, radius, START_ANGLE, START_ANGLE + SWEEP)}
            stroke={isDark ? Palette.surfaceDark : '#E5E7EB'}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
          />
          {clamped > MIN_GRADE ? (
            <Path
              d={arcPath(center, center, radius, START_ANGLE, angle)}
              stroke={color}
              strokeWidth={stroke}
              strokeLinecap="round"
              fill="none"
            />
          ) : null}

          <Circle cx={knob.x} cy={knob.y} r={stroke * 0.78} fill={colors.card} />
          <Circle
            cx={knob.x}
            cy={knob.y}
            r={stroke * 0.78}
            stroke={color}
            strokeWidth={4}
            fill="none"
          />
        </Svg>

        <View className="absolute inset-0 items-center justify-center" pointerEvents="none">
          <Text
            className="font-bold text-text-primary-light dark:text-text-primary-dark"
            style={{ fontSize: 52, fontVariant: ['tabular-nums'] }}
          >
            {clamped}
            <Text style={{ fontSize: 26 }}>%</Text>
          </Text>
          <Text className="mt-1 text-[12px] font-semibold text-text-secondary-light dark:text-text-secondary-dark">
            calificación objetivo
          </Text>
        </View>
      </View>

      <View className="mt-4 flex-row items-center gap-4">
        <TouchableOpacity
          className="h-11 w-11 items-center justify-center rounded-full border"
          style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Bajar un punto"
          onPress={() => step(-1)}
        >
          <Ionicons name="remove" size={20} color={colors.text} />
        </TouchableOpacity>

        <Text className="w-[92px] text-center text-[13px] font-semibold text-text-secondary-light dark:text-text-secondary-dark">
          Arrastra el aro
        </Text>

        <TouchableOpacity
          className="h-11 w-11 items-center justify-center rounded-full border"
          style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Subir un punto"
          onPress={() => step(1)}
        >
          <Ionicons name="add" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
