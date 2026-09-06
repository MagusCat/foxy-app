import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Card, Note, ScreenShell, SectionTitle, softTint } from '@/components/settings-ui';
import { buildAchievements, countUnlocked } from '@/constants/achievements';
import { Palette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { useAgenda } from '@/hooks/use-agenda';
import { useDailyStreak } from '@/hooks/use-daily-streak';
import { useDailyGoal } from '@/hooks/use-learning-prefs';
import { useQuestionHistory } from '@/hooks/use-question-history';
import { useStudyActivity } from '@/hooks/use-study-activity';

export default function AchievementsScreen() {
  const { isDark, colors } = useTheme();
  const [, streak] = useDailyStreak();
  const { stats } = useStudyActivity();
  const { events } = useAgenda();
  const { saved } = useQuestionHistory();
  const goal = useDailyGoal();

  const groups = useMemo(
    () =>
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
    [streak.best, stats, events.length, saved.length, goal.goal],
  );

  const totals = useMemo(() => countUnlocked(groups), [groups]);
  const ratio = totals.total > 0 ? totals.unlocked / totals.total : 0;

  return (
    <ScreenShell title="Mis logros" subtitle="Lo que has conseguido estudiando con Foxy">
      <View
        className="mt-2 rounded-[22px] border p-[18px]"
        style={{ backgroundColor: softTint('#F59E0B', isDark), borderColor: '#F59E0B' }}
      >
        <View className="flex-row items-center">
          <View
            className="h-12 w-12 items-center justify-center rounded-2xl"
            style={{ backgroundColor: colors.card }}
          >
            <Ionicons name="trophy" size={24} color="#F59E0B" />
          </View>
          <View className="ml-3 flex-1">
            <Text className="text-xl font-bold text-text-primary-light dark:text-text-primary-dark">
              {totals.unlocked} de {totals.total}
            </Text>
            <Text className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
              logros desbloqueados
            </Text>
          </View>
        </View>

        <View className="mt-3.5 h-2 overflow-hidden rounded-full" style={{ backgroundColor: colors.card }}>
          <View
            className="h-full rounded-full"
            style={{ width: `${Math.round(ratio * 100)}%`, backgroundColor: '#F59E0B' }}
          />
        </View>
      </View>

      {groups.map((group) => (
        <React.Fragment key={group.title}>
          <SectionTitle>{group.title}</SectionTitle>
          <View className="gap-2.5">
            {group.items.map((item) => {
              const progressRatio = item.progress / item.target;

              return (
                <Card key={item.id}>
                  <View className="flex-row items-center p-3.5">
                    <View
                      className="mr-3 h-11 w-11 items-center justify-center rounded-2xl"
                      style={{
                        backgroundColor: item.unlocked ? softTint(item.color, isDark) : colors.surface,
                      }}
                    >
                      <Ionicons
                        name={item.unlocked ? item.icon : 'lock-closed-outline'}
                        size={20}
                        color={item.unlocked ? item.color : colors.icon}
                      />
                    </View>

                    <View className="flex-1">
                      <View className="flex-row items-center">
                        <Text
                          className="flex-1 text-[14px] font-semibold text-text-primary-light dark:text-text-primary-dark"
                          numberOfLines={1}
                        >
                          {item.title}
                        </Text>
                        {item.unlocked ? (
                          <Ionicons name="checkmark-circle" size={16} color={item.color} />
                        ) : (
                          <Text className="text-[11px] font-semibold text-text-secondary-light dark:text-text-secondary-dark">
                            {item.progress}/{item.target}
                          </Text>
                        )}
                      </View>

                      <Text className="mt-0.5 text-[12px] leading-[16px] text-text-secondary-light dark:text-text-secondary-dark">
                        {item.description}
                      </Text>

                      {!item.unlocked ? (
                        <View
                          className="mt-2 h-1.5 overflow-hidden rounded-full"
                          style={{ backgroundColor: colors.surface }}
                        >
                          <View
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.round(progressRatio * 100)}%`,
                              backgroundColor: item.color,
                            }}
                          />
                        </View>
                      ) : null}
                    </View>
                  </View>
                </Card>
              );
            })}
          </View>
        </React.Fragment>
      ))}

      <Note icon="flame-outline">
        Tu mejor racha es de {streak.best} {streak.best === 1 ? 'día' : 'días'} y tienes{' '}
        {streak.freezes} {streak.freezes === 1 ? 'congelación guardada' : 'congelaciones guardadas'}.
      </Note>

      <View className="mt-1 flex-row items-center justify-center">
        <Ionicons name="sparkles-outline" size={13} color={Palette.flameOrange} />
        <Text className="ml-1.5 text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
          Los logros se calculan solos con tu actividad real.
        </Text>
      </View>
    </ScreenShell>
  );
}
