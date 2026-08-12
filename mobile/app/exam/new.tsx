import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';

import { GradeDial } from '@/components/grade-dial';
import { MonthCalendar } from '@/components/month-calendar';
import { useScreenPadding } from '@/components/screen-header';
import { softTint } from '@/components/settings-ui';
import { ALLOWED_DOCUMENTS_LABEL } from '@/constants/attachments';
import { getSubjectAccent } from '@/constants/subject-colors';
import { Palette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { localDay } from '@/hooks/use-agenda';
import { describeAttachment, useAttachments } from '@/hooks/use-attachments';
import { useDailyStreak } from '@/hooks/use-daily-streak';
import { useKeyboardHeight } from '@/hooks/use-keyboard-height';
import { usePersistentState } from '@/hooks/use-persistent-state';
import { useSheetPaddingBottom } from '@/hooks/use-sheet-padding';
import { useStudyActivity } from '@/hooks/use-study-activity';
import { formatExamDate, useStudyPlans, type PlanMaterial } from '@/hooks/use-study-plans';

/** Materias que Foxy ya conoce. El usuario puede añadir las suyas. */
const SUBJECT_CATALOG = [
  'Matemáticas', 'Álgebra', 'Geometría', 'Cálculo', 'Estadística', 'Física', 'Química',
  'Química Orgánica', 'Biología', 'Anatomía', 'Ciencias Naturales', 'Informática',
  'Programación', 'Bases de datos', 'Minería de datos', 'Redes', 'Inglés', 'Español',
  'Literatura', 'Francés', 'Alemán', 'Portugués', 'Historia', 'Geografía', 'Cívica',
  'Filosofía', 'Psicología', 'Sociología', 'Economía', 'Contabilidad', 'Administración',
  'Derecho', 'Marketing', 'Arte', 'Música', 'Educación Física', 'Enfermería', 'Medicina',
  'Ingeniería', 'Arquitectura',
];

const LANGUAGES = [
  { value: 'Español', hint: 'El examen y las lecciones en español' },
  { value: 'English', hint: 'Lessons and questions in English' },
  { value: 'Português', hint: 'Lições e perguntas em português' },
  { value: 'Français', hint: 'Leçons et questions en français' },
  { value: 'Deutsch', hint: 'Lektionen und Fragen auf Deutsch' },
  { value: 'Italiano', hint: 'Lezioni e domande in italiano' },
];

const SURVEY: { id: string; question: string; options: string[] }[] = [
  {
    id: 'ayuda',
    question: '¿Qué te ayuda más a estudiar?',
    options: [
      'Explicaciones paso a paso',
      'Ejercicios resueltos',
      'Tarjetas de memoria',
      'Simulacros de examen',
      'Resúmenes cortos',
      'Escucharlo en audio',
    ],
  },
  {
    id: 'reto',
    question: '¿Qué se te complica más?',
    options: [
      'Me falta tiempo',
      'Me distraigo fácil',
      'No sé por dónde empezar',
      'Olvido lo que estudio',
      'Me pongo nervioso en el examen',
    ],
  },
];

const PREPARING_MESSAGES = [
  'Leyendo tu material de estudio…',
  'Detectando los temas que entran al examen…',
  'Ordenando los temas por dificultad…',
  'Repartiendo las lecciones entre los días que faltan…',
];

const FINISHING_MESSAGES = [
  'Ajustando tu plan a la calificación objetivo…',
  'Preparando tu primera lección…',
];

type Step = 'subject' | 'date' | 'grade' | 'materials' | 'language' | 'preparing' | 'survey' | 'finishing';

const FORM_STEPS: Step[] = ['subject', 'date', 'grade', 'materials', 'language'];

function addDays(amount: number) {
  const date = new Date();
  date.setDate(date.getDate() + amount);
  return localDay(date);
}

// ---------------------------------------------------------------------------

function StepTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View className="mb-5">
      <Text className="text-[24px] font-bold leading-[31px] text-text-primary-light dark:text-text-primary-dark">
        {title}
      </Text>
      {subtitle ? (
        <Text className="mt-2 text-[13px] leading-[19px] text-text-secondary-light dark:text-text-secondary-dark">
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

function SelectableRow({
  label,
  hint,
  selected,
  accent,
  multi,
  onPress,
}: {
  label: string;
  hint?: string;
  selected: boolean;
  accent: string;
  /** Cuadrado para varias respuestas, círculo para una sola. */
  multi?: boolean;
  onPress: () => void;
}) {
  const { colors, isDark } = useTheme();

  return (
    <TouchableOpacity
      className="mb-2.5 flex-row items-center rounded-2xl border-[1.5px] px-3.5 py-3.5"
      style={{
        borderColor: selected ? accent : colors.cardBorder,
        backgroundColor: selected ? softTint(accent, isDark) : colors.card,
      }}
      activeOpacity={0.75}
      accessibilityRole={multi ? 'checkbox' : 'radio'}
      accessibilityState={{ checked: selected, selected }}
      accessibilityLabel={label}
      onPress={onPress}
    >
      <View
        className="mr-3 h-[22px] w-[22px] items-center justify-center border-2"
        style={{
          borderRadius: multi ? 7 : 11,
          borderColor: selected ? accent : colors.cardBorder,
          backgroundColor: selected ? accent : 'transparent',
        }}
      >
        {selected ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
      </View>

      <View className="flex-1">
        <Text className="text-[14px] font-semibold text-text-primary-light dark:text-text-primary-dark">
          {label}
        </Text>
        {hint ? (
          <Text className="mt-0.5 text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
            {hint}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

/**
 * Pantalla de espera con barra y mensajes que van cambiando. Todavía no hay
 * IA detrás: el tiempo es fijo y lo que importa es contar qué se está
 * preparando para que la espera no parezca vacía.
 */
function PreparingView({
  messages,
  durationMs,
  title,
  onDone,
}: {
  messages: string[];
  durationMs: number;
  title: string;
  onDone: () => void;
}) {
  const { colors, isDark } = useTheme();
  const [index, setIndex] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: durationMs,
      easing: Easing.inOut(Easing.quad),
      // La barra anima `width`, que no vive en el hilo de UI nativo.
      useNativeDriver: false,
    }).start();

    const step = durationMs / messages.length;
    const rotate = setInterval(() => {
      setIndex((prev) => Math.min(prev + 1, messages.length - 1));
    }, step);
    const finish = setTimeout(onDone, durationMs);

    return () => {
      clearInterval(rotate);
      clearTimeout(finish);
    };
  }, [durationMs, messages.length, onDone, progress]);

  return (
    <View className="flex-1 items-center justify-center px-8">
      <View
        className="h-20 w-20 items-center justify-center rounded-[26px]"
        style={{ backgroundColor: softTint(Palette.primary, isDark) }}
      >
        <Text style={{ fontSize: 38 }}>🦊</Text>
      </View>

      <Text className="mt-6 text-center text-[20px] font-bold text-text-primary-light dark:text-text-primary-dark">
        {title}
      </Text>

      <Text
        className="mt-2.5 h-10 text-center text-[13px] leading-[19px] text-text-secondary-light dark:text-text-secondary-dark"
        numberOfLines={2}
      >
        {messages[index]}
      </Text>

      <View
        className="mt-5 h-2 w-full overflow-hidden rounded-full"
        style={{ backgroundColor: colors.surface }}
      >
        <Animated.View
          className="h-full rounded-full"
          style={{
            backgroundColor: Palette.primary,
            width: progress.interpolate({ inputRange: [0, 1], outputRange: ['4%', '100%'] }),
          }}
        />
      </View>

      <Text className="mt-4 text-center text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
        No cierres la app mientras preparamos tu examen.
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------

export default function NewExamScreen() {
  const padding = useScreenPadding();
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const keyboardHeight = useKeyboardHeight();
  const sheetPaddingBottom = useSheetPaddingBottom();

  const { createPlan } = useStudyPlans();
  const { logSession } = useStudyActivity();
  const [, , markStudied] = useDailyStreak();
  const [savedSubjects, setSavedSubjects] = usePersistentState<string[]>('foxy:subjects', []);

  const attachments = useAttachments();

  const [step, setStep] = useState<Step>('subject');

  const [subject, setSubject] = useState('');
  const [title, setTitle] = useState('');
  const [subjectQuery, setSubjectQuery] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [isCreatingSubject, setCreatingSubject] = useState(false);

  const [examDate, setExamDate] = useState('');
  const [dateMode, setDateMode] = useState<'quick' | 'soon' | 'calendar'>('quick');

  const [targetGrade, setTargetGrade] = useState(75);
  const [language, setLanguage] = useState('Español');

  const [pastedTexts, setPastedTexts] = useState<{ id: string; name: string; content: string }[]>([]);
  const [isPasteVisible, setPasteVisible] = useState(false);
  const [pasteDraft, setPasteDraft] = useState('');

  const [answers, setAnswers] = useState<Record<string, string[]>>({});

  const accent = useMemo(
    () => getSubjectAccent(subject || 'Foxy', isDark).color,
    [subject, isDark],
  );

  /** El catálogo, más lo que el usuario ya tenía guardado, sin repetir. */
  const allSubjects = useMemo(() => {
    const seen = new Set<string>();
    return [...savedSubjects, ...SUBJECT_CATALOG].filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [savedSubjects]);

  const filteredSubjects = useMemo(() => {
    const query = subjectQuery.trim().toLowerCase();
    if (!query) return allSubjects;
    return allSubjects.filter((item) => item.toLowerCase().includes(query));
  }, [allSubjects, subjectQuery]);

  const materialCount = attachments.attachments.length + pastedTexts.length;

  const formIndex = FORM_STEPS.indexOf(step);
  const isForm = formIndex >= 0;

  const canContinue =
    step === 'subject'
      ? subject.length > 0
      : step === 'date'
        ? examDate.length > 0
        : step === 'survey'
          ? SURVEY.every((block) => (answers[block.id]?.length ?? 0) > 0)
          : true;

  const goBack = () => {
    if (formIndex > 0) {
      setStep(FORM_STEPS[formIndex - 1]);
      return;
    }
    router.back();
  };

  const goNext = () => {
    if (!canContinue) return;
    if (formIndex >= 0 && formIndex < FORM_STEPS.length - 1) {
      setStep(FORM_STEPS[formIndex + 1]);
      return;
    }
    if (step === 'language') setStep('preparing');
  };

  const handleAddSubject = () => {
    const trimmed = newSubject.trim();
    if (!trimmed) return;

    if (!allSubjects.some((item) => item.toLowerCase() === trimmed.toLowerCase())) {
      // Se guarda en la misma lista que usa Preguntar: la materia que creas
      // aquí queda disponible en toda la app.
      setSavedSubjects((prev) => [...prev, trimmed]);
    }
    setSubject(trimmed);
    setNewSubject('');
    setSubjectQuery('');
    setCreatingSubject(false);
  };

  const handleSavePaste = () => {
    const trimmed = pasteDraft.trim();
    if (!trimmed) {
      setPasteVisible(false);
      return;
    }
    setPastedTexts((prev) => [
      ...prev,
      {
        id: `txt-${Date.now()}`,
        name: `Texto pegado ${prev.length + 1}`,
        content: trimmed,
      },
    ]);
    setPasteDraft('');
    setPasteVisible(false);
  };

  const toggleAnswer = (blockId: string, option: string) => {
    setAnswers((prev) => {
      const current = prev[blockId] ?? [];
      return {
        ...prev,
        [blockId]: current.includes(option)
          ? current.filter((item) => item !== option)
          : [...current, option],
      };
    });
  };

  const handleFinish = () => {
    const materials: PlanMaterial[] = [
      ...attachments.attachments.map((item) => ({
        id: item.id,
        kind: item.kind,
        name: item.name,
        uri: item.uri,
        size: item.size,
      })),
      ...pastedTexts.map((item) => ({
        id: item.id,
        kind: 'text' as const,
        name: item.name,
        content: item.content,
      })),
    ];

    const plan = createPlan({
      title: title.trim() || `Examen de ${subject}`,
      subject,
      examDate,
      targetGrade,
      language,
      materials,
      survey: SURVEY.flatMap((block) => answers[block.id] ?? []),
    });

    // Crear el plan es actividad real: cuenta para la racha y el historial.
    markStudied();
    logSession({ kind: 'exam', subject, title: plan.title, minutes: 10 });

    router.replace({ pathname: '/exam/[id]', params: { id: plan.id } });
  };

  // -------------------------------------------------------------------------

  if (step === 'preparing' || step === 'finishing') {
    const isFirst = step === 'preparing';
    return (
      <View
        className="flex-1 bg-bg-light dark:bg-bg-dark"
        style={{ paddingTop: padding.top, paddingBottom: padding.stackBottom }}
      >
        <PreparingView
          key={step}
          title={isFirst ? 'Preparando tu examen' : 'Casi listo'}
          messages={isFirst ? PREPARING_MESSAGES : FINISHING_MESSAGES}
          durationMs={isFirst ? 3200 : 2000}
          onDone={isFirst ? () => setStep('survey') : handleFinish}
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-bg-light dark:bg-bg-dark">
      {/* ENCABEZADO: volver y en qué paso vas */}
      <View className="flex-row items-center px-5 pb-4" style={{ paddingTop: padding.top }}>
        <TouchableOpacity
          className="mr-3 h-9 w-9 items-center justify-center rounded-full border"
          style={{ backgroundColor: colors.surface, borderColor: colors.cardBorder }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          onPress={goBack}
        >
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </TouchableOpacity>

        <View className="h-2 flex-1 overflow-hidden rounded-full" style={{ backgroundColor: colors.surface }}>
          <View
            className="h-full rounded-full"
            style={{
              backgroundColor: Palette.primary,
              width: `${(((isForm ? formIndex : FORM_STEPS.length) + 1) / (FORM_STEPS.length + 1)) * 100}%`,
            }}
          />
        </View>

        <TouchableOpacity
          className="ml-3"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Cancelar"
          onPress={() => router.back()}
        >
          <Text className="text-[13px] font-semibold text-text-secondary-light dark:text-text-secondary-dark">
            Cancelar
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        className="px-5"
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* PASO 1: MATERIA ---------------------------------------------- */}
        {step === 'subject' ? (
          <>
            <StepTitle
              title="¿De qué materia es tu examen?"
              subtitle="Elige una de la lista o crea la tuya si no está."
            />

            <View
              className="mb-4 flex-row items-center rounded-2xl border px-3.5"
              style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}
            >
              <Ionicons name="search" size={16} color={colors.icon} />
              <TextInput
                className="ml-2 flex-1 py-3 text-[14px] text-text-primary-light dark:text-text-primary-dark"
                placeholder="Buscar materia"
                placeholderTextColor={colors.icon}
                value={subjectQuery}
                onChangeText={setSubjectQuery}
              />
              {subjectQuery ? (
                <TouchableOpacity
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel="Borrar búsqueda"
                  onPress={() => setSubjectQuery('')}
                >
                  <Ionicons name="close-circle" size={16} color={colors.icon} />
                </TouchableOpacity>
              ) : null}
            </View>

            <View className="flex-row flex-wrap gap-2">
              {filteredSubjects.map((item) => {
                const isSelected = subject === item;
                const itemAccent = getSubjectAccent(item, isDark);
                return (
                  <TouchableOpacity
                    key={item}
                    className="rounded-2xl border-[1.5px] px-3.5 py-2.5"
                    style={{
                      borderColor: isSelected ? itemAccent.color : colors.cardBorder,
                      backgroundColor: isSelected ? itemAccent.soft : colors.card,
                    }}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => setSubject(item)}
                  >
                    <Text
                      className="text-[13px] font-semibold text-text-secondary-light dark:text-text-secondary-dark"
                      style={isSelected ? { color: itemAccent.color, fontWeight: '700' } : undefined}
                    >
                      {item}
                    </Text>
                  </TouchableOpacity>
                );
              })}

              {isCreatingSubject ? null : (
                <TouchableOpacity
                  className="flex-row items-center rounded-2xl border-[1.5px] border-dashed px-3.5 py-2.5"
                  style={{ borderColor: Palette.primary }}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel="Crear mi materia"
                  onPress={() => {
                    setNewSubject(subjectQuery.trim());
                    setCreatingSubject(true);
                  }}
                >
                  <Ionicons name="add" size={15} color={Palette.primary} />
                  <Text className="ml-1 text-[13px] font-bold" style={{ color: Palette.primary }}>
                    Crear mi materia
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {isCreatingSubject ? (
              <View
                className="mt-3.5 rounded-2xl border p-3.5"
                style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}
              >
                <Text className="mb-2 text-[13px] font-semibold text-text-primary-light dark:text-text-primary-dark">
                  Nombre de la materia
                </Text>
                <TextInput
                  className="rounded-xl border px-3.5 py-2.5 text-[14px] text-text-primary-light dark:text-text-primary-dark"
                  style={{ backgroundColor: colors.background, borderColor: colors.cardBorder }}
                  placeholder="Ej. Minería de datos"
                  placeholderTextColor={colors.icon}
                  value={newSubject}
                  onChangeText={setNewSubject}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleAddSubject}
                />
                <View className="mt-3 flex-row justify-end gap-2.5">
                  <TouchableOpacity
                    className="rounded-xl px-4 py-2"
                    onPress={() => {
                      setNewSubject('');
                      setCreatingSubject(false);
                    }}
                  >
                    <Text className="text-[13px] font-semibold text-text-secondary-light dark:text-text-secondary-dark">
                      Cancelar
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="rounded-xl bg-primary px-4 py-2"
                    style={newSubject.trim() ? undefined : { opacity: 0.5 }}
                    disabled={!newSubject.trim()}
                    onPress={handleAddSubject}
                  >
                    <Text className="text-[13px] font-bold text-white">Guardar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            {subject ? (
              <View className="mt-6">
                <Text className="mb-2 text-[13px] font-semibold text-text-primary-light dark:text-text-primary-dark">
                  ¿Qué tema entra en el examen? <Text className="font-normal">(opcional)</Text>
                </Text>
                <TextInput
                  className="rounded-2xl border px-3.5 py-3 text-[14px] text-text-primary-light dark:text-text-primary-dark"
                  style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}
                  placeholder={`Ej. Planteamiento de problemas de ${subject.toLowerCase()}`}
                  placeholderTextColor={colors.icon}
                  value={title}
                  onChangeText={setTitle}
                  maxLength={90}
                />
              </View>
            ) : null}
          </>
        ) : null}

        {/* PASO 2: FECHA ------------------------------------------------ */}
        {step === 'date' ? (
          <>
            <StepTitle
              title="¿Cuándo es tu examen?"
              subtitle="Con la fecha, Foxy reparte los temas entre los días que quedan."
            />

            <View className="flex-row flex-wrap gap-2">
              {[
                { label: 'Mañana', days: 1 },
                { label: 'En 2 días', days: 2 },
                { label: 'En 4 días', days: 4 },
              ].map((option) => {
                const day = addDays(option.days);
                const isSelected = dateMode === 'quick' && examDate === day;
                return (
                  <TouchableOpacity
                    key={option.label}
                    className="rounded-2xl border-[1.5px] px-4 py-3"
                    style={{
                      borderColor: isSelected ? Palette.primary : colors.cardBorder,
                      backgroundColor: isSelected ? softTint(Palette.primary, isDark) : colors.card,
                    }}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => {
                      setDateMode('quick');
                      setExamDate(day);
                    }}
                  >
                    <Text
                      className="text-[14px] font-semibold text-text-primary-light dark:text-text-primary-dark"
                      style={isSelected ? { color: Palette.primary } : undefined}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity
                className="rounded-2xl border-[1.5px] px-4 py-3"
                style={{
                  borderColor: dateMode === 'soon' ? Palette.primary : colors.cardBorder,
                  backgroundColor: dateMode === 'soon' ? softTint(Palette.primary, isDark) : colors.card,
                }}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityState={{ selected: dateMode === 'soon' }}
                onPress={() => setDateMode('soon')}
              >
                <Text
                  className="text-[14px] font-semibold text-text-primary-light dark:text-text-primary-dark"
                  style={dateMode === 'soon' ? { color: Palette.primary } : undefined}
                >
                  Próximos días
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="flex-row items-center rounded-2xl border-[1.5px] px-4 py-3"
                style={{
                  borderColor: dateMode === 'calendar' ? Palette.primary : colors.cardBorder,
                  backgroundColor:
                    dateMode === 'calendar' ? softTint(Palette.primary, isDark) : colors.card,
                }}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityState={{ selected: dateMode === 'calendar' }}
                onPress={() => setDateMode('calendar')}
              >
                <Ionicons
                  name="calendar-outline"
                  size={15}
                  color={dateMode === 'calendar' ? Palette.primary : colors.icon}
                  style={{ marginRight: 6 }}
                />
                <Text
                  className="text-[14px] font-semibold text-text-primary-light dark:text-text-primary-dark"
                  style={dateMode === 'calendar' ? { color: Palette.primary } : undefined}
                >
                  Elegir fecha
                </Text>
              </TouchableOpacity>
            </View>

            {dateMode === 'soon' ? (
              <View className="mt-4 flex-row flex-wrap gap-2">
                {Array.from({ length: 14 }, (_, index) => index + 1).map((offset) => {
                  const day = addDays(offset);
                  const date = new Date(`${day}T00:00:00`);
                  const isSelected = examDate === day;
                  const weekday = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'][date.getDay()];
                  return (
                    <TouchableOpacity
                      key={day}
                      className="w-[60px] items-center rounded-2xl border-[1.5px] py-2.5"
                      style={{
                        borderColor: isSelected ? Palette.primary : colors.cardBorder,
                        backgroundColor: isSelected ? softTint(Palette.primary, isDark) : colors.card,
                      }}
                      activeOpacity={0.75}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      onPress={() => setExamDate(day)}
                    >
                      <Text className="text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
                        {weekday}
                      </Text>
                      <Text
                        className="text-[16px] font-bold text-text-primary-light dark:text-text-primary-dark"
                        style={isSelected ? { color: Palette.primary } : undefined}
                      >
                        {date.getDate()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : null}

            {dateMode === 'calendar' ? (
              <View
                className="mt-4 rounded-2xl border p-3.5"
                style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}
              >
                <MonthCalendar
                  selectedDay={examDate || undefined}
                  onSelectDay={setExamDate}
                  disablePast
                  accent={Palette.primary}
                />
              </View>
            ) : null}

            {examDate ? (
              <View
                className="mt-5 flex-row items-center rounded-2xl border p-3.5"
                style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}
              >
                <Ionicons name="school" size={18} color={Palette.accentPurple} />
                <Text className="ml-2.5 flex-1 text-[13px] font-semibold text-text-primary-light dark:text-text-primary-dark">
                  Tu examen es el {formatExamDate(examDate)}
                </Text>
              </View>
            ) : null}
          </>
        ) : null}

        {/* PASO 3: CALIFICACIÓN ----------------------------------------- */}
        {step === 'grade' ? (
          <>
            <StepTitle
              title="¿Qué calificación quieres sacar?"
              subtitle="Foxy usa tu meta para decidir cuánto hay que repasar cada tema."
            />

            <View className="mt-2 items-center">
              <GradeDial value={targetGrade} onChange={setTargetGrade} color={accent} />
            </View>

            <View
              className="mt-7 flex-row items-start rounded-2xl border p-3.5"
              style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}
            >
              <Ionicons name="bulb-outline" size={16} color={Palette.flameOrange} style={{ marginTop: 1 }} />
              <Text className="ml-2.5 flex-1 text-[12px] leading-[18px] text-text-secondary-light dark:text-text-secondary-dark">
                {targetGrade >= 90
                  ? 'Meta alta: vas a repasar todos los temas y hacer simulacros completos.'
                  : targetGrade >= 70
                    ? 'Buena meta: cubre los temas del examen con práctica suficiente.'
                    : 'Meta de aprobado: Foxy se centrará en lo esencial de cada tema.'}
              </Text>
            </View>
          </>
        ) : null}

        {/* PASO 4: MATERIAL --------------------------------------------- */}
        {step === 'materials' ? (
          <>
            <StepTitle
              title="Sube tu material de estudio"
              subtitle="Diapositivas, apuntes, la guía del profe… Foxy saca los temas de ahí."
            />

            <View className="flex-row flex-wrap gap-2.5">
              {[
                {
                  label: 'Tomar foto',
                  icon: 'camera-outline' as const,
                  color: Palette.accentBlue,
                  onPress: attachments.addFromCamera,
                },
                {
                  label: 'Galería',
                  icon: 'images-outline' as const,
                  color: Palette.primaryGlow,
                  onPress: attachments.addFromLibrary,
                },
                {
                  label: 'Archivos',
                  icon: 'document-text-outline' as const,
                  color: '#FBBF24',
                  onPress: attachments.addFromFiles,
                },
                {
                  label: 'Pegar texto',
                  icon: 'clipboard-outline' as const,
                  color: '#10B981',
                  onPress: () => setPasteVisible(true),
                },
              ].map((action) => (
                <TouchableOpacity
                  key={action.label}
                  className="flex-1 basis-[46%] items-center justify-center rounded-2xl border py-5"
                  style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel={action.label}
                  onPress={action.onPress}
                >
                  <Ionicons name={action.icon} size={24} color={action.color} />
                  <Text className="mt-2 text-[13px] font-semibold text-text-primary-light dark:text-text-primary-dark">
                    {action.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text className="mt-3 px-1 text-[11px] leading-[16px] text-text-secondary-light dark:text-text-secondary-dark">
              Imágenes y {ALLOWED_DOCUMENTS_LABEL}. Para pegar texto copiado, mantén pulsado el campo y
              elige Pegar.
            </Text>

            {materialCount > 0 ? (
              <View className="mt-5">
                <Text className="mb-2.5 text-[13px] font-bold text-text-primary-light dark:text-text-primary-dark">
                  Material añadido ({materialCount})
                </Text>

                {attachments.attachments.map((item) => (
                  <View
                    key={item.id}
                    className="mb-2 flex-row items-center rounded-2xl border p-2.5"
                    style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}
                  >
                    {item.kind === 'image' ? (
                      <Image
                        source={{ uri: item.uri }}
                        style={{ height: 38, width: 38, borderRadius: 10 }}
                        contentFit="cover"
                        transition={120}
                      />
                    ) : (
                      <View
                        className="h-[38px] w-[38px] items-center justify-center rounded-[10px]"
                        style={{ backgroundColor: colors.surface }}
                      >
                        <Ionicons name="document-text" size={18} color="#FBBF24" />
                      </View>
                    )}

                    <View className="ml-2.5 flex-1">
                      <Text
                        className="text-[13px] font-semibold text-text-primary-light dark:text-text-primary-dark"
                        numberOfLines={1}
                      >
                        {item.name}
                      </Text>
                      <Text className="mt-0.5 text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
                        {describeAttachment(item)}
                      </Text>
                    </View>

                    <TouchableOpacity
                      className="h-8 w-8 items-center justify-center rounded-full"
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      accessibilityRole="button"
                      accessibilityLabel={`Quitar ${item.name}`}
                      onPress={() => attachments.removeAttachment(item.id)}
                    >
                      <Ionicons name="close" size={16} color={colors.icon} />
                    </TouchableOpacity>
                  </View>
                ))}

                {pastedTexts.map((item) => (
                  <View
                    key={item.id}
                    className="mb-2 flex-row items-center rounded-2xl border p-2.5"
                    style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}
                  >
                    <View
                      className="h-[38px] w-[38px] items-center justify-center rounded-[10px]"
                      style={{ backgroundColor: colors.surface }}
                    >
                      <Ionicons name="clipboard" size={18} color="#10B981" />
                    </View>

                    <View className="ml-2.5 flex-1">
                      <Text className="text-[13px] font-semibold text-text-primary-light dark:text-text-primary-dark">
                        {item.name}
                      </Text>
                      <Text className="mt-0.5 text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
                        {item.content.length} caracteres
                      </Text>
                    </View>

                    <TouchableOpacity
                      className="h-8 w-8 items-center justify-center rounded-full"
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      accessibilityRole="button"
                      accessibilityLabel={`Quitar ${item.name}`}
                      onPress={() => setPastedTexts((prev) => prev.filter((text) => text.id !== item.id))}
                    >
                      <Ionicons name="close" size={16} color={colors.icon} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : null}

            {/* OPCIÓN DE PAGO, TODAVÍA CERRADA */}
            <TouchableOpacity
              className="mt-5 flex-row items-center rounded-2xl border p-4"
              style={{ backgroundColor: colors.card, borderColor: colors.cardBorder, opacity: 0.75 }}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Chatear para armar tu plan de estudio. Disponible con el plan de pago"
              onPress={() =>
                Alert.alert(
                  'Disponible con el plan de pago',
                  'Armar el plan chateando con Foxy, sin subir material, llegará con la suscripción. Por ahora sube tus apuntes o pega el temario.',
                  [
                    { text: 'Entendido', style: 'cancel' },
                    { text: 'Ver planes', onPress: () => router.push('/subscription') },
                  ],
                )
              }
            >
              <View
                className="h-11 w-11 items-center justify-center rounded-2xl"
                style={{ backgroundColor: softTint(Palette.accentPurple, isDark) }}
              >
                <Ionicons name="chatbubbles-outline" size={21} color={Palette.accentPurple} />
              </View>

              <View className="ml-3 flex-1">
                <Text className="text-[14px] font-bold text-text-primary-light dark:text-text-primary-dark">
                  ¿No tienes material de estudio?
                </Text>
                <Text className="mt-0.5 text-[12px] leading-[17px] text-text-secondary-light dark:text-text-secondary-dark">
                  Chatea para armar tu propio plan de estudio.
                </Text>
                <View
                  className="mt-2 flex-row items-center self-start rounded-full px-2.5 py-1"
                  style={{ backgroundColor: softTint(Palette.accentPurple, isDark) }}
                >
                  <Ionicons name="lock-closed" size={10} color={Palette.accentPurple} />
                  <Text className="ml-1 text-[10px] font-bold" style={{ color: Palette.accentPurple }}>
                    Pronto · Plan de pago
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          </>
        ) : null}

        {/* PASO 5: IDIOMA ----------------------------------------------- */}
        {step === 'language' ? (
          <>
            <StepTitle
              title="¿En qué idioma será el examen?"
              subtitle="Las lecciones y las preguntas se generan en este idioma."
            />

            {LANGUAGES.map((item) => (
              <SelectableRow
                key={item.value}
                label={item.value}
                hint={item.hint}
                selected={language === item.value}
                accent={Palette.primary}
                onPress={() => setLanguage(item.value)}
              />
            ))}
          </>
        ) : null}

        {/* ENCUESTA ------------------------------------------------------ */}
        {step === 'survey' ? (
          <>
            <StepTitle
              title="Una última cosa"
              subtitle="Dos preguntas rápidas para ajustar tus lecciones. Puedes marcar varias."
            />

            {SURVEY.map((block) => (
              <View key={block.id} className="mb-6">
                <Text className="mb-3 text-[15px] font-bold text-text-primary-light dark:text-text-primary-dark">
                  {block.question}
                </Text>
                {block.options.map((option) => (
                  <SelectableRow
                    key={option}
                    label={option}
                    multi
                    selected={(answers[block.id] ?? []).includes(option)}
                    accent={Palette.primary}
                    onPress={() => toggleAnswer(block.id, option)}
                  />
                ))}
              </View>
            ))}
          </>
        ) : null}
      </ScrollView>

      {/* PIE: CONTINUAR */}
      <View
        className="border-t px-5 pt-3"
        style={{
          borderColor: colors.cardBorder,
          backgroundColor: colors.background,
          paddingBottom: keyboardHeight > 0 ? 12 : padding.stackBottom,
        }}
      >
        <TouchableOpacity
          className="items-center justify-center rounded-[18px] py-4"
          style={{ backgroundColor: Palette.primary, opacity: canContinue ? 1 : 0.45 }}
          activeOpacity={0.85}
          disabled={!canContinue}
          accessibilityRole="button"
          accessibilityLabel={step === 'survey' ? 'Crear mi plan' : 'Continuar'}
          onPress={step === 'survey' ? () => setStep('finishing') : goNext}
        >
          <Text className="text-[15px] font-bold text-white">
            {step === 'survey'
              ? 'Crear mi plan'
              : step === 'materials' && materialCount === 0
                ? 'Continuar sin material'
                : 'Continuar'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* MODAL: PEGAR TEXTO */}
      <Modal
        visible={isPasteVisible}
        transparent
        statusBarTranslucent
        navigationBarTranslucent
        animationType="slide"
        onRequestClose={() => setPasteVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/45 dark:bg-black/75">
          <TouchableOpacity className="flex-1" activeOpacity={1} onPress={() => setPasteVisible(false)} />
          <View
            className="rounded-t-[26px] px-[18px] pt-[18px]"
            style={{ backgroundColor: colors.card, paddingBottom: sheetPaddingBottom }}
          >
            <View className="mb-3.5 flex-row items-center justify-between">
              <Text className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark">
                Pegar texto
              </Text>
              <TouchableOpacity
                className="h-[30px] w-[30px] items-center justify-center rounded-full"
                style={{ backgroundColor: colors.surface }}
                accessibilityRole="button"
                accessibilityLabel="Cerrar"
                onPress={() => setPasteVisible(false)}
              >
                <Ionicons name="close" size={18} color={colors.text} />
              </TouchableOpacity>
            </View>

            <TextInput
              className="rounded-2xl border px-3.5 py-3 text-[14px] text-text-primary-light dark:text-text-primary-dark"
              style={{
                backgroundColor: colors.background,
                borderColor: colors.cardBorder,
                minHeight: 140,
                textAlignVertical: 'top',
              }}
              placeholder="Mantén pulsado y elige Pegar, o escribe aquí el temario."
              placeholderTextColor={colors.icon}
              value={pasteDraft}
              onChangeText={setPasteDraft}
              multiline
              autoFocus
            />

            <TouchableOpacity
              className="mt-3.5 items-center rounded-[18px] py-3.5"
              style={{ backgroundColor: Palette.primary, opacity: pasteDraft.trim() ? 1 : 0.45 }}
              activeOpacity={0.85}
              disabled={!pasteDraft.trim()}
              accessibilityRole="button"
              accessibilityLabel="Añadir texto"
              accessibilityState={{ disabled: !pasteDraft.trim() }}
              onPress={handleSavePaste}
            >
              <Text className="text-sm font-bold text-white">Añadir texto</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
