import { useCallback, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';

import { daysUntil, localDay, MONTH_NAMES } from '@/hooks/use-agenda';
import { usePersistentState } from '@/hooks/use-persistent-state';

export const STUDY_PLANS_KEY = 'foxy:study-plans';

export type LessonKind = 'intro' | 'practica' | 'quiz' | 'reto';

export const LESSON_KIND_META: Record<
  LessonKind,
  { label: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  intro: { label: 'Explicación', icon: 'document-text' },
  practica: { label: 'Práctica', icon: 'create' },
  quiz: { label: 'Cuestionario', icon: 'help' },
  reto: { label: 'Reto final', icon: 'stats-chart' },
};

export type PlanMaterialKind = 'image' | 'file' | 'text';

export type PlanMaterial = {
  id: string;
  kind: PlanMaterialKind;
  name: string;
  uri?: string;
  content?: string;
  size?: number;
};

export type PlanLesson = {
  id: string;
  title: string;
  kind: LessonKind;
  level: number;
  done: boolean;
  doneAt?: string;
};

export type PlanTopic = {
  id: string;
  title: string;
  level: number;
  lessons: PlanLesson[];
};

export type StudyPlan = {
  id: string;
  title: string;
  subject: string;
  examDate: string;
  targetGrade: number;
  language: string;
  createdAt: string;
  materials: PlanMaterial[];
  topics: PlanTopic[];
  survey: string[];
  hidden?: boolean;
};

const TOPIC_TEMPLATES = [
  'Planteamiento y conceptos base',
  'Tipos de problemas y cómo reconocerlos',
  'Procedimientos paso a paso',
  'Casos prácticos resueltos',
  'Errores frecuentes en el examen',
  'Aplicaciones y ejemplos reales',
  'Integración y repaso general',
  'Preguntas tipo examen',
  'Simulacro final',
];

const LESSON_PLAN: { kind: LessonKind; level: number; title: string }[] = [
  { kind: 'intro', level: 1, title: 'Explicación guiada' },
  { kind: 'practica', level: 1, title: 'Practica lo básico' },
  { kind: 'quiz', level: 2, title: 'Cuestionario rápido' },
  { kind: 'practica', level: 2, title: 'Ejercicios mixtos' },
  { kind: 'quiz', level: 3, title: 'Preguntas de examen' },
  { kind: 'reto', level: 3, title: 'Reto de dominio' },
];

function topicCountFor(examDate: string) {
  const left = daysUntil(examDate);
  if (left <= 1) return 5;
  if (left <= 3) return 6;
  if (left <= 7) return 7;
  return TOPIC_TEMPLATES.length;
}

function buildTopics(examDate: string): PlanTopic[] {
  return TOPIC_TEMPLATES.slice(0, topicCountFor(examDate)).map((title, index) => ({
    id: `top-${index + 1}`,
    title,
    level: Math.floor(index / 3) + 1,
    lessons: LESSON_PLAN.map((lesson, lessonIndex) => ({
      id: `top-${index + 1}-les-${lessonIndex + 1}`,
      title: lesson.title,
      kind: lesson.kind,
      level: lesson.level,
      done: false,
    })),
  }));
}

export type PlanProgress = {
  lessonsDone: number;
  lessonsTotal: number;
  topicsDone: number;
  topicsTotal: number;
  ratio: number;
  percent: number;
};

export function planProgress(plan: StudyPlan): PlanProgress {
  const lessons = plan.topics.flatMap((topic) => topic.lessons);
  const lessonsDone = lessons.filter((lesson) => lesson.done).length;
  const topicsDone = plan.topics.filter((topic) => topic.lessons.every((lesson) => lesson.done)).length;
  const ratio = lessons.length === 0 ? 0 : lessonsDone / lessons.length;

  return {
    lessonsDone,
    lessonsTotal: lessons.length,
    topicsDone,
    topicsTotal: plan.topics.length,
    ratio,
    percent: Math.round(ratio * 100),
  };
}

export function topicProgress(topic: PlanTopic) {
  const done = topic.lessons.filter((lesson) => lesson.done).length;
  const ratio = topic.lessons.length === 0 ? 0 : done / topic.lessons.length;
  return { done, total: topic.lessons.length, ratio, percent: Math.round(ratio * 100) };
}

export function isTopicUnlocked(plan: StudyPlan, index: number) {
  if (index <= 0) return true;
  return plan.topics[index - 1].lessons.every((lesson) => lesson.done);
}

export function isLessonUnlocked(topic: PlanTopic, index: number) {
  if (index <= 0) return true;
  return topic.lessons[index - 1].done;
}

export function nextTopicIndex(plan: StudyPlan) {
  const index = plan.topics.findIndex((topic) => topic.lessons.some((lesson) => !lesson.done));
  return index === -1 ? plan.topics.length - 1 : index;
}

const MAX_DAILY_LESSONS = 12;

export function dailyLessonGoal(plan: StudyPlan) {
  const { lessonsDone, lessonsTotal } = planProgress(plan);
  const pending = lessonsTotal - lessonsDone;
  if (pending <= 0) return 0;

  const daysLeft = Math.max(daysUntil(plan.examDate), 1);
  return Math.min(MAX_DAILY_LESSONS, Math.max(1, Math.ceil(pending / daysLeft)));
}

export function lessonsDoneToday(plan: StudyPlan) {
  const today = localDay(new Date());
  return plan.topics
    .flatMap((topic) => topic.lessons)
    .filter((lesson) => lesson.doneAt && localDay(new Date(lesson.doneAt)) === today).length;
}

export function formatExamDate(day: string) {
  const date = new Date(`${day}T00:00:00`);
  const weekdays = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  return `${weekdays[date.getDay()]}, ${date.getDate()} de ${MONTH_NAMES[date.getMonth()].toLowerCase()}`;
}

export function formatShortDate(day: string) {
  const date = new Date(`${day}T00:00:00`);
  return `${date.getDate()} ${MONTH_NAMES[date.getMonth()].toLowerCase().slice(0, 3)}`;
}

export function describeCountdown(day: string) {
  const left = daysUntil(day);
  if (left < 0) return 'ya pasó';
  if (left === 0) return 'hoy';
  if (left === 1) return 'mañana';
  return `en ${left} días`;
}

export type NewPlanInput = {
  title: string;
  subject: string;
  examDate: string;
  targetGrade: number;
  language: string;
  materials: PlanMaterial[];
  survey: string[];
};

export function useStudyPlans() {
  const [plans, setPlans, hydrated] = usePersistentState<StudyPlan[]>(STUDY_PLANS_KEY, []);

  const createPlan = useCallback(
    (input: NewPlanInput) => {
      const plan: StudyPlan = {
        ...input,
        id: `plan-${Date.now()}`,
        createdAt: new Date().toISOString(),
        topics: buildTopics(input.examDate),
      };
      setPlans((prev) => [plan, ...prev]);
      return plan;
    },
    [setPlans],
  );

  const removePlan = useCallback(
    (id: string) => setPlans((prev) => prev.filter((plan) => plan.id !== id)),
    [setPlans],
  );

  const updatePlan = useCallback(
    (id: string, update: (plan: StudyPlan) => StudyPlan) =>
      setPlans((prev) => prev.map((plan) => (plan.id === id ? update(plan) : plan))),
    [setPlans],
  );

  const completeLesson = useCallback(
    (planId: string, topicId: string, lessonId: string) =>
      updatePlan(planId, (plan) => ({
        ...plan,
        topics: plan.topics.map((topic) =>
          topic.id !== topicId
            ? topic
            : {
                ...topic,
                lessons: topic.lessons.map((lesson) =>
                  lesson.id === lessonId
                    ? { ...lesson, done: true, doneAt: new Date().toISOString() }
                    : lesson,
                ),
              },
        ),
      })),
    [updatePlan],
  );

  const addMaterials = useCallback(
    (planId: string, materials: PlanMaterial[]) =>
      updatePlan(planId, (plan) => ({ ...plan, materials: [...plan.materials, ...materials] })),
    [updatePlan],
  );

  const sorted = useMemo(
    () => [...plans].sort((a, b) => a.examDate.localeCompare(b.examDate)),
    [plans],
  );

  const today = localDay(new Date());
  const upcoming = useMemo(() => sorted.filter((plan) => plan.examDate >= today), [sorted, today]);

  return {
    plans: sorted,
    upcoming,
    hydrated,
    createPlan,
    removePlan,
    updatePlan,
    completeLesson,
    addMaterials,
  };
}

export function useStudyPlan(id?: string) {
  const store = useStudyPlans();
  const plan = useMemo(() => store.plans.find((item) => item.id === id), [store.plans, id]);
  return { ...store, plan };
}
