import React from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Márgenes verticales compartidos por todas las pantallas.
 *
 * Antes cada pestaña calculaba los suyos (12, 16, y algunas sumaban un `py-3`
 * encima), así que los títulos quedaban a distinta altura al cambiar de tab.
 */
export function useScreenPadding() {
  const insets = useSafeAreaInsets();

  return {
    /** Margen superior por debajo de la barra de estado. */
    top: Math.max(insets.top, 12) + 8,
    /** Deja libre la barra flotante de pestañas. */
    tabBottom: insets.bottom + 100,
    /** Pantallas apiladas: no hay barra flotante que esquivar. */
    stackBottom: insets.bottom + 32,
  };
}

type TabHeaderProps = {
  title: string;
  subtitle?: string;
  /** Acción principal alineada a la derecha del título. */
  right?: React.ReactNode;
};

/** Encabezado de una pestaña: título grande, subtítulo y acción opcional. */
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
