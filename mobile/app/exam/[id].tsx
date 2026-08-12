import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { GoalBar } from '@/components/goal-bar';
import { MonthCalendar } from '@/components/month-calendar';
import { NextLessonSheet } from '@/components/next-lesson-sheet';
import { PlanSettingsSheet } from '@/components/plan-settings-sheet';
import { ProgressRing } from '@/components/progress-ring';
import { useScreenPadding } from '@/components/screen-header';
import { softTint } from '@/components/settings-ui';
import { getSubjectAccent } from '@/constants/subject-colors';
import { Palette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { daysUntil, localDay } from '@/hooks/use-agenda';
import { useAttachments } from '@/hooks/use-attachments';
import { useDailyStreak } from '@/hooks/use-daily-streak';
import { usePersistentState } from '@/hooks/use-persistent-state';
import { useSheetPaddingBottom } from '@/hooks/use-sheet-padding';
import {
  dailyLessonGoal,
  formatExamDate,
  formatShortDate,
  isTopicUnlocked,
  lessonsDoneToday,
  planProgress,
  topicProgress,
  useStudyPlan,
  type PlanMaterial,
} from '@/hooks/use-study-plans';

type TabKey = 'temas' | 'progreso' | 'archivos';

const WEEKDAY_SHORT = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

/**
 * Tira de días alrededor de hoy. El día del examen lleva birrete y los días
 * ya pasados van en línea discontinua, para que el calendario se lea de un
 * vistazo sin abrir el mes completo.
 */
function DayStrip({ examDate }: { examDate: string }) {
  const { colors } = useTheme();
  const today = localDay(new Date());

  const days = useMemo(() => {
    const window = Array.from({ length: 14 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() + index - 3);
      const key = localDay(date);
      return {
        key,
        number: date.getDate(),
        weekday: WEEKDAY_SHORT[date.getDay()],
        isToday: key === today,
        isPast: key < today,
        isExam: key === examDate,
        isBreak: false,
      };
    });

    // Un examen a meses vista cae fuera de la ventana y la tira quedaba sin
    // birrete: se engancha al final, separado, para que siga estando a la
    // vista sin dibujar los cien días de en medio.
    if (window.some((day) => day.isExam) || examDate < today) return window;

    const exam = new Date(`${examDate}T00:00:00`);
    return [
      ...window,
      {
        key: 'break',
        number: 0,
        weekday: '',
        isToday: false,
        isPast: false,
        isExam: false,
        isBreak: true,
      },
      {
        key: examDate,
        number: exam.getDate(),
        weekday: WEEKDAY_SHORT[exam.getDay()],
        isToday: false,
        isPast: false,
        isExam: true,
        isBreak: false,
      },
    ];
  }, [examDate, today]);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}
    >
      {days.map((day) =>
        day.isBreak ? (
          <View key={day.key} className="h-[38px] w-3 justify-end self-end">
            <Text className="pb-2.5 text-[13px]" style={{ color: colors.icon }}>
              ···
            </Text>
          </View>
        ) : (
        <View key={day.key} className="w-[38px] items-center">
          <Text className="mb-1.5 text-[12px] text-text-secondary-light dark:text-text-secondary-dark">
            {day.weekday}
          </Text>

          <View
            className="h-[38px] w-[38px] items-center justify-center rounded-full"
            style={
              day.isExam
                ? { backgroundColor: softTint(Palette.accentPurple, true) }
                : day.isToday
                  ? { borderWidth: 2, borderColor: colors.text }
                  : {
                      borderWidth: 1.5,
                      borderStyle: 'dashed',
                      borderColor: colors.cardBorder,
                    }
            }
          >
            {day.isExam ? (
              <Ionicons name="school" size={18} color={Palette.accentPurple} />
            ) : (
              <Text
                className="text-[14px] font-semibold"
                style={{ color: day.isPast ? colors.icon : colors.text }}
              >
                {day.number}
              </Text>
            )}
          </View>
        </View>
        ),
      )}
    </ScrollView>
  );
}

function StatRow({
  emoji,
  label,
  value,
  last,
}: {
  emoji: string;
  label: string;
  value: string;
  last?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View
      className="flex-row items-center py-3.5"
      style={last ? undefined : { borderBottomWidth: 1, borderColor: colors.cardBorder }}
    >
      <Text style={{ fontSize: 18 }}>{emoji}</Text>
      <Text className="ml-3 flex-1 text-[15px] text-text-primary-light dark:text-text-primary-dark">
        {label}
      </Text>
      <Text className="text-[15px] font-bold text-text-primary-light dark:text-text-primary-dark">
        {value}
      </Text>
    </View>
  );
}

export default function ExamPlanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const padding = useScreenPadding();
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const sheetPaddingBottom = useSheetPaddingBottom();

  const { plan, addMaterials, removePlan, updatePlan, hydrated } = useStudyPlan(id);
  const [, streak] = useDailyStreak();
  const [avatarUri] = usePersistentState('foxy:avatar', '');
  const [userName] = usePersistentState('foxy:user-name', 'Usuario');

  const [tab, setTab] = useState<TabKey>('temas');
  const [isAddVisible, setAddVisible] = useState(false);
  const [isLessonSheetVisible, setLessonSheetVisible] = useState(false);
  const [isSettingsVisible, setSettingsVisible] = useState(false);

  const picker = useAttachments();
  const { attachments, clearAttachments } = picker;

  /**
   * Lo que se elige en el selector entra en el plan y se vacía enseguida: el
   * hook es el buzón temporal, la lista buena vive en el plan guardado.
   */
  useEffect(() => {
    if (!plan || attachments.length === 0) return;

    addMaterials(
      plan.id,
      attachments.map((item) => ({
        id: item.id,
        kind: item.kind,
        name: item.name,
        uri: item.uri,
        size: item.size,
      })),
    );
    clearAttachments();
  }, [attachments, plan, addMaterials, clearAttachments]);

  // Leer del disco tarda un instante: sin esta espera se vería un "ya no
  // existe" en cuanto se abre la pantalla, antes de cargar los planes.
  if (!plan && !hydrated) {
    return <View className="flex-1 bg-bg-light dark:bg-bg-dark" />;
  }

  if (!plan) {
    return (
      <View
        className="flex-1 items-center justify-center bg-bg-light px-8 dark:bg-bg-dark"
        style={{ paddingTop: padding.top }}
      >
        <Ionicons name="document-text-outline" size={38} color={colors.icon} />
        <Text className="mt-3 text-center text-[15px] font-semibold text-text-primary-light dark:text-text-primary-dark">
          Esta preparación ya no existe
        </Text>
        <TouchableOpacity
          className="mt-5 rounded-full px-5 py-2.5"
          style={{ backgroundColor: Palette.primary }}
          onPress={() => router.replace('/(tabs)/exams')}
        >
          <Text className="text-[13px] font-bold text-white">Ver mis exámenes</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const progress = planProgress(plan);
  const accent = getSubjectAccent(plan.subject, isDark);
  const left = daysUntil(plan.examDate);
  const goal = dailyLessonGoal(plan);
  const doneToday = lessonsDoneToday(plan);

  const openTopic = (topicId: string, unlocked: boolean, title: string) => {
    if (!unlocked) {
      Alert.alert('Tema bloqueado', `Termina el tema anterior para abrir "${title}".`);
      return;
    }
    router.push({ pathname: '/exam/topic', params: { planId: plan.id, topicId } });
  };

  const pickThen = (action: () => void) => {
    setAddVisible(false);
    setTimeout(action, 260);
  };

  const tabs: { key: TabKey; label: string; badge?: string }[] = [
    { key: 'temas', label: 'Temas de estudio' },
    { key: 'progreso', label: 'Progreso', badge: `${progress.percent}%` },
    { key: 'archivos', label: 'Archivos', badge: `${plan.materials.length}` },
  ];

  return (
    <View className="flex-1 bg-bg-light dark:bg-bg-dark">
      <ScrollView
        contentContainerStyle={{ paddingTop: padding.top, paddingBottom: padding.stackBottom }}
        showsVerticalScrollIndicator={false}
      >
        {/* BARRA SUPERIOR: volver a la izquierda y todo lo demás junto a la
            derecha, que es donde cae el pulgar. */}
        <View className="flex-row items-center px-5 pb-4">
          <TouchableOpacity
            className="h-9 w-9 items-center justify-center rounded-full border"
            style={{ backgroundColor: colors.surface, borderColor: colors.cardBorder }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Volver"
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={18} color={colors.text} />
          </TouchableOpacity>

          <View className="flex-1" />

          <View className="flex-row items-center gap-2">
            <TouchableOpacity
              className="h-9 flex-row items-center rounded-full border px-4"
              style={{ backgroundColor: colors.surface, borderColor: colors.cardBorder }}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Crear una lección de esta preparación"
              onPress={() => setLessonSheetVisible(true)}
            >
              <Ionicons name="add" size={16} color={colors.text} />
              <Text className="ml-1 text-[14px] font-semibold text-text-primary-light dark:text-text-primary-dark">
                Crear
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="h-9 w-9 items-center justify-center rounded-full border"
              style={{ backgroundColor: colors.surface, borderColor: colors.cardBorder }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Compartir"
              onPress={() =>
                Alert.alert('Próximamente', 'Compartir tu plan con tus compañeros llegará pronto.')
              }
            >
              <Ionicons name="share-social-outline" size={17} color={colors.text} />
            </TouchableOpacity>

            <TouchableOpacity
              className="h-9 w-9 items-center justify-center rounded-full border"
              style={{ backgroundColor: colors.surface, borderColor: colors.cardBorder }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Información y ajustes de la preparación"
              onPress={() => setSettingsVisible(true)}
            >
              <Ionicons name="ellipsis-vertical" size={17} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* TIRA DE DÍAS */}
        <DayStrip examDate={plan.examDate} />

        {/* TÍTULO */}
        <View className="mt-6 px-5">
          <Text className="text-center text-[13px] text-text-secondary-light dark:text-text-secondary-dark">
            {plan.subject}
          </Text>
          <Text className="mt-1.5 text-center text-[26px] font-bold leading-[33px] text-text-primary-light dark:text-text-primary-dark">
            {plan.title}
          </Text>
        </View>

        {/* CUENTA ATRÁS */}
        <View className="mt-5 px-5">
          <LinearGradient
            colors={
              left <= 1
                ? ['#3B1418', isDark ? '#1A0F12' : '#4C1D24']
                : [softTint(accent.color, true), isDark ? '#16151B' : '#1F1C28']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderRadius: 20,
              borderWidth: 1,
              borderColor: left <= 1 ? '#7F1D1D' : colors.cardBorder,
              padding: 18,
            }}
          >
            <Text className="text-[11px] font-bold uppercase tracking-wider text-white/70">
              {left < 0 ? 'El examen ya pasó' : 'Hasta el examen'}
            </Text>

            <View className="mt-1.5 flex-row items-end justify-between">
              <View className="flex-row items-baseline">
                <Text className="text-[46px] font-bold leading-[52px] text-white">
                  {Math.max(left, 0)}
                </Text>
                <Text className="ml-2 text-[16px] font-semibold text-white/85">
                  {Math.abs(left) === 1 ? 'día' : 'días'}
                </Text>
              </View>

              <Text className="mb-1.5 max-w-[55%] text-right text-[12px] text-white/70" numberOfLines={2}>
                {formatExamDate(plan.examDate)}
              </Text>
            </View>
          </LinearGradient>
        </View>

        {/* PESTAÑAS */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
          className="mt-5 grow-0"
        >
          {tabs.map((item) => {
            const isActive = tab === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                className="h-11 flex-row items-center rounded-full px-4"
                style={{ backgroundColor: isActive ? colors.text : colors.surface }}
                activeOpacity={0.8}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                onPress={() => setTab(item.key)}
              >
                <Text
                  className="text-[14px] font-semibold"
                  style={{ color: isActive ? colors.background : colors.text }}
                >
                  {item.label}
                </Text>
                {item.badge ? (
                  <View
                    className="ml-2 rounded-full px-2 py-0.5"
                    style={{ backgroundColor: isActive ? `${colors.background}33` : colors.cardBorder }}
                  >
                    <Text
                      className="text-[11px] font-bold"
                      style={{ color: isActive ? colors.background : colors.text }}
                    >
                      {item.badge}
                    </Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ---------------- TEMAS DE ESTUDIO ---------------- */}
        {tab === 'temas' ? (
          <View className="mt-5 px-5">
            {plan.topics.map((topic, index) => {
              const unlocked = isTopicUnlocked(plan, index);
              const topicDone = topicProgress(topic);
              const isCurrent = unlocked && topicDone.percent < 100;

              return (
                <TouchableOpacity
                  key={topic.id}
                  className="mb-3 flex-row items-center rounded-[18px] border p-4"
                  style={{
                    backgroundColor: colors.card,
                    borderColor: isCurrent ? accent.color : colors.cardBorder,
                    borderWidth: isCurrent ? 1.5 : 1,
                    opacity: unlocked ? 1 : 0.55,
                  }}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={`Tema ${index + 1}: ${topic.title}. ${
                    unlocked ? `${topicDone.percent} por ciento` : 'Bloqueado'
                  }`}
                  onPress={() => openTopic(topic.id, unlocked, topic.title)}
                >
                  <Text
                    className="w-6 text-[15px] font-bold"
                    style={{ color: unlocked ? colors.text : colors.icon }}
                  >
                    {index + 1}
                  </Text>

                  <View className="ml-1 flex-1">
                    <Text
                      className="text-[15px] font-semibold text-text-primary-light dark:text-text-primary-dark"
                      numberOfLines={2}
                    >
                      {topic.title}
                    </Text>
                    <Text className="mt-1 text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
                      Nivel {topic.level}
                      {topicDone.percent > 0 ? ` · ${topicDone.percent}% completado` : ''}
                    </Text>
                  </View>

                  {!unlocked ? (
                    <Ionicons name="lock-closed" size={18} color={colors.icon} />
                  ) : topicDone.percent === 100 ? (
                    <Ionicons name="checkmark-circle" size={22} color="#10B981" />
                  ) : (
                    <Ionicons name="arrow-forward" size={18} color={colors.text} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}

        {/* ---------------- PROGRESO ---------------- */}
        {tab === 'progreso' ? (
          <View className="mt-5 px-5">
            <View
              className="rounded-[20px] border p-4"
              style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}
            >
              <View className="flex-row items-end">
                <View
                  className="mr-3 h-11 w-11 items-center justify-center overflow-hidden rounded-full border"
                  style={{ backgroundColor: colors.surface, borderColor: colors.cardBorder }}
                >
                  {avatarUri ? (
                    <Image
                      source={{ uri: avatarUri }}
                      style={{ height: '100%', width: '100%' }}
                      contentFit="cover"
                    />
                  ) : (
                    <Text className="text-[16px] font-bold text-text-primary-light dark:text-text-primary-dark">
                      {userName.charAt(0).toUpperCase()}
                    </Text>
                  )}
                </View>

                <View className="flex-1">
                  <GoalBar
                    ratio={progress.ratio}
                    target={plan.targetGrade}
                    color={accent.color}
                    withTargetLabel
                    height={10}
                  />
                </View>

                <Text className="ml-3 text-[19px] font-bold text-text-primary-light dark:text-text-primary-dark">
                  {progress.percent}%
                </Text>
              </View>

              <Text className="mt-3.5 text-center text-[12px] leading-[18px] text-text-secondary-light dark:text-text-secondary-dark">
                Tu nivel promedio de dominio de todos los temas.{'\n'}
                {progress.percent === 0 ? '¡Empieza por el primero! 💪' : '¡Sigue así! 💪'}
              </Text>

              <View className="mt-2 h-px" style={{ backgroundColor: colors.cardBorder }} />

              <StatRow emoji="🎓" label="Fecha del examen" value={formatShortDate(plan.examDate)} />
              <StatRow emoji="🎯" label="Calificación objetivo" value={`${plan.targetGrade}%`} />
              <StatRow emoji="🔥" label="Racha" value={`${streak.count}`} />
              <StatRow
                emoji="✅"
                label="Lecciones completadas"
                value={`${progress.lessonsDone}`}
                last
              />
            </View>

            {/* META DIARIA */}
            <View
              className="mt-3 flex-row items-center rounded-[20px] border p-4"
              style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}
            >
              <ProgressRing
                size={34}
                stroke={4}
                ratio={goal === 0 ? 0 : doneToday / goal}
                color={Palette.flameOrange}
                trackColor={colors.surface}
              />
              <Text className="ml-3 flex-1 text-[15px] text-text-primary-light dark:text-text-primary-dark">
                Tu meta diaria
              </Text>
              <Text className="text-[15px] font-bold text-text-primary-light dark:text-text-primary-dark">
                {doneToday}/{goal} lecciones
              </Text>
            </View>

            {/* CALENDARIO DEL MES */}
            <View
              className="mt-3 rounded-[20px] border p-4"
              style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}
            >
              <MonthCalendar examDay={plan.examDate} />
            </View>

            {/* RACHA */}
            <View
              className="mt-3 items-center rounded-[20px] border px-4 py-6"
              style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}
            >
              <Ionicons
                name="flame"
                size={30}
                color={streak.count > 0 ? Palette.flameOrange : colors.icon}
              />
              <Text className="mt-1.5 text-[34px] font-bold leading-[40px] text-text-primary-light dark:text-text-primary-dark">
                {streak.count}
              </Text>
              <Text className="text-[14px] font-semibold text-text-primary-light dark:text-text-primary-dark">
                {streak.count === 1 ? 'día de racha' : 'días de racha'}
              </Text>
              <Text className="mt-1.5 text-center text-[12px] text-text-secondary-light dark:text-text-secondary-dark">
                {streak.count > 0
                  ? '¡No la pierdas! Estudia algo hoy para mantenerla.'
                  : '¿Estás listo para comenzar tu primera racha?'}
              </Text>
            </View>
          </View>
        ) : null}

        {/* ---------------- ARCHIVOS ---------------- */}
        {tab === 'archivos' ? (
          <View className="mt-5 px-5">
            <View className="mb-4 flex-row gap-2.5">
              <TouchableOpacity
                className="h-11 flex-1 flex-row items-center justify-center rounded-full border"
                style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Descargar todo"
                onPress={() =>
                  Alert.alert(
                    'Tus archivos',
                    plan.materials.length === 0
                      ? 'Todavía no has subido material a esta preparación.'
                      : 'Este material ya está guardado en tu dispositivo junto con la preparación. La descarga desde la nube llegará con las cuentas en línea.',
                  )
                }
              >
                <Ionicons name="download-outline" size={17} color={colors.text} />
                <Text className="ml-1.5 text-[14px] font-semibold text-text-primary-light dark:text-text-primary-dark">
                  Descargar todo
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="h-11 flex-1 flex-row items-center justify-center rounded-full border"
                style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Agregar más material"
                onPress={() => setAddVisible(true)}
              >
                <Ionicons name="add" size={17} color={colors.text} />
                <Text className="ml-1.5 text-[14px] font-semibold text-text-primary-light dark:text-text-primary-dark">
                  Agregar más
                </Text>
              </TouchableOpacity>
            </View>

            {plan.materials.length === 0 ? (
              <View
                className="items-center rounded-[20px] border px-5 py-8"
                style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}
              >
                <Ionicons name="folder-open-outline" size={30} color={colors.icon} />
                <Text className="mt-2.5 text-center text-[14px] font-semibold text-text-primary-light dark:text-text-primary-dark">
                  Sin material todavía
                </Text>
                <Text className="mt-1 text-center text-[12px] leading-[18px] text-text-secondary-light dark:text-text-secondary-dark">
                  Sube tus apuntes o diapositivas y Foxy ajustará los temas a lo que entra de verdad.
                </Text>
              </View>
            ) : (
              plan.materials.map((material: PlanMaterial) => (
                <View
                  key={material.id}
                  className="mb-2.5 flex-row items-center rounded-2xl border p-3"
                  style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}
                >
                  {material.kind === 'image' && material.uri ? (
                    <Image
                      source={{ uri: material.uri }}
                      style={{ height: 34, width: 34, borderRadius: 9 }}
                      contentFit="cover"
                      transition={120}
                    />
                  ) : (
                    <View
                      className="h-[34px] w-[34px] items-center justify-center rounded-[9px]"
                      style={{ backgroundColor: colors.surface }}
                    >
                      <Ionicons
                        name={material.kind === 'text' ? 'clipboard' : 'document-text'}
                        size={17}
                        color={material.kind === 'text' ? '#10B981' : '#FBBF24'}
                      />
                    </View>
                  )}

                  <Text
                    className="ml-3 flex-1 text-[13px] text-text-primary-light dark:text-text-primary-dark"
                    numberOfLines={2}
                  >
                    {material.name}
                  </Text>

                  <TouchableOpacity
                    className="ml-2 h-9 w-9 items-center justify-center rounded-full"
                    style={{ backgroundColor: colors.surface }}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`Abrir ${material.name}`}
                    onPress={() =>
                      Alert.alert(
                        material.name,
                        material.kind === 'text'
                          ? material.content?.slice(0, 400) || 'Sin contenido'
                          : 'Este archivo se guarda con tu preparación y se usará cuando conectemos la IA.',
                      )
                    }
                  >
                    <Ionicons name="download-outline" size={16} color={colors.text} />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        ) : null}
      </ScrollView>

      {/* HOJA: AGREGAR MATERIAL */}
      <Modal
        visible={isAddVisible}
        transparent
        statusBarTranslucent
        navigationBarTranslucent
        animationType="slide"
        onRequestClose={() => setAddVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/45 dark:bg-black/75">
          <TouchableOpacity className="flex-1" activeOpacity={1} onPress={() => setAddVisible(false)} />
          <View
            className="rounded-t-[26px] px-[18px] pt-[18px]"
            style={{ backgroundColor: colors.card, paddingBottom: sheetPaddingBottom }}
          >
            <Text className="mb-4 text-lg font-bold text-text-primary-light dark:text-text-primary-dark">
              Agregar material
            </Text>

            <View className="flex-row gap-2.5">
              {[
                { label: 'Cámara', icon: 'camera-outline' as const, color: Palette.accentBlue, action: picker.addFromCamera },
                { label: 'Fotos', icon: 'images-outline' as const, color: Palette.primaryGlow, action: picker.addFromLibrary },
                { label: 'Archivos', icon: 'folder-outline' as const, color: '#FBBF24', action: picker.addFromFiles },
              ].map((option) => (
                <TouchableOpacity
                  key={option.label}
                  className="flex-1 items-center justify-center rounded-2xl border py-4"
                  style={{ backgroundColor: colors.background, borderColor: colors.cardBorder }}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel={option.label}
                  onPress={() => pickThen(option.action)}
                >
                  <Ionicons name={option.icon} size={22} color={option.color} />
                  <Text className="mt-1.5 text-[12px] font-semibold text-text-primary-light dark:text-text-primary-dark">
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* HOJA: SIGUIENTE LECCIÓN (botón Crear) */}
      <NextLessonSheet
        visible={isLessonSheetVisible}
        onClose={() => setLessonSheetVisible(false)}
        plan={plan}
      />

      {/* HOJA: INFORMACIÓN Y AJUSTES (tres puntos) */}
      <PlanSettingsSheet
        visible={isSettingsVisible}
        onClose={() => setSettingsVisible(false)}
        plan={plan}
        onUpdate={(patch) => updatePlan(plan.id, (current) => ({ ...current, ...patch }))}
        onDelete={() => {
          setSettingsVisible(false);
          removePlan(plan.id);
          router.replace('/(tabs)/exams');
        }}
        onOpenSources={() => {
          setSettingsVisible(false);
          setTab('archivos');
        }}
      />
    </View>
  );
}
