import { useCallback, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';

import { usePersistentState } from '@/hooks/use-persistent-state';

const STORAGE_KEY = 'foxy:questions';

/** Preguntas que se conservan. Las guardadas nunca se descartan. */
const MAX_HISTORY = 60;

/**
 * Cómo quiere el usuario que Foxy responda. Es lo que ofrecen las apps de
 * este tipo: la respuesta directa, el procedimiento, o que te pregunte a ti.
 */
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
  /** ISO. */
  at: string;
  /** Marcada por el usuario para no perderla. */
  saved: boolean;
};

export type PendingQuestion = { text: string; subject: string } | null;

/**
 * Pregunta que el historial deja lista para reenviar.
 *
 * Se usa estado compartido en vez de parámetros de navegación: al navegar a
 * la pestaña con parámetros, el navegador apilaba una segunda pantalla de
 * Preguntar y el botón atrás llevaba a un inicio duplicado.
 */
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
        // El recorte respeta las guardadas: se descartan solo las sueltas.
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

  /** Borra el historial pero conserva lo que el usuario marcó como guardado. */
  const clearUnsaved = useCallback(
    () => setQuestions((prev) => prev.filter((item) => item.saved)),
    [setQuestions],
  );

  const saved = useMemo(() => questions.filter((item) => item.saved), [questions]);

  return { questions, saved, addQuestion, toggleSaved, removeQuestion, clearUnsaved, hydrated };
}
