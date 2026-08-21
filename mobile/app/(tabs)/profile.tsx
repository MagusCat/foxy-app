import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useGuardedRouter } from '@/features/shared/hooks/use-guarded-router';

import { AvatarEditor } from '@/components/avatar-editor';
import { TabHeader, useScreenPadding } from '@/components/screen-header';
import { Card, CardDivider, Row, SectionTitle, softTint } from '@/components/settings-ui';
import { buildAchievements, countUnlocked } from '@/constants/achievements';
import { Palette } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { ThemePreference, useTheme } from '@/contexts/theme-context';
import { appAlert } from '@/features/shared/components/overlay';
import { usePersistentState } from '@/hooks/use-persistent-state';
import { useDailyStreak } from '@/hooks/use-daily-streak';
import { useStudyActivity, formatMinutes } from '@/hooks/use-study-activity';
import { useSubscription } from '@/hooks/use-subscription';
import { useAgenda } from '@/hooks/use-agenda';
import { useDailyGoal } from '@/hooks/use-learning-prefs';
import { useQuestionHistory } from '@/hooks/use-question-history';

const THEME_OPTIONS: {
  value: ThemePreference;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { value: 'system', label: 'Sistema', icon: 'phone-portrait-outline' },
  { value: 'light', label: 'Claro', icon: 'sunny-outline' },
  { value: 'dark', label: 'Oscuro', icon: 'moon-outline' },
];

export default function ProfileScreen() {
  const padding = useScreenPadding();
  const router = useGuardedRouter();
  const { isDark, colors, preference, setPreference } = useTheme();
  const { signOut } = useAuth();

  const [userName] = usePersistentState('foxy:user-name', 'Usuario');
  const [school] = usePersistentState('foxy:school', '');
  const [subjects] = usePersistentState<string[]>('foxy:subjects', []);
  const [, streak] = useDailyStreak();
  const { stats } = useStudyActivity();
  const { plan, isBasic } = useSubscription();
  const { events } = useAgenda();
  const { questions, saved } = useQuestionHistory();
  const goal = useDailyGoal();

  const achievements = useMemo(
    () =>
      countUnlocked(
        buildAchievements({
          streakBest: streak.best,
          totalSessions: stats.totalSessions,
          totalMinutes: stats.totalMinutes,
          subjectsStudied: stats.bySubject.length,
          examsCreated: stats.examsCreated,
          eventsPlanned: events.length,
          savedQuestions: saved.length,
          goalsMet: [...stats.focusMinutesByDay.values()].filter((minutes) => minutes >= goal.goal).length,
        }),
      ),
    [streak.best, stats, events.length, saved.length, goal.goal],
  );

  const handleLogout = () => {
    appAlert(
      'Cerrar sesión',
      'Todavía no existen las cuentas en línea, así que al cerrar sesión se borra tu perfil de este dispositivo: nombre, foto, escuela, cuadernos, actividad y eventos. Tus preferencias de la app se quedan.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar sesión',
          style: 'destructive',
          onPress: () => signOut(),
        },
      ],
    );
  };

  return (
    <View className="flex-1 bg-bg-light dark:bg-bg-dark">
      <ScrollView
        className="px-5"
        contentContainerStyle={{ paddingTop: padding.top, paddingBottom: padding.tabBottom }}
        showsVerticalScrollIndicator={false}
      >
        <TabHeader title="Mi perfil" />

        <View
          className="flex-row items-center rounded-2xl border p-4"
          style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}
        >
          <AvatarEditor name={userName} size={58} />

          <TouchableOpacity
            className="ml-4 flex-1 flex-row items-center"
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Ver mi cuenta"
            onPress={() => router.push('/settings/account')}
          >
            <View className="flex-1">
              <Text
                className="text-[17px] font-bold text-text-primary-light dark:text-text-primary-dark"
                numberOfLines={1}
              >
                {userName}
              </Text>
              <Text
                className="mt-0.5 text-[13px] text-text-secondary-light dark:text-text-secondary-dark"
                numberOfLines={1}
              >
                {school || 'Sin escuela asignada'}
              </Text>
            </View>

            <Ionicons name="chevron-forward" size={17} color={colors.icon} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          className="mt-3 rounded-2xl border p-4"
          style={{ backgroundColor: softTint(plan.color, isDark), borderColor: plan.color }}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={`${plan.name}. Ver planes de suscripción`}
          onPress={() => router.push('/subscription')}
        >
          <View className="flex-row items-center">
            <View
              className="h-10 w-10 items-center justify-center rounded-xl"
              style={{ backgroundColor: colors.card }}
            >
              <Ionicons name={plan.icon} size={20} color={plan.color} />
            </View>

            <View className="ml-3 flex-1">
              <Text className="text-[10px] font-bold uppercase tracking-wider" style={{ color: plan.color }}>
                Tu plan
              </Text>
              <Text className="text-[15px] font-bold text-text-primary-light dark:text-text-primary-dark">
                {plan.name}
              </Text>
            </View>

            <View
              className="flex-row items-center rounded-full px-3 py-1.5"
              style={{ backgroundColor: plan.color }}
            >
              <Text className="text-[12px] font-bold text-white">
                {isBasic ? 'Mejorar' : 'Ver planes'}
              </Text>
            </View>
          </View>

        </TouchableOpacity>

        <TouchableOpacity
          className="mt-3 rounded-2xl border p-4"
          style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={`Racha de ${streak.count} días. Ver mi actividad`}
          onPress={() => router.push('/activity')}
        >
          <View className="flex-row items-center">
            <Ionicons name="flame" size={20} color={Palette.flameOrange} />
            <Text className="ml-2 flex-1 text-[15px] font-bold text-text-primary-light dark:text-text-primary-dark">
              {streak.count} {streak.count === 1 ? 'día seguido' : 'días seguidos'}
            </Text>
            <Text className="mr-1 text-[12px] text-text-secondary-light dark:text-text-secondary-dark">
              Mejor: {streak.best}
            </Text>
            <Ionicons name="chevron-forward" size={15} color={colors.icon} />
          </View>

          <View className="mt-3.5 flex-row justify-between">
            {streak.week.map((day) => (
              <View key={day.key} className="items-center" style={{ width: 32 }}>
                <Text className="mb-1 text-[10px] text-text-secondary-light dark:text-text-secondary-dark">
                  {day.label}
                </Text>
                <View
                  className="h-7 w-7 items-center justify-center rounded-full border"
                  style={{
                    backgroundColor: day.active ? Palette.flameOrange : colors.surface,
                    borderColor: day.isToday ? Palette.flameOrange : colors.cardBorder,
                    borderWidth: day.isToday ? 1.5 : 1,
                    opacity: day.isFuture ? 0.4 : 1,
                  }}
                >
                  {day.active ? <Ionicons name="flame" size={13} color="#FFFFFF" /> : null}
                </View>
              </View>
            ))}
          </View>
        </TouchableOpacity>

        <View className="mt-3 flex-row gap-3">
          {[
            { value: formatMinutes(stats.weekMinutes), label: 'esta semana' },
            { value: `${subjects.length}`, label: 'materias' },
            { value: `${stats.totalSessions}`, label: 'sesiones' },
          ].map((stat) => (
            <View
              key={stat.label}
              className="flex-1 items-center rounded-2xl border py-3"
              style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}
            >
              <Text
                className="text-[17px] font-bold text-text-primary-light dark:text-text-primary-dark"
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {stat.value}
              </Text>
              <Text className="mt-0.5 text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
                {stat.label}
              </Text>
            </View>
          ))}
        </View>

        <SectionTitle>Mi progreso</SectionTitle>
        <Card>
          <Row icon="stats-chart-outline" label="Mi actividad" onPress={() => router.push('/activity')} />
          <CardDivider />
          <Row
            icon="trophy-outline"
            label="Mis logros"
            value={`${achievements.unlocked}/${achievements.total}`}
            onPress={() => router.push('/achievements')}
          />
          <CardDivider />
          <Row
            icon="chatbubbles-outline"
            label="Mis preguntas"
            value={questions.length > 0 ? `${questions.length}` : undefined}
            onPress={() => router.push('/history')}
          />
          <CardDivider />
          <Row icon="timer-outline" label="Modo enfoque" onPress={() => router.push('/focus')} />
        </Card>

        <TouchableOpacity
          className="mt-3 flex-row items-center rounded-2xl border px-3.5 py-3.5"
          style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Calendario y eventos"
          onPress={() => router.push('/calendar')}
        >
          <View
            className="mr-3 h-8 w-8 items-center justify-center rounded-[10px]"
            style={{ backgroundColor: colors.surface }}
          >
            <Ionicons name="calendar-outline" size={17} color={colors.icon} />
          </View>
          <Text className="flex-1 text-[15px] font-medium text-text-primary-light dark:text-text-primary-dark">
            Calendario y eventos
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.icon} />
        </TouchableOpacity>

        <SectionTitle>Configuración</SectionTitle>
        <Card>
          <Row
            icon="sparkles-outline"
            label="Preferencias de aprendizaje"
            onPress={() => router.push('/settings/learning')}
          />
          <CardDivider />
          <Row
            icon="notifications-outline"
            label="Notificaciones"
            onPress={() => router.push('/settings/notifications')}
          />
          <CardDivider />
          <Row
            icon="contrast-outline"
            label="Apariencia"
            right={
              <View
                className="flex-row items-center gap-1 rounded-full p-1"
                style={{ backgroundColor: colors.surface }}
              >
                {THEME_OPTIONS.map((option) => {
                  const isSelected = preference === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      accessibilityRole="button"
                      accessibilityLabel={`Tema ${option.label}`}
                      accessibilityState={{ selected: isSelected }}
                      onPress={() => setPreference(option.value)}
                      className="h-7 w-7 items-center justify-center rounded-full"
                      style={{ backgroundColor: isSelected ? colors.card : 'transparent' }}
                    >
                      <Ionicons
                        name={option.icon}
                        size={14}
                        color={isSelected ? colors.text : colors.icon}
                      />
                    </Pressable>
                  );
                })}
              </View>
            }
          />
        </Card>

        <SectionTitle>Privacidad</SectionTitle>
        <Card>
          <Row
            icon="lock-closed-outline"
            label="Privacidad y datos"
            onPress={() => router.push('/settings/privacy')}
          />
        </Card>

        <SectionTitle>Ayuda</SectionTitle>
        <Card>
          <Row
            icon="help-circle-outline"
            label="Ayuda y soporte"
            onPress={() => router.push('/settings/help')}
          />
          <CardDivider />
          <Row
            icon="information-circle-outline"
            label="¿Qué es Fox?"
            onPress={() => router.push('/settings/about-fox')}
          />
        </Card>

        <TouchableOpacity
          className="mt-6 flex-row items-center justify-center rounded-2xl border py-3.5"
          style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Cerrar sesión"
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={18} color="#EF4444" style={{ marginRight: 7 }} />
          <Text className="text-[15px] font-semibold" style={{ color: '#EF4444' }}>
            Cerrar sesión
          </Text>
        </TouchableOpacity>

        <Text className="mt-4 text-center text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
          Fox 🦊 — hecho para estudiar sin agobios
        </Text>
      </ScrollView>
    </View>
  );
}
