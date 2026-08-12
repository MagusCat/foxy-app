import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  Modal,
  Switch,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Palette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { getSubjectAccent } from '@/constants/subject-colors';
import { ALLOWED_DOCUMENTS_LABEL } from '@/constants/attachments';
import { useScreenPadding } from '@/components/screen-header';
import { useAgenda, describeEventDate, daysUntil, EVENT_KIND_META } from '@/hooks/use-agenda';
import { useDailyGoal } from '@/hooks/use-learning-prefs';
import {
  ANSWER_MODES,
  usePendingQuestion,
  useQuestionHistory,
  type AnswerMode,
} from '@/hooks/use-question-history';
import { useKeyboardHeight } from '@/hooks/use-keyboard-height';
import { formatClock, useFocusSession } from '@/hooks/use-focus-session';
import { usePersistentState } from '@/hooks/use-persistent-state';
import { useDailyStreak } from '@/hooks/use-daily-streak';
import { useSheetPaddingBottom } from '@/hooks/use-sheet-padding';
import { useAttachments, describeAttachment } from '@/hooks/use-attachments';
import { useSubscription } from '@/hooks/use-subscription';
import { useStudyActivity } from '@/hooks/use-study-activity';

const LESSON_TYPES: { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { label: 'Cuestionario', icon: 'help-circle-outline', color: Palette.accentBlue },
  { label: 'Examen oral simulado', icon: 'mic-outline', color: Palette.accentPurple },
  { label: 'Verdadero o falso', icon: 'checkmark-circle-outline', color: '#10B981' },
  { label: 'Podcast', icon: 'headset-outline', color: '#EC4899' },
  { label: 'Tarjetas de memoria', icon: 'albums-outline', color: Palette.flameOrange },
  { label: 'Examen escrito simulado', icon: 'create-outline', color: '#14B8A6' },
];

const INITIAL_SUBJECTS = [
  'Matemáticas',
  'Física',
  'Química',
  'Informática',
  'Inglés',
  'Alemán',
  'Español',
  'Francés',
  'Biología',
  'Geografía',
  'Historia',
  'Economía',
  'Filosofía',
  'Psicología',
];

const isIOS = Platform.OS === 'ios';

const ACTION_CIRCLE = isIOS ? 'h-10 w-10' : 'h-9 w-9';
const CAMERA_PILL = isIOS ? 'h-10 w-12' : 'h-9 w-11';
const HEADER_PILL = 'h-9';
const TALK_PILL = isIOS ? 'h-10' : 'h-9';
const ACTION_ICON_SIZE = isIOS ? 20 : 18;

export default function HomeScreen() {
  const padding = useScreenPadding();
  const router = useRouter();
  const { isDark } = useTheme();
  const keyboardHeight = useKeyboardHeight();
  const sheetPaddingBottom = useSheetPaddingBottom();
  const iconOnSurface = isDark ? Palette.textPrimaryDark : Palette.textPrimaryLight;

  const [userName] = usePersistentState('foxy:user-name', 'Usuario');
  const [avatarUri] = usePersistentState('foxy:avatar', '');
  const [subjects, setSubjects] = usePersistentState<string[]>('foxy:subjects', INITIAL_SUBJECTS);
  const [selectedSubject, setSelectedSubject] = usePersistentState(
    'foxy:selected-subject',
    'Matemáticas',
  );
  const [streakCount, , markStudied] = useDailyStreak();
  const focus = useFocusSession();
  const { plan, isBasic, remaining, reachedLimit, registerQuestion } = useSubscription();
  const { logSession } = useStudyActivity();
  const { addQuestion } = useQuestionHistory();
  const [pendingQuestion, setPendingQuestion] = usePendingQuestion();
  const { upcoming } = useAgenda();
  const goal = useDailyGoal();

  const [inputMessage, setInputMessage] = useState('');
  /** Resumen de lo último que se envió. Se muestra un momento y desaparece. */
  const [sentNotice, setSentNotice] = useState<string | null>(null);
  const [answerMode, setAnswerMode] = usePersistentState<AnswerMode>('foxy:answer-mode', 'pasos');
  const {
    attachments,
    addFromCamera,
    addFromLibrary,
    addFromFiles,
    removeAttachment,
    clearAttachments,
  } = useAttachments();
  const subjectAccent = useMemo(() => getSubjectAccent(selectedSubject, isDark), [selectedSubject, isDark]);
  const canSend = inputMessage.trim().length > 0 || attachments.length > 0;

  const currentMode = ANSWER_MODES.find((item) => item.value === answerMode) ?? ANSWER_MODES[0];
  const cycleAnswerMode = () => {
    const index = ANSWER_MODES.findIndex((item) => item.value === answerMode);
    setAnswerMode(ANSWER_MODES[(index + 1) % ANSWER_MODES.length].value);
  };

  const nextEvent = upcoming.find((event) => daysUntil(event.date) <= 7);

  const [isEditMode, setIsEditMode] = useState(false);
  const [isSubjectModalVisible, setSubjectModalVisible] = useState(false);
  const [subjectModalMode, setSubjectModalMode] = useState<'list' | 'add'>('list');
  const [newSubjectInput, setNewSubjectInput] = useState('');
  const [isOptionsModalVisible, setOptionsModalVisible] = useState(false);
  const [isStartModalVisible, setStartModalVisible] = useState(false);
  const [solverEnabled, setSolverEnabled] = useState(true);

  useEffect(() => {
    if (!pendingQuestion) return;

    setInputMessage(pendingQuestion.text);
    setSelectedSubject(pendingQuestion.subject);
    setPendingQuestion(null);
  }, [pendingQuestion, setPendingQuestion, setSelectedSubject]);

  const closeOptionsThen = (action: () => void) => {
    setOptionsModalVisible(false);
    setTimeout(action, 260);
  };

  const closeStartModalThen = (action: () => void) => {
    setStartModalVisible(false);
    setTimeout(action, 260);
  };

  const handleScanProblem = () => closeStartModalThen(addFromCamera);

  const handleLessonType = (label: string) =>
    closeStartModalThen(() =>
      Alert.alert(
        label,
        `Foxy generará "${label.toLowerCase()}" de ${selectedSubject} en cuanto conectemos la IA.`,
      ),
    );

  const goToTab = (path: '/(tabs)/exams' | '/(tabs)/class') =>
    closeStartModalThen(() => router.push(path));

  const handleSend = () => {
    if (!canSend) return;

    if (reachedLimit) {
      Alert.alert(
        'Ya usaste tus preguntas de hoy',
        `${plan.name} incluye preguntas diarias limitadas. Mañana se renuevan solas, o puedes ver los otros planes con un adulto.`,
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

    registerQuestion();
    markStudied();
    logSession({
      kind: images > 0 ? 'scan' : 'chat',
      subject: selectedSubject,
      title: text || `${attachments.length} adjunto${attachments.length > 1 ? 's' : ''}`,
      minutes: 5,
    });
    addQuestion({ text, subject: selectedSubject, mode: answerMode, images, files });

    setInputMessage('');
    clearAttachments();

    // Enviar cuenta como ponerse a estudiar: arranca el temporizador si no
    // había ninguno en marcha y a partir de ahí se ve arriba, en la barra.
    if (!focus.isRunning) focus.start();

    // Sin IA todavía no hay respuesta que mostrar, y un Alert por cada envío
    // corta el ritmo: se avisa en la propia caja y se puede seguir enviando.
    setSentNotice(text || `${attachments.length} adjunto${attachments.length > 1 ? 's' : ''}`);
  };

  /**
   * El aviso de "enviado" se borra solo. Se guarda el temporizador para que
   * dos envíos seguidos no dejen uno viejo apagando el mensaje nuevo.
   */
  useEffect(() => {
    if (!sentNotice) return;

    const timer = setTimeout(() => setSentNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [sentNotice]);

  const showComingSoon = (feature: string) => {
    Alert.alert('Próximamente', `${feature} estará disponible muy pronto.`);
  };

  const handleAddSubjectSubmit = () => {
    const trimmed = newSubjectInput.trim();
    if (!trimmed) {
      Alert.alert('Campo vacío', 'Por favor ingresa un nombre para la nueva materia.');
      return;
    }
    if (subjects.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      Alert.alert('Materia duplicada', 'Esta materia ya existe en tu lista.');
      return;
    }
    setSubjects((prev) => [...prev, trimmed]);
    setSelectedSubject(trimmed);
    setNewSubjectInput('');
    setSubjectModalMode('list');
  };

  const handleDeleteSubject = (subjectToDelete: string) => {
    if (subjects.length <= 1) {
      Alert.alert('Atención', 'Debes conservar al menos una materia en tu lista.');
      return;
    }
    Alert.alert(
      'Eliminar materia',
      `¿Seguro que quieres eliminar "${subjectToDelete}"? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            const updated = subjects.filter((s) => s !== subjectToDelete);
            setSubjects(updated);
            if (selectedSubject === subjectToDelete) {
              setSelectedSubject(updated[0] ?? 'Matemáticas');
            }
          },
        },
      ],
    );
  };

  return (
    <View className="flex-1 bg-bg-light dark:bg-bg-dark">
      <ScrollView
        className="px-5"
        contentContainerClassName="flex-grow"
        contentContainerStyle={{
          paddingTop: padding.top,
          paddingBottom: keyboardHeight > 0 ? keyboardHeight + 16 : padding.tabBottom - 10,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-row items-center justify-between pb-4">
          <View className="mr-2 flex-1 flex-row items-center gap-2">
            <TouchableOpacity
              className={`${HEADER_PILL} flex-row items-center rounded-full border border-card-light-border bg-surface-light px-3 dark:border-surface-dark-border dark:bg-surface-dark`}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`Racha de ${streakCount} días. Ver mi actividad`}
              onPress={() => router.push('/activity')}
            >
              <Ionicons name="flame" size={17} color={Palette.flameOrange} />
              <Text className="ml-1 text-[14px] font-bold text-text-primary-light dark:text-text-primary-dark">
                {streakCount}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className={`${HEADER_PILL} shrink flex-row items-center rounded-full border border-card-light-border bg-surface-light px-3 dark:border-surface-dark-border dark:bg-surface-dark`}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`${plan.name}. Ver planes`}
              onPress={() => router.push('/subscription')}
            >
              <Ionicons name={plan.icon} size={14} color={plan.color} />
              <Text
                className="ml-1.5 shrink text-[13px] font-semibold text-text-primary-light dark:text-text-primary-dark"
                numberOfLines={1}
              >
                {plan.shortName}
              </Text>
              {isBasic && remaining !== null ? (
                <Text className="ml-1.5 text-[13px] font-bold" style={{ color: plan.color }}>
                  {remaining}
                </Text>
              ) : null}
            </TouchableOpacity>

            {focus.isRunning ? (
              <TouchableOpacity
                className={`${HEADER_PILL} flex-row items-center rounded-full border bg-surface-light px-3 dark:bg-surface-dark`}
                style={{ borderColor: Palette.flameOrange }}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`Modo enfoque en curso, quedan ${formatClock(focus.secondsLeft)}. Volver al temporizador`}
                onPress={() => router.push('/focus')}
              >
                <Ionicons name="timer-outline" size={14} color={Palette.flameOrange} />
                <Text
                  className="ml-1.5 text-[13px] font-bold"
                  style={{ color: Palette.flameOrange, fontVariant: ['tabular-nums'] }}
                >
                  {formatClock(focus.secondsLeft)}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <TouchableOpacity
            className={`${HEADER_PILL} aspect-square items-center justify-center overflow-hidden rounded-full border border-card-light-border bg-surface-light dark:border-surface-dark-border dark:bg-surface-dark`}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Ir a mi perfil"
            onPress={() => router.push('/(tabs)/profile')}
          >
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={{ height: '100%', width: '100%' }} contentFit="cover" />
            ) : (
              <Text className="text-[15px] font-bold text-text-primary-light dark:text-text-primary-dark">
                {userName.charAt(0).toUpperCase()}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <View className="flex-1 items-center justify-center py-8">
          <Text className="text-center text-[22px] font-bold tracking-[-0.3px] text-text-primary-light dark:text-text-primary-dark">
            ¡Hola {userName}! 👋 ¿Qué aprendemos hoy?
          </Text>
          <Text className="mt-2 px-4 text-center text-[13px] leading-[19px] text-text-secondary-light dark:text-text-secondary-dark">
            Soy Foxy, tu inteligencia artificial para estudiar: te explico paso a paso, te tomo la
            lección y preparo tus exámenes contigo.
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
              Comenzar
            </Text>
          </TouchableOpacity>

          <View className="mt-7 w-full gap-2">
            {/* Con el temporizador en marcha esta tarjeta sobra: la cuenta ya
                se ve arriba, en la barra, y aquí solo repetiría lo mismo en
                medio de la pantalla. */}
            {focus.isRunning ? null : (
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
            )}

            {nextEvent ? (
              <TouchableOpacity
                className="flex-row items-center rounded-2xl border border-card-light-border bg-card-light px-3.5 py-3 dark:border-card-dark-border dark:bg-card-dark"
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`Próximo evento: ${nextEvent.title}, ${describeEventDate(nextEvent.date)}`}
                onPress={() => router.push('/activity')}
              >
                <View
                  className="mr-3 h-9 w-9 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${EVENT_KIND_META[nextEvent.kind].color}${isDark ? '2E' : '1F'}` }}
                >
                  <Ionicons
                    name={EVENT_KIND_META[nextEvent.kind].icon}
                    size={18}
                    color={EVENT_KIND_META[nextEvent.kind].color}
                  />
                </View>

                <View className="flex-1">
                  <Text
                    className="text-[13px] font-semibold text-text-primary-light dark:text-text-primary-dark"
                    numberOfLines={1}
                  >
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

        <View className="mt-auto w-full items-center">
          <View className="z-10 -mb-[13px] flex-row items-center gap-2">
            <TouchableOpacity
              className="flex-row items-center rounded-[18px] border bg-white px-4 py-[7px] dark:bg-[#1B1522]"
              style={{ borderColor: subjectAccent.color, elevation: 4 }}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`Materia: ${selectedSubject}. Cambiar`}
              onPress={() => {
                setIsEditMode(false);
                setSubjectModalVisible(true);
              }}
            >
              <Text className="text-xs font-semibold" style={{ color: subjectAccent.color }}>
                {selectedSubject}
              </Text>
              <Ionicons name="swap-vertical" size={14} color={subjectAccent.color} style={{ marginLeft: 6 }} />
            </TouchableOpacity>

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

            {/* Confirmación del último envío: se manda sin esperar respuesta,
                así que este aviso es lo único que devuelve la app por ahora. */}
            {sentNotice ? (
              <TouchableOpacity
                className="mb-2.5 flex-row items-center rounded-xl border border-card-light-border bg-surface-light px-2.5 py-2 dark:border-surface-dark-border dark:bg-surface-dark"
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Enviado. Ver mis preguntas"
                accessibilityLiveRegion="polite"
                onPress={() => router.push('/history')}
              >
                <Ionicons name="checkmark-circle" size={15} color="#10B981" />
                <Text
                  className="ml-1.5 flex-1 text-[11px] text-text-secondary-light dark:text-text-secondary-dark"
                  numberOfLines={1}
                >
                  Enviado: {sentNotice}
                </Text>
                <Text className="ml-1.5 text-[11px] font-bold" style={{ color: subjectAccent.color }}>
                  Ver
                </Text>
              </TouchableOpacity>
            ) : null}

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
        </View>
      </ScrollView>

      <Modal
        visible={isSubjectModalVisible}
        transparent
        statusBarTranslucent
        navigationBarTranslucent
        animationType="slide"
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
          <View
            className="max-h-[85%] flex-col rounded-t-[26px] bg-white px-[18px] pt-[18px] dark:bg-[#16141D]"
            style={{ paddingBottom: sheetPaddingBottom }}
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
                          <Text
                            className={`flex-1 text-xs font-medium ${textColor}`}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
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
                              <Ionicons
                                name="checkmark"
                                size={15}
                                color={subjectAccent.color}
                                style={{ marginLeft: 4 }}
                              />
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

                  <TouchableOpacity
                    className="rounded-2xl bg-primary px-5 py-2"
                    onPress={handleAddSubjectSubmit}
                  >
                    <Text className="text-sm font-semibold text-white">Guardar</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={isOptionsModalVisible}
        transparent
        statusBarTranslucent
        navigationBarTranslucent
        animationType="slide"
        onRequestClose={() => setOptionsModalVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/45 dark:bg-black/75">
          <TouchableOpacity
            className="flex-1"
            activeOpacity={1}
            onPress={() => setOptionsModalVisible(false)}
          />
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
                onPress={() => closeOptionsThen(addFromCamera)}
              >
                <Ionicons name="camera-outline" size={22} color={Palette.accentBlueGlow} />
                <Text className="mt-1.5 text-xs font-medium text-text-primary-light dark:text-text-primary-dark">
                  Cámara
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="flex-1 items-center justify-center rounded-[14px] border border-[#E5E7EB] bg-white py-3.5 dark:border-[#2D2838] dark:bg-[#1F1C28]"
                activeOpacity={0.7}
                onPress={() => closeOptionsThen(addFromLibrary)}
              >
                <Ionicons name="images-outline" size={22} color={Palette.primaryGlow} />
                <Text className="mt-1.5 text-xs font-medium text-text-primary-light dark:text-text-primary-dark">
                  Fotos
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="flex-1 items-center justify-center rounded-[14px] border border-[#E5E7EB] bg-white py-3.5 dark:border-[#2D2838] dark:bg-[#1F1C28]"
                activeOpacity={0.7}
                onPress={() => closeOptionsThen(addFromFiles)}
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
                    style={
                      isSelected
                        ? { borderColor: subjectAccent.color, backgroundColor: subjectAccent.soft }
                        : undefined
                    }
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => setAnswerMode(option.value)}
                  >
                    <Ionicons
                      name={option.icon}
                      size={18}
                      color={isSelected ? subjectAccent.color : iconOnSurface}
                    />
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
                    {isSelected ? (
                      <Ionicons name="checkmark-circle" size={17} color={subjectAccent.color} />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>

            <View className="my-3 h-px bg-[#E5E7EB] dark:bg-[#2A2533]" />

            <View className="gap-3.5">
              <TouchableOpacity
                className="flex-row items-center py-1"
                activeOpacity={0.7}
                onPress={() => closeOptionsThen(() => router.push('/history'))}
              >
                <View className="mr-2.5 w-7 items-center">
                  <Ionicons name="time-outline" size={20} color={iconOnSurface} />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
                    Mis preguntas
                  </Text>
                  <Text className="mt-0.5 text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
                    Historial y preguntas guardadas
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#6B7280" />
              </TouchableOpacity>

              <TouchableOpacity
                className="flex-row items-center py-1"
                activeOpacity={0.7}
                onPress={() => closeOptionsThen(() => router.push('/focus'))}
              >
                <View className="mr-2.5 w-7 items-center">
                  <Ionicons name="timer-outline" size={20} color={iconOnSurface} />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
                    Modo enfoque
                  </Text>
                  <Text className="mt-0.5 text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
                    Temporizador que suma minutos reales
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#6B7280" />
              </TouchableOpacity>

              <View className="flex-row items-center py-1">
                <View className="mr-2.5 w-7 items-center">
                  <Ionicons name="flash-outline" size={20} color="#FBBF24" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
                    Solucionador
                  </Text>
                  <Text className="mt-0.5 text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
                    Obtén soluciones completas rápidamente
                  </Text>
                </View>
                <Switch
                  value={solverEnabled}
                  onValueChange={setSolverEnabled}
                  trackColor={{
                    false: isDark ? '#2D2D3A' : '#D1D5DB',
                    true: Palette.primary,
                  }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isStartModalVisible}
        transparent
        statusBarTranslucent
        navigationBarTranslucent
        animationType="slide"
        onRequestClose={() => setStartModalVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/45 dark:bg-black/75">
          <TouchableOpacity
            className="flex-1"
            activeOpacity={1}
            onPress={() => setStartModalVisible(false)}
          />
          <View
            className="max-h-[88%] rounded-t-[26px] bg-white px-[18px] pt-[18px] dark:bg-[#16141D]"
            style={{ paddingBottom: sheetPaddingBottom }}
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
                    Crea o únete a una clase
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#6B7280" />
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
