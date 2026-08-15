import React, { useMemo, useState } from 'react';
import { Alert, Modal, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useRouter } from 'expo-router';

import { Card, ChipGroup, Note, ScreenShell, SectionTitle, softTint } from '@/components/settings-ui';
import { getSubjectAccent } from '@/constants/subject-colors';
import { Palette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { useDailyGoal } from '@/hooks/use-learning-prefs';
import {
  EVENT_KIND_META,
  MONTH_NAMES,
  WEEKDAY_LABELS,
  buildMonthGrid,
  describeEventDate,
  localDay,
  type EventKind,
} from '@/hooks/use-agenda';
import { useAgenda } from '@/hooks/use-agenda';
import { MAX_FREEZES, useDailyStreak } from '@/hooks/use-daily-streak';
import { usePersistentState } from '@/hooks/use-persistent-state';
import { useSheetPaddingBottom } from '@/hooks/use-sheet-padding';
import { STUDY_KIND_META, formatMinutes, useStudyActivity } from '@/hooks/use-study-activity';

type Segment = 'actividad' | 'calendario';

const KIND_OPTIONS: { value: EventKind; label: string }[] = [
  { value: 'examen', label: 'Examen' },
  { value: 'tarea', label: 'Tarea' },
  { value: 'clase', label: 'Clase' },
  { value: 'repaso', label: 'Repaso' },
];

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
  const sheetPaddingBottom = useSheetPaddingBottom();
  const goal = useDailyGoal();

  const [segment, setSegment] = useState<Segment>('actividad');
  const [, streak] = useDailyStreak();
  const { sessions, stats } = useStudyActivity();
  const { upcoming, markedDays, addEvent, removeEvent } = useAgenda();
  const [subjects] = usePersistentState<string[]>('foxy:subjects', ['Matemáticas']);

  const today = localDay(new Date());
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedDay, setSelectedDay] = useState(today);

  const [isEventModalVisible, setEventModalVisible] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [eventKind, setEventKind] = useState<EventKind>('examen');
  const [eventSubject, setEventSubject] = useState(subjects[0] ?? 'Matemáticas');
  const [eventTime, setEventTime] = useState('');

  const grid = useMemo(() => buildMonthGrid(cursor.year, cursor.month), [cursor]);
  const selectedEvents = markedDays.get(selectedDay) ?? [];
  const accent = isDark ? Palette.primaryGlow : Palette.primary;

  const shiftMonth = (amount: number) => {
    setCursor((prev) => {
      const date = new Date(prev.year, prev.month + amount, 1);
      return { year: date.getFullYear(), month: date.getMonth() };
    });
  };

  const openEventModal = () => {
    setEventTitle('');
    setEventTime('');
    setEventKind('examen');
    setEventSubject(subjects[0] ?? 'Matemáticas');
    setEventModalVisible(true);
  };

  const handleSaveEvent = () => {
    const title = eventTitle.trim();
    if (!title) {
      Alert.alert('Falta el título', 'Escribe de qué se trata el evento.');
      return;
    }

    const time = eventTime.trim();
    if (time && !/^([01]?\d|2[0-3]):[0-5]\d$/.test(time)) {
      Alert.alert('Hora no válida', 'Usa el formato de 24 horas, por ejemplo 08:30 o 17:45.');
      return;
    }

    addEvent({ title, subject: eventSubject, kind: eventKind, date: selectedDay, time: time || undefined });
    setEventModalVisible(false);
  };

  const handleDeleteEvent = (id: string, title: string) => {
    Alert.alert('Eliminar evento', `¿Quitar "${title}" de tu calendario?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => removeEvent(id) },
    ]);
  };

  return (
    <>
      <ScreenShell title="Mi actividad" subtitle="Tu progreso de estudio y lo que viene">
        <View
          className="mt-2 flex-row rounded-full p-1"
          style={{ backgroundColor: colors.surface }}
        >
          {([
            { value: 'actividad' as const, label: 'Actividad', icon: 'stats-chart-outline' as const },
            { value: 'calendario' as const, label: 'Calendario', icon: 'calendar-outline' as const },
          ]).map((option) => {
            const isSelected = segment === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                className="flex-1 flex-row items-center justify-center rounded-full py-2"
                style={{ backgroundColor: isSelected ? colors.card : 'transparent' }}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                onPress={() => setSegment(option.value)}
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

        {segment === 'actividad' ? (
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
        ) : (
          <>
            <Card className="mt-4">
              <View className="p-3.5">
                <View className="mb-3 flex-row items-center justify-between">
                  <TouchableOpacity
                    className="h-8 w-8 items-center justify-center rounded-full"
                    style={{ backgroundColor: colors.surface }}
                    accessibilityRole="button"
                    accessibilityLabel="Mes anterior"
                    onPress={() => shiftMonth(-1)}
                  >
                    <Ionicons name="chevron-back" size={16} color={colors.text} />
                  </TouchableOpacity>

                  <Text className="text-[15px] font-bold text-text-primary-light dark:text-text-primary-dark">
                    {MONTH_NAMES[cursor.month]} {cursor.year}
                  </Text>

                  <TouchableOpacity
                    className="h-8 w-8 items-center justify-center rounded-full"
                    style={{ backgroundColor: colors.surface }}
                    accessibilityRole="button"
                    accessibilityLabel="Mes siguiente"
                    onPress={() => shiftMonth(1)}
                  >
                    <Ionicons name="chevron-forward" size={16} color={colors.text} />
                  </TouchableOpacity>
                </View>

                <View className="mb-1 flex-row">
                  {WEEKDAY_LABELS.map((label, index) => (
                    <View key={`${label}-${index}`} className="flex-1 items-center">
                      <Text className="text-[10px] font-bold text-text-secondary-light dark:text-text-secondary-dark">
                        {label}
                      </Text>
                    </View>
                  ))}
                </View>

                <View className="flex-row flex-wrap">
                  {grid.map((cell) => {
                    const events = markedDays.get(cell.key) ?? [];
                    const isSelected = cell.key === selectedDay;

                    return (
                      <TouchableOpacity
                        key={cell.key}
                        style={{ width: `${100 / 7}%`, height: 44 }}
                        className="items-center justify-center"
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={`Día ${cell.day}${events.length ? `, ${events.length} eventos` : ''}`}
                        onPress={() => {
                          setSelectedDay(cell.key);
                          if (cell.isOutside) {
                            const date = new Date(`${cell.key}T00:00:00`);
                            setCursor({ year: date.getFullYear(), month: date.getMonth() });
                          }
                        }}
                      >
                        <View
                          className="h-8 w-8 items-center justify-center rounded-full border"
                          style={{
                            backgroundColor: isSelected ? accent : 'transparent',
                            borderColor: cell.isToday && !isSelected ? accent : 'transparent',
                            borderWidth: cell.isToday && !isSelected ? 1.5 : 1,
                            opacity: cell.isOutside ? 0.35 : 1,
                          }}
                        >
                          <Text
                            className="text-xs font-semibold"
                            style={{ color: isSelected ? '#FFFFFF' : colors.text }}
                          >
                            {cell.day}
                          </Text>
                        </View>

                        <View className="mt-0.5 h-1 flex-row items-center gap-0.5">
                          {events.slice(0, 3).map((event) => (
                            <View
                              key={event.id}
                              className="h-1 w-1 rounded-full"
                              style={{ backgroundColor: EVENT_KIND_META[event.kind].color }}
                            />
                          ))}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </Card>

            <SectionTitle>{describeEventDate(selectedDay)}</SectionTitle>

            {selectedEvents.length === 0 ? (
              <Card>
                <View className="items-center px-5 py-6">
                  <Ionicons name="calendar-clear-outline" size={24} color={colors.icon} />
                  <Text className="mt-2 text-center text-xs text-text-secondary-light dark:text-text-secondary-dark">
                    No hay nada agendado este día.
                  </Text>
                </View>
              </Card>
            ) : (
              <Card>
                <View className="p-2">
                  {selectedEvents.map((event) => {
                    const meta = EVENT_KIND_META[event.kind];
                    return (
                      <View key={event.id} className="flex-row items-center px-1.5 py-2.5">
                        <View
                          className="mr-3 h-9 w-9 items-center justify-center rounded-xl"
                          style={{ backgroundColor: softTint(meta.color, isDark) }}
                        >
                          <Ionicons name={meta.icon} size={17} color={meta.color} />
                        </View>
                        <View className="flex-1">
                          <Text
                            className="text-[13px] font-semibold text-text-primary-light dark:text-text-primary-dark"
                            numberOfLines={1}
                          >
                            {event.title}
                          </Text>
                          <Text className="mt-0.5 text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
                            {meta.label} · {event.subject}
                            {event.time ? ` · ${event.time}` : ''}
                          </Text>
                        </View>
                        <TouchableOpacity
                          className="h-8 w-8 items-center justify-center rounded-full"
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          accessibilityRole="button"
                          accessibilityLabel={`Eliminar ${event.title}`}
                          onPress={() => handleDeleteEvent(event.id, event.title)}
                        >
                          <Ionicons name="trash-outline" size={16} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              </Card>
            )}

            <TouchableOpacity
              className="mt-3 flex-row items-center justify-center rounded-[18px] bg-primary py-3.5"
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Agregar evento"
              onPress={openEventModal}
            >
              <Ionicons name="add" size={18} color="#FFFFFF" style={{ marginRight: 5 }} />
              <Text className="text-sm font-bold text-white">Agregar evento</Text>
            </TouchableOpacity>

            <SectionTitle>Próximos eventos</SectionTitle>
            {upcoming.length === 0 ? (
              <Card>
                <View className="items-center px-5 py-8">
                  <Ionicons name="calendar-outline" size={28} color={colors.icon} />
                  <Text className="mt-2.5 text-center text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
                    Sin eventos por ahora
                  </Text>
                  <Text className="mt-1 text-center text-xs leading-[17px] text-text-secondary-light dark:text-text-secondary-dark">
                    Agenda tu próximo examen o entrega y Foxy te ayudará a prepararte a tiempo.
                  </Text>
                </View>
              </Card>
            ) : (
              <Card>
                <View className="p-2">
                  {upcoming.slice(0, 8).map((event) => {
                    const meta = EVENT_KIND_META[event.kind];
                    return (
                      <TouchableOpacity
                        key={event.id}
                        className="flex-row items-center px-1.5 py-2.5"
                        activeOpacity={0.7}
                        onPress={() => {
                          const date = new Date(`${event.date}T00:00:00`);
                          setCursor({ year: date.getFullYear(), month: date.getMonth() });
                          setSelectedDay(event.date);
                        }}
                      >
                        <View
                          className="mr-3 h-9 w-9 items-center justify-center rounded-xl"
                          style={{ backgroundColor: softTint(meta.color, isDark) }}
                        >
                          <Ionicons name={meta.icon} size={17} color={meta.color} />
                        </View>
                        <View className="flex-1">
                          <Text
                            className="text-[13px] font-semibold text-text-primary-light dark:text-text-primary-dark"
                            numberOfLines={1}
                          >
                            {event.title}
                          </Text>
                          <Text className="mt-0.5 text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
                            {meta.label} · {event.subject}
                          </Text>
                        </View>
                        <Text className="ml-2 text-[11px] font-semibold" style={{ color: meta.color }}>
                          {describeEventDate(event.date)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </Card>
            )}

            <Note icon="notifications-outline">
              Cuando actives los recordatorios, Foxy te avisará un día antes de cada examen.
            </Note>
          </>
        )}
      </ScreenShell>

      <Modal
        visible={isEventModalVisible}
        transparent
        statusBarTranslucent
        navigationBarTranslucent
        animationType="slide"
        onRequestClose={() => setEventModalVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/45 dark:bg-black/75">
          <TouchableOpacity className="flex-1" activeOpacity={1} onPress={() => setEventModalVisible(false)} />

          <View
            className="max-h-[88%] rounded-t-[26px] bg-white px-[18px] pt-[18px] dark:bg-[#16141D]"
            style={{ paddingBottom: sheetPaddingBottom }}
          >
            <View className="mb-1 flex-row items-center justify-between">
              <Text className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark">
                Nuevo evento
              </Text>
              <TouchableOpacity
                className="h-[30px] w-[30px] items-center justify-center rounded-full bg-[#F3F4F6] dark:bg-[#2A2533]"
                accessibilityRole="button"
                accessibilityLabel="Cerrar"
                onPress={() => setEventModalVisible(false)}
              >
                <Ionicons name="close" size={18} color={colors.text} />
              </TouchableOpacity>
            </View>

            <Text className="mb-3.5 text-xs text-text-secondary-light dark:text-text-secondary-dark">
              {describeEventDate(selectedDay)} · {selectedDay}
            </Text>

            <ScrollView style={{ flexShrink: 1 }} showsVerticalScrollIndicator={false}>
              <TextInput
                className="mb-3 rounded-[14px] border border-[#E5E7EB] bg-[#F9FAFB] px-3.5 py-2.5 text-sm text-text-primary-light dark:border-[#2D2838] dark:bg-[#14121A] dark:text-text-primary-dark"
                placeholder="Ej. Examen de ecuaciones"
                placeholderTextColor="#6B7280"
                value={eventTitle}
                onChangeText={setEventTitle}
                maxLength={60}
              />

              <Text className="mb-2 text-xs font-semibold text-text-primary-light dark:text-text-primary-dark">
                Tipo
              </Text>
              <View className="mb-3.5">
                <ChipGroup options={KIND_OPTIONS} selected={eventKind} onSelect={setEventKind} />
              </View>

              <Text className="mb-2 text-xs font-semibold text-text-primary-light dark:text-text-primary-dark">
                Materia
              </Text>
              <View className="mb-3.5">
                <ChipGroup
                  options={subjects.slice(0, 8).map((subject) => ({ value: subject, label: subject }))}
                  selected={eventSubject}
                  onSelect={setEventSubject}
                />
              </View>

              <Text className="mb-2 text-xs font-semibold text-text-primary-light dark:text-text-primary-dark">
                Hora (opcional)
              </Text>
              <TextInput
                className="mb-3 rounded-[14px] border border-[#E5E7EB] bg-[#F9FAFB] px-3.5 py-2.5 text-sm text-text-primary-light dark:border-[#2D2838] dark:bg-[#14121A] dark:text-text-primary-dark"
                placeholder="08:30"
                placeholderTextColor="#6B7280"
                value={eventTime}
                onChangeText={setEventTime}
                keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
                maxLength={5}
              />
            </ScrollView>

            <TouchableOpacity
              className="mt-1 items-center rounded-[18px] bg-primary py-3.5"
              activeOpacity={0.85}
              onPress={handleSaveEvent}
            >
              <Text className="text-sm font-bold text-white">Guardar evento</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}
