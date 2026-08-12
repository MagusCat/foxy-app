import React from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useRouter } from 'expo-router';

import { Card, Note, ScreenShell, SectionTitle, softTint } from '@/components/settings-ui';
import { getSubjectAccent } from '@/constants/subject-colors';
import { Palette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { useDailyGoal } from '@/hooks/use-learning-prefs';
import { MONTH_NAMES } from '@/hooks/use-agenda';
import { MAX_FREEZES, useDailyStreak } from '@/hooks/use-daily-streak';
import { STUDY_KIND_META, formatMinutes, useStudyActivity } from '@/hooks/use-study-activity';

function describeMoment(iso: string) {
  const date = new Date(iso);
  const minutes = Math.round((Date.now() - date.getTime()) / 60_000);

  if (minutes < 1) return 'Ahora mismo';
  if (minutes < 60) return `Hace ${minutes} min`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;

  const days = Math.round(hours / 24);
  if (days === 1) return 'Ayer';
  if (days < 7) return `Hace ${days} días`;

  return `${date.getDate()} de ${MONTH_NAMES[date.getMonth()].toLowerCase()}`;
}

export default function ActivityScreen() {
  const router = useRouter();
  const { isDark, colors } = useTheme();
  const goal = useDailyGoal();

  const [, streak] = useDailyStreak();
  const { sessions, stats } = useStudyActivity();

  const accent = isDark ? Palette.primaryGlow : Palette.primary;

  return (
    <ScreenShell title="Mi actividad" subtitle="Tu progreso de estudio y lo que viene">
        {/* El calendario vive en su propia pantalla: aquí solo se entra. */}
        <View
          className="mt-2 flex-row rounded-full p-1"
          style={{ backgroundColor: colors.surface }}
        >
          {([
            { value: 'actividad' as const, label: 'Actividad', icon: 'stats-chart-outline' as const },
            { value: 'calendario' as const, label: 'Calendario', icon: 'calendar-outline' as const },
          ]).map((option) => {
            const isSelected = option.value === 'actividad';
            return (
              <TouchableOpacity
                key={option.value}
                className="flex-1 flex-row items-center justify-center rounded-full py-2"
                style={{ backgroundColor: isSelected ? colors.card : 'transparent' }}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                onPress={() => {
                  if (option.value === 'calendario') router.push('/calendar');
                }}
              >
                <Ionicons
                  name={option.icon}
                  size={15}
                  color={isSelected ? accent : colors.icon}
                  style={{ marginRight: 6 }}
                />
                <Text
                  className="text-[13px] font-semibold"
                  style={{ color: isSelected ? colors.text : colors.textSecondary }}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <>
            <View
              className="mt-4 rounded-[22px] border p-[18px]"
              style={{
                backgroundColor: softTint(Palette.flameOrange, isDark),
                borderColor: Palette.flameOrange,
              }}
            >
              <View className="flex-row items-center">
                <View
                  className="h-12 w-12 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: colors.card }}
                >
                  <Ionicons name="flame" size={26} color={Palette.flameOrange} />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark">
                    {streak.count} {streak.count === 1 ? 'día' : 'días'}
                  </Text>
                  <Text className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                    Tu mejor racha: {streak.best} {streak.best === 1 ? 'día' : 'días'}
                  </Text>
                </View>

                <TouchableOpacity
                  className="flex-row items-center rounded-full px-2.5 py-1.5"
                  style={{ backgroundColor: colors.card }}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`${streak.freezes} congelaciones de racha`}
                  onPress={() =>
                    Alert.alert(
                      'Congelaciones de racha',
                      `Tienes ${streak.freezes} de ${MAX_FREEZES}. Si un día no estudias, se gasta una automáticamente y tu racha sigue viva. Ganas una nueva cada 7 días seguidos.`,
                    )
                  }
                >
                  <Ionicons name="snow-outline" size={14} color={Palette.accentBlue} />
                  <Text className="ml-1 text-[13px] font-bold text-text-primary-light dark:text-text-primary-dark">
                    {streak.freezes}
                  </Text>
                </TouchableOpacity>
              </View>

              <View className="mt-4 flex-row justify-between">
                {streak.week.map((day) => (
                  <View key={day.key} className="items-center" style={{ width: 34 }}>
                    <Text className="mb-1.5 text-[10px] font-semibold text-text-secondary-light dark:text-text-secondary-dark">
                      {day.label}
                    </Text>
                    <View
                      className="h-8 w-8 items-center justify-center rounded-full border"
                      style={{
                        backgroundColor: day.frozen
                          ? Palette.accentBlue
                          : day.active
                            ? Palette.flameOrange
                            : colors.card,
                        borderColor: day.isToday ? Palette.flameOrange : colors.cardBorder,
                        borderWidth: day.isToday ? 1.5 : 1,
                        opacity: day.isFuture ? 0.4 : 1,
                      }}
                    >
                      <Ionicons
                        name={day.frozen ? 'snow' : day.active ? 'flame' : 'ellipse-outline'}
                        size={day.active ? 15 : 9}
                        color={day.active ? '#FFFFFF' : colors.icon}
                      />
                    </View>
                  </View>
                ))}
              </View>

              <View className="mt-4">
                <View className="mb-1.5 flex-row items-center justify-between">
                  <Text className="text-xs font-semibold text-text-primary-light dark:text-text-primary-dark">
                    Meta de la semana
                  </Text>
                  <Text className="text-xs font-bold" style={{ color: Palette.flameOrange }}>
                    {streak.weeklyActive} / {streak.weeklyGoal} días
                  </Text>
                </View>
                <View className="h-2 overflow-hidden rounded-full" style={{ backgroundColor: colors.card }}>
                  <View
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(Math.round((streak.weeklyActive / streak.weeklyGoal) * 100), 100)}%`,
                      backgroundColor: Palette.flameOrange,
                    }}
                  />
                </View>
                <Text className="mt-1.5 text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
                  {streak.nextMilestone
                    ? `Te faltan ${streak.daysToMilestone} días para llegar a ${streak.nextMilestone} seguidos 🔥`
                    : '¡Llegaste a todas las metas de racha! 🎉'}
                </Text>
              </View>
            </View>

            <Card className="mt-3">
              <TouchableOpacity
                className="p-4"
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`Meta de hoy: ${goal.done} de ${goal.goal} minutos. Abrir modo enfoque`}
                onPress={() => router.push('/focus')}
              >
                <View className="mb-2 flex-row items-center">
                  <Ionicons
                    name={goal.met ? 'checkmark-circle' : 'timer-outline'}
                    size={17}
                    color={goal.met ? '#10B981' : Palette.flameOrange}
                  />
                  <Text className="ml-2 flex-1 text-[13px] font-semibold text-text-primary-light dark:text-text-primary-dark">
                    {goal.met ? '¡Meta de hoy cumplida!' : `Meta de hoy: faltan ${formatMinutes(goal.remaining)}`}
                  </Text>
                  <Text className="text-[12px] font-bold text-text-secondary-light dark:text-text-secondary-dark">
                    {goal.done}/{goal.goal} min
                  </Text>
                </View>

                <View className="h-2 overflow-hidden rounded-full" style={{ backgroundColor: colors.surface }}>
                  <View
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.round(goal.ratio * 100)}%`,
                      backgroundColor: goal.met ? '#10B981' : Palette.flameOrange,
                    }}
                  />
                </View>

                <Text className="mt-2 text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
                  Toca para abrir el modo enfoque y sumar minutos.
                </Text>
              </TouchableOpacity>
            </Card>

            <View className="mt-3 flex-row gap-3">
              {[
                { label: 'hoy', value: formatMinutes(stats.todayMinutes), icon: 'today-outline' as const, color: Palette.accentBlue },
                { label: 'esta semana', value: formatMinutes(stats.weekMinutes), icon: 'calendar-outline' as const, color: Palette.accentPurple },
                { label: 'sesiones', value: `${stats.totalSessions}`, icon: 'layers-outline' as const, color: '#10B981' },
              ].map((item) => (
                <View
                  key={item.label}
                  className="flex-1 items-center rounded-2xl border py-3"
                  style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}
                >
                  <Ionicons name={item.icon} size={17} color={item.color} />
                  <Text
                    className="mt-1 text-[15px] font-bold text-text-primary-light dark:text-text-primary-dark"
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {item.value}
                  </Text>
                  <Text className="text-[10px] text-text-secondary-light dark:text-text-secondary-dark">
                    {item.label}
                  </Text>
                </View>
              ))}
            </View>

            <SectionTitle>Últimos 7 días</SectionTitle>
            <Card>
              <View className="flex-row items-end justify-between px-3.5 pb-3 pt-4" style={{ height: 132 }}>
                {stats.days.map((day) => {
                  const ratio = day.minutes / stats.maxDayMinutes;
                  return (
                    <View key={day.key} className="flex-1 items-center justify-end">
                      <Text className="mb-1 text-[9px] text-text-secondary-light dark:text-text-secondary-dark">
                        {day.minutes > 0 ? day.minutes : ''}
                      </Text>
                      <View
                        className="w-[60%] rounded-t-lg"
                        style={{
                          height: Math.max(ratio * 74, 4),
                          backgroundColor: day.minutes > 0 ? Palette.accentBlue : colors.cardBorder,
                          opacity: day.isToday ? 1 : 0.75,
                        }}
                      />
                      <Text
                        className="mt-1.5 text-[10px] font-semibold"
                        style={{ color: day.isToday ? Palette.accentBlue : colors.textSecondary }}
                      >
                        {day.label}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </Card>

            {stats.bySubject.length > 0 ? (
              <>
                <SectionTitle>Por materia</SectionTitle>
                <Card>
                  <View className="gap-3 p-3.5">
                    {stats.bySubject.slice(0, 6).map((item) => {
                      const subjectAccent = getSubjectAccent(item.subject, isDark);
                      return (
                        <View key={item.subject}>
                          <View className="mb-1.5 flex-row items-center justify-between">
                            <Text
                              className="flex-1 text-[13px] font-semibold text-text-primary-light dark:text-text-primary-dark"
                              numberOfLines={1}
                            >
                              {item.subject}
                            </Text>
                            <Text className="ml-2 text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
                              {formatMinutes(item.minutes)}
                            </Text>
                          </View>
                          <View
                            className="h-2 overflow-hidden rounded-full"
                            style={{ backgroundColor: colors.surface }}
                          >
                            <View
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.max(item.ratio * 100, 6)}%`,
                                backgroundColor: subjectAccent.color,
                              }}
                            />
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </Card>
              </>
            ) : null}

            <SectionTitle>Historial reciente</SectionTitle>
            {sessions.length === 0 ? (
              <Card>
                <View className="items-center px-5 py-8">
                  <Ionicons name="sparkles-outline" size={28} color={colors.icon} />
                  <Text className="mt-2.5 text-center text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
                    Todavía no hay actividad
                  </Text>
                  <Text className="mt-1 text-center text-xs leading-[17px] text-text-secondary-light dark:text-text-secondary-dark">
                    Hazle una pregunta a Foxy o crea un examen de práctica y tu progreso empezará a
                    aparecer aquí.
                  </Text>
                </View>
              </Card>
            ) : (
              <Card>
                <View className="p-2">
                  {sessions.slice(0, 15).map((session) => {
                    const meta = STUDY_KIND_META[session.kind];
                    return (
                      <View key={session.id} className="flex-row items-center px-1.5 py-2.5">
                        <View
                          className="mr-3 h-8 w-8 items-center justify-center rounded-xl"
                          style={{ backgroundColor: softTint(meta.color, isDark) }}
                        >
                          <Ionicons name={meta.icon} size={16} color={meta.color} />
                        </View>
                        <View className="flex-1">
                          <Text
                            className="text-[13px] font-semibold text-text-primary-light dark:text-text-primary-dark"
                            numberOfLines={1}
                          >
                            {session.title}
                          </Text>
                          <Text className="mt-0.5 text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
                            {meta.label} · {session.subject}
                          </Text>
                        </View>
                        <View className="ml-2 items-end">
                          <Text className="text-[11px] font-semibold text-text-primary-light dark:text-text-primary-dark">
                            {formatMinutes(session.minutes)}
                          </Text>
                          <Text className="mt-0.5 text-[10px] text-text-secondary-light dark:text-text-secondary-dark">
                            {describeMoment(session.at)}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </Card>
            )}

            <Note icon="lock-closed-outline">
              Tu actividad se guarda solo en este dispositivo mientras no exista la cuenta en línea.
            </Note>
        </>
    </ScreenShell>
  );
}
