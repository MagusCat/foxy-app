import React, { useMemo, useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useGuardedRouter } from '@/features/shared/hooks/use-guarded-router';

import { GoalBar } from '@/components/goal-bar';
import { AppHeader, useScreenPadding } from '@/components/screen-header';
import { softTint } from '@/components/settings-ui';
import { getSubjectAccent } from '@/constants/subject-colors';
import { normalizeSubject } from '@/constants/subjects';
import { Palette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { appAlert } from '@/features/shared/components/overlay';
import { useKeyboardHeight } from '@/hooks/use-keyboard-height';
import { describeCountdown, planProgress, useStudyPlans } from '@/hooks/use-study-plans';

export default function ExamsScreen() {
  const padding = useScreenPadding();
  const router = useGuardedRouter();
  const keyboardHeight = useKeyboardHeight();
  const { colors, isDark } = useTheme();

  const { plans, removePlan } = useStudyPlans();
  const [query, setQuery] = useState('');

  const visiblePlans = useMemo(() => {
    // Normalización sin tildes (doc Parte 5.4): nadie escribe acentos en un
    // buscador. Buscar "quim" debe encontrar "Química".
    const clean = normalizeSubject(query.trim());
    if (!clean) return plans;
    return plans.filter(
      (plan) =>
        normalizeSubject(plan.title).includes(clean) || normalizeSubject(plan.subject).includes(clean),
    );
  }, [plans, query]);

  const handleDelete = (id: string, title: string) => {
    appAlert('Eliminar plan', `¿Eliminar "${title}" y todo su progreso?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => removePlan(id) },
    ]);
  };

  return (
    <View className="flex-1 bg-bg-light dark:bg-bg-dark">
      <AppHeader />

      <ScrollView
        className="px-5"
        contentContainerStyle={{ paddingBottom: padding.tabBottom + keyboardHeight }}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row items-center gap-2.5">
          <View
            className="h-11 flex-1 flex-row items-center rounded-full border px-3.5"
            style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}
          >
            <Ionicons name="search" size={16} color={colors.icon} />
            <TextInput
              className="ml-2 flex-1 text-[14px] text-text-primary-light dark:text-text-primary-dark"
              placeholder="Buscar plan"
              placeholderTextColor={colors.icon}
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
            />
            {query ? (
              <TouchableOpacity
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Borrar búsqueda"
                onPress={() => setQuery('')}
              >
                <Ionicons name="close-circle" size={16} color={colors.icon} />
              </TouchableOpacity>
            ) : null}
          </View>

          <TouchableOpacity
            className="h-11 flex-row items-center rounded-full border px-4"
            style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Nuevo plan"
            onPress={() => router.push('/exam/new')}
          >
            <Ionicons name="add" size={17} color={colors.text} />
            <Text className="ml-1 text-[14px] font-semibold text-text-primary-light dark:text-text-primary-dark">
              Nuevo plan
            </Text>
          </TouchableOpacity>
        </View>

        <View className="mt-7">
          <View className="mb-3 flex-row items-center">
            <Text className="text-[19px] font-bold text-text-primary-light dark:text-text-primary-dark">
              Mis planes de estudio
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.text} style={{ marginLeft: 4 }} />
          </View>

          {plans.length === 0 ? (
            <View
              className="items-start rounded-[24px] border p-5"
              style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}
            >
              <View className="mb-3.5 flex-row">
                <View
                  className="h-10 w-10 items-center justify-center rounded-full border-2"
                  style={{ backgroundColor: softTint(Palette.primary, isDark), borderColor: colors.card }}
                >
                  <Ionicons name="flame" size={18} color={Palette.primary} />
                </View>
                <View
                  className="-ml-2.5 h-10 w-10 items-center justify-center rounded-full border-2"
                  style={{ backgroundColor: softTint(Palette.accentBlue, isDark), borderColor: colors.card }}
                >
                  <Ionicons name="school" size={18} color={Palette.accentBlue} />
                </View>
              </View>

              <Text className="mb-1.5 text-xl font-bold text-text-primary-light dark:text-text-primary-dark">
                Prepárate para tu examen con IA
              </Text>
              <Text className="mb-[18px] text-[13px] leading-[19px] text-text-secondary-light dark:text-text-secondary-dark">
                Dinos la materia, cuándo es y qué nota quieres. Foxy arma la ruta de estudio con tu
                propio material.
              </Text>

              <TouchableOpacity
                className="flex-row items-center rounded-[20px] px-[22px] py-3"
                style={{ backgroundColor: Palette.primary }}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Crear mi primer plan"
                onPress={() => router.push('/exam/new')}
              >
                <Ionicons name="sparkles" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text className="text-sm font-bold text-white">Crear mi primer plan</Text>
              </TouchableOpacity>
            </View>
          ) : visiblePlans.length === 0 ? (
            <Text className="py-4 text-[13px] text-text-secondary-light dark:text-text-secondary-dark">
              Ningún plan coincide con “{query.trim()}”.
            </Text>
          ) : (
            visiblePlans.map((plan) => {
              const progress = planProgress(plan);
              const accent = getSubjectAccent(plan.subject, isDark);

              return (
                <TouchableOpacity
                  key={plan.id}
                  className="mb-3 rounded-[22px] border p-4"
                  style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={`${plan.title}. ${progress.percent} por ciento de dominio. Examen ${describeCountdown(plan.examDate)}`}
                  accessibilityHint="Mantén pulsado para eliminar"
                  onPress={() => router.push({ pathname: '/exam/[id]', params: { id: plan.id } })}
                  onLongPress={() => handleDelete(plan.id, plan.title)}
                >
                  <Text
                    className="text-[17px] font-bold leading-[23px] text-text-primary-light dark:text-text-primary-dark"
                    numberOfLines={2}
                  >
                    {plan.title}
                  </Text>

                  <View className="mt-4 flex-row items-end">
                    <View className="flex-1">
                      <GoalBar
                        ratio={progress.ratio}
                        target={plan.targetGrade}
                        color={accent.color}
                        withTargetLabel
                      />
                    </View>
                    <Text className="ml-3 text-[15px] font-bold leading-[16px] text-text-primary-light dark:text-text-primary-dark">
                      {progress.percent}%
                    </Text>
                  </View>

                  <View className="mt-4 flex-row items-center justify-between">
                    <Text className="flex-1 pr-3 text-[13px] text-text-secondary-light dark:text-text-secondary-dark">
                      {describeCountdown(plan.examDate)} · {progress.topicsDone} de{' '}
                      {progress.topicsTotal} temas
                    </Text>

                    <TouchableOpacity
                      className="rounded-full px-5 py-2.5"
                      style={{ backgroundColor: Palette.primary }}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityLabel={`Continuar con ${plan.title}`}
                      onPress={() => router.push({ pathname: '/exam/[id]', params: { id: plan.id } })}
                    >
                      <Text className="text-[13px] font-bold text-white">Continuar</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}
