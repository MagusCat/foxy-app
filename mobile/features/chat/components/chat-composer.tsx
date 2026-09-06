import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useGuardedRouter } from '@/features/shared/hooks/use-guarded-router';

import { ALLOWED_DOCUMENTS_LABEL } from '@/constants/attachments';
import { getSubjectAccent } from '@/constants/subject-colors';
import { DEFAULT_SUBJECTS, normalizeSubject } from '@/constants/subjects';
import { Palette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { appAlert } from '@/features/shared/components/overlay';
import { AppModal, SheetSlide } from '@/features/shared/components/portal';
import { useSubjectLimit } from '@/features/shared/hooks/use-subject-limit';
import { describeAttachment, useAttachments } from '@/hooks/use-attachments';
import { persistMedia } from '@/lib/media';
import { useDailyStreak } from '@/hooks/use-daily-streak';
import { useKeyboardHeight } from '@/hooks/use-keyboard-height';
import { usePersistentState } from '@/hooks/use-persistent-state';
import {
  ANSWER_MODES,
  usePendingQuestion,
  useQuestionHistory,
  type AnswerMode,
} from '@/hooks/use-question-history';
import { useSheetPaddingBottom } from '@/hooks/use-sheet-padding';
import { useStudyActivity } from '@/hooks/use-study-activity';
import { useSubscription } from '@/hooks/use-subscription';

import { useChat } from '../hooks/use-chat';

const isIOS = Platform.OS === 'ios';
const ACTION_CIRCLE = isIOS ? 'h-10 w-10' : 'h-9 w-9';
const CAMERA_PILL = isIOS ? 'h-10 w-12' : 'h-9 w-11';
const TALK_PILL = isIOS ? 'h-10' : 'h-9';
const ACTION_ICON_SIZE = isIOS ? 20 : 18;
const SUBJECT_SHEET_MAX_HEIGHT = Math.round(Dimensions.get('window').height * 0.85);

type ChatComposerProps = {
  onSent: (conversationId: string) => void;
  initialText?: string;
  autoCamera?: boolean;
  conversationId?: string;
};

export function ChatComposer({ onSent, initialText, autoCamera, conversationId }: ChatComposerProps) {
  const router = useGuardedRouter();
  const { isDark } = useTheme();
  const keyboardHeight = useKeyboardHeight();
  const sheetPaddingBottom = useSheetPaddingBottom();
  const iconOnSurface = isDark ? Palette.textPrimaryDark : Palette.textPrimaryLight;

  const [subjects, setSubjects, subjectsHydrated] = usePersistentState<string[]>(
    'foxy:subjects',
    DEFAULT_SUBJECTS,
  );
  const [selectedSubject, setSelectedSubject] = usePersistentState('foxy:selected-subject', 'Matemáticas');
  const [answerMode, setAnswerMode] = usePersistentState<AnswerMode>('foxy:answer-mode', 'pasos');
  const [inputMessage, setInputMessage] = useState(initialText ?? '');

  const { plan, reachedLimit, registerQuestion } = useSubscription();
  const { logSession } = useStudyActivity();
  const [, , markStudied] = useDailyStreak();
  const { addQuestion } = useQuestionHistory();
  const [pendingQuestion, setPendingQuestion] = usePendingQuestion();
  const { send, conversations } = useChat();
  const { guard: guardSubjectLimit } = useSubjectLimit(subjects.length);

  useEffect(() => {
    if (!pendingQuestion) return;
    setInputMessage(pendingQuestion.text);
    setSelectedSubject(pendingQuestion.subject);
    setPendingQuestion(null);
  }, [pendingQuestion, setPendingQuestion, setSelectedSubject]);

  useEffect(() => {
    if (!subjectsHydrated || subjects.length === 0) return;
    if (subjects.some((subject) => normalizeSubject(subject) === normalizeSubject(selectedSubject))) return;
    setSelectedSubject(subjects[Math.floor(Math.random() * subjects.length)]);
  }, [subjectsHydrated, subjects, selectedSubject, setSelectedSubject]);

  const { attachments, addFromCamera, addFromLibrary, addFromFiles, removeAttachment, clearAttachments } =
    useAttachments();

  const conversation = useMemo(
    () => conversations.find((item) => item.id === conversationId),
    [conversations, conversationId],
  );
  const activeSubject = conversation?.subject ?? selectedSubject;
  const isSubjectLocked = Boolean(conversation);
  const subjectAccent = useMemo(() => getSubjectAccent(activeSubject, isDark), [activeSubject, isDark]);
  const canSend = inputMessage.trim().length > 0 || attachments.length > 0;
  const currentMode = ANSWER_MODES.find((item) => item.value === answerMode) ?? ANSWER_MODES[0];

  const cycleAnswerMode = () => {
    const index = ANSWER_MODES.findIndex((item) => item.value === answerMode);
    setAnswerMode(ANSWER_MODES[(index + 1) % ANSWER_MODES.length].value);
  };

  const [isSubjectModalVisible, setSubjectModalVisible] = useState(false);
  const [subjectModalMode, setSubjectModalMode] = useState<'list' | 'add'>('list');
  const [newSubjectInput, setNewSubjectInput] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [isOptionsModalVisible, setOptionsModalVisible] = useState(false);

  const autoCameraFired = useRef(false);
  useEffect(() => {
    if (!autoCamera || autoCameraFired.current) return;
    autoCameraFired.current = true;
    addFromCamera();
  }, [autoCamera, addFromCamera]);

  const handleSend = () => {
    if (!canSend) return;

    if (reachedLimit) {
      appAlert(
        'Ya usaste tus preguntas de hoy',
        `${plan.name} incluye preguntas diarias limitadas. Mañana se renuevan solas, o puedes ver los otros planes.`,
        [
          { text: 'Espero a mañana', style: 'cancel' },
          { text: 'Ver planes', onPress: () => router.push('/subscription') },
        ],
      );
      return;
    }

    const images = attachments.filter((item) => item.kind === 'image').length;
    const files = attachments.length - images;
    const text = inputMessage.trim();
    // Se copian a almacenamiento permanente: las URIs del picker viven en la
    // caché y el SO puede vaciarlas, pero la conversación se guarda para
    // siempre. Sin esto, las miniaturas del historial se rompen con el tiempo.
    const sentAttachments = attachments.map((item) => ({
      kind: item.kind,
      name: item.name,
      uri: persistMedia(item.uri, item.kind === 'image' ? 'chat-img' : 'chat-doc'),
    }));

    registerQuestion();
    markStudied();
    logSession({
      kind: images > 0 ? 'scan' : 'chat',
      subject: activeSubject,
      title: text || `${attachments.length} adjunto${attachments.length > 1 ? 's' : ''}`,
      minutes: 0,
    });
    addQuestion({ text, subject: activeSubject, mode: answerMode, images, files });

    const id = send(text, activeSubject, sentAttachments, conversationId);

    setInputMessage('');
    clearAttachments();
    onSent(id);
  };

  const handleAddSubjectSubmit = () => {
    const trimmed = newSubjectInput.trim();
    if (!trimmed) {
      appAlert('Campo vacío', 'Por favor ingresa un nombre para la nueva materia.');
      return;
    }
    if (subjects.some((item) => normalizeSubject(item) === normalizeSubject(trimmed))) {
      appAlert('Materia duplicada', 'Esta materia ya existe en tu lista.');
      return;
    }
    guardSubjectLimit(() => {
      setSubjects((prev) => [...prev, trimmed]);
      setSelectedSubject(trimmed);
      setNewSubjectInput('');
      setSubjectModalMode('list');
    });
  };

  const handleDeleteSubject = (subjectToDelete: string) => {
    if (subjects.length <= 1) {
      appAlert('Atención', 'Debes conservar al menos una materia en tu lista.');
      return;
    }
    appAlert(
      'Eliminar materia',
      `¿Seguro que quieres eliminar "${subjectToDelete}"? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            const updated = subjects.filter((item) => item !== subjectToDelete);
            setSubjects(updated);
            if (selectedSubject === subjectToDelete) setSelectedSubject(updated[0] ?? 'Matemáticas');
          },
        },
      ],
    );
  };

  const showComingSoon = (feature: string) => appAlert('Próximamente', `${feature} estará disponible muy pronto.`);

  return (
    <View className="w-full items-center px-5" style={{ paddingBottom: keyboardHeight > 0 ? sheetPaddingBottom : 0 }}>
      <View className="z-10 -mb-[13px] flex-row items-center gap-2">
        {isSubjectLocked ? (
          <View
            className="flex-row items-center rounded-[18px] border bg-white px-4 py-[7px] dark:bg-[#1B1522]"
            style={{ borderColor: subjectAccent.color, elevation: 4 }}
            accessibilityLabel={`Materia: ${activeSubject} (fija en este tema)`}
          >
            <Text className="text-xs font-semibold" style={{ color: subjectAccent.color }}>
              {activeSubject}
            </Text>
            <Ionicons
              name="lock-closed"
              size={14}
              color={subjectAccent.color}
              style={{ marginLeft: 6 }}
            />
          </View>
        ) : (
          <TouchableOpacity
            className="flex-row items-center rounded-[18px] border bg-white px-4 py-[7px] dark:bg-[#1B1522]"
            style={{ borderColor: subjectAccent.color, elevation: 4 }}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Materia: ${activeSubject}`}
            accessibilityHint="Cambiar materia"
            onPress={() => {
              setIsEditMode(false);
              setSubjectModalVisible(true);
            }}
          >
            <Text className="text-xs font-semibold" style={{ color: subjectAccent.color }}>
              {activeSubject}
            </Text>
            <Ionicons
              name="swap-vertical"
              size={14}
              color={subjectAccent.color}
              style={{ marginLeft: 6 }}
            />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          className="flex-row items-center rounded-[18px] border border-card-light-border bg-white px-3 py-[7px] dark:border-surface-dark-border dark:bg-[#1B1522]"
          style={{ elevation: 4 }}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`Modo de respuesta: ${currentMode.label}. Tocar para cambiar`}
          onPress={cycleAnswerMode}
        >
          <Ionicons name={currentMode.icon} size={13} color={iconOnSurface} />
          <Text className="ml-1.5 text-xs font-semibold text-text-primary-light dark:text-text-primary-dark">
            {currentMode.label}
          </Text>
        </TouchableOpacity>
      </View>

      <View
        className="w-full rounded-[22px] border bg-card-light px-3.5 pb-2.5 pt-5 dark:bg-card-dark"
        style={{ borderColor: subjectAccent.color }}
      >
        {attachments.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mb-2.5 -mx-1"
            contentContainerStyle={{ paddingHorizontal: 4, gap: 8 }}
          >
            {attachments.map((attachment) => (
              <View
                key={attachment.id}
                className="flex-row items-center rounded-xl border border-card-light-border bg-surface-light py-1.5 pl-1.5 pr-1 dark:border-surface-dark-border dark:bg-surface-dark"
              >
                {attachment.kind === 'image' ? (
                  <Image
                    source={{ uri: attachment.uri }}
                    style={{ height: 28, width: 28, borderRadius: 8 }}
                    contentFit="cover"
                    transition={120}
                  />
                ) : (
                  <View className="h-7 w-7 items-center justify-center rounded-lg bg-card-light dark:bg-card-dark">
                    <Ionicons name="document-text-outline" size={15} color="#FBBF24" />
                  </View>
                )}

                <View className="mx-1.5 max-w-[130px]">
                  <Text
                    className="text-[11px] font-medium text-text-primary-light dark:text-text-primary-dark"
                    numberOfLines={1}
                  >
                    {attachment.name}
                  </Text>
                  <Text className="text-[9px] text-text-secondary-light dark:text-text-secondary-dark">
                    {describeAttachment(attachment)}
                  </Text>
                </View>

                <TouchableOpacity
                  className="h-6 w-6 items-center justify-center rounded-full"
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  accessibilityRole="button"
                  accessibilityLabel={`Quitar ${attachment.name}`}
                  onPress={() => removeAttachment(attachment.id)}
                >
                  <Ionicons name="close" size={14} color={iconOnSurface} />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}

        <TextInput
          className="mb-2.5 text-sm text-text-primary-light dark:text-text-primary-dark"
          style={{ minHeight: 38, textAlignVertical: 'top' }}
          placeholder="Pregunta, habla o envía un archivo"
          placeholderTextColor={isDark ? Palette.textSecondaryDark : Palette.textMutedLight}
          value={inputMessage}
          onChangeText={setInputMessage}
          multiline
        />

        <View className="flex-row items-center justify-between pt-0.5">
          <View className="flex-row items-center gap-2">
            <TouchableOpacity
              className={`${ACTION_CIRCLE} items-center justify-center rounded-full border border-card-light-border bg-surface-light dark:border-surface-dark-border dark:bg-surface-dark`}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Más opciones"
              onPress={() => setOptionsModalVisible(true)}
            >
              <Ionicons name="add" size={ACTION_ICON_SIZE} color={iconOnSurface} />
            </TouchableOpacity>

            <TouchableOpacity
              className={`${CAMERA_PILL} items-center justify-center rounded-full`}
              style={{ backgroundColor: subjectAccent.color }}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Abrir cámara"
              onPress={addFromCamera}
            >
              <Ionicons name="camera" size={ACTION_ICON_SIZE} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View className="flex-row items-center gap-2">
            <TouchableOpacity
              className={`${ACTION_CIRCLE} items-center justify-center rounded-full border border-card-light-border bg-surface-light dark:border-surface-dark-border dark:bg-surface-dark`}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Dictar por voz"
              onPress={() => showComingSoon('El micrófono')}
            >
              <Ionicons name="mic-outline" size={ACTION_ICON_SIZE} color={iconOnSurface} />
            </TouchableOpacity>

            {canSend ? (
              <TouchableOpacity
                className={`${CAMERA_PILL} items-center justify-center rounded-full`}
                style={{ backgroundColor: subjectAccent.color }}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Enviar a Foxy"
                onPress={handleSend}
              >
                <Ionicons name="arrow-up" size={ACTION_ICON_SIZE} color="#FFFFFF" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                className={`${TALK_PILL} flex-row items-center rounded-full border border-card-light-border bg-surface-light px-3 dark:border-surface-dark-border dark:bg-surface-dark`}
                activeOpacity={0.8}
                onPress={() => showComingSoon('El modo de voz')}
              >
                <Text className="text-xs font-semibold text-text-primary-light dark:text-text-primary-dark">
                  Hablar
                </Text>
                <Ionicons name="stats-chart" size={12} color={iconOnSurface} style={{ marginLeft: 4 }} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      <AppModal
        visible={isSubjectModalVisible}
        onRequestClose={() => {
          setIsEditMode(false);
          setSubjectModalMode('list');
          setSubjectModalVisible(false);
        }}
      >
        <View className="flex-1 justify-end bg-black/45 dark:bg-black/75">
          <TouchableOpacity
            className="flex-1"
            activeOpacity={1}
            onPress={() => {
              setIsEditMode(false);
              setSubjectModalMode('list');
              setSubjectModalVisible(false);
            }}
          />
          <SheetSlide>
            <View
              className="flex-col rounded-t-[26px] bg-white px-[18px] pt-[18px] dark:bg-[#16141D]"
              style={{ maxHeight: SUBJECT_SHEET_MAX_HEIGHT, paddingBottom: sheetPaddingBottom }}
            >
            {subjectModalMode === 'list' ? (
              <>
                <View className="mb-3.5 flex-row items-center justify-between">
                  <Text className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark">
                    {isEditMode ? 'Gestionar materias' : 'Elige la materia'}
                  </Text>
                  <TouchableOpacity
                    className="h-[30px] w-[30px] items-center justify-center rounded-full bg-[#F3F4F6] dark:bg-[#2A2533]"
                    accessibilityRole="button"
                    accessibilityLabel="Cerrar"
                    onPress={() => {
                      setIsEditMode(false);
                      setSubjectModalVisible(false);
                    }}
                  >
                    <Ionicons name="close" size={18} color={iconOnSurface} />
                  </TouchableOpacity>
                </View>

                <ScrollView style={{ flexShrink: 1 }} showsVerticalScrollIndicator={false}>
                  <View className="flex-row flex-wrap justify-between py-0.5">
                    {subjects.map((subject) => {
                      const isSelected = selectedSubject === subject;
                      const cardColor =
                        isSelected && !isEditMode
                          ? 'border-[1.5px] border-primary bg-[#FEE2E2] dark:border-primary-glow dark:bg-[#2D1B22]'
                          : isEditMode
                            ? 'border-[#D1D5DB] bg-[#F9FAFB] dark:border-[#3D364A] dark:bg-[#1C1924]'
                            : 'border-[#E5E7EB] bg-white dark:border-[#2D2838] dark:bg-[#1F1C28]';
                      const textColor =
                        isSelected && !isEditMode
                          ? 'font-bold text-text-primary-light dark:text-text-primary-dark'
                          : 'text-text-secondary-light dark:text-[#D1D5DB]';
                      return (
                        <TouchableOpacity
                          key={subject}
                          className={`mb-2.5 w-[48%] flex-row items-center justify-between rounded-[14px] border px-3 py-2.5 ${cardColor}`}
                          activeOpacity={0.7}
                          onPress={() => {
                            if (!isEditMode) {
                              setSelectedSubject(subject);
                              setSubjectModalVisible(false);
                            }
                          }}
                        >
                          <Text className={`flex-1 text-xs font-medium ${textColor}`} numberOfLines={1} ellipsizeMode="tail">
                            {subject}
                          </Text>

                          {isEditMode ? (
                            <TouchableOpacity
                              className="ml-1 p-0.5"
                              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                              accessibilityRole="button"
                              accessibilityLabel={`Eliminar ${subject}`}
                              onPress={() => handleDeleteSubject(subject)}
                            >
                              <Ionicons name="trash-outline" size={16} color="#EF4444" />
                            </TouchableOpacity>
                          ) : (
                            isSelected && (
                              <Ionicons name="checkmark" size={15} color={subjectAccent.color} style={{ marginLeft: 4 }} />
                            )
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>

                <View className="mt-3.5 flex-row items-center justify-end gap-2.5 pt-1.5">
                  <TouchableOpacity
                    className={`flex-row items-center rounded-[18px] border px-4 py-2 ${
                      isEditMode
                        ? 'border-primary bg-[#FEE2E2] dark:border-primary-glow dark:bg-[#2D1B22]'
                        : 'border-[#E5E7EB] bg-white dark:border-[#342F42] dark:bg-[#1F1C28]'
                    }`}
                    activeOpacity={0.8}
                    onPress={() => setIsEditMode(!isEditMode)}
                  >
                    <Ionicons
                      name={isEditMode ? 'checkmark-circle-outline' : 'pencil-outline'}
                      size={15}
                      color={iconOnSurface}
                      style={{ marginRight: 4 }}
                    />
                    <Text className="text-[13px] font-semibold text-text-primary-light dark:text-text-primary-dark">
                      {isEditMode ? 'Listo' : 'Editar'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    className="flex-row items-center rounded-[18px] bg-primary px-[18px] py-2"
                    activeOpacity={0.8}
                    onPress={() => setSubjectModalMode('add')}
                  >
                    <Ionicons name="add" size={16} color="#FFFFFF" style={{ marginRight: 2 }} />
                    <Text className="text-[13px] font-semibold text-white">Agregar</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <View className="mb-3.5 flex-row items-center justify-between">
                  <Text className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark">
                    Nueva Materia
                  </Text>
                  <TouchableOpacity
                    className="h-[30px] w-[30px] items-center justify-center rounded-full bg-[#F3F4F6] dark:bg-[#2A2533]"
                    accessibilityRole="button"
                    accessibilityLabel="Cerrar"
                    onPress={() => {
                      setNewSubjectInput('');
                      setSubjectModalMode('list');
                    }}
                  >
                    <Ionicons name="close" size={18} color={iconOnSurface} />
                  </TouchableOpacity>
                </View>

                <TextInput
                  className="mb-[18px] rounded-[14px] border border-[#E5E7EB] bg-[#F9FAFB] px-3.5 py-2.5 text-sm text-text-primary-light dark:border-[#2D2838] dark:bg-[#14121A] dark:text-text-primary-dark"
                  placeholder="Ej. Robótica, Filosofía..."
                  placeholderTextColor="#6B7280"
                  value={newSubjectInput}
                  onChangeText={setNewSubjectInput}
                  autoFocus
                />
                <View className="flex-row justify-end gap-2.5">
                  <TouchableOpacity
                    className="rounded-2xl px-4 py-2"
                    onPress={() => {
                      setNewSubjectInput('');
                      setSubjectModalMode('list');
                    }}
                  >
                    <Text className="text-sm font-semibold text-text-secondary-light dark:text-text-secondary-dark">
                      Cancelar
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity className="rounded-2xl bg-primary px-5 py-2" onPress={handleAddSubjectSubmit}>
                    <Text className="text-sm font-semibold text-white">Guardar</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
            </View>
          </SheetSlide>
        </View>
      </AppModal>

      <AppModal visible={isOptionsModalVisible} onRequestClose={() => setOptionsModalVisible(false)}>
        <View className="flex-1 justify-end bg-black/45 dark:bg-black/75">
          <TouchableOpacity className="flex-1" activeOpacity={1} onPress={() => setOptionsModalVisible(false)} />
          <SheetSlide>
            <View
              className="rounded-t-[26px] bg-white px-[18px] pt-[18px] dark:bg-[#16141D]"
              style={{ paddingBottom: sheetPaddingBottom }}
            >
            <View className="relative mb-3.5 items-center justify-center">
              <Text className="text-[13px] font-semibold text-text-secondary-light dark:text-text-secondary-dark">
                Opciones
              </Text>
              <TouchableOpacity
                className="absolute -top-1 right-0 h-[30px] w-[30px] items-center justify-center rounded-full bg-[#F3F4F6] dark:bg-[#2A2533]"
                onPress={() => setOptionsModalVisible(false)}
              >
                <Ionicons name="close" size={18} color={iconOnSurface} />
              </TouchableOpacity>
            </View>

            <View className="my-1.5 flex-row justify-between gap-2">
              <TouchableOpacity
                className="flex-1 items-center justify-center rounded-[14px] border border-[#E5E7EB] bg-white py-3.5 dark:border-[#2D2838] dark:bg-[#1F1C28]"
                activeOpacity={0.7}
                onPress={() => {
                  setOptionsModalVisible(false);
                  addFromCamera();
                }}
              >
                <Ionicons name="camera-outline" size={22} color={Palette.accentBlueGlow} />
                <Text className="mt-1.5 text-xs font-medium text-text-primary-light dark:text-text-primary-dark">
                  Cámara
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="flex-1 items-center justify-center rounded-[14px] border border-[#E5E7EB] bg-white py-3.5 dark:border-[#2D2838] dark:bg-[#1F1C28]"
                activeOpacity={0.7}
                onPress={() => {
                  setOptionsModalVisible(false);
                  addFromLibrary();
                }}
              >
                <Ionicons name="images-outline" size={22} color={Palette.primaryGlow} />
                <Text className="mt-1.5 text-xs font-medium text-text-primary-light dark:text-text-primary-dark">
                  Fotos
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="flex-1 items-center justify-center rounded-[14px] border border-[#E5E7EB] bg-white py-3.5 dark:border-[#2D2838] dark:bg-[#1F1C28]"
                activeOpacity={0.7}
                onPress={() => {
                  setOptionsModalVisible(false);
                  addFromFiles();
                }}
              >
                <Ionicons name="folder-outline" size={22} color="#FBBF24" />
                <Text className="mt-1.5 text-xs font-medium text-text-primary-light dark:text-text-primary-dark">
                  Archivos
                </Text>
                <Text className="mt-0.5 text-[9px] text-text-secondary-light dark:text-text-secondary-dark">
                  PDF y texto
                </Text>
              </TouchableOpacity>
            </View>

            <Text className="mt-2 px-1 text-[10px] leading-[14px] text-text-secondary-light dark:text-text-secondary-dark">
              Por ahora Foxy lee {ALLOWED_DOCUMENTS_LABEL}. Pronto añadiremos más formatos.
            </Text>

            <View className="mb-1 mt-2.5 flex-row justify-between gap-2">
              <TouchableOpacity
                className="flex-1 items-center justify-center rounded-[14px] border border-[#E5E7EB] bg-white py-3 dark:border-[#2D2838] dark:bg-[#1F1C28]"
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Abrir modo enfoque"
                onPress={() => {
                  setOptionsModalVisible(false);
                  router.push('/focus');
                }}
              >
                <Ionicons name="timer-outline" size={22} color="#F97316" />
                <Text className="mt-1.5 text-xs font-medium text-text-primary-light dark:text-text-primary-dark">
                  Modo enfoque
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="flex-1 items-center justify-center rounded-[14px] border border-[#E5E7EB] bg-white py-3 dark:border-[#2D2838] dark:bg-[#1F1C28]"
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Abrir historial de preguntas"
                onPress={() => {
                  setOptionsModalVisible(false);
                  router.push('/history');
                }}
              >
                <Ionicons name="chatbubbles-outline" size={22} color={Palette.accentBlue} />
                <Text className="mt-1.5 text-xs font-medium text-text-primary-light dark:text-text-primary-dark">
                  Historial
                </Text>
              </TouchableOpacity>
            </View>

            <View className="my-3 h-px bg-[#E5E7EB] dark:bg-[#2A2533]" />

            <Text className="mb-2 text-[13px] font-semibold text-text-primary-light dark:text-text-primary-dark">
              ¿Cómo quieres la respuesta?
            </Text>
            <View className="mb-1 gap-2">
              {ANSWER_MODES.map((option) => {
                const isSelected = option.value === answerMode;
                return (
                  <TouchableOpacity
                    key={option.value}
                    className="flex-row items-center rounded-[14px] border border-[#E5E7EB] bg-white px-3 py-2.5 dark:border-[#2D2838] dark:bg-[#1F1C28]"
                    style={isSelected ? { borderColor: subjectAccent.color, backgroundColor: subjectAccent.soft } : undefined}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => setAnswerMode(option.value)}
                  >
                    <Ionicons name={option.icon} size={18} color={isSelected ? subjectAccent.color : iconOnSurface} />
                    <View className="ml-2.5 flex-1">
                      <Text
                        className="text-[13px] font-semibold text-text-primary-light dark:text-text-primary-dark"
                        style={isSelected ? { color: subjectAccent.color } : undefined}
                      >
                        {option.label}
                      </Text>
                      <Text className="mt-0.5 text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
                        {option.hint}
                      </Text>
                    </View>
                    {isSelected ? <Ionicons name="checkmark-circle" size={17} color={subjectAccent.color} /> : null}
                  </TouchableOpacity>
                );
              })}
              </View>
            </View>
          </SheetSlide>
        </View>
      </AppModal>
    </View>
  );
}
