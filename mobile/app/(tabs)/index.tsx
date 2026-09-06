import React, { useState } from 'react';
import { Dimensions, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppHeader, useScreenPadding } from '@/components/screen-header';
import { getSubjectAccent } from '@/constants/subject-colors';
import { Palette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { ChatComposer } from '@/features/chat/components/chat-composer';
import { useChat } from '@/features/chat/hooks/use-chat';
import { appAlert } from '@/features/shared/components/overlay';
import { AppModal, SheetSlide } from '@/features/shared/components/portal';
import { useGuardedRouter } from '@/features/shared/hooks/use-guarded-router';
import { daysUntil, describeEventDate, EVENT_KIND_META, useAgenda } from '@/hooks/use-agenda';
import { useFocusSession } from '@/hooks/use-focus-session';
import { useDailyGoal } from '@/hooks/use-learning-prefs';
import { useKeyboardHeight } from '@/hooks/use-keyboard-height';
import { usePersistentState } from '@/hooks/use-persistent-state';
import { useSheetPaddingBottom } from '@/hooks/use-sheet-padding';

const LESSON_TYPES: { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { label: 'Cuestionario', icon: 'help-circle-outline', color: Palette.accentBlue },
  { label: 'Examen oral simulado', icon: 'mic-outline', color: Palette.accentPurple },
  { label: 'Verdadero o falso', icon: 'checkmark-circle-outline', color: '#10B981' },
  { label: 'Podcast', icon: 'headset-outline', color: '#EC4899' },
  { label: 'Tarjetas de memoria', icon: 'albums-outline', color: Palette.flameOrange },
  { label: 'Examen escrito simulado', icon: 'create-outline', color: '#14B8A6' },
];
const START_SHEET_MAX_HEIGHT = Math.round(Dimensions.get('window').height * 0.88);

export default function HomeScreen() {
  const padding = useScreenPadding();
  const router = useGuardedRouter();
  const { isDark } = useTheme();
  const sheetPaddingBottom = useSheetPaddingBottom();
  const keyboardHeight = useKeyboardHeight();
  const iconOnSurface = isDark ? Palette.textPrimaryDark : Palette.textPrimaryLight;

  const [userName] = usePersistentState('foxy:user-name', 'Usuario');
  const [selectedSubject] = usePersistentState('foxy:selected-subject', 'Matemáticas');
  const focus = useFocusSession();
  const { upcoming } = useAgenda();
  const goal = useDailyGoal();

  const { conversations, groups } = useChat();
  const lastConversation = groups[0]?.conversations[0];
  const lastAccent = lastConversation ? getSubjectAccent(lastConversation.subject, isDark) : undefined;
  const totalChats = conversations.length;

  const nextEvent = upcoming.find((event) => daysUntil(event.date) <= 7);
  const [isStartModalVisible, setStartModalVisible] = useState(false);

  const closeStartModalThen = (action: () => void) => {
    setStartModalVisible(false);
    setTimeout(action, 260);
  };

  const handleScanProblem = () =>
    closeStartModalThen(() => router.push({ pathname: '/chat', params: { scan: '1' } }));

  const handleLessonType = (label: string) =>
    closeStartModalThen(() =>
      appAlert(label, `Foxy generará "${label.toLowerCase()}" de ${selectedSubject} en cuanto conectemos la IA.`),
    );

  const goToTab = (path: '/(tabs)/exams' | '/(tabs)/class') => closeStartModalThen(() => router.push(path));

  return (
    <View className="flex-1 bg-bg-light dark:bg-bg-dark">
      <AppHeader />

      <ScrollView className="px-5" contentContainerStyle={{ flexGrow: 1, paddingBottom: 10 }} showsVerticalScrollIndicator={false}>
        <View className="flex-1 items-center justify-center py-8">
          <Text className="text-center text-[22px] font-bold tracking-[-0.3px] text-text-primary-light dark:text-text-primary-dark">
            ¡Hola {userName}! ¿Qué quiere estudiar hoy?
          </Text>

          <TouchableOpacity
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Comenzar"
            onPress={() => setStartModalVisible(true)}
            className="mt-5 flex-row items-center rounded-[22px] px-[22px] py-3"
            style={{ backgroundColor: Palette.primary }}
          >
            <Ionicons name="sparkles" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text className="text-sm font-bold text-white" numberOfLines={1}>
              Comienza aquí
            </Text>
          </TouchableOpacity>

          <View className="mt-7 w-full gap-2">
            {!focus.isRunning && goal.showInList ? (
              <TouchableOpacity
                className="flex-row items-center rounded-2xl border border-card-light-border bg-card-light px-3.5 py-3 dark:border-card-dark-border dark:bg-card-dark"
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`Meta de hoy: ${goal.done} de ${goal.goal} minutos. Abrir modo enfoque`}
                onPress={() => router.push('/focus')}
              >
                <View
                  className="mr-3 h-9 w-9 items-center justify-center rounded-xl"
                  style={{ backgroundColor: isDark ? '#331F14' : '#FFEDD5' }}
                >
                  <Ionicons
                    name={goal.met ? 'checkmark-circle' : 'timer-outline'}
                    size={18}
                    color={goal.met ? '#10B981' : Palette.flameOrange}
                  />
                </View>

                <View className="flex-1">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-[13px] font-semibold text-text-primary-light dark:text-text-primary-dark">
                      {goal.met ? '¡Meta de hoy cumplida!' : 'Meta de hoy'}
                    </Text>
                    <Text className="text-[11px] font-bold text-text-secondary-light dark:text-text-secondary-dark">
                      {goal.done}/{goal.goal} min
                    </Text>
                  </View>

                  <View className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-light dark:bg-surface-dark">
                    <View
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.round(goal.ratio * 100)}%`,
                        backgroundColor: goal.met ? '#10B981' : Palette.flameOrange,
                      }}
                    />
                  </View>
                </View>

                <Ionicons name="chevron-forward" size={15} color="#6B7280" style={{ marginLeft: 8 }} />
              </TouchableOpacity>
            ) : null}

            {lastConversation && lastAccent ? (
              <TouchableOpacity
                className="flex-row items-center rounded-2xl border border-card-light-border bg-card-light px-3.5 py-3 dark:border-card-dark-border dark:bg-card-dark"
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`Continuar conversación: ${lastConversation.title}`}
                onPress={() => router.push({ pathname: '/chat', params: { id: lastConversation.id } })}
              >
                <View
                  className="mr-3 h-9 w-9 items-center justify-center rounded-xl"
                  style={{ backgroundColor: lastAccent.soft }}
                >
                  <Ionicons name="chatbubble-ellipses-outline" size={18} color={lastAccent.color} />
                </View>

                <View className="flex-1">
                  <Text
                    className="text-[13px] font-semibold text-text-primary-light dark:text-text-primary-dark"
                    numberOfLines={1}
                  >
                    Continuar: {lastConversation.title}
                  </Text>
                  <Text className="mt-0.5 text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
                    {lastConversation.subject} · {lastConversation.messages.length}{' '}
                    {lastConversation.messages.length === 1 ? 'mensaje' : 'mensajes'}
                  </Text>
                </View>

                <Ionicons name="chevron-forward" size={15} color="#6B7280" />
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              className="flex-row items-center rounded-2xl border border-card-light-border bg-card-light px-3.5 py-3 dark:border-card-dark-border dark:bg-card-dark"
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Mis conversaciones"
              onPress={() => router.push('/chat')}
            >
              <View
                className="mr-3 h-9 w-9 items-center justify-center rounded-xl"
                style={{ backgroundColor: isDark ? '#152238' : '#DBEAFE' }}
              >
                <Ionicons name="chatbubbles-outline" size={18} color={Palette.accentBlue} />
              </View>

              <View className="flex-1">
                <Text className="text-[13px] font-semibold text-text-primary-light dark:text-text-primary-dark">
                  Mis conversaciones
                </Text>
                <Text className="mt-0.5 text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
                  {totalChats > 0
                    ? `${totalChats} ${totalChats === 1 ? 'conversación' : 'conversaciones'}`
                    : 'Todavía no tienes conversaciones'}
                </Text>
              </View>

              <Ionicons name="chevron-forward" size={15} color="#6B7280" />
            </TouchableOpacity>

            {nextEvent ? (
              <TouchableOpacity
                className="flex-row items-center rounded-2xl border border-card-light-border bg-card-light px-3.5 py-3 dark:border-card-dark-border dark:bg-card-dark"
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`Próximo evento: ${nextEvent.title}, ${describeEventDate(nextEvent.date)}`}
                onPress={() => router.push('/calendar')}
              >
                <View
                  className="mr-3 h-9 w-9 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${EVENT_KIND_META[nextEvent.kind].color}${isDark ? '2E' : '1F'}` }}
                >
                  <Ionicons name={EVENT_KIND_META[nextEvent.kind].icon} size={18} color={EVENT_KIND_META[nextEvent.kind].color} />
                </View>

                <View className="flex-1">
                  <Text className="text-[13px] font-semibold text-text-primary-light dark:text-text-primary-dark" numberOfLines={1}>
                    {nextEvent.title}
                  </Text>
                  <Text className="mt-0.5 text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
                    {EVENT_KIND_META[nextEvent.kind].label} · {describeEventDate(nextEvent.date)}
                  </Text>
                </View>

                <Ionicons name="chevron-forward" size={15} color="#6B7280" />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </ScrollView>

      <View style={{ paddingBottom: keyboardHeight > 0 ? 0 : padding.tabBottom - 22 }}>
        <ChatComposer onSent={(id) => router.push({ pathname: '/chat', params: { id } })} />
      </View>

      <AppModal visible={isStartModalVisible} onRequestClose={() => setStartModalVisible(false)}>
        <View className="flex-1 justify-end bg-black/45 dark:bg-black/75">
          <TouchableOpacity className="flex-1" activeOpacity={1} onPress={() => setStartModalVisible(false)} />
          <SheetSlide>
            <View
              className="rounded-t-[26px] bg-white px-[18px] pt-[18px] dark:bg-[#16141D]"
              style={{ maxHeight: START_SHEET_MAX_HEIGHT, paddingBottom: sheetPaddingBottom }}
            >
            <View className="mb-3.5 flex-row items-center justify-between">
              <Text className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark">
                ¿Qué quieres hacer?
              </Text>
              <TouchableOpacity
                className="h-[30px] w-[30px] items-center justify-center rounded-full bg-[#F3F4F6] dark:bg-[#2A2533]"
                accessibilityRole="button"
                accessibilityLabel="Cerrar"
                onPress={() => setStartModalVisible(false)}
              >
                <Ionicons name="close" size={18} color={iconOnSurface} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flexShrink: 1 }} showsVerticalScrollIndicator={false}>
              <TouchableOpacity
                className="mb-4 flex-row items-center rounded-[20px] border border-card-light-border bg-card-light p-4 dark:border-card-dark-border dark:bg-card-dark"
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Escanear problema"
                onPress={handleScanProblem}
              >
                <View
                  className="h-12 w-12 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: isDark ? '#152238' : '#DBEAFE' }}
                >
                  <Ionicons name="scan-outline" size={24} color={Palette.accentBlue} />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-[15px] font-bold text-text-primary-light dark:text-text-primary-dark">
                    Escanear problema
                  </Text>
                  <Text className="mt-0.5 text-xs leading-[17px] text-text-secondary-light dark:text-text-secondary-dark">
                    Toma una foto y obtén ayuda paso a paso
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#6B7280" />
              </TouchableOpacity>

              <Text className="mb-2.5 text-sm font-bold text-text-primary-light dark:text-text-primary-dark">
                Crear una lección
              </Text>
              <View className="mb-4 flex-row flex-wrap justify-between">
                {LESSON_TYPES.map((lesson) => (
                  <TouchableOpacity
                    key={lesson.label}
                    className="mb-2.5 w-[48%] items-start rounded-[16px] border border-[#E5E7EB] bg-white p-3 dark:border-[#2D2838] dark:bg-[#1F1C28]"
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={lesson.label}
                    onPress={() => handleLessonType(lesson.label)}
                  >
                    <Ionicons name={lesson.icon} size={20} color={lesson.color} />
                    <Text
                      className="mt-2 text-xs font-semibold leading-[16px] text-text-primary-light dark:text-text-primary-dark"
                      numberOfLines={2}
                    >
                      {lesson.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                className="mb-3 flex-row items-center rounded-[20px] border border-card-light-border bg-card-light p-4 dark:border-card-dark-border dark:bg-card-dark"
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Planes de estudio para tu examen"
                onPress={() => goToTab('/(tabs)/exams')}
              >
                <View
                  className="h-12 w-12 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: isDark ? '#2D1B22' : '#FEE2E2' }}
                >
                  <Ionicons name="calendar-outline" size={22} color={Palette.primary} />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-[15px] font-bold text-text-primary-light dark:text-text-primary-dark">
                    ¿Se acerca un examen?
                  </Text>
                  <Text className="mt-0.5 text-xs leading-[17px] text-text-secondary-light dark:text-text-secondary-dark">
                    Aprende con planes de estudio creados por inteligencia artificial
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#6B7280" />
              </TouchableOpacity>

              <TouchableOpacity
                className="flex-row items-center rounded-[20px] border border-card-light-border bg-card-light p-4 dark:border-card-dark-border dark:bg-card-dark"
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Conéctate con tus compañeros"
                onPress={() => goToTab('/(tabs)/class')}
              >
                <View
                  className="h-12 w-12 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: isDark ? '#241A33' : '#F3E8FF' }}
                >
                  <Ionicons name="people-outline" size={22} color={Palette.accentPurple} />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-[15px] font-bold text-text-primary-light dark:text-text-primary-dark">
                    Conéctate con tus compañeros
                  </Text>
                  <Text className="mt-0.5 text-xs leading-[17px] text-text-secondary-light dark:text-text-secondary-dark">
                    Crea o únete a un cuaderno
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#6B7280" />
              </TouchableOpacity>
            </ScrollView>
            </View>
          </SheetSlide>
        </View>
      </AppModal>
    </View>
  );
}
