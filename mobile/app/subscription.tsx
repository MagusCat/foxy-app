import React from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Card, Note, ScreenShell, SectionTitle, softTint } from '@/components/settings-ui';
import { BASIC_DAILY_QUESTIONS, PLANS, type Plan } from '@/constants/plans';
import { useTheme } from '@/contexts/theme-context';
import { useSubscription } from '@/hooks/use-subscription';

export default function SubscriptionScreen() {
  const { isDark, colors } = useTheme();
  const { plan: currentPlan, planId, setPlanId, isBasic, questionsToday, limit, remaining } =
    useSubscription();

  const usedRatio = limit ? Math.min(questionsToday / limit, 1) : 0;

  const handleChoosePlan = (plan: Plan) => {
    if (plan.id === planId) return;

    Alert.alert(
      `Cambiar a ${plan.name}`,
      `${plan.price} ${plan.period}.\n\nLos planes se activan con un adulto responsable: nunca te vamos a cobrar sin su permiso.`,
      [
        { text: 'Ahora no', style: 'cancel' },
        {
          text: 'Avisar a un adulto',
          onPress: () =>
            Alert.alert(
              'Listo',
              'Cuando conectemos las cuentas, aquí se enviará el aviso al correo del adulto que registres en Mi cuenta.',
            ),
        },
        {
          text: 'Ver en la app',
          onPress: () => {
            setPlanId(plan.id);
            Alert.alert(
              'Modo vista previa',
              `La app se ve con ${plan.name}. No se cobró nada: es solo para revisar cómo queda.`,
            );
          },
        },
      ],
    );
  };

  return (
    <ScreenShell title="Planes de Fox" subtitle="Elige cómo quieres estudiar con Foxy">
      <View
        className="mt-2 rounded-[22px] border p-[18px]"
        style={{
          backgroundColor: softTint(currentPlan.color, isDark),
          borderColor: currentPlan.color,
        }}
      >
        <View className="flex-row items-center">
          <View
            className="h-11 w-11 items-center justify-center rounded-2xl"
            style={{ backgroundColor: colors.card }}
          >
            <Ionicons name={currentPlan.icon} size={22} color={currentPlan.color} />
          </View>
          <View className="ml-3 flex-1">
            <Text className="text-[11px] font-bold uppercase tracking-wider" style={{ color: currentPlan.color }}>
              Tu plan actual
            </Text>
            <Text className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark">
              {currentPlan.name}
            </Text>
          </View>
          <Text className="text-sm font-bold" style={{ color: currentPlan.color }}>
            {currentPlan.price}
          </Text>
        </View>

        <Text className="mt-2.5 text-[13px] leading-[19px] text-text-secondary-light dark:text-text-secondary-dark">
          {currentPlan.tagline}
        </Text>

        {isBasic && limit ? (
          <View className="mt-3.5">
            <View className="mb-1.5 flex-row items-center justify-between">
              <Text className="text-xs font-semibold text-text-primary-light dark:text-text-primary-dark">
                Preguntas de hoy
              </Text>
              <Text className="text-xs font-bold" style={{ color: currentPlan.color }}>
                {questionsToday} / {limit}
              </Text>
            </View>
            <View className="h-2 overflow-hidden rounded-full" style={{ backgroundColor: colors.card }}>
              <View
                className="h-full rounded-full"
                style={{ width: `${Math.round(usedRatio * 100)}%`, backgroundColor: currentPlan.color }}
              />
            </View>
            <Text className="mt-1.5 text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
              {remaining === 0
                ? 'Se renuevan mañana automáticamente.'
                : `Te quedan ${remaining} preguntas y se renuevan mañana.`}
            </Text>
          </View>
        ) : null}
      </View>

      <Note icon="shield-checkmark-outline">
        Fox es una app de estudio para toda la familia: sin anuncios, sin compras dentro del chat y
        con la autorización de un adulto para cualquier cambio de plan.
      </Note>

      <SectionTitle>Todos los planes</SectionTitle>

      {PLANS.map((plan) => {
        const isCurrent = plan.id === planId;

        return (
          <View
            key={plan.id}
            className="mb-3 rounded-[22px] border p-[18px]"
            style={{
              backgroundColor: colors.card,
              borderColor: isCurrent ? plan.color : colors.cardBorder,
              borderWidth: isCurrent ? 1.5 : 1,
            }}
          >
            <View className="flex-row items-start">
              <View
                className="h-10 w-10 items-center justify-center rounded-2xl"
                style={{ backgroundColor: softTint(plan.color, isDark) }}
              >
                <Ionicons name={plan.icon} size={20} color={plan.color} />
              </View>

              <View className="ml-3 flex-1">
                <View className="flex-row flex-wrap items-center">
                  <Text className="mr-2 text-base font-bold text-text-primary-light dark:text-text-primary-dark">
                    {plan.name}
                  </Text>
                  {plan.badge ? (
                    <View
                      className="rounded-full px-2 py-0.5"
                      style={{ backgroundColor: softTint(plan.color, isDark) }}
                    >
                      <Text className="text-[10px] font-bold" style={{ color: plan.color }}>
                        {isCurrent ? 'Tu plan actual' : plan.badge}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text className="mt-0.5 text-[12px] leading-[17px] text-text-secondary-light dark:text-text-secondary-dark">
                  {plan.tagline}
                </Text>
              </View>
            </View>

            <View className="mt-3 flex-row items-baseline">
              <Text className="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark">
                {plan.price}
              </Text>
              <Text className="ml-1.5 text-xs text-text-secondary-light dark:text-text-secondary-dark">
                {plan.period}
              </Text>
            </View>

            <View className="mt-3 gap-2">
              {plan.benefits.map((benefit) => (
                <View key={benefit} className="flex-row items-start">
                  <Ionicons
                    name="checkmark-circle"
                    size={15}
                    color={plan.color}
                    style={{ marginTop: 1, marginRight: 7 }}
                  />
                  <Text className="flex-1 text-[13px] leading-[18px] text-text-primary-light dark:text-text-primary-dark">
                    {benefit}
                  </Text>
                </View>
              ))}

              {plan.missing?.map((item) => (
                <View key={item} className="flex-row items-start" style={{ opacity: 0.55 }}>
                  <Ionicons
                    name="remove-circle-outline"
                    size={15}
                    color={colors.icon}
                    style={{ marginTop: 1, marginRight: 7 }}
                  />
                  <Text className="flex-1 text-[13px] leading-[18px] text-text-secondary-light dark:text-text-secondary-dark">
                    {item}
                  </Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              className="mt-4 items-center rounded-[16px] py-3"
              style={{
                backgroundColor: isCurrent ? softTint(plan.color, isDark) : plan.color,
              }}
              activeOpacity={isCurrent ? 1 : 0.85}
              disabled={isCurrent}
              accessibilityRole="button"
              accessibilityLabel={isCurrent ? `${plan.name} es tu plan actual` : `Cambiar a ${plan.name}`}
              onPress={() => handleChoosePlan(plan)}
            >
              <Text
                className="text-sm font-bold"
                style={{ color: isCurrent ? plan.color : '#FFFFFF' }}
              >
                {isCurrent ? 'Tu plan actual' : plan.id === 'basico' ? 'Volver a este plan' : 'Mejorar plan'}
              </Text>
            </TouchableOpacity>
          </View>
        );
      })}

      <SectionTitle>Para mamá, papá o tutor</SectionTitle>

      <Card>
        <View className="p-[18px]">
          <Text className="text-[15px] font-bold text-text-primary-light dark:text-text-primary-dark">
            Estudiar tranquilos
          </Text>
          <Text className="mt-1.5 text-[13px] leading-[19px] text-text-secondary-light dark:text-text-secondary-dark">
            Fox está pensado para estudiantes, así que las decisiones de dinero siempre pasan por un
            adulto y el contenido se mantiene apropiado para la edad de cada perfil.
          </Text>

          <View className="mt-3.5 gap-2.5">
            {[
              { icon: 'happy-outline' as const, text: 'Respuestas apropiadas para la edad del estudiante' },
              { icon: 'time-outline' as const, text: 'Límites de tiempo de uso configurables' },
              { icon: 'mail-outline' as const, text: 'Resumen semanal del avance al correo del adulto' },
              { icon: 'card-outline' as const, text: 'Cancela cuando quieras, sin llamadas ni trámites' },
            ].map((item) => (
              <View key={item.text} className="flex-row items-center">
                <Ionicons name={item.icon} size={16} color={colors.icon} style={{ marginRight: 9 }} />
                <Text className="flex-1 text-[13px] text-text-primary-light dark:text-text-primary-dark">
                  {item.text}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </Card>

      <Note icon="information-circle-outline">
        Con {PLANS[0].name} tienes {BASIC_DAILY_QUESTIONS} preguntas diarias, que se renuevan solas
        cada día. No hace falta pagar para seguir estudiando.
      </Note>
    </ScreenShell>
  );
}
