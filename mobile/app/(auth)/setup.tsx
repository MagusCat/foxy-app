import React, { useRef, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useScreenPadding } from '@/components/screen-header';
import { ChipGroup, Note } from '@/components/settings-ui';
import {
  DEFAULT_SCHOOL_PROFILE,
  describeGrade,
  GROUP_OPTIONS,
  SCHOOL_STAGES,
  SHIFTS,
  type SchoolProfile,
  type SchoolStage,
  type Shift,
} from '@/constants/school';
import { getSubjectAccent } from '@/constants/subject-colors';
import { DEFAULT_SUBJECTS } from '@/constants/subjects';
import { Palette } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/contexts/theme-context';
import { usePersistentState } from '@/hooks/use-persistent-state';
import { useKeyboardHeight } from '@/hooks/use-keyboard-height';
import { useSheetPaddingBottom } from '@/hooks/use-sheet-padding';
import { useSubscription } from '@/hooks/use-subscription';

type Step = 'name' | 'age' | 'school' | 'level' | 'shift' | 'subjects';

const STEPS: Step[] = ['name', 'age', 'school', 'level', 'shift', 'subjects'];

const AGE_RANGES = [
  { value: 'menor13', label: 'Menos de 13' },
  { value: '13a15', label: '13 a 15' },
  { value: '16a17', label: '16 a 17' },
  { value: 'mayor18', label: '18 o más' },
] as const;

function StepTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View className="mb-6">
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

export default function SetupScreen() {
  const padding = useScreenPadding();
  const { colors, isDark } = useTheme();
  const keyboardHeight = useKeyboardHeight();
  const sheetPaddingBottom = useSheetPaddingBottom();
  // Tope de materias según el plan (Básico = 4; Plus/Grupo = ilimitadas).
  const { subjectLimit } = useSubscription();
  const { completeSetup } = useAuth();

  const [, setUserName] = usePersistentState('foxy:user-name', 'Usuario');
  const [, setAccount] = usePersistentState('foxy:account', { ageRange: '' as string });
  const [, setSchoolName] = usePersistentState('foxy:school', '');
  const [, setProfile] = usePersistentState<SchoolProfile>('foxy:grade', DEFAULT_SCHOOL_PROFILE);
  const [, setSubjects] = usePersistentState<string[]>('foxy:subjects', []);
  const [, setSelectedSubject] = usePersistentState('foxy:selected-subject', '');

  const [step, setStep] = useState<Step>('name');

  const [name, setName] = useState('');
  const [ageRange, setAgeRange] = useState('');
  const [school, setSchool] = useState('');
  const [draftProfile, setDraftProfile] = useState<SchoolProfile>(DEFAULT_SCHOOL_PROFILE);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);

  const formRef = useRef({ name, ageRange, school, draftProfile, selectedSubjects });
  formRef.current = { name, ageRange, school, draftProfile, selectedSubjects };

  const index = STEPS.indexOf(step);
  const canContinue =
    step === 'name'
      ? name.trim().length > 0
      : step === 'age'
        ? ageRange !== ''
        : step === 'level'
          ? draftProfile.stage !== undefined
          : step === 'shift'
            ? draftProfile.shift !== undefined
            : step === 'subjects'
              ? selectedSubjects.length >= 2
              : school.trim().length > 0;

  const stage = SCHOOL_STAGES.find((item) => item.value === draftProfile.stage);

  const updateDraftProfile = (patch: Partial<SchoolProfile>) =>
    setDraftProfile((prev) => {
      const next = { ...prev, ...patch };
      return { ...next, grade: describeGrade(next) };
    });

  const toggleSubject = (subject: string) => {
    setSelectedSubjects((prev) => {
      if (prev.includes(subject)) return prev.filter((item) => item !== subject);
      if (subjectLimit !== null && prev.length >= subjectLimit) return prev;
      return [...prev, subject];
    });
  };

  const finish = () => {
    const current = formRef.current;
    setUserName(current.name.trim());
    setAccount((prev) => ({ ...prev, ageRange: current.ageRange }));
    setSchoolName(current.school.trim());
    setProfile(current.draftProfile);
    setSubjects(current.selectedSubjects);
    // La primera materia con la que se abre la app es una de las elegidas,
    // al azar; el resto del tiempo se respeta la última que elija el usuario.
    setSelectedSubject(current.selectedSubjects[Math.floor(Math.random() * current.selectedSubjects.length)]);
    // El AuthGate del layout raíz ve `hasCompletedSetup` y manda solo a las
    // pestañas: aquí no hace falta navegar a mano.
    completeSetup();
  };

  const goNext = () => {
    if (!canContinue) return;
    if (index < STEPS.length - 1) {
      setStep(STEPS[index + 1]);
      return;
    }
    finish();
  };

  const goBack = () => {
    if (index > 0) setStep(STEPS[index - 1]);
  };

  const skip = () => {
    if (step === 'age') setAgeRange('');
    if (step === 'school') setSchool('');
    if (step === 'level') setDraftProfile(DEFAULT_SCHOOL_PROFILE);
    if (step === 'shift') updateDraftProfile({ shift: undefined });
    if (index < STEPS.length - 1) {
      setStep(STEPS[index + 1]);
      return;
    }
    finish();
  };

  return (
    <View className="flex-1 bg-bg-light dark:bg-bg-dark">
      <View className="flex-row items-center px-5 pb-4" style={{ paddingTop: padding.top }}>
        {index > 0 ? (
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
        ) : (
          <View className="mr-3 h-9 w-9" />
        )}

        <View className="h-2 flex-1 overflow-hidden rounded-full" style={{ backgroundColor: colors.surface }}>
          <View
            className="h-full rounded-full"
            style={{ backgroundColor: Palette.primary, width: `${((index + 1) / STEPS.length) * 100}%` }}
          />
        </View>

        <Text className="ml-3 text-[13px] font-semibold text-text-secondary-light dark:text-text-secondary-dark">
          {index + 1}/{STEPS.length}
        </Text>
      </View>

      <View className="flex-1 px-5">
        {step === 'name' ? (
          <>
            <StepTitle title="¿Cómo te llamas?" subtitle="Así te saludará Foxy." />
            <TextInput
              className="rounded-2xl border px-3.5 py-3 text-[14px] text-text-primary-light dark:text-text-primary-dark"
              style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}
              placeholder="Tu nombre"
              placeholderTextColor={colors.icon}
              value={name}
              onChangeText={setName}
              autoFocus
              maxLength={24}
            />
          </>
        ) : null}

        {step === 'age' ? (
          <>
            <StepTitle title="¿Cuántos años tienes?" subtitle="Foxy ajusta sus explicaciones según tu edad." />
            <ChipGroup
              options={AGE_RANGES.map((range) => ({ value: range.value, label: range.label }))}
              selected={ageRange}
              onSelect={setAgeRange}
            />
          </>
        ) : null}

        {step === 'school' ? (
          <>
            <StepTitle title="¿Dónde estudias?" subtitle="Sirve para adaptar los exámenes de práctica a tu plan de estudios." />
            <TextInput
              className="rounded-2xl border px-3.5 py-3 text-[14px] text-text-primary-light dark:text-text-primary-dark"
              style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}
              placeholder="Ej. Colegio San José"
              placeholderTextColor={colors.icon}
              value={school}
              onChangeText={setSchool}
              maxLength={60}
            />
          </>
        ) : null}

        {step === 'level' ? (
          <>
            <StepTitle title="¿Qué nivel cursas?" subtitle="Foxy adapta el vocabulario y la dificultad de sus explicaciones." />

            <ChipGroup
              options={SCHOOL_STAGES.map((item) => ({ value: item.value, label: item.label }))}
              selected={(draftProfile.stage ?? '') as SchoolStage}
              onSelect={(value) => updateDraftProfile({ stage: value, level: undefined })}
            />

            {stage ? (
              <>
                <Text className="mb-2 mt-4 text-[12px] font-semibold text-text-primary-light dark:text-text-primary-dark">
                  {stage.noun === 'grado' ? 'Grado' : 'Año'}
                </Text>
                <ChipGroup
                  options={stage.levels.map((level) => ({ value: level, label: `${level} ${stage.noun}` }))}
                  selected={draftProfile.level ?? ''}
                  onSelect={(level) => updateDraftProfile({ level })}
                />

                <Text className="mb-2 mt-4 text-[12px] font-semibold text-text-primary-light dark:text-text-primary-dark">
                  Grupo
                </Text>
                <ChipGroup
                  options={[
                    { value: '', label: 'Sin grupo' },
                    ...GROUP_OPTIONS.map((group) => ({ value: group, label: group })),
                  ]}
                  selected={draftProfile.group ?? ''}
                  onSelect={(group) => updateDraftProfile({ group })}
                />
              </>
            ) : null}
          </>
        ) : null}

        {step === 'shift' ? (
          <>
            <StepTitle title="¿En qué turno estudias?" subtitle="Foxy usa tu turno para proponerte horarios de estudio que te queden bien." />
            <ChipGroup
              options={SHIFTS.map((shift) => ({ value: shift.value, label: shift.label }))}
              selected={draftProfile.shift ?? ('' as Shift)}
              onSelect={(shift) => updateDraftProfile({ shift })}
            />
          </>
        ) : null}

        {step === 'subjects' ? (
          <>
            <StepTitle
              title="¿Qué materias llevas?"
              subtitle={`Elige al menos 2${subjectLimit === null ? '' : ` y hasta ${subjectLimit}`}. Aparecerán al preguntar, al crear exámenes y en el modo enfoque.`}
            />
            <Text className="mb-3 text-[12px] font-semibold text-text-secondary-light dark:text-text-secondary-dark">
              Elige al menos 2 ·{' '}
              {subjectLimit === null
                ? `${selectedSubjects.length} elegidas`
                : `${selectedSubjects.length} de ${subjectLimit} elegidas`}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {DEFAULT_SUBJECTS.map((subject) => {
                const isOn = selectedSubjects.includes(subject);
                const accent = getSubjectAccent(subject, isDark);
                const isDisabled =
                  !isOn && subjectLimit !== null && selectedSubjects.length >= subjectLimit;
                return (
                  <TouchableOpacity
                    key={subject}
                    className="flex-row items-center rounded-2xl border-[1.5px] px-3 py-2"
                    style={{
                      borderColor: isOn ? accent.color : colors.cardBorder,
                      backgroundColor: isOn ? accent.soft : colors.card,
                      opacity: isDisabled ? 0.4 : 1,
                    }}
                    activeOpacity={0.75}
                    disabled={isDisabled}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isOn, disabled: isDisabled }}
                    accessibilityLabel={subject}
                    onPress={() => toggleSubject(subject)}
                  >
                    {isOn ? (
                      <Ionicons name="checkmark" size={14} color={accent.color} style={{ marginRight: 4 }} />
                    ) : null}
                    <Text
                      className="text-[13px] font-semibold text-text-secondary-light dark:text-text-secondary-dark"
                      style={isOn ? { color: accent.color } : undefined}
                    >
                      {subject}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Note icon="chatbubbles-outline">
              Podrás cambiarlas cuando quieras desde el menú del chat o en Mi cuenta → Mis materias.
            </Note>
          </>
        ) : null}
      </View>

      <View className="px-5" style={{ paddingBottom: keyboardHeight > 0 ? sheetPaddingBottom : padding.stackBottom }}>
        <TouchableOpacity
          className="items-center justify-center rounded-[18px] py-4"
          style={{ backgroundColor: Palette.primary, opacity: canContinue ? 1 : 0.45 }}
          activeOpacity={0.85}
          disabled={!canContinue}
          accessibilityRole="button"
          accessibilityLabel={step === 'subjects' ? 'Empezar a usar Fox' : 'Continuar'}
          onPress={goNext}
        >
          <Text className="text-[15px] font-bold text-white">
            {step === 'subjects' ? 'Empezar a usar Fox' : 'Continuar'}
          </Text>
        </TouchableOpacity>

        {step === 'name' || step === 'subjects' ? null : (
          <TouchableOpacity
            className="mt-2.5 flex-row items-center justify-center rounded-[18px] border py-3.5"
            style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Prefiero no decirlo"
            onPress={skip}
          >
            <Text className="mr-1.5 text-[14px] font-semibold text-text-primary-light dark:text-text-primary-dark">
              Prefiero no decirlo
            </Text>
            <Ionicons name="arrow-forward-circle-outline" size={17} color={colors.text} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
