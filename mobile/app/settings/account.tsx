import React, { useMemo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useGuardedRouter } from '@/features/shared/hooks/use-guarded-router';

import { AvatarEditor } from '@/components/avatar-editor';
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
import { mergeSubjects, normalizeSubject } from '@/constants/subjects';
import { Palette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { appAlert, useOverlay } from '@/features/shared/components/overlay';
import { useSubjectLimit } from '@/features/shared/hooks/use-subject-limit';
import { clearPersistedState, usePersistentState, SESSION_KEYS } from '@/hooks/use-persistent-state';
import { useSubscription } from '@/hooks/use-subscription';

type EditableField = 'name' | 'school' | null;

const AGE_RANGES = [
  { value: 'menor13', label: 'Menos de 13' },
  { value: '13a15', label: '13 a 15' },
  { value: '16a17', label: '16 a 17' },
  { value: 'mayor18', label: '18 o más' },
  { value: '', label: 'Prefiero no decirlo' },
] as const;

const SHIFT_OPTIONS = [
  ...SHIFTS.map((shift) => ({ value: shift.value as string, label: shift.label })),
  { value: '', label: 'Prefiero no decirlo' },
];

export default function AccountScreen() {
  const router = useGuardedRouter();
  const { colors, isDark } = useTheme();
  const { plan } = useSubscription();
  const { showPrompt } = useOverlay();

  const [userName, setUserName] = usePersistentState('foxy:user-name', 'Usuario');
  const [account, setAccount] = usePersistentState('foxy:account', { ageRange: '' as string });
  const [school, setSchool] = usePersistentState('foxy:school', '');
  const [subjects, setSubjects] = usePersistentState<string[]>('foxy:subjects', []);
  const [profile, setProfile] = usePersistentState<SchoolProfile>(
    'foxy:grade',
    DEFAULT_SCHOOL_PROFILE,
  );

  const [editing, setEditing] = useState<EditableField>(null);

  const stage = SCHOOL_STAGES.find((item) => item.value === profile.stage);
  const isGradeChosen = Boolean(profile.stage && profile.level && profile.grade);
  const catalog = useMemo(() => mergeSubjects(subjects), [subjects]);
  const selected = useMemo(
    () => new Set(subjects.map((item) => item.toLowerCase())),
    [subjects],
  );
  const { warn: subjectWarn, guard: guardSubjectLimit } = useSubjectLimit(subjects.length);

  const updateProfile = (patch: Partial<SchoolProfile>) =>
    setProfile((prev) => {
      const next = { ...prev, ...patch };
      return { ...next, grade: describeGrade(next) };
    });

  const toggleSubject = (subject: string) => {
    const key = subject.toLowerCase();
    if (selected.has(key)) {
      setSubjects((prev) => prev.filter((item) => item.toLowerCase() !== key));
      return;
    }
    guardSubjectLimit(() => setSubjects((prev) => [...prev, subject]));
  };

  const handleCreateSubject = () => {
    guardSubjectLimit(() => {
      showPrompt({
        title: 'Nueva materia',
        placeholder: 'Ej. Robótica',
        confirmLabel: 'Crear',
        maxLength: 40,
        onSubmit: (value) => {
          if (!subjects.some((item) => normalizeSubject(item) === normalizeSubject(value))) {
            setSubjects((prev) => [...prev, value]);
          }
        },
      });
    });
  };

  const handleSave = (value: string) => {
    if (editing === 'name') setUserName(value);
    if (editing === 'school') setSchool(value);
    setEditing(null);
  };

  const handleDeleteAccount = () => {
    appAlert(
      'Eliminar mi cuenta',
      'Las cuentas en línea todavía no existen: por ahora todo vive en este dispositivo. Cuando estén listas, aquí podrás pedir la eliminación definitiva.',
      [
        { text: 'Entendido', style: 'cancel' },
        {
          text: 'Borrar lo de este equipo',
          style: 'destructive',
          onPress: async () => {
            await clearPersistedState(SESSION_KEYS);
            appAlert('Listo', 'Se borró tu información de este dispositivo.');
          },
        },
      ],
    );
  };

  return (
    <ScreenShell title="Mi cuenta" subtitle="Tus datos y cómo te ve Foxy">
      <View
        className="mt-2 flex-row items-center rounded-2xl border p-4"
        style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}
      >
        <AvatarEditor name={userName} size={68} />
        <View className="ml-4 flex-1">
          <Text
            className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark"
            numberOfLines={1}
          >
            {userName}
          </Text>
          <Text className="mt-0.5 text-xs text-text-secondary-light dark:text-text-secondary-dark">
            Toca la foto para cambiarla
          </Text>
        </View>
      </View>

      <SectionTitle>Datos</SectionTitle>
      <Card>
        <Row
          icon="person-outline"
          label="Nombre"
          description="Así te saluda Foxy"
          value={userName}
          onPress={() => setEditing('name')}
        />
        <CardDivider />
        <Row
          icon="mail-outline"
          label="Correo"
          description="El de tu inicio de sesión"
          value="Al conectar tu cuenta"
        />
        <CardDivider />
        <Row
          icon="school-outline"
          label="Dónde estudias"
          description="Personaliza tus exámenes con tu plan de estudios"
          value={school || 'Sin agregar'}
          onPress={() => setEditing('school')}
        />
        <CardDivider />
        <Row
          icon="card-outline"
          color={plan.color}
          label="Mi plan"
          value={plan.name}
          onPress={() => router.push('/subscription')}
        />
      </Card>

      <SectionTitle>Mi edad</SectionTitle>
      <Card>
        <View className="p-3.5">
          <Text className="mb-2.5 text-[13px] leading-[18px] text-text-secondary-light dark:text-text-secondary-dark">
            Foxy ajusta sus explicaciones y el contenido que muestra según tu edad.
          </Text>
          <ChipGroup
            options={AGE_RANGES.map((range) => ({ value: range.value, label: range.label }))}
            selected={account.ageRange}
            onSelect={(value) => setAccount((prev) => ({ ...prev, ageRange: value }))}
          />
        </View>
      </Card>
      <Note icon="shield-checkmark-outline">Nunca se cobra nada sin que tú lo confirmes.</Note>

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

          {isGradeChosen ? (
            <View
              className="mt-4 flex-row items-center rounded-2xl border px-3.5 py-3"
              style={{ backgroundColor: colors.background, borderColor: colors.cardBorder }}
            >
              <Ionicons name="checkmark-circle" size={17} color="#10B981" />
              <Text className="ml-2.5 text-[13px] font-semibold text-text-primary-light dark:text-text-primary-dark">
                {profile.grade}
              </Text>
            </View>
          ) : profile.grade ? (
            <View
              className="mt-4 flex-row items-start rounded-2xl border px-3.5 py-3"
              style={{ backgroundColor: colors.background, borderColor: colors.cardBorder }}
            >
              <Ionicons name="information-circle-outline" size={16} color={colors.icon} />
              <Text className="ml-2.5 flex-1 text-[12px] leading-[17px] text-text-secondary-light dark:text-text-secondary-dark">
                Tenías anotado «{profile.grade}». Elige tu nivel aquí arriba para dejarlo completo.
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
            options={SHIFT_OPTIONS}
            selected={profile.shift ?? ''}
            onSelect={(shift) => updateProfile({ shift: shift ? (shift as SchoolProfile['shift']) : undefined })}
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

            <TouchableOpacity
              className="flex-row items-center rounded-2xl border-[1.5px] border-dashed px-3 py-2"
              style={{ borderColor: Palette.primary }}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Crear una materia"
              onPress={handleCreateSubject}
            >
              <Ionicons name="add" size={15} color={Palette.primary} />
              <Text className="ml-1 text-[13px] font-bold" style={{ color: Palette.primary }}>
                Crear materia
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Card>
      <Note>
        {subjectWarn ??
          (subjects.length === 0
            ? 'Todavía no has marcado ninguna materia.'
            : `${subjects.length} ${subjects.length === 1 ? 'materia activa' : 'materias activas'}.`)}
      </Note>

      <SectionTitle>Zona delicada</SectionTitle>
      <Card>
        <Row
          icon="close-circle-outline"
          danger
          label="Eliminar mi cuenta"
          description="Disponible cuando existan las cuentas en línea"
          onPress={handleDeleteAccount}
        />
      </Card>
      <Note icon="lock-closed-outline">
        Para borrar lo que Fox guarda en este teléfono, ve a Privacidad y datos.
      </Note>

      <PromptModal
        visible={editing === 'name'}
        title="¿Cómo te llamas?"
        description="Así te saludará Foxy en la pantalla de inicio."
        placeholder="Tu nombre"
        initialValue={userName}
        maxLength={24}
        onCancel={() => setEditing(null)}
        onSave={handleSave}
      />

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
    </ScreenShell>
  );
}
