import React, { useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Palette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { useSheetPaddingBottom } from '@/hooks/use-sheet-padding';
import { isTopicUnlocked, topicProgress, type StudyPlan } from '@/hooks/use-study-plans';

type Tab = 'aprender' | 'practicar' | 'examen';

type LessonOption = { label: string; icon: keyof typeof Ionicons.glyphMap };

const OPTIONS: Record<'aprender' | 'practicar', LessonOption[]> = {
  aprender: [
    { label: 'Texto inteligente', icon: 'document-text-outline' },
    { label: 'Pódcast', icon: 'mic-outline' },
    { label: 'Video', icon: 'play-circle-outline' },
    { label: 'Tarjetas de repaso', icon: 'copy-outline' },
    { label: 'Áreas de mejora', icon: 'analytics-outline' },
    { label: 'Chat', icon: 'chatbubble-outline' },
  ],
  practicar: [
    { label: 'Ejercicio', icon: 'create-outline' },
    { label: 'Examen', icon: 'list-outline' },
    { label: 'Verdadero / falso', icon: 'checkbox-outline' },
    { label: 'Repetición', icon: 'repeat-outline' },
  ],
};

const TABS: { value: Tab; label: string }[] = [
  { value: 'aprender', label: 'Aprender' },
  { value: 'practicar', label: 'Practicar' },
  { value: 'examen', label: 'Examen' },
];

type NextLessonSheetProps = {
  visible: boolean;
  onClose: () => void;
  plan: StudyPlan;
  topicId?: string;
};

export function NextLessonSheet({ visible, onClose, plan, topicId }: NextLessonSheetProps) {
  const { colors } = useTheme();
  const sheetPaddingBottom = useSheetPaddingBottom();

  const [tab, setTab] = useState<Tab>('aprender');
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    if (visible) return;
    setPending(null);
    setTab('aprender');
  }, [visible]);

  const announce = (label: string, topicTitle: string) => {
    onClose();
    setTimeout(
      () =>
        Alert.alert(
          label,
          `Foxy generará "${label.toLowerCase()}" sobre "${topicTitle}" en cuanto conectemos la IA.`,
        ),
      260,
    );
  };

  const handlePick = (label: string) => {
    if (topicId) {
      const topic = plan.topics.find((item) => item.id === topicId);
      announce(label, topic?.title ?? plan.title);
      return;
    }
    setPending(label);
  };

  const handlePickTopic = (title: string, unlocked: boolean) => {
    if (!unlocked) {
      Alert.alert('Tema bloqueado', 'Termina el tema anterior para poder trabajar con este.');
      return;
    }
    announce(pending ?? 'Lección', title);
  };

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-black/45 dark:bg-black/75">
        <TouchableOpacity className="flex-1" activeOpacity={1} onPress={onClose} />

        <View
          className="max-h-[88%] rounded-t-[26px] px-[18px] pt-[18px]"
          style={{ backgroundColor: colors.card, paddingBottom: sheetPaddingBottom }}
        >
          <View className="mb-4 flex-row items-center">
            {pending ? (
              <TouchableOpacity
                className="h-[34px] w-[34px] items-center justify-center rounded-full"
                style={{ backgroundColor: colors.surface }}
                accessibilityRole="button"
                accessibilityLabel="Volver a los tipos de lección"
                onPress={() => setPending(null)}
              >
                <Ionicons name="chevron-back" size={18} color={colors.text} />
              </TouchableOpacity>
            ) : (
              <View className="h-[34px] w-[34px]" />
            )}

            <Text className="flex-1 text-center text-[17px] font-bold text-text-primary-light dark:text-text-primary-dark">
              {pending ? 'Selecciona un tema' : 'Siguiente lección'}
            </Text>

            <TouchableOpacity
              className="h-[34px] w-[34px] items-center justify-center rounded-full"
              style={{ backgroundColor: colors.surface }}
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
              onPress={onClose}
            >
              <Ionicons name="close" size={18} color={colors.text} />
            </TouchableOpacity>
          </View>

          {pending ? (
            <ScrollView style={{ flexShrink: 1 }} showsVerticalScrollIndicator={false}>
              {plan.topics.map((topic, index) => {
                const unlocked = isTopicUnlocked(plan, index);
                const done = topicProgress(topic);

                return (
                  <TouchableOpacity
                    key={topic.id}
                    className="mb-2.5 flex-row items-center rounded-2xl border p-4"
                    style={{
                      backgroundColor: colors.background,
                      borderColor: unlocked && done.percent < 100 ? Palette.primary : colors.cardBorder,
                      borderWidth: unlocked && done.percent < 100 ? 1.5 : 1,
                      opacity: unlocked ? 1 : 0.55,
                    }}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={`Tema ${index + 1}: ${topic.title}${unlocked ? '' : '. Bloqueado'}`}
                    onPress={() => handlePickTopic(topic.title, unlocked)}
                  >
                    <Text
                      className="w-6 text-[15px] font-bold"
                      style={{ color: unlocked ? colors.text : colors.icon }}
                    >
                      {index + 1}
                    </Text>
                    <Text
                      className="ml-1 flex-1 text-[14px] font-semibold text-text-primary-light dark:text-text-primary-dark"
                      numberOfLines={2}
                    >
                      {topic.title}
                    </Text>
                    <Ionicons
                      name={unlocked ? 'arrow-forward' : 'lock-closed'}
                      size={17}
                      color={unlocked ? colors.text : colors.icon}
                    />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : (
            <>
              <View className="mb-5 flex-row rounded-full p-1" style={{ backgroundColor: colors.surface }}>
                {TABS.map((item) => {
                  const isActive = tab === item.value;
                  return (
                    <TouchableOpacity
                      key={item.value}
                      className="flex-1 items-center justify-center rounded-full py-2.5"
                      style={{ backgroundColor: isActive ? colors.text : 'transparent' }}
                      activeOpacity={0.8}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: isActive }}
                      onPress={() => setTab(item.value)}
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
              </View>

              <ScrollView style={{ flexShrink: 1 }} showsVerticalScrollIndicator={false}>
                {tab === 'examen' ? (
                  <>
                    {[
                      {
                        icon: 'timer-outline' as const,
                        title: 'Examen Escrito Simulado',
                        description: 'Responde preguntas y obtén una calificación.',
                        action: 'Configura tu examen escrito',
                      },
                      {
                        icon: 'mic-outline' as const,
                        title: 'Examen Oral Simulado',
                        description: 'Habla con la IA en tiempo real y obtén una calificación.',
                        action: 'Configura tu examen oral',
                      },
                    ].map((item) => (
                      <View
                        key={item.title}
                        className="mb-3 items-center rounded-[20px] border px-4 py-6"
                        style={{ backgroundColor: colors.background, borderColor: colors.cardBorder }}
                      >
                        <View
                          className="h-14 w-14 items-center justify-center rounded-full"
                          style={{ backgroundColor: colors.surface }}
                        >
                          <Ionicons name={item.icon} size={26} color={colors.text} />
                        </View>

                        <Text className="mt-3 text-center text-[17px] font-bold text-text-primary-light dark:text-text-primary-dark">
                          {item.title}
                        </Text>
                        <Text className="mt-1 text-center text-[13px] leading-[19px] text-text-secondary-light dark:text-text-secondary-dark">
                          {item.description}
                        </Text>

                        <TouchableOpacity
                          className="mt-4 rounded-full px-6 py-3"
                          style={{ backgroundColor: Palette.accentBlue }}
                          activeOpacity={0.85}
                          accessibilityRole="button"
                          accessibilityLabel={item.action}
                          onPress={() => handlePick(item.title)}
                        >
                          <Text className="text-[14px] font-bold text-white">{item.action}</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </>
                ) : (
                  <View className="flex-row flex-wrap justify-between">
                    {OPTIONS[tab].map((option) => (
                      <TouchableOpacity
                        key={option.label}
                        className="mb-3 w-[48.5%] items-center justify-center rounded-[20px] border px-3 py-6"
                        style={{ backgroundColor: colors.background, borderColor: colors.cardBorder }}
                        activeOpacity={0.8}
                        accessibilityRole="button"
                        accessibilityLabel={option.label}
                        onPress={() => handlePick(option.label)}
                      >
                        <View
                          className="h-12 w-12 items-center justify-center rounded-full"
                          style={{ backgroundColor: colors.surface }}
                        >
                          <Ionicons name={option.icon} size={23} color={colors.text} />
                        </View>
                        <Text
                          className="mt-2.5 text-center text-[14px] font-semibold text-text-primary-light dark:text-text-primary-dark"
                          numberOfLines={2}
                        >
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </ScrollView>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}
