import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';

import { Card, Note, ScreenShell, SectionTitle, softTint } from '@/components/settings-ui';
import { Palette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';

const WHAT_IT_DOES: { icon: keyof typeof Ionicons.glyphMap; title: string; text: string; color: string }[] = [
  {
    icon: 'chatbubble-ellipses-outline',
    title: 'Pregunta lo que sea',
    text: 'Escribe, dicta o manda una foto de tu problema y Foxy lo resuelve contigo, paso a paso.',
    color: Palette.accentBlue,
  },
  {
    icon: 'document-text-outline',
    title: 'Practica antes del examen',
    text: 'Foxy arma exámenes y planes de estudio con lo que necesitas repasar.',
    color: Palette.primary,
  },
  {
    icon: 'people-outline',
    title: 'Estudia con tu clase',
    text: 'Crea o únete a un salón para compartir materiales con tus compañeros.',
    color: Palette.accentPurple,
  },
  {
    icon: 'flame-outline',
    title: 'Mantén el ritmo',
    text: 'La racha, tu actividad y el calendario te ayudan a no dejar todo para el final.',
    color: Palette.flameOrange,
  },
];

const VALUES: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [
  { icon: 'happy-outline', text: 'Contenido apropiado para la edad de cada estudiante' },
  { icon: 'eye-off-outline', text: 'Sin anuncios ni seguimiento publicitario' },
  { icon: 'lock-closed-outline', text: 'Tus datos son tuyos: hoy ni siquiera salen del teléfono' },
  { icon: 'people-circle-outline', text: 'Las decisiones de dinero siempre pasan por un adulto' },
  { icon: 'school-outline', text: 'Foxy te acompaña a entender, no te da la respuesta y ya' },
];

export default function AboutFoxScreen() {
  const { isDark, colors } = useTheme();

  return (
    <ScreenShell title="¿Qué es Fox?" subtitle="La app, el zorro y para qué sirven">
      {/* HERO */}
      <LinearGradient
        colors={[Palette.primary, Palette.accentBlue]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderRadius: 24, padding: 22, marginTop: 8 }}
      >
        <View className="flex-row items-center">
          <View className="h-16 w-16 items-center justify-center rounded-3xl bg-white/20">
            <Text style={{ fontSize: 34 }}>🦊</Text>
          </View>
          <View className="ml-3.5 flex-1">
            <Text className="text-2xl font-bold text-white">Fox</Text>
            <Text className="mt-0.5 text-[13px] leading-[18px] text-white/90">
              Tu app de estudio con inteligencia artificial.
            </Text>
          </View>
        </View>

        <Text className="mt-4 text-[13px] leading-[19px] text-white/90">
          La app se llama <Text className="font-bold text-white">Fox</Text>. El zorro que te acompaña
          dentro se llama <Text className="font-bold text-white">Foxy</Text>: es quien lee tus
          apuntes, te explica los ejercicios y te recuerda que hoy toca estudiar.
        </Text>
      </LinearGradient>

      <SectionTitle>Qué puedes hacer</SectionTitle>
      <View className="gap-2.5">
        {WHAT_IT_DOES.map((item) => (
          <Card key={item.title}>
            <View className="flex-row items-start p-3.5">
              <View
                className="mr-3 h-10 w-10 items-center justify-center rounded-2xl"
                style={{ backgroundColor: softTint(item.color, isDark) }}
              >
                <Ionicons name={item.icon} size={20} color={item.color} />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-text-primary-light dark:text-text-primary-dark">
                  {item.title}
                </Text>
                <Text className="mt-1 text-[12px] leading-[17px] text-text-secondary-light dark:text-text-secondary-dark">
                  {item.text}
                </Text>
              </View>
            </View>
          </Card>
        ))}
      </View>

      <SectionTitle>Conoce a Foxy</SectionTitle>
      <Card>
        <View className="p-[18px]">
          <View className="mb-3 flex-row items-center">
            <View
              className="h-12 w-12 items-center justify-center rounded-2xl"
              style={{ backgroundColor: softTint(Palette.flameOrange, isDark) }}
            >
              <Text style={{ fontSize: 26 }}>🦊</Text>
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-base font-bold text-text-primary-light dark:text-text-primary-dark">
                Foxy
              </Text>
              <Text className="text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
                Mascota y tutor de la app
              </Text>
            </View>
          </View>

          <Text className="text-[13px] leading-[19px] text-text-secondary-light dark:text-text-secondary-dark">
            Elegimos un zorro porque es curioso, se adapta rápido y encuentra el camino corto sin
            hacer trampa. Foxy no está para darte la respuesta y desaparecer: te pregunta qué
            entendiste, te propone un ejercicio parecido y celebra tu racha contigo.
          </Text>

          <View className="mt-3.5 flex-row flex-wrap gap-2">
            {['Paciente', 'Curioso', 'Claro', 'Nada aburrido'].map((trait) => (
              <View
                key={trait}
                className="rounded-full px-3 py-1.5"
                style={{ backgroundColor: softTint(Palette.flameOrange, isDark) }}
              >
                <Text className="text-[12px] font-semibold" style={{ color: Palette.flameOrange }}>
                  {trait}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </Card>

      <SectionTitle>En qué creemos</SectionTitle>
      <Card>
        <View className="gap-3 p-[18px]">
          {VALUES.map((value) => (
            <View key={value.text} className="flex-row items-start">
              <Ionicons
                name={value.icon}
                size={17}
                color={colors.icon}
                style={{ marginTop: 1, marginRight: 10 }}
              />
              <Text className="flex-1 text-[13px] leading-[18px] text-text-primary-light dark:text-text-primary-dark">
                {value.text}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      <SectionTitle>La app</SectionTitle>
      <Card>
        <View className="flex-row items-center justify-between p-3.5">
          <Text className="text-[13px] text-text-secondary-light dark:text-text-secondary-dark">
            Versión
          </Text>
          <Text className="text-[13px] font-semibold text-text-primary-light dark:text-text-primary-dark">
            {Constants.expoConfig?.version ?? '1.0.0'}
          </Text>
        </View>
      </Card>

      <Note icon="construct-outline">
        Fox está en construcción: la interfaz ya está lista y la inteligencia artificial de Foxy se
        conecta en la siguiente etapa.
      </Note>
    </ScreenShell>
  );
}
