import { useCallback, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';

import { usePersistentState } from '@/hooks/use-persistent-state';

const STORAGE_KEY = 'foxy:questions';

const MAX_HISTORY = 60;

export type AnswerMode = 'respuesta' | 'pasos' | 'quiz';

export const ANSWER_MODES: {
  value: AnswerMode;
  label: string;
  hint: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { value: 'pasos', label: 'Paso a paso', hint: 'Foxy resuelve explicando cada paso', icon: 'footsteps-outline' },
  { value: 'respuesta', label: 'Solo la respuesta', hint: 'Directo al resultado', icon: 'flash-outline' },
  { value: 'quiz', label: 'Pregúntame', hint: 'Foxy te guía con preguntas', icon: 'help-circle-outline' },
];

export type AskedQuestion = {
  id: string;
  text: string;
  subject: string;
  mode: AnswerMode;
  images: number;
  files: number;
  at: string;
  saved: boolean;
};

export type PendingQuestion = { text: string; subject: string } | null;

export function usePendingQuestion() {
  return usePersistentState<PendingQuestion>('foxy:pending-question', null);
}

export function useQuestionHistory() {
  const [questions, setQuestions, hydrated] = usePersistentState<AskedQuestion[]>(STORAGE_KEY, []);

  const addQuestion = useCallback(
    (question: Omit<AskedQuestion, 'id' | 'at' | 'saved'>) => {
      const entry: AskedQuestion = {
        ...question,
        id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        at: new Date().toISOString(),
        saved: false,
      };

      setQuestions((prev) => {
        const next = [entry, ...prev];
        if (next.length <= MAX_HISTORY) return next;

        const kept: AskedQuestion[] = [];
        let plain = 0;
        next.forEach((item) => {
          if (item.saved) {
            kept.push(item);
            return;
          }
          if (plain < MAX_HISTORY) {
            kept.push(item);
            plain += 1;
          }
        });
        return kept;
      });

      return entry;
    },
    [setQuestions],
  );

  const toggleSaved = useCallback(
    (id: string) =>
      setQuestions((prev) =>
        prev.map((item) => (item.id === id ? { ...item, saved: !item.saved } : item)),
      ),
    [setQuestions],
  );

  const removeQuestion = useCallback(
    (id: string) => setQuestions((prev) => prev.filter((item) => item.id !== id)),
    [setQuestions],
  );

  const clearUnsaved = useCallback(
    () => setQuestions((prev) => prev.filter((item) => item.saved)),
    [setQuestions],
  );

  const saved = useMemo(() => questions.filter((item) => item.saved), [questions]);

  return { questions, saved, addQuestion, toggleSaved, removeQuestion, clearUnsaved, hydrated };
}
