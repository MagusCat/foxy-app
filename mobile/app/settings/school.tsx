import React, { useMemo, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import type { Classroom } from '@/app/(tabs)/class';
import {
  Card,
  CardDivider,
  ChipGroup,
  Note,
  PromptModal,
  Row,
  ScreenShell,
  SectionTitle,
} from '@/components/settings-ui';
import {
  DEFAULT_SCHOOL_PROFILE,
  describeGrade,
  GROUP_OPTIONS,
  SCHOOL_STAGES,
  SHIFTS,
  type SchoolProfile,
  type SchoolStage,
} from '@/constants/school';
import { getSubjectAccent } from '@/constants/subject-colors';
import { mergeSubjects } from '@/constants/subjects';
import { Palette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { usePersistentState } from '@/hooks/use-persistent-state';

export default function SchoolScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();

  const [school, setSchool] = usePersistentState('foxy:school', '');
  const [subjects, setSubjects] = usePersistentState<string[]>('foxy:subjects', []);
  const [rooms] = usePersistentState<Classroom[]>('foxy:classrooms', []);
  const [profile, setProfile] = usePersistentState<SchoolProfile>(
    'foxy:grade',
    DEFAULT_SCHOOL_PROFILE,
  );

  const [editing, setEditing] = useState<'school' | 'teacher' | null>(null);
  const [isCreatingSubject, setCreatingSubject] = useState(false);
  const [newSubject, setNewSubject] = useState('');

  const stage = SCHOOL_STAGES.find((item) => item.value === profile.stage);
  const catalog = useMemo(() => mergeSubjects(subjects), [subjects]);
  const selected = useMemo(
    () => new Set(subjects.map((item) => item.toLowerCase())),
    [subjects],
  );

  const updateProfile = (patch: Partial<SchoolProfile>) =>
    setProfile((prev) => {
      const next = { ...prev, ...patch };
      return { ...next, grade: describeGrade(next) };
    });

  const toggleSubject = (subject: string) => {
    const key = subject.toLowerCase();
    setSubjects((prev) =>
      prev.some((item) => item.toLowerCase() === key)
        ? prev.filter((item) => item.toLowerCase() !== key)
        : [...prev, subject],
    );
  };

  const handleCreateSubject = () => {
    const trimmed = newSubject.trim();
    if (!trimmed) return;

    if (!subjects.some((item) => item.toLowerCase() === trimmed.toLowerCase())) {
      setSubjects((prev) => [...prev, trimmed]);
    }
    setNewSubject('');
    setCreatingSubject(false);
  };

  return (
    <ScreenShell title="Mi escuela" subtitle="Para que Foxy conozca tu contexto escolar">
      <SectionTitle>Datos de la escuela</SectionTitle>
      <Card>
        <Row
          icon="school-outline"
          label="Escuela"
          description="Personaliza tus exámenes con tu plan de estudios"
          value={school || 'Sin agregar'}
          onPress={() => setEditing('school')}
        />
        <CardDivider />
        <Row
          icon="person-circle-outline"
          label="Tutor o titular"
          value={profile.tutor || 'Sin agregar'}
          onPress={() => setEditing('teacher')}
        />
      </Card>

      <SectionTitle>Grado y grupo</SectionTitle>
      <Card>
        <View className="p-3.5">
          <Text className="mb-2.5 text-[13px] leading-[18px] text-text-secondary-light dark:text-text-secondary-dark">
            Elige tu nivel: Foxy adapta el vocabulario y la dificultad de sus explicaciones.
          </Text>

          <ChipGroup
            options={SCHOOL_STAGES.map((item) => ({ value: item.value, label: item.label }))}
            selected={(profile.stage ?? '') as SchoolStage}
            onSelect={(value) => updateProfile({ stage: value, level: undefined })}
          />

          {stage ? (
            <>
              <Text className="mb-2 mt-4 text-[12px] font-semibold text-text-primary-light dark:text-text-primary-dark">
                {stage.noun === 'grado' ? 'Grado' : 'Año'}
              </Text>
              <ChipGroup
                options={stage.levels.map((level) => ({ value: level, label: `${level} ${stage.noun}` }))}
                selected={profile.level ?? ''}
                onSelect={(level) => updateProfile({ level })}
              />

              <Text className="mb-2 mt-4 text-[12px] font-semibold text-text-primary-light dark:text-text-primary-dark">
                Grupo
              </Text>
              <ChipGroup
                options={[
                  { value: '', label: 'Sin grupo' },
                  ...GROUP_OPTIONS.map((group) => ({ value: group, label: group })),
                ]}
                selected={profile.group ?? ''}
                onSelect={(group) => updateProfile({ group })}
              />
            </>
          ) : null}

          {profile.grade ? (
            <View
              className="mt-4 flex-row items-center rounded-2xl border px-3.5 py-3"
              style={{ backgroundColor: colors.background, borderColor: colors.cardBorder }}
            >
              <Ionicons name="checkmark-circle" size={17} color="#10B981" />
              <Text className="ml-2.5 text-[13px] font-semibold text-text-primary-light dark:text-text-primary-dark">
                {profile.grade}
              </Text>
            </View>
          ) : null}
        </View>
      </Card>

      <SectionTitle>Turno</SectionTitle>
      <Card>
        <View className="p-3.5">
          <Text className="mb-2.5 text-[13px] leading-[18px] text-text-secondary-light dark:text-text-secondary-dark">
            Foxy usa tu turno para proponerte horarios de estudio que te queden bien.
          </Text>
          <ChipGroup
            options={SHIFTS.map((shift) => ({ value: shift.value, label: shift.label }))}
            selected={profile.shift}
            onSelect={(shift) => updateProfile({ shift })}
          />
        </View>
      </Card>

      <SectionTitle>Mis materias</SectionTitle>
      <Card>
        <View className="p-3.5">
          <Text className="mb-3 text-[13px] leading-[18px] text-text-secondary-light dark:text-text-secondary-dark">
            Marca las que llevas este ciclo. Aparecerán al preguntar, al crear exámenes y en el modo
            enfoque.
          </Text>

          <View className="flex-row flex-wrap gap-2">
            {catalog.map((subject) => {
              const isOn = selected.has(subject.toLowerCase());
              const accent = getSubjectAccent(subject, isDark);

              return (
                <TouchableOpacity
                  key={subject}
                  className="flex-row items-center rounded-2xl border-[1.5px] px-3 py-2"
                  style={{
                    borderColor: isOn ? accent.color : colors.cardBorder,
                    backgroundColor: isOn ? accent.soft : colors.background,
                  }}
                  activeOpacity={0.75}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isOn }}
                  accessibilityLabel={subject}
                  onPress={() => toggleSubject(subject)}
                >
                  {isOn ? (
                    <Ionicons
                      name="checkmark"
                      size={14}
                      color={accent.color}
                      style={{ marginRight: 4 }}
                    />
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

            {isCreatingSubject ? null : (
              <TouchableOpacity
                className="flex-row items-center rounded-2xl border-[1.5px] border-dashed px-3 py-2"
                style={{ borderColor: Palette.primary }}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel="Crear una materia"
                onPress={() => setCreatingSubject(true)}
              >
                <Ionicons name="add" size={15} color={Palette.primary} />
                <Text className="ml-1 text-[13px] font-bold" style={{ color: Palette.primary }}>
                  Crear materia
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {isCreatingSubject ? (
            <View className="mt-3.5">
              <TextInput
                className="rounded-xl border px-3.5 py-2.5 text-[14px] text-text-primary-light dark:text-text-primary-dark"
                style={{ backgroundColor: colors.background, borderColor: colors.cardBorder }}
                placeholder="Ej. Robótica"
                placeholderTextColor={colors.icon}
                value={newSubject}
                onChangeText={setNewSubject}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleCreateSubject}
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
                  onPress={handleCreateSubject}
                >
                  <Text className="text-[13px] font-bold text-white">Guardar</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </View>
      </Card>
      <Note>
        {subjects.length === 0
          ? 'Todavía no has marcado ninguna materia.'
          : `${subjects.length} ${subjects.length === 1 ? 'materia activa' : 'materias activas'}.`}
      </Note>

      <SectionTitle>Mis salones</SectionTitle>
      <Card>
        <Row
          icon="people-outline"
          label="Salones y compañeros"
          description={
            rooms.length === 0
              ? 'Todavía no perteneces a ningún salón'
              : `${rooms.length} ${rooms.length === 1 ? 'salón activo' : 'salones activos'}`
          }
          onPress={() => router.push('/(tabs)/class')}
        />
      </Card>

      <PromptModal
        visible={editing === 'school'}
        title="¿A qué escuela vas?"
        description="Sirve para adaptar los exámenes de práctica a tu plan de estudios."
        placeholder="Ej. Colegio San José"
        initialValue={school}
        allowEmpty
        onCancel={() => setEditing(null)}
        onSave={(value) => {
          setSchool(value);
          setEditing(null);
        }}
      />

      <PromptModal
        visible={editing === 'teacher'}
        title="Tutor o titular"
        description="El profe que te acompaña durante el ciclo escolar."
        placeholder="Ej. Prof. Ana Rivas"
        initialValue={profile.tutor}
        maxLength={40}
        allowEmpty
        onCancel={() => setEditing(null)}
        onSave={(value) => {
          updateProfile({ tutor: value });
          setEditing(null);
        }}
      />
    </ScreenShell>
  );
}
