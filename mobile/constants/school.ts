export const SCHOOL_STAGES = [
  { value: 'primaria', label: 'Primaria', noun: 'grado', levels: ['1º', '2º', '3º', '4º', '5º', '6º'] },
  { value: 'secundaria', label: 'Secundaria', noun: 'año', levels: ['1º', '2º', '3º', '4º', '5º'] },
  { value: 'universidad', label: 'Universidad', noun: 'año', levels: ['1º', '2º', '3º', '4º', '5º'] },
] as const;

export type SchoolStage = (typeof SCHOOL_STAGES)[number]['value'];

export const GROUP_OPTIONS = ['A', 'B', 'C', 'D', 'E', 'F'];

export const SHIFTS = [
  { value: 'matutino', label: 'Matutino' },
  { value: 'vespertino', label: 'Vespertino' },
  { value: 'mixto', label: 'Mixto' },
] as const;

export type Shift = (typeof SHIFTS)[number]['value'];

export type SchoolProfile = {
  grade: string;
  shift?: Shift;
  stage?: SchoolStage;
  level?: string;
  group?: string;
};

export const DEFAULT_SCHOOL_PROFILE: SchoolProfile = {
  grade: '',
};

export function describeGrade(profile: SchoolProfile) {
  if (!profile.stage || !profile.level) return profile.grade || '';

  const stage = SCHOOL_STAGES.find((item) => item.value === profile.stage);
  if (!stage) return profile.grade || '';

  const base = `${profile.level} ${stage.noun}`;
  return profile.group ? `${base} ${profile.group}` : base;
}
