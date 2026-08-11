import React from 'react';
import { Text, View } from 'react-native';

import { Palette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';

type BrandLogoProps = {
  /** Lado del cuadro de la marca en px. */
  size?: number;
  /** Añade el nombre de la app a la derecha del símbolo. */
  withWordmark?: boolean;
  /** Fondo del símbolo. Sobre el splash rojo conviene pasar blanco. */
  background?: string;
  /** Color del nombre. Por defecto sigue al tema (claro/oscuro). */
  wordmarkColor?: string;
};

/**
 * ESPACIO RESERVADO PARA EL LOGO.
 *
 * Todavía no existe el archivo de marca, así que aquí va un símbolo
 * provisional con las proporciones finales. Cuando llegue el logo real solo
 * hay que cambiar el contenido de este componente (por ejemplo, un
 * `<Image source={require('@/assets/images/logo.png')} />`): las pantallas de
 * splash, onboarding e inicio de sesión ya reservan el hueco con este tamaño.
 */
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
        // El color va por `style` y no por clases: un `color: undefined` en el
        // estilo pisa al de la clase de NativeWind y el texto se caía al negro
        // por defecto, que en modo oscuro se pierde contra el fondo.
        <Text className="ml-3 font-bold" style={{ fontSize: size * 0.55, color: wordmarkColor ?? colors.text }}>
          Fox
        </Text>
      ) : null}
    </View>
  );
}
