import { useCallback } from 'react';

import { usePersistentState } from '@/hooks/use-persistent-state';

export const CHAT_KEY = 'foxy:chat';

const MAX_MESSAGES = 200;

export type ChatAttachment = {
  kind: 'image' | 'file';
  name: string;
  uri: string;
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'foxy';
  text: string;
  subject: string;
  at: string;
  attachments?: ChatAttachment[];
};

const REPLIES = [
  (subject: string) =>
    `Ya tengo tu pregunta de ${subject}. Todavía no estoy conectado a la IA, así que aún no puedo resolverla: en cuanto lo esté, te la explico paso a paso aquí mismo.`,
  (subject: string) =>
    `Apuntado en ${subject}. Me falta la conexión con la IA para responderte de verdad; mientras tanto queda guardado en tus preguntas para no perderlo.`,
  (subject: string) =>
    `Recibido. Cuando conectemos la IA, esto de ${subject} será lo primero que trabajemos: te daré la explicación y ejercicios para practicar.`,
];

function replyFor(subject: string, attachments: number, index: number) {
  const base = REPLIES[index % REPLIES.length](subject);
  if (attachments === 0) return base;

  const noun = attachments === 1 ? 'el archivo' : `los ${attachments} archivos`;
  return `${base}\n\nTambién guardé ${noun} que me enviaste.`;
}

export function useChat() {
  const [messages, setMessages, hydrated] = usePersistentState<ChatMessage[]>(CHAT_KEY, []);

  const send = useCallback(
    (text: string, subject: string, attachments: ChatAttachment[] = []) => {
      const now = Date.now();

      const question: ChatMessage = {
        id: `msg-${now}`,
        role: 'user',
        text,
        subject,
        at: new Date(now).toISOString(),
        attachments: attachments.length > 0 ? attachments : undefined,
      };

      setMessages((prev) => [...prev, question].slice(-MAX_MESSAGES));
      return question;
    },
    [setMessages],
  );

  const answer = useCallback(
    (subject: string, attachments: number) => {
      setMessages((prev) => {
        const previousAnswers = prev.filter((message) => message.role === 'foxy').length;
        const reply: ChatMessage = {
          id: `msg-${Date.now()}-foxy`,
          role: 'foxy',
          text: replyFor(subject, attachments, previousAnswers),
          subject,
          at: new Date().toISOString(),
        };
        return [...prev, reply].slice(-MAX_MESSAGES);
      });
    },
    [setMessages],
  );

  const clear = useCallback(() => setMessages([]), [setMessages]);

  return { messages, hydrated, send, answer, clear };
}
