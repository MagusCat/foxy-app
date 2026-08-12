import React, { useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Modal,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';

import { NextLessonSheet } from '@/components/next-lesson-sheet';
import { ProgressRing } from '@/components/progress-ring';
import { useScreenPadding } from '@/components/screen-header';
import { softTint } from '@/components/settings-ui';
import { getSubjectAccent } from '@/constants/subject-colors';
import { Palette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { useDailyStreak } from '@/hooks/use-daily-streak';
import { useSheetPaddingBottom } from '@/hooks/use-sheet-padding';
import { useStudyActivity } from '@/hooks/use-study-activity';
import {
  isLessonUnlocked,
  LESSON_KIND_META,
  topicProgress,
  useStudyPlan,
  type PlanLesson,
} from '@/hooks/use-study-plans';

const NODE = 64;
const ROW_HEIGHT = 118;
const SEPARATOR_HEIGHT = 58;
const CORNER = 16;

const X_PATTERN = [0.5, 0.68, 0.42, 0.56, 0.72, 0.38];

type TreeItem =
  | { kind: 'separator'; id: string; level: number; y: number }
  | { kind: 'node'; id: string; lesson: PlanLesson; index: number; x: number; cy: number };

function connector(x0: number, y0: number, x1: number, y1: number) {
  if (Math.abs(x1 - x0) < 1) return `M ${x0} ${y0} V ${y1}`;

  const middle = (y0 + y1) / 2;
  const direction = x1 > x0 ? 1 : -1;

  return [
    `M ${x0} ${y0}`,
    `V ${middle - CORNER}`,
    `Q ${x0} ${middle} ${x0 + direction * CORNER} ${middle}`,
    `H ${x1 - direction * CORNER}`,
    `Q ${x1} ${middle} ${x1} ${middle + CORNER}`,
    `V ${y1}`,
  ].join(' ');
}

export default function TopicScreen() {
  const { planId, topicId } = useLocalSearchParams<{ planId: string; topicId: string }>();
  const { width } = useWindowDimensions();
  const padding = useScreenPadding();
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const sheetPaddingBottom = useSheetPaddingBottom();

  const { plan, completeLesson, hydrated } = useStudyPlan(planId);
  const { logSession } = useStudyActivity();
  const [, , markStudied] = useDailyStreak();

  const [openLesson, setOpenLesson] = useState<PlanLesson | null>(null);
  const [isLessonSheetVisible, setLessonSheetVisible] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;

  const topic = plan?.topics.find((item) => item.id === topicId);
  const treeWidth = width - 40;

  const { items, height } = useMemo(() => {
    if (!topic) return { items: [] as TreeItem[], height: 0 };

    const result: TreeItem[] = [];
    let y = 0;
    let nodeIndex = 0;

    topic.lessons.forEach((lesson, index) => {
      if (index > 0 && lesson.level !== topic.lessons[index - 1].level) {
        result.push({ kind: 'separator', id: `sep-${lesson.id}`, level: lesson.level, y });
        y += SEPARATOR_HEIGHT;
      }

      result.push({
        kind: 'node',
        id: lesson.id,
        lesson,
        index,
        x: X_PATTERN[nodeIndex % X_PATTERN.length] * treeWidth,
        cy: y + ROW_HEIGHT / 2,
      });

      y += ROW_HEIGHT;
      nodeIndex += 1;
    });

    return { items: result, height: y };
  }, [topic, treeWidth]);

  const paths = useMemo(() => {
    const lines: string[] = [];
    for (let index = 0; index < items.length - 1; index += 1) {
      const from = items[index];
      const to = items[index + 1];
      if (from.kind !== 'node' || to.kind !== 'node') continue;
      lines.push(connector(from.x, from.cy + NODE / 2, to.x, to.cy - NODE / 2));
    }
    return lines;
  }, [items]);

  if (!topic && !hydrated) {
    return <View className="flex-1 bg-bg-light dark:bg-bg-dark" />;
  }

  if (!plan || !topic) {
    return (
      <View
        className="flex-1 items-center justify-center bg-bg-light px-8 dark:bg-bg-dark"
        style={{ paddingTop: padding.top }}
      >
        <Ionicons name="school-outline" size={38} color={colors.icon} />
        <Text className="mt-3 text-center text-[15px] font-semibold text-text-primary-light dark:text-text-primary-dark">
          Este tema ya no existe
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

  const accent = getSubjectAccent(plan.subject, isDark);
  const done = topicProgress(topic);

  const headerOpacity = scrollY.interpolate({
    inputRange: [40, 110],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  const compactOpacity = scrollY.interpolate({
    inputRange: [60, 120],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const handleNodePress = (lesson: PlanLesson, index: number) => {
    if (!isLessonUnlocked(topic, index)) {
      Alert.alert('Lección bloqueada', 'Termina la lección anterior para abrir esta.');
      return;
    }
    setOpenLesson(lesson);
  };

  const handleComplete = (lesson: PlanLesson) => {
    completeLesson(plan.id, topic.id, lesson.id);
    markStudied();
    logSession({
      kind: 'lesson',
      subject: plan.subject,
      title: `${topic.title} · ${lesson.title}`,
      minutes: 8,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setOpenLesson(null);
  };

  return (
    <View className="flex-1 bg-bg-light dark:bg-bg-dark">
      <View
        className="flex-row items-center px-5 pb-3"
        style={{ paddingTop: padding.top, backgroundColor: colors.background, zIndex: 20 }}
      >
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
            accessibilityLabel="Crear una lección de este tema"
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
            accessibilityLabel="Cómo funciona este tema"
            onPress={() =>
              Alert.alert(
                topic.title,
                'Cada burbuja es una lección. Se abren en orden: al terminar una, se desbloquea la siguiente y sube tu dominio del tema.',
              )
            }
          >
            <Ionicons name="information-circle-outline" size={18} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: padding.top + 48,
          left: 20,
          right: 20,
          zIndex: 15,
          opacity: compactOpacity,
        }}
      >
        <View
          className="flex-row items-center rounded-[18px] border p-3"
          style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}
        >
          <View className="flex-1 pr-3">
            <Text className="text-[10px] font-bold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark">
              Tema y dominio
            </Text>
            <Text
              className="mt-0.5 text-[15px] font-bold text-text-primary-light dark:text-text-primary-dark"
              numberOfLines={2}
            >
              {topic.title}
            </Text>
          </View>

          <ProgressRing
            size={44}
            stroke={4}
            ratio={done.ratio}
            color={accent.color}
            trackColor={colors.surface}
          >
            <Text className="text-[12px] font-bold text-text-primary-light dark:text-text-primary-dark">
              {done.percent}%
            </Text>
          </ProgressRing>
        </View>
      </Animated.View>

      <Animated.ScrollView
        contentContainerStyle={{ paddingBottom: padding.stackBottom + 24 }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: true,
        })}
      >
        <Animated.View className="items-center px-5 pb-2 pt-3" style={{ opacity: headerOpacity }}>
          <Text className="text-[10px] font-bold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark">
            Tema y dominio
          </Text>

          <View className="mt-4">
            <ProgressRing
              size={88}
              stroke={7}
              ratio={done.ratio}
              color={accent.color}
              trackColor={colors.surface}
            >
              <Text className="text-[20px] font-bold text-text-primary-light dark:text-text-primary-dark">
                {done.percent}%
              </Text>
            </ProgressRing>
          </View>

          <Text className="mt-4 text-center text-[22px] font-bold leading-[29px] text-text-primary-light dark:text-text-primary-dark">
            {topic.title}
          </Text>

          <View
            className="mt-3 rounded-full px-3.5 py-1.5"
            style={{ backgroundColor: colors.surface }}
          >
            <Text className="text-[12px] font-semibold text-text-primary-light dark:text-text-primary-dark">
              Nivel {topic.level}
            </Text>
          </View>
        </Animated.View>

        <View className="mt-4 px-5">
          <View style={{ width: treeWidth, height }}>
            <Svg
              width={treeWidth}
              height={height}
              style={{ position: 'absolute' }}
              pointerEvents="none"
            >
              {paths.map((d, index) => (
                <Path
                  key={index}
                  d={d}
                  stroke={colors.cardBorder}
                  strokeWidth={3}
                  strokeLinecap="round"
                  fill="none"
                />
              ))}
            </Svg>

            {items.map((item) => {
              if (item.kind === 'separator') {
                return (
                  <View
                    key={item.id}
                    className="absolute left-0 right-0 flex-row items-center"
                    style={{ top: item.y, height: SEPARATOR_HEIGHT }}
                  >
                    <View className="h-px flex-1" style={{ backgroundColor: colors.cardBorder }} />
                    <View
                      className="mx-3 flex-row items-center rounded-full border px-3 py-1.5"
                      style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}
                    >
                      <Ionicons name="lock-closed" size={11} color={colors.icon} />
                      <Text className="ml-1.5 text-[12px] font-semibold text-text-secondary-light dark:text-text-secondary-dark">
                        Nivel {item.level}
                      </Text>
                    </View>
                    <View className="h-px flex-1" style={{ backgroundColor: colors.cardBorder }} />
                  </View>
                );
              }

              const unlocked = isLessonUnlocked(topic, item.index);
              const isDone = item.lesson.done;
              const isCurrent = unlocked && !isDone;
              const meta = LESSON_KIND_META[item.lesson.kind];

              return (
                <TouchableOpacity
                  key={item.id}
                  className="absolute items-center justify-center"
                  style={{
                    top: item.cy - NODE / 2,
                    left: item.x - NODE / 2,
                    height: NODE,
                    width: NODE,
                    borderRadius: NODE / 2,
                    backgroundColor: isDone ? '#10B981' : colors.card,
                    borderWidth: isCurrent ? 2.5 : 1.5,
                    borderColor: isDone
                      ? '#10B981'
                      : isCurrent
                        ? accent.color
                        : colors.cardBorder,
                    opacity: unlocked ? 1 : 0.55,
                  }}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={`${meta.label}: ${item.lesson.title}. ${
                    isDone ? 'Completada' : unlocked ? 'Disponible' : 'Bloqueada'
                  }`}
                  onPress={() => handleNodePress(item.lesson, item.index)}
                >
                  <Ionicons
                    name={isDone ? meta.icon : unlocked ? meta.icon : 'lock-closed'}
                    size={26}
                    color={isDone ? '#FFFFFF' : isCurrent ? accent.color : colors.icon}
                  />
                </TouchableOpacity>
              );
            })}
          </View>

          {done.percent === 100 ? (
            <View
              className="mt-6 items-center rounded-[20px] border p-5"
              style={{ backgroundColor: colors.card, borderColor: '#10B981' }}
            >
              <Ionicons name="trophy" size={28} color="#10B981" />
              <Text className="mt-2 text-center text-[15px] font-bold text-text-primary-light dark:text-text-primary-dark">
                ¡Tema dominado!
              </Text>
              <Text className="mt-1 text-center text-[12px] text-text-secondary-light dark:text-text-secondary-dark">
                Ya puedes seguir con el siguiente tema de tu plan.
              </Text>
              <TouchableOpacity
                className="mt-3.5 rounded-full px-5 py-2.5"
                style={{ backgroundColor: Palette.primary }}
                activeOpacity={0.85}
                onPress={() => router.back()}
              >
                <Text className="text-[13px] font-bold text-white">Volver a mis temas</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </Animated.ScrollView>

      <Modal
        visible={openLesson !== null}
        transparent
        statusBarTranslucent
        navigationBarTranslucent
        animationType="slide"
        onRequestClose={() => setOpenLesson(null)}
      >
        <View className="flex-1 justify-end bg-black/45 dark:bg-black/75">
          <TouchableOpacity className="flex-1" activeOpacity={1} onPress={() => setOpenLesson(null)} />
          <View
            className="rounded-t-[26px] px-[18px] pt-[18px]"
            style={{ backgroundColor: colors.card, paddingBottom: sheetPaddingBottom }}
          >
            {openLesson ? (
              <>
                <View className="mb-4 flex-row items-center">
                  <View
                    className="h-12 w-12 items-center justify-center rounded-2xl"
                    style={{ backgroundColor: softTint(accent.color, isDark) }}
                  >
                    <Ionicons
                      name={LESSON_KIND_META[openLesson.kind].icon}
                      size={22}
                      color={accent.color}
                    />
                  </View>

                  <View className="ml-3 flex-1">
                    <Text className="text-[11px] font-bold uppercase tracking-wider" style={{ color: accent.color }}>
                      {LESSON_KIND_META[openLesson.kind].label}
                    </Text>
                    <Text className="mt-0.5 text-[17px] font-bold text-text-primary-light dark:text-text-primary-dark">
                      {openLesson.title}
                    </Text>
                  </View>
                </View>

                <Text className="text-[13px] leading-[19px] text-text-secondary-light dark:text-text-secondary-dark">
                  {openLesson.done
                    ? 'Ya completaste esta lección. Puedes repasarla cuando quieras.'
                    : `Foxy generará esta lección sobre "${topic.title}" en cuanto conectemos la IA. Mientras tanto puedes marcarla como completada para ver cómo avanza tu dominio.`}
                </Text>

                <TouchableOpacity
                  className="mt-5 items-center rounded-[18px] py-4"
                  style={{ backgroundColor: openLesson.done ? colors.surface : Palette.primary }}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={openLesson.done ? 'Cerrar' : 'Marcar como completada'}
                  onPress={() => (openLesson.done ? setOpenLesson(null) : handleComplete(openLesson))}
                >
                  <Text
                    className="text-[15px] font-bold"
                    style={{ color: openLesson.done ? colors.text : '#FFFFFF' }}
                  >
                    {openLesson.done ? 'Cerrar' : 'Marcar como completada'}
                  </Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      <NextLessonSheet
        visible={isLessonSheetVisible}
        onClose={() => setLessonSheetVisible(false)}
        plan={plan}
        topicId={topic.id}
      />
    </View>
  );
}
