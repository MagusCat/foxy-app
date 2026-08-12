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

const STROKE = 18;
const KNOB_RADIUS = 14;
const KNOB_STROKE = 4;
/** Cuánto sobresale el pomo del trazo: el aro se mete hacia dentro para que quepa. */
const INSET = Math.max(STROKE / 2, KNOB_RADIUS + KNOB_STROKE / 2);

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
 * Traduce el punto que toca el dedo a una nota.
 *
 * En el hueco de abajo no se calcula nada: se mantiene el extremo del que
 * viene el gesto. Si se cogiera el más cercano, arrastrar de largo por debajo
 * saltaría de 100 % a 50 % de golpe, que es lo que hacía que el dial pareciera
 * volverse loco.
 */
function pointToGrade(x: number, y: number, center: number, previous: number) {
  const degrees = (Math.atan2(y - center, x - center) * 180) / Math.PI;
  let offset = degrees - START_ANGLE;
  while (offset < 0) offset += 360;

  if (offset > SWEEP) {
    return previous > (MIN_GRADE + MAX_GRADE) / 2 ? MAX_GRADE : MIN_GRADE;
  }

  return Math.round(MIN_GRADE + (offset / SWEEP) * (MAX_GRADE - MIN_GRADE));
}

type GradeDialProps = {
  value: number;
  onChange: (value: number) => void;
  size?: number;
  color: string;
  /** Avisa mientras se arrastra, para poder bloquear el scroll de la pantalla. */
  onDragChange?: (dragging: boolean) => void;
};

/**
 * Selector circular de calificación objetivo (50 % a 100 %). Se puede
 * arrastrar sobre el aro o ajustar de uno en uno con los botones, que además
 * es la única forma accesible con lector de pantalla.
 */
export function GradeDial({ value, onChange, size = 232, color, onDragChange }: GradeDialProps) {
  const { colors, isDark } = useTheme();

  const center = size / 2;
  const radius = center - INSET;

  const clamped = Math.min(Math.max(value, MIN_GRADE), MAX_GRADE);
  const angle = gradeToAngle(clamped);
  const knob = polar(center, center, radius, angle);

  // El valor vive fuera del responder: el gesto lee siempre el último
  // publicado y así no se dispara un cambio por cada píxel repetido.
  const latest = useRef(clamped);
  latest.current = clamped;

  const container = useRef<View>(null);
  /** Esquina del dial en la pantalla, para poder trabajar con `pageX/pageY`. */
  const origin = useRef({ x: 0, y: 0 });

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        // Una vez cogido el gesto no se suelta: si no, el scroll de la
        // pantalla se lo lleva en cuanto el dedo sube o baja un poco.
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,

        onPanResponderGrant: (event) => {
          onDragChange?.(true);

          // En `grant` las coordenadas locales sí son de esta vista; se
          // aprovecha para apuntar dónde está en pantalla y poder seguir el
          // dedo aunque se salga del dial.
          const { locationX, locationY, pageX, pageY } = event.nativeEvent;
          origin.current = { x: pageX - locationX, y: pageY - locationY };

          const next = pointToGrade(locationX, locationY, center, latest.current);
          if (next !== latest.current) {
            latest.current = next;
            onChange(next);
          }
        },

        onPanResponderMove: (event) => {
          // Fuera de la vista, `locationX/locationY` dejan de ser fiables
          // (pasan a referirse a lo que haya debajo del dedo); `pageX/pageY`
          // siempre valen.
          const x = event.nativeEvent.pageX - origin.current.x;
          const y = event.nativeEvent.pageY - origin.current.y;

          const next = pointToGrade(x, y, center, latest.current);
          if (next === latest.current) return;

          latest.current = next;
          onChange(next);
          // Un toque seco cada 5 puntos: marcar cada grado vibra sin parar.
          if (next % 5 === 0) Haptics.selectionAsync().catch(() => {});
        },

        onPanResponderRelease: () => onDragChange?.(false),
        onPanResponderTerminate: () => onDragChange?.(false),
      }),
    [center, onChange, onDragChange],
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
        ref={container}
        style={{ width: size, height: size }}
        {...responder.panHandlers}
        accessibilityRole="adjustable"
        accessibilityLabel="Calificación objetivo"
        accessibilityValue={{ min: MIN_GRADE, max: MAX_GRADE, now: clamped }}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'increment') step(1);
          if (event.nativeEvent.actionName === 'decrement') step(-1);
        }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      >
        {/* El SVG no intercepta el toque: el gesto lo maneja el contenedor,
            que es el único que da coordenadas locales fiables. */}
        <Svg width={size} height={size} pointerEvents="none">
          <Path
            d={arcPath(center, center, radius, START_ANGLE, START_ANGLE + SWEEP)}
            stroke={isDark ? Palette.surfaceDark : '#E5E7EB'}
            strokeWidth={STROKE}
            strokeLinecap="round"
            fill="none"
          />
          {clamped > MIN_GRADE ? (
            <Path
              d={arcPath(center, center, radius, START_ANGLE, angle)}
              stroke={color}
              strokeWidth={STROKE}
              strokeLinecap="round"
              fill="none"
            />
          ) : null}

          <Circle cx={knob.x} cy={knob.y} r={KNOB_RADIUS} fill={colors.card} />
          <Circle
            cx={knob.x}
            cy={knob.y}
            r={KNOB_RADIUS}
            stroke={color}
            strokeWidth={KNOB_STROKE}
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
