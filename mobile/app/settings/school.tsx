import React, { useState } from 'react';
import { Text, View } from 'react-native';
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
import { getSubjectAccent } from '@/constants/subject-colors';
import { useTheme } from '@/contexts/theme-context';
import { usePersistentState } from '@/hooks/use-persistent-state';

type EditableField = 'school' | 'grade' | 'teacher' | null;

const SHIFTS = [
  { value: 'matutino', label: 'Matutino' },
  { value: 'vespertino', label: 'Vespertino' },
  { value: 'mixto', label: 'Mixto' },
] as const;

export default function SchoolScreen() {
  const router = useRouter();
  const { isDark } = useTheme();

  const [school, setSchool] = usePersistentState('foxy:school', '');
  const [subjects] = usePersistentState<string[]>('foxy:subjects', []);
  const [rooms] = usePersistentState<Classroom[]>('foxy:classrooms', []);
  const [profile, setProfile] = usePersistentState('foxy:grade', {
    grade: '',
    tutor: '',
    shift: 'matutino' as (typeof SHIFTS)[number]['value'],
  });

  const [editing, setEditing] = useState<EditableField>(null);

  const handleSave = (value: string) => {
    if (editing === 'school') setSchool(value);
    if (editing === 'grade') setProfile((prev) => ({ ...prev, grade: value }));
    if (editing === 'teacher') setProfile((prev) => ({ ...prev, tutor: value }));
    setEditing(null);
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
          icon="layers-outline"
          label="Grado y grupo"
          value={profile.grade || 'Sin agregar'}
          onPress={() => setEditing('grade')}
        />
        <CardDivider />
        <Row
          icon="person-circle-outline"
          label="Tutor o titular"
          value={profile.tutor || 'Sin agregar'}
          onPress={() => setEditing('teacher')}
        />
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
            onSelect={(value) => setProfile((prev) => ({ ...prev, shift: value }))}
          />
        </View>
      </Card>

      <SectionTitle>Mis materias</SectionTitle>
      <Card>
        <View className="p-3.5">
          {subjects.length === 0 ? (
            <Text className="text-[13px] text-text-secondary-light dark:text-text-secondary-dark">
              Todavía no tienes materias. Agrégalas desde el selector de la pantalla Preguntar.
            </Text>
          ) : (
            <View className="flex-row flex-wrap gap-2">
              {subjects.map((subject) => {
                const accent = getSubjectAccent(subject, isDark);
                return (
                  <View
                    key={subject}
                    className="rounded-2xl border px-3 py-1.5"
                    style={{ borderColor: accent.color, backgroundColor: accent.soft }}
                  >
                    <Text className="text-[12px] font-semibold" style={{ color: accent.color }}>
                      {subject}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </Card>
      <Note>Las materias se administran desde el selector de la pantalla Preguntar.</Note>

      <SectionTitle>Mis salones</SectionTitle>
      <Card>
        <Row
          icon="people-outline"
          label="Salones y compañeros"
          description={
            rooms.length === 0
              ? 'Todavía no perteneces a ningún salón'
              : `${rooms.length} salón${rooms.length > 1 ? 'es' : ''} activo${rooms.length > 1 ? 's' : ''}`
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
        onSave={handleSave}
      />

      <PromptModal
        visible={editing === 'grade'}
        title="Grado y grupo"
        placeholder="Ej. 2° B"
        initialValue={profile.grade}
        maxLength={20}
        allowEmpty
        onCancel={() => setEditing(null)}
        onSave={handleSave}
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
        onSave={handleSave}
      />
    </ScreenShell>
  );
}
