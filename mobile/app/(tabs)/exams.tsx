import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';

import { GoalBar } from '@/components/goal-bar';
import { useScreenPadding } from '@/components/screen-header';
import { softTint } from '@/components/settings-ui';
import { getSubjectAccent } from '@/constants/subject-colors';
import { Palette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { useDailyStreak } from '@/hooks/use-daily-streak';
import { usePersistentState } from '@/hooks/use-persistent-state';
import { describeCountdown, planProgress, useStudyPlans } from '@/hooks/use-study-plans';

export default function ExamsScreen() {
  const padding = useScreenPadding();
  const router = useRouter();
  const { colors, isDark } = useTheme();

  const [streakCount] = useDailyStreak();
  const [userName] = usePersistentState('foxy:user-name', 'Usuario');
  const [avatarUri] = usePersistentState('foxy:avatar', '');
  const [school] = usePersistentState('foxy:school', '');
  const [profile] = usePersistentState('foxy:grade', { grade: '', tutor: '', shift: 'matutino' });

  const { plans, removePlan } = useStudyPlans();
  const [query, setQuery] = useState('');

  const visiblePlans = useMemo(() => {
    const clean = query.trim().toLowerCase();
    if (!clean) return plans;
    return plans.filter(
      (plan) =>
        plan.title.toLowerCase().includes(clean) || plan.subject.toLowerCase().includes(clean),
    );
  }, [plans, query]);

  const handleDelete = (id: string, title: string) => {
    Alert.alert('Eliminar preparación', `¿Eliminar "${title}" y todo su progreso?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => removePlan(id) },
    ]);
  };

  return (
    <View className="flex-1 bg-bg-light dark:bg-bg-dark">
      <ScrollView
        className="px-5"
        contentContainerStyle={{ paddingTop: padding.top, paddingBottom: padding.tabBottom }}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row items-center pb-5">
          <View className="flex-1 flex-row">
            <TouchableOpacity
              className="h-9 flex-row items-center rounded-full border px-3"
              style={{ backgroundColor: colors.surface, borderColor: colors.cardBorder }}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`Racha de ${streakCount} ${streakCount === 1 ? 'día' : 'días'}. Ver mi actividad`}
              onPress={() => router.push('/activity')}
            >
              <Ionicons name="flame" size={17} color={Palette.flameOrange} />
              <Text className="ml-1 text-[14px] font-bold text-text-primary-light dark:text-text-primary-dark">
                {streakCount}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Ver los planes de suscripción"
            onPress={() => router.push('/subscription')}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                height: 36,
                paddingHorizontal: 18,
                borderRadius: 18,
                backgroundColor: Palette.primary,
              }}
            >
              <Text className="text-[14px] font-bold text-white">Comprar</Text>
              <Ionicons name="sparkles" size={14} color="#FFFFFF" style={{ marginLeft: 6 }} />
            </View>
          </TouchableOpacity>

          <View className="flex-1 flex-row justify-end">
            <TouchableOpacity
              className="h-9 w-9 items-center justify-center overflow-hidden rounded-full border"
              style={{ backgroundColor: colors.surface, borderColor: colors.cardBorder }}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Ir a mi perfil"
              onPress={() => router.push('/(tabs)/profile')}
            >
              {avatarUri ? (
                <Image
                  source={{ uri: avatarUri }}
                  style={{ height: '100%', width: '100%' }}
                  contentFit="cover"
                />
              ) : (
                <Text className="text-[15px] font-bold text-text-primary-light dark:text-text-primary-dark">
                  {userName.charAt(0).toUpperCase()}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View className="flex-row items-center gap-2.5">
          <View
            className="h-11 flex-1 flex-row items-center rounded-full border px-3.5"
            style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}
          >
            <Ionicons name="search" size={16} color={colors.icon} />
            <TextInput
              className="ml-2 flex-1 text-[14px] text-text-primary-light dark:text-text-primary-dark"
              placeholder="Buscar examen"
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
            accessibilityLabel="Crear nuevo examen"
            onPress={() => router.push('/exam/new')}
          >
            <Ionicons name="add" size={17} color={colors.text} />
            <Text className="ml-1 text-[14px] font-semibold text-text-primary-light dark:text-text-primary-dark">
              Nuevo examen
            </Text>
          </TouchableOpacity>
        </View>

        <View className="mt-7">
          <View className="mb-3 flex-row items-center">
            <Text className="text-[19px] font-bold text-text-primary-light dark:text-text-primary-dark">
              Mis preparaciones de examen
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
                accessibilityLabel="Crear nuevo examen"
                onPress={() => router.push('/exam/new')}
              >
                <Ionicons name="sparkles" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text className="text-sm font-bold text-white">Crear nuevo examen</Text>
              </TouchableOpacity>
            </View>
          ) : visiblePlans.length === 0 ? (
            <Text className="py-4 text-[13px] text-text-secondary-light dark:text-text-secondary-dark">
              Ninguna preparación coincide con “{query.trim()}”.
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

        <View className="mt-7">
          <Text className="mb-3 text-[19px] font-bold text-text-primary-light dark:text-text-primary-dark">
            Mi escuela
          </Text>

          {school ? (
            <View
              className="items-center rounded-[24px] border px-5 py-7"
              style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}
            >
              <TouchableOpacity
                className="absolute right-3.5 top-3.5 h-9 w-9 items-center justify-center rounded-full"
                style={{ backgroundColor: colors.surface }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Editar mi escuela"
                onPress={() => router.push('/settings/school')}
              >
                <Ionicons name="pencil" size={15} color={colors.icon} />
              </TouchableOpacity>

              <View className="w-full flex-row items-center justify-center">
                <View className="w-9 items-center">
                  <Text style={{ fontSize: 24, lineHeight: 30 }}>🌿</Text>
                </View>
                <View
                  className="mx-2 h-14 w-14 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: colors.surface }}
                >
                  <Text style={{ fontSize: 26, lineHeight: 32 }}>🏛️</Text>
                </View>
                <View className="w-9 items-center">
                  <Text style={{ fontSize: 24, lineHeight: 30, transform: [{ scaleX: -1 }] }}>🌿</Text>
                </View>
              </View>

              <Text
                className="mt-3.5 text-center text-[21px] font-bold leading-[28px] text-text-primary-light dark:text-text-primary-dark"
                numberOfLines={3}
              >
                {school}
              </Text>

              {profile.grade ? (
                <Text className="mt-1.5 text-center text-[13px] text-text-secondary-light dark:text-text-secondary-dark">
                  {profile.grade}
                </Text>
              ) : null}
            </View>
          ) : (
            <View
              className="rounded-[20px] border p-[18px]"
              style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}
            >
              <Text className="mb-1.5 text-base font-bold text-text-primary-light dark:text-text-primary-dark">
                ¿A qué escuela vas?
              </Text>
              <Text className="mb-3.5 text-xs leading-[18px] text-text-secondary-light dark:text-text-secondary-dark">
                Personaliza tus exámenes con contenido relacionado a tus profesores y clases.
              </Text>
              <TouchableOpacity
                className="flex-row items-center self-start rounded-2xl px-4 py-[9px]"
                style={{ backgroundColor: Palette.primary }}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Agregar escuela"
                onPress={() => router.push('/settings/school')}
              >
                <Ionicons name="add" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text className="text-[13px] font-semibold text-white">Agregar escuela</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
