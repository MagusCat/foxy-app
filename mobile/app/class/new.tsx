import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';

import { useGuardedRouter } from '@/features/shared/hooks/use-guarded-router';

import { useScreenPadding } from '@/components/screen-header';
import { softTint } from '@/components/settings-ui';
import { getSubjectAccent } from '@/constants/subject-colors';
import { mergeSubjects, normalizeSubject, searchSubjects } from '@/constants/subjects';
import { Palette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { useSubjectLimit } from '@/features/shared/hooks/use-subject-limit';
import {
  CLASS_DAYS,
  VISIBILITY_META,
  composeSchedule,
  generateRoomCode,
  roomVisibility,
  useClassroom,
  useClassrooms,
  type Classroom,
  type RoomVisibility,
} from '@/hooks/use-classrooms';
import { usePersistentState } from '@/hooks/use-persistent-state';
import { useSheetPaddingBottom } from '@/hooks/use-sheet-padding';
import { useKeyboardHeight } from '@/hooks/use-keyboard-height';

type Step = 'name' | 'subject' | 'days' | 'visibility';

const FORM_STEPS: Step[] = ['name', 'subject', 'days', 'visibility'];

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

export default function NewClassroomScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const padding = useScreenPadding();
  const sheetPaddingBottom = useSheetPaddingBottom();
  const keyboardHeight = useKeyboardHeight();
  const router = useGuardedRouter();
  const { colors, isDark } = useTheme();

  const { setRooms, updateRoom } = useClassrooms();
  const { room } = useClassroom(id);
  const [savedSubjects, setSavedSubjects] = usePersistentState<string[]>('foxy:subjects', []);
  const { guard: guardSubjectLimit } = useSubjectLimit(savedSubjects.length);

  const [step, setStep] = useState<Step>('name');

  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [subjectQuery, setSubjectQuery] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [isCreatingSubject, setCreatingSubject] = useState(false);
  const [days, setDays] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<RoomVisibility>('privado');

  const filledFromRoom = useRef(false);
  useEffect(() => {
    if (!room || filledFromRoom.current) return;
    filledFromRoom.current = true;
    setName(room.name);
    setSubject(room.subject);
    setDays(room.days ?? []);
    setVisibility(roomVisibility(room));
  }, [room]);

  const allSubjects = useMemo(() => mergeSubjects(savedSubjects), [savedSubjects]);
  const filteredSubjects = useMemo(
    () => searchSubjects(allSubjects, subjectQuery),
    [allSubjects, subjectQuery],
  );

  const formIndex = FORM_STEPS.indexOf(step);
  const canContinue = step === 'name' ? name.trim().length > 0 : true;

  const goBack = () => {
    if (formIndex > 0) {
      setStep(FORM_STEPS[formIndex - 1]);
      return;
    }
    router.back();
  };

  const toggleDay = (day: string) =>
    setDays((prev) => (prev.includes(day) ? prev.filter((item) => item !== day) : [...prev, day]));

  const handleAddSubject = () => {
    const trimmed = newSubject.trim();
    if (!trimmed) return;

    guardSubjectLimit(() => {
      if (!allSubjects.some((item) => normalizeSubject(item) === normalizeSubject(trimmed))) {
        setSavedSubjects((prev) => [...prev, trimmed]);
      }
      setSubject(trimmed);
      setNewSubject('');
      setSubjectQuery('');
      setCreatingSubject(false);
    });
  };

  const handleSave = () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    const details = {
      name: trimmedName,
      subject,
      schedule: composeSchedule(days),
      days,
      visibility,
    };

    if (room) {
      updateRoom(room.id, (prev) => ({ ...prev, ...details }));
      router.back();
      return;
    }

    const created: Classroom = {
      id: `${Date.now()}`,
      code: generateRoomCode(),
      posts: [],
      ...details,
    };
    setRooms((prev) => [created, ...prev]);
    router.replace({ pathname: '/class/[id]', params: { id: created.id } });
  };

  const goNext = () => {
    if (!canContinue) return;
    if (formIndex < FORM_STEPS.length - 1) {
      setStep(FORM_STEPS[formIndex + 1]);
      return;
    }
    handleSave();
  };

  return (
    <View className="flex-1 bg-bg-light dark:bg-bg-dark">
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
              width: `${((formIndex + 1) / FORM_STEPS.length) * 100}%`,
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
        contentContainerStyle={{ paddingBottom: 24 + keyboardHeight }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {step === 'name' ? (
          <>
            <StepTitle
              title="¿Cómo se llama tu cuaderno?"
              subtitle="Puedes cambiarlo después desde el detalle del cuaderno."
            />
            <TextInput
              className="rounded-2xl border px-3.5 py-3 text-[14px] text-text-primary-light dark:text-text-primary-dark"
              style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}
              placeholder="Ej. Matemáticas 3ºB"
              placeholderTextColor={colors.icon}
              value={name}
              onChangeText={setName}
              autoFocus
              maxLength={40}
            />
          </>
        ) : null}

        {step === 'subject' ? (
          <>
            <StepTitle
              title="¿De qué materia es?"
              subtitle="Opcional. Elige una de la lista o crea la tuya si no está."
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
                    onPress={() => setSubject(isSelected ? '' : item)}
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
                  placeholder="Ej. Robótica"
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
          </>
        ) : null}

        {step === 'days' ? (
          <>
            <StepTitle title="¿Qué días tienes clase?" subtitle="Opcional. Puedes dejarlo en blanco." />

            <View className="flex-row flex-wrap gap-2">
              {CLASS_DAYS.map((day) => {
                const isOn = days.includes(day);
                return (
                  <TouchableOpacity
                    key={day}
                    className="h-12 w-12 items-center justify-center rounded-full border-[1.5px]"
                    style={{
                      borderColor: isOn ? Palette.primary : colors.cardBorder,
                      backgroundColor: isOn ? softTint(Palette.primary, isDark) : colors.card,
                    }}
                    activeOpacity={0.75}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isOn }}
                    accessibilityLabel={day}
                    onPress={() => toggleDay(day)}
                  >
                    <Text
                      className="text-[13px] font-semibold text-text-secondary-light dark:text-text-secondary-dark"
                      style={isOn ? { color: Palette.primary, fontWeight: '700' } : undefined}
                    >
                      {day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        ) : null}

        {step === 'visibility' ? (
          <>
            <StepTitle
              title="¿Público o privado?"
              subtitle="Puedes cambiarlo después desde el detalle del cuaderno."
            />

            {(Object.keys(VISIBILITY_META) as RoomVisibility[]).map((value) => {
              const meta = VISIBILITY_META[value];
              const isSelected = visibility === value;
              return (
                <TouchableOpacity
                  key={value}
                  className="mb-2.5 flex-row items-center rounded-2xl border-[1.5px] px-3.5 py-3.5"
                  style={{
                    borderColor: isSelected ? Palette.primary : colors.cardBorder,
                    backgroundColor: isSelected ? softTint(Palette.primary, isDark) : colors.card,
                  }}
                  activeOpacity={0.75}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={meta.label}
                  onPress={() => setVisibility(value)}
                >
                  <View
                    className="mr-3.5 h-10 w-10 items-center justify-center rounded-full"
                    style={{ backgroundColor: isSelected ? softTint(Palette.primary, isDark) : colors.surface }}
                  >
                    <Ionicons name={meta.icon} size={19} color={isSelected ? Palette.primary : colors.icon} />
                  </View>
                  <View className="flex-1">
                    <Text
                      className="text-[14px] font-semibold text-text-primary-light dark:text-text-primary-dark"
                      style={isSelected ? { color: Palette.primary } : undefined}
                    >
                      {meta.label}
                    </Text>
                    <Text className="mt-0.5 text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
                      {meta.hint}
                    </Text>
                  </View>
                  {isSelected ? <Ionicons name="checkmark-circle" size={20} color={Palette.primary} /> : null}
                </TouchableOpacity>
              );
            })}
          </>
        ) : null}
      </ScrollView>

      <View
        className="border-t px-5 pt-3"
        style={{ borderColor: colors.cardBorder, backgroundColor: colors.background, paddingBottom: sheetPaddingBottom }}
      >
        <TouchableOpacity
          className="items-center justify-center rounded-[18px] py-4"
          style={{ backgroundColor: Palette.primary, opacity: canContinue ? 1 : 0.45 }}
          activeOpacity={0.85}
          disabled={!canContinue}
          accessibilityRole="button"
          accessibilityLabel={
            step === 'visibility' ? (room ? 'Guardar cambios' : 'Crear cuaderno') : 'Continuar'
          }
          onPress={goNext}
        >
          <Text className="text-[15px] font-bold text-white">
            {step === 'visibility'
              ? room
                ? 'Guardar cambios'
                : 'Crear cuaderno'
              : step === 'subject' && !subject
                ? 'Continuar sin materia'
                : 'Continuar'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
