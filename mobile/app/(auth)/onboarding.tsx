import React, { useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { BrandLogo } from '@/components/brand-logo';
import { useScreenPadding } from '@/components/screen-header';
import { softTint } from '@/components/settings-ui';
import { Palette } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/contexts/theme-context';

type Slide = {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  title: string;
  description: string;
};

const SLIDES: Slide[] = [
  {
    icon: 'sparkles',
    color: Palette.primary,
    title: 'Pregunta lo que sea',
    description:
      'Escribe tu duda o toma una foto del ejercicio. Foxy te lo explica paso a paso, con tus palabras.',
  },
  {
    icon: 'calendar',
    color: Palette.accentBlue,
    title: 'Lleva tus exámenes al día',
    description:
      'Guarda fechas, materias y salones en un solo lugar. Nada de enterarte del examen la noche anterior.',
  },
  {
    icon: 'flame',
    color: Palette.flameOrange,
    title: 'Estudia sin agobios',
    description:
      'Sesiones cortas, rachas y logros. Un poquito cada día rinde más que desvelarse una vez.',
  },
];

export default function OnboardingScreen() {
  const { width } = useWindowDimensions();
  const padding = useScreenPadding();
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { markOnboardingSeen } = useAuth();

  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);

  const isLast = index === SLIDES.length - 1;

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    if (next !== index) setIndex(next);
  };

  const goToLogin = () => {
    markOnboardingSeen();
    router.replace('/login');
  };

  const handleNext = () => {
    if (isLast) {
      goToLogin();
      return;
    }
    scrollRef.current?.scrollTo({ x: width * (index + 1), animated: true });
  };

  return (
    <View className="flex-1 bg-bg-light dark:bg-bg-dark">
      {/* ENCABEZADO: marca a la izquierda, salir a la derecha */}
      <View
        className="flex-row items-center justify-between px-6"
        style={{ paddingTop: padding.top }}
      >
        <BrandLogo size={34} withWordmark />

        <TouchableOpacity
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Saltar la introducción"
          onPress={goToLogin}
        >
          <Text className="text-[13px] font-semibold text-text-secondary-light dark:text-text-secondary-dark">
            Saltar
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        className="flex-1"
      >
        {SLIDES.map((slide) => (
          <View key={slide.title} style={{ width }} className="flex-1 items-center justify-center px-8">
            {/* Hueco de la ilustración. TODO(diseño): sustituir por el arte
                definitivo cuando esté; las medidas ya son las finales. */}
            <View
              className="mb-9 items-center justify-center rounded-[36px]"
              style={{
                width: Math.min(width - 96, 260),
                height: Math.min(width - 96, 260),
                backgroundColor: softTint(slide.color, isDark),
              }}
            >
              <Ionicons name={slide.icon} size={84} color={slide.color} />
            </View>

            <Text className="text-center text-[24px] font-bold text-text-primary-light dark:text-text-primary-dark">
              {slide.title}
            </Text>
            <Text className="mt-3 text-center text-[14px] leading-[21px] text-text-secondary-light dark:text-text-secondary-dark">
              {slide.description}
            </Text>
          </View>
        ))}
      </ScrollView>

      {/* PIE: puntos y acciones */}
      <View className="px-8" style={{ paddingBottom: padding.stackBottom }}>
        <View className="mb-7 flex-row items-center justify-center">
          {SLIDES.map((slide, slideIndex) => {
            const isActive = slideIndex === index;
            return (
              <View
                key={slide.title}
                className="mx-1 h-2 rounded-full"
                style={{
                  // El punto activo se alarga en vez de crecer: se lee mejor
                  // de un vistazo en qué paso vas.
                  width: isActive ? 22 : 8,
                  backgroundColor: isActive ? Palette.primary : colors.cardBorder,
                }}
              />
            );
          })}
        </View>

        <TouchableOpacity
          className="items-center justify-center rounded-full py-4"
          style={{ backgroundColor: Palette.primary }}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={isLast ? 'Comenzar ahora' : 'Siguiente'}
          onPress={handleNext}
        >
          <Text className="text-[13px] font-bold uppercase tracking-wider text-white">
            {isLast ? 'Comenzar ahora' : 'Siguiente'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="mt-3 items-center justify-center rounded-full border py-4"
          style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Ya tengo cuenta"
          onPress={goToLogin}
        >
          <Text className="text-[13px] font-bold uppercase tracking-wider text-text-primary-light dark:text-text-primary-dark">
            Ya tengo cuenta
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
