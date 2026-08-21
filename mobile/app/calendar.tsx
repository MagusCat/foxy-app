import React, { useMemo, useState } from 'react';
import {
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useGuardedRouter } from '@/features/shared/hooks/use-guarded-router';

import { useScreenPadding } from '@/components/screen-header';
import { TimePickerSheet } from '@/components/time-picker-sheet';
import { ChipGroup, softTint } from '@/components/settings-ui';
import { getSubjectAccent } from '@/constants/subject-colors';
import { Palette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { appAlert } from '@/features/shared/components/overlay';
import { AppModal, SheetSlide } from '@/features/shared/components/portal';
import {
  buildMonthGrid,
  describeEventDate,
  EVENT_KIND_META,
  localDay,
  MONTH_NAMES,
  useAgenda,
  type EventKind,
} from '@/hooks/use-agenda';
import { usePersistentState } from '@/hooks/use-persistent-state';
import { useSheetPaddingBottom } from '@/hooks/use-sheet-padding';
import { useStudyPlans } from '@/hooks/use-study-plans';
import { formatTime12 } from '@/lib/time';

const WEEKDAYS = ['lu', 'ma', 'mi', 'ju', 'vi', 'sá', 'do'];

const KIND_OPTIONS: { value: EventKind; label: string }[] = [
  { value: 'examen', label: 'Examen' },
  { value: 'tarea', label: 'Tarea' },
  { value: 'clase', label: 'Clase' },
  { value: 'repaso', label: 'Repaso' },
];

type Filter = 'todo' | 'mios' | 'clase';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'todo', label: 'Todo' },
  { value: 'mios', label: 'Mis eventos' },
  { value: 'clase', label: 'Clase' },
];

type CalendarItem = {
  id: string;
  title: string;
  subject: string;
  date: string;
  time?: string;
  kind: EventKind;
  source: 'evento' | 'plan';
  planId?: string;
};

export default function CalendarScreen() {
  const padding = useScreenPadding();
  const router = useGuardedRouter();
  const { colors } = useTheme();
  const sheetPaddingBottom = useSheetPaddingBottom();

  const { events, addEvent, removeEvent } = useAgenda();
  const { plans } = useStudyPlans();
  const [subjects] = usePersistentState<string[]>('foxy:subjects', ['Matemáticas']);

  const today = localDay(new Date());
  const [filter, setFilter] = useState<Filter>('todo');
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedDay, setSelectedDay] = useState(today);

  const [isEventModalVisible, setEventModalVisible] = useState(false);
  const [isTimeVisible, setTimeVisible] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [eventKind, setEventKind] = useState<EventKind>('examen');
  const [eventSubject, setEventSubject] = useState(subjects[0] ?? 'Matemáticas');
  const [eventTime, setEventTime] = useState('');

  const items = useMemo<CalendarItem[]>(() => {
    const fromEvents: CalendarItem[] = events.map((event) => ({
      id: event.id,
      title: event.title,
      subject: event.subject,
      date: event.date,
      time: event.time,
      kind: event.kind,
      source: 'evento',
    }));

    const fromPlans: CalendarItem[] = plans.map((plan) => ({
      id: `plan-${plan.id}`,
      title: plan.title,
      subject: plan.subject,
      date: plan.examDate,
      kind: 'examen',
      source: 'plan',
      planId: plan.id,
    }));

    return [...fromEvents, ...fromPlans].sort((a, b) =>
      `${a.date}${a.time ?? ''}`.localeCompare(`${b.date}${b.time ?? ''}`),
    );
  }, [events, plans]);

  const visible = useMemo(() => {
    if (filter === 'mios') return items.filter((item) => item.kind !== 'clase');
    if (filter === 'clase') return items.filter((item) => item.kind === 'clase');
    return items;
  }, [items, filter]);

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    visible.forEach((item) => {
      const list = map.get(item.date) ?? [];
      list.push(item);
      map.set(item.date, list);
    });
    return map;
  }, [visible]);

  const upcoming = useMemo(() => visible.filter((item) => item.date >= today), [visible, today]);
  const selectedItems = byDay.get(selectedDay) ?? [];
  const grid = useMemo(() => buildMonthGrid(cursor.year, cursor.month), [cursor]);

  const shiftMonth = (amount: number) =>
    setCursor((prev) => {
      const date = new Date(prev.year, prev.month + amount, 1);
      return { year: date.getFullYear(), month: date.getMonth() };
    });

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
      appAlert('Falta el título', 'Escribe de qué se trata el evento.');
      return;
    }

    addEvent({
      title,
      subject: eventSubject,
      kind: eventKind,
      date: selectedDay,
      time: eventTime || undefined,
    });
    setEventModalVisible(false);
  };

  const handlePressItem = (item: CalendarItem) => {
    if (item.source === 'plan' && item.planId) {
      router.push({ pathname: '/exam/[id]', params: { id: item.planId } });
      return;
    }

    appAlert(item.title, `${EVENT_KIND_META[item.kind].label} · ${item.subject}`, [
      { text: 'Cerrar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => removeEvent(item.id),
      },
    ]);
  };

  return (
    <View className="flex-1 bg-bg-light dark:bg-bg-dark">
      <ScrollView
        contentContainerStyle={{ paddingTop: padding.top, paddingBottom: padding.stackBottom }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-5">
          <View className="flex-row items-center">
            <View className="w-10">
              <TouchableOpacity
                className="h-10 w-10 items-center justify-center rounded-full border"
                style={{ backgroundColor: colors.surface, borderColor: colors.cardBorder }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Volver"
                onPress={() => router.back()}
              >
                <Ionicons name="chevron-back" size={19} color={colors.text} />
              </TouchableOpacity>
            </View>

            <Text className="flex-1 text-center text-[24px] font-bold text-text-primary-light dark:text-text-primary-dark">
              Mi calendario
            </Text>

            <View className="w-10" />
          </View>

          <TouchableOpacity
            className="mt-4 flex-row items-center justify-center self-center rounded-full px-6 py-3.5"
            style={{ backgroundColor: Palette.accentBlue }}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Agregar evento"
            onPress={openEventModal}
          >
            <Ionicons name="add" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text className="text-[15px] font-bold text-white">Agregar evento</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
          className="mt-5 grow-0"
        >
          {FILTERS.map((item) => {
            const isActive = filter === item.value;
            return (
              <TouchableOpacity
                key={item.value}
                className="h-10 items-center justify-center rounded-full px-4"
                style={{ backgroundColor: isActive ? colors.text : colors.surface }}
                activeOpacity={0.8}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                onPress={() => setFilter(item.value)}
              >
                <Text
                  className="text-[14px] font-semibold"
                  style={{ color: isActive ? colors.background : colors.text }}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View className="mt-4 px-5">
          <View
            className="rounded-[20px] border p-4"
            style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}
          >
            <View className="mb-3 flex-row items-center justify-between">
              <TouchableOpacity
                className="h-8 w-8 items-center justify-center rounded-full"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Mes anterior"
                onPress={() => shiftMonth(-1)}
              >
                <Ionicons name="chevron-back" size={18} color={colors.text} />
              </TouchableOpacity>

              <Text className="text-[16px] font-semibold text-text-primary-light dark:text-text-primary-dark">
                {MONTH_NAMES[cursor.month].toLowerCase()} {cursor.year}
              </Text>

              <TouchableOpacity
                className="h-8 w-8 items-center justify-center rounded-full"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Mes siguiente"
                onPress={() => shiftMonth(1)}
              >
                <Ionicons name="chevron-forward" size={18} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View className="flex-row pb-1">
              {WEEKDAYS.map((label) => (
                <View key={label} className="flex-1 items-center">
                  <Text className="text-[12px] text-text-secondary-light dark:text-text-secondary-dark">
                    {label}
                  </Text>
                </View>
              ))}
            </View>

            <View className="flex-row flex-wrap">
              {grid.map((cell) => {
                const dayItems = byDay.get(cell.key) ?? [];
                const hasItems = dayItems.length > 0;
                const isSelected = cell.key === selectedDay;

                return (
                  <TouchableOpacity
                    key={cell.key}
                    style={{ width: `${100 / 7}%`, height: 46 }}
                    className="items-center justify-center"
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`${cell.day} de ${MONTH_NAMES[cursor.month]}${
                      hasItems ? `, ${dayItems.length} en el calendario` : ''
                    }`}
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => {
                      setSelectedDay(cell.key);
                      if (cell.isOutside) {
                        const date = new Date(`${cell.key}T00:00:00`);
                        setCursor({ year: date.getFullYear(), month: date.getMonth() });
                      }
                    }}
                  >
                    <View
                      className="h-9 w-9 items-center justify-center rounded-full"
                      style={{
                        backgroundColor: cell.isToday
                          ? colors.text
                          : hasItems
                            ? Palette.accentBlue
                            : isSelected
                              ? colors.surface
                              : 'transparent',
                        borderWidth: isSelected && !cell.isToday && !hasItems ? 1.5 : 0,
                        borderColor: colors.cardBorder,
                        opacity: cell.isOutside ? 0.35 : 1,
                      }}
                    >
                      <Text
                        className="text-[14px] font-medium"
                        style={{
                          color: cell.isToday
                            ? colors.background
                            : hasItems
                              ? '#FFFFFF'
                              : colors.text,
                        }}
                      >
                        {cell.day}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {selectedItems.length > 0 ? (
          <View className="mt-6 px-5">
            <Text className="mb-3 text-[19px] font-bold text-text-primary-light dark:text-text-primary-dark">
              {describeEventDate(selectedDay)}
            </Text>
            {selectedItems.map((item) => (
              <CalendarRow key={item.id} item={item} onPress={() => handlePressItem(item)} />
            ))}
          </View>
        ) : null}

        <View className="mt-6 px-5">
          <Text className="mb-3 text-[19px] font-bold text-text-primary-light dark:text-text-primary-dark">
            Próximos
          </Text>

          {upcoming.length === 0 ? (
            <View
              className="items-center rounded-[20px] border px-5 py-8"
              style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}
            >
              <Ionicons name="calendar-outline" size={28} color={colors.icon} />
              <Text className="mt-2.5 text-center text-[14px] font-semibold text-text-primary-light dark:text-text-primary-dark">
                Sin nada por delante
              </Text>
              <Text className="mt-1 text-center text-[12px] leading-[17px] text-text-secondary-light dark:text-text-secondary-dark">
                Agenda tu próximo examen o entrega y Foxy te ayudará a prepararte a tiempo.
              </Text>
            </View>
          ) : (
            upcoming
              .slice(0, 12)
              .map((item) => (
                <CalendarRow key={item.id} item={item} onPress={() => handlePressItem(item)} />
              ))
          )}
        </View>
      </ScrollView>

      <AppModal visible={isEventModalVisible} onRequestClose={() => setEventModalVisible(false)}>
        <View className="flex-1 justify-end bg-black/45 dark:bg-black/75">
          <TouchableOpacity className="flex-1" activeOpacity={1} onPress={() => setEventModalVisible(false)} />

          <SheetSlide>
            <View
              className="max-h-[88%] rounded-t-[26px] px-[18px] pt-[18px]"
              style={{ backgroundColor: colors.card, paddingBottom: sheetPaddingBottom }}
            >
            <View className="mb-1 flex-row items-center justify-between">
              <Text className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark">
                Nuevo evento
              </Text>
              <TouchableOpacity
                className="h-[30px] w-[30px] items-center justify-center rounded-full"
                style={{ backgroundColor: colors.surface }}
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
                className="mb-3 rounded-[14px] border px-3.5 py-2.5 text-sm text-text-primary-light dark:text-text-primary-dark"
                style={{ backgroundColor: colors.background, borderColor: colors.cardBorder }}
                placeholder="Ej. Examen de ecuaciones"
                placeholderTextColor={colors.icon}
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
              <View className="mb-3 flex-row items-center gap-2">
                <TouchableOpacity
                  className="flex-1 flex-row items-center rounded-[14px] border px-3.5 py-3"
                  style={{ backgroundColor: colors.background, borderColor: colors.cardBorder }}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Elegir la hora del evento"
                  onPress={() => setTimeVisible(true)}
                >
                  <Ionicons name="time-outline" size={17} color={colors.icon} />
                  <Text
                    className="ml-2.5 flex-1 text-sm"
                    style={{ color: eventTime ? colors.text : colors.icon }}
                  >
                    {eventTime ? formatTime12(eventTime) : 'Sin hora'}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.icon} />
                </TouchableOpacity>

                {eventTime ? (
                  <TouchableOpacity
                    className="h-11 w-11 items-center justify-center rounded-full"
                    style={{ backgroundColor: colors.surface }}
                    accessibilityRole="button"
                    accessibilityLabel="Quitar la hora"
                    onPress={() => setEventTime('')}
                  >
                    <Ionicons name="close" size={17} color={colors.icon} />
                  </TouchableOpacity>
                ) : null}
              </View>
            </ScrollView>

            <TouchableOpacity
              className="mt-1 items-center rounded-[18px] py-3.5"
              style={{ backgroundColor: Palette.primary }}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Guardar evento"
              onPress={handleSaveEvent}
            >
              <Text className="text-sm font-bold text-white">Guardar evento</Text>
            </TouchableOpacity>
            </View>
          </SheetSlide>
        </View>
      </AppModal>

      <TimePickerSheet
        visible={isTimeVisible}
        title="Hora del evento"
        description="Desliza para elegir la hora"
        value={eventTime || '08:00'}
        onCancel={() => setTimeVisible(false)}
        onSave={(time) => {
          setEventTime(time);
          setTimeVisible(false);
        }}
      />
    </View>
  );
}

function CalendarRow({ item, onPress }: { item: CalendarItem; onPress: () => void }) {
  const { colors, isDark } = useTheme();
  const accent = getSubjectAccent(item.subject, isDark);
  const date = new Date(`${item.date}T00:00:00`);

  return (
    <TouchableOpacity
      className="mb-2.5 flex-row overflow-hidden rounded-[18px] border"
      style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, ${describeEventDate(item.date)}`}
      onPress={onPress}
    >
      <View className="w-1" style={{ backgroundColor: accent.color }} />

      <View className="w-[58px] items-center justify-center py-3.5">
        <Text
          className="text-[11px] font-bold uppercase"
          style={{ color: colors.textSecondary }}
        >
          {MONTH_NAMES[date.getMonth()].slice(0, 3)}
        </Text>
        <Text className="text-[20px] font-bold text-text-primary-light dark:text-text-primary-dark">
          {date.getDate()}
        </Text>
      </View>

      <View className="flex-1 justify-center py-3.5 pr-3.5">
        <View className="flex-row items-center">
          <View
            className="self-start rounded-full px-2.5 py-1"
            style={{ backgroundColor: softTint(accent.color, isDark) }}
          >
            <Text
              className="text-[11px] font-semibold"
              style={{ color: accent.color }}
              numberOfLines={1}
            >
              {item.subject}
            </Text>
          </View>

          {item.time ? (
            <Text className="ml-2 text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
              {item.time}
            </Text>
          ) : null}
        </View>

        <Text
          className="mt-1.5 text-[15px] font-semibold leading-[21px] text-text-primary-light dark:text-text-primary-dark"
          numberOfLines={2}
        >
          {item.title}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
